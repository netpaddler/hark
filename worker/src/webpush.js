// Web Push as a Worker can send it: VAPID (ES256) and aes128gcm (RFC 8291).
// The private key never leaves the Worker. This file has no hymn text.

const RECORD_SIZE = 4096;
const text = new TextEncoder();

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  const pad = (4 - (value.length % 4)) % 4;
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export async function importVapidPrivateKey(jwkText) {
  const jwk = typeof jwkText === "string" ? JSON.parse(jwkText) : jwkText;
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function vapidAuthorization({ endpoint, privateKey, publicBytes, subject, exp }) {
  const aud = new URL(endpoint).origin;
  const expires = exp || Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = bytesToBase64Url(text.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToBase64Url(text.encode(JSON.stringify({ aud, exp: expires, sub: subject })));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, text.encode(`${header}.${payload}`)),
  );
  return `vapid t=${header}.${payload}.${bytesToBase64Url(signature)}, k=${bytesToBase64Url(publicBytes)}`;
}

// One record is enough for a short notice. The header carries the salt and
// the ephemeral public key, which is what aes128gcm receivers expect.
export async function encryptPayload(payload, userPublicBytes, userAuthBytes) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const userKey = await crypto.subtle.importKey(
    "raw",
    userPublicBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: userKey }, local.privateKey, 256),
  );
  const info = concat(text.encode("WebPush: info\0"), userPublicBytes, localPublic);
  const ikm = await hkdf(userAuthBytes, shared, info, 32);
  const keyBytes = await hkdf(salt, ikm, text.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text.encode("Content-Encoding: nonce\0"), 12);
  const plaintext = concat(typeof payload === "string" ? text.encode(payload) : payload, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plaintext));
  const header = new Uint8Array(21 + localPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = localPublic.length;
  header.set(localPublic, 21);
  return concat(header, cipher);
}

// Used by tests to prove the ciphertext is the record a push service can open.
export async function decryptPayload(body, userPrivateKey, userPublicBytes, userAuthBytes) {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const senderPublic = body.slice(21, 21 + idLength);
  const cipher = body.slice(21 + idLength);
  const senderKey = await crypto.subtle.importKey(
    "raw",
    senderPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, userPrivateKey, 256),
  );
  const info = concat(text.encode("WebPush: info\0"), userPublicBytes, senderPublic);
  const ikm = await hkdf(userAuthBytes, shared, info, 32);
  const keyBytes = await hkdf(salt, ikm, text.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cipher));
  let end = plain.length;
  while (end > 0 && plain[end - 1] === 0) end -= 1;
  if (end === 0 || plain[end - 1] !== 2) throw new Error("bad padding");
  return plain.slice(0, end - 1);
}

export async function sendPush({ subscription, payload, privateKey, publicBytes, subject }) {
  const body = await encryptPayload(
    payload,
    base64UrlToBytes(subscription.keys.p256dh),
    base64UrlToBytes(subscription.keys.auth),
  );
  const authorization = await vapidAuthorization({
    endpoint: subscription.endpoint,
    privateKey,
    publicBytes,
    subject,
  });
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
    },
    body,
  });
}
