// Anonymous listening counts. Nothing here may throw into playback.

const VISITOR_KEY = "hark-visitor";
const SESSION_KEY = "hark-session";
export const LISTEN_URL = "https://hark-requests.netpaddler.workers.dev/listen";

// Global Privacy Control is the one browser signal that turns counting off.
// It is a legal opt out in California and other states, so it is honored for
// both these counts and Google Analytics. Do Not Track is deliberately not
// checked: it was never legally binding and most browsers have dropped it.
export function trackingOff(nav = globalThis.navigator) {
  try {
    if (nav && nav.globalPrivacyControl === true) return true;
  } catch {
    return true;
  }
  return false;
}

function randomId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function storedId(store, key) {
  const current = store.getItem(key);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const next = randomId();
  store.setItem(key, next);
  return next;
}

export function listenIdentity() {
  return {
    visitor: storedId(localStorage, VISITOR_KEY),
    session: storedId(sessionStorage, SESSION_KEY),
  };
}

export function sendListen(event) {
  try {
    if (trackingOff()) return;
    const identity = listenIdentity();
    const body = JSON.stringify({
      visitor: identity.visitor,
      session: identity.session,
      type: event.type,
      hymn: Number.isInteger(event.hymn) ? event.hymn : null,
      path: typeof event.path === "string" ? event.path.slice(0, 200) : "",
    });
    const blob = new Blob([body], { type: "text/plain" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(LISTEN_URL, blob)) return;
    fetch(LISTEN_URL, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  } catch {
    /* counting must never affect playback */
  }
}
