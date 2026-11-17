// Creates a public GitHub issue for each hymn comment or request, then adds a reply.
// Also stores web push subscriptions and sends a notice when hymns are added.
// Secrets: GITHUB_TOKEN, TURNSTILE_SECRET, VAPID_PRIVATE_JWK, PUSH_NOTIFY_SECRET
// Vars: REPO, LABEL, ALLOWED_ORIGIN, VAPID_PUBLIC_KEY, VAPID_SUBJECT
// Bindings: RATE_LIMIT (optional), PUSH_SUBSCRIPTIONS (push subscriptions only)

import { handleNotify, handleSubscribe, handleUnsubscribe } from "./push-routes.js";

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const MEMORY_KEYS = 5000;

const hits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Hark is served from more than one host: the custom domain, and the old
// github.io address that redirects to it. A single allow-origin header cannot
// name a list, so the matching origin is echoed back instead. The vary header
// below is what keeps a cache from handing one site's header to the other.
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function cors(response, env, request) {
  const headers = new Headers(response.headers);
  const allowed = allowedOrigins(env);
  const sent = request && request.headers.get("origin");
  let origin;
  if (allowed.includes("*")) origin = "*";
  else if (sent && allowed.includes(sent)) origin = sent;
  else origin = allowed[0] || "*";
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function originAllowed(request, env) {
  const allowed = allowedOrigins(env);
  if (allowed.includes("*")) return true;
  const origin = request.headers.get("origin");
  // A browser always sends Origin on a cross site POST, so a post without one
  // did not come from the form. Reading the list stays open to anything.
  if (!origin) return request.method !== "POST";
  return allowed.includes(origin);
}

function plainText(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function commentView(comment) {
  const login = comment && comment.user && comment.user.login ? comment.user.login : "";
  return {
    author: plainText(login),
    body: plainText(comment && comment.body),
    created_at: comment && comment.created_at ? comment.created_at : "",
  };
}

function issueView(issue, comments) {
  return {
    number: issue.number,
    title: plainText(issue.title),
    created_at: issue.created_at || "",
    html_url: typeof issue.html_url === "string" ? issue.html_url : "",
    body: plainText(issue.body),
    comments: Array.isArray(comments) ? comments.map(commentView) : [],
  };
}

async function loadIssueList(env) {
  const repo = env.REPO || "netpaddler/hark";
  const label = env.LABEL || "hymn-request";
  const listed = await github(
    env,
    `/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=20`,
  );
  if (!listed.ok) return null;
  const raw = await listed.json();
  const issues = (Array.isArray(raw) ? raw : []).filter((item) => item && !item.pull_request);
  const comments = await Promise.all(
    issues.map(async (issue) => {
      if (!issue.comments) return [];
      const reply = await github(env, `/repos/${repo}/issues/${issue.number}/comments`);
      if (!reply.ok) return [];
      const data = await reply.json();
      return Array.isArray(data) ? data : [];
    }),
  );
  return issues.map((issue, index) => issueView(issue, comments[index]));
}

async function cachedIssueList(env) {
  const cache = caches.default;
  const key = new Request("https://hark.internal/hymn-requests");
  const hit = await cache.match(key);
  if (hit) return hit;
  if (!env.GITHUB_TOKEN) return json({ error: "Requests are not open yet." }, 503);
  const list = await loadIssueList(env);
  if (!list) return json({ error: "The list did not load." }, 502);
  const response = new Response(JSON.stringify(list), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
  await cache.put(key, response.clone());
  return response;
}

function recentTimes(times, now) {
  return (Array.isArray(times) ? times : []).filter(
    (time) => Number.isFinite(time) && now - time < WINDOW_MS,
  );
}

// One isolate's own count, so this is a speed bump rather than a limit. It is
// what runs until a KV namespace is bound as RATE_LIMIT. Quiet addresses are
// swept out so a long lived isolate does not hold every caller it ever saw.
function allowInMemory(ip, now) {
  if (hits.size > MEMORY_KEYS) {
    for (const [key, times] of hits) {
      if (!recentTimes(times, now).length) hits.delete(key);
    }
  }
  const recent = recentTimes(hits.get(ip), now);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

// Shared by every isolate, so the count is the real one. A KV read can lag a
// moment behind a write, which at five an hour is not worth more machinery.
async function allowInStore(store, ip, now) {
  const key = `rate:${ip}`;
  let saved;
  try {
    saved = JSON.parse((await store.get(key)) || "[]");
  } catch {
    saved = [];
  }
  const recent = recentTimes(saved, now);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  await store.put(key, JSON.stringify(recent), { expirationTtl: WINDOW_MS / 1000 });
  return true;
}

async function allow(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  if (env.RATE_LIMIT) {
    try {
      return await allowInStore(env.RATE_LIMIT, ip, now);
    } catch {
      /* KV is unreachable, so fall back to this isolate's own count */
    }
  }
  return allowInMemory(ip, now);
}

// Answers "ok", "failed" or "unconfigured". A missing secret used to pass the
// check, which left the form an open door: anything able to post JSON could
// open issues on the repo under any name. A form that is briefly closed is the
// better failure, and "unconfigured" is what tells the caller to stop retrying.
async function turnstileCheck(token, request, env) {
  if (!env.TURNSTILE_SECRET) return "unconfigured";
  if (!token) return "failed";
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!response.ok) return "failed";
    const data = await response.json();
    return data.success === true ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "user-agent": "hark-requests",
      "x-github-api-version": "2022-11-28",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function ensureLabel(env) {
  const repo = env.REPO || "netpaddler/hark";
  const label = env.LABEL || "hymn-request";
  const existing = await github(env, `/repos/${repo}/labels/${encodeURIComponent(label)}`);
  if (existing.ok) return;
  await github(env, `/repos/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: label,
      color: "6f2c2c",
      description: "Comment or hymn request from the Hark site",
    }),
  });
}

// Same window as hymn requests, but a separate counter, so turning on
// notifications does not use up the five comments allowed in an hour.
async function allowPush(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  if (env.RATE_LIMIT) {
    try {
      const key = `push-rate:${ip}`;
      let saved;
      try {
        saved = JSON.parse((await env.RATE_LIMIT.get(key)) || "[]");
      } catch {
        saved = [];
      }
      const recent = recentTimes(saved, now);
      if (recent.length >= LIMIT) return false;
      recent.push(now);
      await env.RATE_LIMIT.put(key, JSON.stringify(recent), { expirationTtl: WINDOW_MS / 1000 });
      return true;
    } catch {
      /* KV is unreachable, so fall back to this isolate's own count */
    }
  }
  return allowInMemory(`push:${ip}`, now);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // GitHub Actions calls this with a bearer secret and no browser Origin.
    if (url.pathname === "/notify") return handleNotify(request, env);
    if (!originAllowed(request, env)) return json({ error: "This origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env, request);
    if (url.pathname === "/subscribe" || url.pathname === "/unsubscribe") {
      if (request.method !== "POST") return cors(json({ error: "Send a POST request." }, 405), env, request);
      if (!(await allowPush(request, env))) {
        return cors(json({ error: "Please wait a while, then try again." }, 429), env, request);
      }
      const response = url.pathname === "/subscribe"
        ? await handleSubscribe(request, env)
        : await handleUnsubscribe(request, env);
      return cors(response, env, request);
    }
    if (request.method === "GET") return cors(await cachedIssueList(env), env, request);
    if (request.method !== "POST") return cors(json({ error: "Send a POST request." }, 405), env, request);
    let payload;
    try {
      payload = await request.json();
    } catch {
      return cors(json({ error: "The form could not be read." }, 400), env, request);
    }
    if (clip(payload.company, 200)) return cors(json({ ok: true }), env, request);
    const message = clip(payload.message, 2000);
    const name = clip(payload.name, 80);
    const hymn = clip(payload.hymn, 120);
    if (!message) return cors(json({ error: "Write a comment or a hymn request." }, 400), env, request);
    // The cheap count first, so a flood cannot make the Worker call Cloudflare
    // once per request on its way to being turned away.
    if (!(await allow(request, env))) {
      return cors(json({ error: "Please wait a while, then try again." }, 429), env, request);
    }
    const check = await turnstileCheck(payload.turnstile, request, env);
    if (check === "unconfigured") {
      return cors(json({ error: "Requests are not open yet." }, 503), env, request);
    }
    if (check !== "ok") return cors(json({ error: "The check failed. Try again." }, 400), env, request);
    if (!env.GITHUB_TOKEN) return cors(json({ error: "Requests are not open yet." }, 503), env, request);

    const repo = env.REPO || "netpaddler/hark";
    const label = env.LABEL || "hymn-request";
    await ensureLabel(env);
    const title = (hymn ? `Hymn request: ${hymn}` : `Comment: ${message}`).slice(0, 120);
    const body = [`Name: ${name || "Not given"}`, `Hymn: ${hymn || "Not given"}`, "", message].join("\n");
    const created = await github(env, `/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body, labels: [label] }),
    });
    if (!created.ok) return cors(json({ error: "The request did not go through." }, 502), env, request);
    const issue = await created.json();
    await github(env, `/repos/${repo}/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Thanks for writing! Hark will reply here soon.",
      }),
    });
    return cors(json({ ok: true, url: issue.html_url }), env, request);
  },
};
