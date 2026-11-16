const CACHE = "hark-v13";

const PRECACHE = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./hymn-model.js",
  "./install.js",
  "./config/requests.js",
  "./vendor/abcjs-basic-min.js",
  "./data/music.json",
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
  "./icons/hark-qr.svg",
  "./data/music/ADESTE_FIDELES.abc",
  "./data/music/CAROL.abc",
  "./data/music/DIVINUM_MYSTERIUM.abc",
  "./data/music/DIX.abc",
  "./data/music/ES_IST_EIN_ROS_ENTSPRUNGEN.abc",
  "./data/music/GOD_REST_YOU_MERRY.abc",
  "./data/music/HYFRYDOL.abc",
  "./data/music/MUELLER.abc",
  "./data/music/PICARDY.abc",
  "./data/music/REGENT_SQUARE.abc",
  "./data/music/SEE_AMID_THE_WINTERS_SNOW.abc",
  "./data/music/TALLIS_CANON.abc",
  "./data/music/TEMPUS_ADEST_FLORIDUM.abc",
  "./data/music/THIRSTING.abc",
  "./data/music/VENI_EMMANUEL.abc",
  "./data/music/VON_HIMMEL_HOCH.abc",
  "./data/music/WARUM_SOLLT_ICH_MICH_DENN_GRAMEN.abc",
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
