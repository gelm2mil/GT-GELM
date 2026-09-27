const CACHE_NAME = "gt-gelm-player-v2-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./config.js",
  "./songs.json",
  "./youtube.json",
  "./manifest.webmanifest"
];

/* ================================
   INSTALL
   ================================ */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});


/* ================================
   ACTIVATE
   ================================ */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .filter(key => key.startsWith("gt-gelm-"))
            .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});


/* ================================
   FETCH
   ================================ */

self.addEventListener("fetch", event => {

  const request = event.request;

  /* Solo trabajamos con solicitudes GET */
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
     Los MP3 están alojados en Cloudflare.
     NO intentamos interceptarlos aquí.
     El reproductor seguirá utilizando directamente
     las URL configuradas en songs.json.
  */
  if (
    url.hostname.includes("workers.dev") &&
    url.pathname.toLowerCase().endsWith(".mp3")
  ) {
    return;
  }


  /*
     Para nuestra propia aplicación:
     primero intentamos la red y,
     si no hay conexión,
     utilizamos la copia almacenada.
  */
  if (url.origin === self.location.origin) {

    event.respondWith(
      fetch(request)
        .then(response => {

          /*
             Guardamos únicamente respuestas válidas.
          */
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, copy);
              });
          }

          return response;
        })
        .catch(() => {

          return caches.match(request)
            .then(cached => {

              if (cached) {
                return cached;
              }

              /*
                 Si es navegación y no hay red,
                 intentamos cargar la aplicación.
              */
              if (request.mode === "navigate") {
                return caches.match("./index.html");
              }

              return new Response(
                "Recurso no disponible sin conexión.",
                {
                  status: 503,
                  statusText: "Offline"
                }
              );
            });

        })
    );

    return;
  }

});
