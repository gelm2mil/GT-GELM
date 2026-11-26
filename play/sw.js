const CACHE = "gelm-cache-v2";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", e => {
  const req = e.request;

  if (req.destination === "audio") {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(res =>
          res || fetch(req).then(net => {
            cache.put(req, net.clone());
            return net;
          })
        )
      )
    );
  }
});
