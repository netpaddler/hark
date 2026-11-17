import { pushNotice } from "./push-notice.js";
import { base64UrlToBytes, importVapidPrivateKey, sendPush } from "./webpush.js";

const PUSH_BATCH = 40;
const encoder = new TextEncoder();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeEqual(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function bearer(request) {
  const match = /^Bearer\s+(\S+)$/.exec(request.headers.get("authorization") || "");
  return match ? match[1] : "";
}

export function subscriptionRecord(payload) {
  if (!payload || typeof payload !== "object") return null;
  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000) return null;
  const keys = payload.keys;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  try {
    if (base64UrlToBytes(keys.p256dh).length !== 65) return null;
    if (base64UrlToBytes(keys.auth).length < 16) return null;
  } catch {
    return null;
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function subscriptionId(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(endpoint));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readEntry(payload) {
  if (!payload || !Array.isArray(payload.hymns) || payload.hymns.length === 0 || payload.hymns.length > 80) {
    return null;
  }
  if (!payload.hymns.every((number) => Number.isInteger(number) && number > 0 && number < 10000)) return null;
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 240) : "";
  const date = typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : "";
  return { date, hymns: payload.hymns, note };
}

async function listPage(store, cursor) {
  const page = await store.list({ cursor: cursor || undefined, limit: PUSH_BATCH });
  const items = [];
  for (const key of page.keys || []) {
    const raw = await store.get(key.name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (value && typeof value.endpoint === "string" && value.keys) items.push({ id: key.name, value });
    } catch {
      /* a bad row is skipped, not fatal */
    }
  }
  const done = page.list_complete !== false && !page.cursor;
  return { items, cursor: done ? "" : page.cursor || "", done };
}

export async function handleSubscribe(request, env) {
  if (!env.PUSH_SUBSCRIPTIONS) return json({ error: "Notifications are not open yet." }, 503);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "The subscription could not be read." }, 400);
  }
  const record = subscriptionRecord(payload);
  if (!record) return json({ error: "That is not a push subscription." }, 400);
  const id = await subscriptionId(record.endpoint);
  await env.PUSH_SUBSCRIPTIONS.put(
    id,
    JSON.stringify({ ...record, saved: new Date().toISOString() }),
  );
  return json({ ok: true });
}

export async function handleUnsubscribe(request, env) {
  if (!env.PUSH_SUBSCRIPTIONS) return json({ error: "Notifications are not open yet." }, 503);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "The subscription could not be read." }, 400);
  }
  const endpoint = payload && typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  if (!/^https:\/\//.test(endpoint)) return json({ error: "That is not a push subscription." }, 400);
  await env.PUSH_SUBSCRIPTIONS.delete(await subscriptionId(endpoint));
  return json({ ok: true });
}

export async function handleNotify(request, env) {
  if (request.method !== "POST") return json({ error: "Send a POST request." }, 405);
  if (!env.PUSH_NOTIFY_SECRET || !env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY || !env.PUSH_SUBSCRIPTIONS) {
    return json({ error: "Notifications are not open yet." }, 503);
  }
  if (!safeEqual(bearer(request), env.PUSH_NOTIFY_SECRET)) {
    return json({ error: "The notify secret did not match." }, 401);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "The notice could not be read." }, 400);
  }
  const entry = readEntry(payload);
  if (!entry) return json({ error: "Name the hymns that were added." }, 400);
  const message = JSON.stringify({
    title: "Hark",
    body: pushNotice(entry),
    url: "/#/whats-new",
  });
  let privateKey;
  let publicBytes;
  try {
    privateKey = await importVapidPrivateKey(env.VAPID_PRIVATE_JWK);
    publicBytes = base64UrlToBytes(env.VAPID_PUBLIC_KEY);
  } catch {
    return json({ error: "Notifications are not open yet." }, 503);
  }
  const subject = env.VAPID_SUBJECT || "mailto:netpaddler@gmail.com";
  const page = await listPage(env.PUSH_SUBSCRIPTIONS, typeof payload.cursor === "string" ? payload.cursor : "");
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const item of page.items) {
    try {
      const response = await sendPush({
        subscription: item.value,
        payload: message,
        privateKey,
        publicBytes,
        subject,
      });
      if (response.status === 404 || response.status === 410) {
        await env.PUSH_SUBSCRIPTIONS.delete(item.id);
        removed += 1;
      } else if (response.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return json({ ok: true, sent, removed, failed, cursor: page.cursor, done: page.done });
}
