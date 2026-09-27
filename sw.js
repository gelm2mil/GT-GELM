const SHELL_CACHE = 'gt-gelm-v3-pro-max-shell-v2';
const RUNTIME_CACHE = 'gt-gelm-v3-pro-max-runtime-v2';

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './config.js',
  './songs.json',
  './youtube.json',
  './cover-map.json',
  './lyrics-map.json',
  './manifest.webmanifest',
  './assets/img/default-cover.svg',
  './assets/img/gt-gelm-mark.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![
            SHELL_CACHE,
            RUNTIME_CACHE
          ].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /*
   * IMPORTANTE:
   * No interceptamos Cloudflare Workers.
   * El audio remoto se administra desde app.js.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Navegación:
   * intenta cargar internet primero.
   * Si no existe conexión, usa index.html guardado.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();

            caches.open(SHELL_CACHE)
              .then(cache => cache.put('./index.html', clone))
              .catch(() => {});
          }

          return response;
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );

    return;
  }

  /*
   * Archivos locales de la aplicación:
   * primero caché, luego red.
   */
  event.respondWith(
    caches.match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (!response || !response.ok) {
              return response;
            }

            const clone = response.clone();

            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(request, clone))
              .catch(() => {});

            return response;
          })
          .catch(() => {
            return cached;
          });
      })
  );
});
