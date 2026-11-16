const CACHE = "hark-v5";

const PRECACHE = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./hymn-model.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./data/hymns.json",
  "./data/recordings.json",
  "./data/themes.json",
  "./data/sins.json",
  "./data/sermons.json",
  "./fonts/newsreader-400.woff2",
  "./fonts/newsreader-400-italic.woff2",
  "./fonts/newsreader-600.woff2",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await refresh;
  if (fresh) return fresh;
  if (request.mode === "navigate") {
    const shell = await cache.match("./index.html");
    if (shell) return shell;
  }
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
