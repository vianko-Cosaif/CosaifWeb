self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match("/login").then((cached) => {
          return cached || new Response("Sin conexion", { status: 503, statusText: "Offline" });
        });
      }
      return new Response("", { status: 503, statusText: "Offline" });
    })
  );
});
