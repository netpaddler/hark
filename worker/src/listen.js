// Anonymous listening events. The IP is used only for this isolate's rate
// limit and is not written to D1 or KV.

const LISTEN_LIMIT = 120;
const LISTEN_WINDOW_MS = 10 * 60 * 1000;
const ORIGIN = "https://hark.theweightofglory.com";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["page", "play", "beat"]);

const visitorHits = new Map();
const ipHits = new Map();

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin || ORIGIN,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function json(body, status, origin) {
  const headers = corsHeaders(origin);
  // 204, 205, and 304 cannot carry a body. A JSON body on 204 crashes the Worker.
  if (status === 204 || status === 205 || status === 304) {
    return new Response(null, { status, headers });
  }
  headers["content-type"] = "application/json; charset=utf-8";
  return new Response(JSON.stringify(body), { status, headers });
}

function recent(list, now) {
  return list.filter((time) => now - time < LISTEN_WINDOW_MS);
}

function allowKey(map, key, now) {
  const kept = recent(map.get(key) || [], now);
  if (kept.length >= LISTEN_LIMIT) {
    map.set(key, kept);
    return false;
  }
  kept.push(now);
  map.set(key, kept);
  if (map.size > 5000) {
    const first = map.keys().next().value;
    map.delete(first);
  }
  return true;
}

export function allowListen(visitor, ip, now = Date.now()) {
  if (!allowKey(visitorHits, `v:${visitor}`, now)) return false;
  if (!allowKey(ipHits, `i:${ip || "unknown"}`, now)) return false;
  return true;
}

function dayStamp(now) {
  return new Date(now).toISOString().slice(0, 10);
}

export function readListen(payload) {
  if (!payload || typeof payload !== "object") return null;
  const visitor = typeof payload.visitor === "string" ? payload.visitor : "";
  const session = typeof payload.session === "string" ? payload.session : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  if (!ID.test(visitor) || !ID.test(session) || !TYPES.has(type)) return null;
  let hymn = null;
  if (payload.hymn != null && payload.hymn !== "") {
    const number = Number(payload.hymn);
    if (!Number.isInteger(number) || number < 1 || number > 999) return null;
    hymn = number;
  }
  const path = typeof payload.path === "string" ? payload.path.slice(0, 200) : "";
  return { visitor, session, type, hymn, path };
}

export function summarizeEvents(rows) {
  const days = new Map();
  const allSessions = new Map();
  const empty = () => ({
    visitors: new Set(),
    sessions: new Set(),
    minutes: 0,
    listening: new Map(),
    hymns: new Map(),
  });
  const total = empty();
  const add = (bucket, row) => {
    bucket.visitors.add(row.visitor);
    bucket.sessions.add(row.session);
    if (row.type === "beat") {
      bucket.minutes += 1;
      bucket.listening.set(row.session, (bucket.listening.get(row.session) || 0) + 1);
    }
    if ((row.type === "play" || row.type === "beat") && Number.isInteger(row.hymn)) {
      bucket.hymns.set(row.hymn, (bucket.hymns.get(row.hymn) || 0) + 1);
    }
  };
  for (const row of rows || []) {
    if (!row || !row.day || !row.visitor || !row.session) continue;
    if (!days.has(row.day)) days.set(row.day, empty());
    add(days.get(row.day), row);
    add(total, row);
    allSessions.set(row.session, true);
  }
  const pack = (bucket) => {
    const lengths = [...bucket.listening.values()];
    const longest = lengths.length ? Math.max(...lengths) : 0;
    const average = lengths.length ? Math.round((bucket.minutes / lengths.length) * 10) / 10 : 0;
    const longSessions = lengths.filter((minutes) => minutes >= 60).length;
    const hymns = [...bucket.hymns.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
    return {
      visitors: bucket.visitors.size,
      sessions: bucket.sessions.size,
      minutes: bucket.minutes,
      average,
      longest,
      longSessions,
      hymns,
    };
  };
  return {
    total: pack(total),
    days: [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, bucket]) => ({ day, ...pack(bucket) })),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statBlock(stats) {
  const hymns = stats.hymns.length
    ? stats.hymns.map(([number, count]) => `<li>Hymn ${number}: ${count}</li>`).join("")
    : "<li>None yet</li>";
  return `<ul>
    <li>Unique visitors: ${stats.visitors}</li>
    <li>Sessions: ${stats.sessions}</li>
    <li>Listening minutes: ${stats.minutes}</li>
    <li>Average listening session: ${stats.average} minutes</li>
    <li>Longest listening session: ${stats.longest} minutes</li>
    <li>Sessions over 1 hour: ${stats.longSessions}</li>
  </ul>
  <p>Top hymns</p>
  <ul>${hymns}</ul>`;
}

export function renderStats(summary) {
  const days = summary.days
    .map((day) => `<section><h2>${escapeHtml(day.day)}</h2>${statBlock(day)}</section>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Hark listening</title></head>
<body>
  <h1>Hark listening</h1>
  <section><h2>Totals</h2>${statBlock(summary.total)}</section>
  ${days || "<p>No events yet.</p>"}
</body>
</html>`;
}

function sameKey(given, secret) {
  const a = String(given || "");
  const b = String(secret || "");
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleListen(request, env) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (origin !== ORIGIN) return json({ error: "This origin is not allowed." }, 403, ORIGIN);
    return json(null, 204, ORIGIN);
  }
  if (request.method !== "POST") return json({ error: "Send a POST request." }, 405, ORIGIN);
  if (origin !== ORIGIN) return json({ error: "This origin is not allowed." }, 403, ORIGIN);
  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json({ error: "The event could not be read." }, 400, ORIGIN);
  }
  const event = readListen(payload);
  if (!event) return json({ error: "The event could not be read." }, 400, ORIGIN);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!allowListen(event.visitor, ip)) return json({ error: "Please wait a while, then try again." }, 429, ORIGIN);
  if (!env.LISTEN) return json({ error: "Listening stats are not open yet." }, 503, ORIGIN);
  const now = Date.now();
  await env.LISTEN.prepare(
    "INSERT INTO events (day, visitor, session, type, hymn, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(dayStamp(now), event.visitor, event.session, event.type, event.hymn, event.path, now)
    .run();
  return json({ ok: true }, 200, ORIGIN);
}

export async function handleStats(request, env) {
  if (request.method !== "GET") return new Response("Send a GET request.", { status: 405 });
  if (!env.LISTEN_STATS_KEY) {
    return new Response("Stats are not open yet.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!sameKey(key, env.LISTEN_STATS_KEY)) return new Response("Not found.", { status: 404 });
  if (!env.LISTEN) {
    return new Response("Stats are not open yet.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const listed = await env.LISTEN.prepare("SELECT day, visitor, session, type, hymn FROM events").bind().all();
  const html = renderStats(summarizeEvents(listed.results || []));
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
