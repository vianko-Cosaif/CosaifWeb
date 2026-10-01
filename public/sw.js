const CACHE_VERSION = "cosaif-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;
const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/cosaif-192.png",
  "/icons/cosaif-512.png",
  "/cosaif-logo.png",
  "/sounds/notification.mp3",
];
const BYPASS_PREFIXES = [
  "/api/",
  "/bff/",
  "/socket.io/",
  "/_next/webpack-hmr",
  "/_next/static/webpack/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("cosaif-pwa-") && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (BYPASS_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix))) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (isStaticAsset(requestUrl)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/sounds/") ||
    /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff2?)$/i.test(url.pathname)
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match("/offline.html");
    return offline || new Response("Sin conexion", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => cached || new Response("", { status: 503, statusText: "Offline" }));

  return cached || network;
}
