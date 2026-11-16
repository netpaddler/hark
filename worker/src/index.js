// Creates a public GitHub issue for each hymn comment or request, then adds a reply.
// Secrets: GITHUB_TOKEN, TURNSTILE_SECRET
// Vars: REPO, LABEL, ALLOWED_ORIGIN

const hits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cors(response, env) {
  const headers = new Headers(response.headers);
  const origin = env.ALLOWED_ORIGIN || "*";
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function allow(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

async function turnstileOk(token, request, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success === true;
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
    if (request.method !== "POST") return cors(json({ error: "Send a POST request." }, 405), env);
    let payload;
    try {
      payload = await request.json();
    } catch {
      return cors(json({ error: "The form could not be read." }, 400), env);
    }
    if (clip(payload.company, 200)) return cors(json({ ok: true }), env);
    const message = clip(payload.message, 2000);
    const name = clip(payload.name, 80);
    const hymn = clip(payload.hymn, 120);
    if (!message) return cors(json({ error: "Write a comment or a hymn request." }, 400), env);
    if (!(await turnstileOk(payload.turnstile, request, env))) {
      return cors(json({ error: "The check failed. Try again." }, 400), env);
    }
    if (!allow(request)) return cors(json({ error: "Please wait a while, then try again." }, 429), env);
    if (!env.GITHUB_TOKEN) return cors(json({ error: "Requests are not open yet." }, 503), env);

    const repo = env.REPO || "netpaddler/hark";
    const label = env.LABEL || "hymn-request";
    await ensureLabel(env);
    const title = (hymn ? `Hymn request: ${hymn}` : `Comment: ${message}`).slice(0, 120);
    const body = [`Name: ${name || "Not given"}`, `Hymn: ${hymn || "Not given"}`, "", message].join("\n");
    const created = await github(env, `/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body, labels: [label] }),
    });
    if (!created.ok) return cors(json({ error: "The request did not go through." }, 502), env);
    const issue = await created.json();
    await github(env, `/repos/${repo}/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Thanks for writing. Hymn requests are limited to the Trinity Hymnal.",
      }),
    });
    return cors(json({ ok: true, url: issue.html_url }), env);
  },
};
