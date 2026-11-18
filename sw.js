const CACHE = "hark-v51";

// vendor/abcjs-basic-min.js is deliberately absent. It is close to half a
// megabyte, and precaching it meant every first visit paid for music the
// reader may never open. The fetch handler below caches it the first time
// someone does, and it stays available offline from then on.
const PRECACHE = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./hymn-model.js",
  "./playlist.js",
  "./listen.js",
  "./ga.js",
  "./config/analytics.js",
  "./stage.js",
  "./install.js",
  "./welcome.js",
  "./likes.js",
  "./changelog.js",
  "./config/requests.js",
  "./config/push.js",
  "./data/music.json",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./data/hymns.json",
  "./data/changelog.json",
  "./feed.xml",
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
  "./data/music/THIRSTING.abc",
  "./data/music/VENI_EMMANUEL.abc",
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

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Hark";
  const body = typeof data.body === "string" && data.body ? data.body : "New hymns were added.";
  const url = typeof data.url === "string" && data.url ? data.url : "/#/whats-new";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/favicon-32.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/#/whats-new",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if (client.navigate) return client.navigate(target).then((next) => (next || client).focus());
        return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

function isAppModule(url, request) {
  if (request.mode === "navigate") return true;
  return /\.(?:html|js|mjs|css)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  // Analytics hosts answer for themselves. Do not cache or intercept them.
  if (
    url.hostname === "static.cloudflareinsights.com" ||
    url.hostname === "cloudflareinsights.com" ||
    url.hostname.endsWith(".cloudflareinsights.com") ||
    url.hostname === "www.googletagmanager.com" ||
    url.hostname === "www.google-analytics.com" ||
    url.hostname === "analytics.google.com"
  ) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(isAppModule(url, request) ? networkFirst(request) : staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

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
