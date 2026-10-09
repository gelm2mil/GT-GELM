const CACHE = 'gt-gelm-player-v11-neon-pulse-v4';
const SHELL = [
  './','./index.html','./styles.css','./app.js','./songs.json','./youtube.json',
  './manifest.webmanifest','./heart-neon.png','./assets/img/default-cover.svg',
  './img/gt-gelm-logo.webp','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (/\.(json|txt)$/i.test(url.pathname)) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
      const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response;
  }).catch(()=>caches.match('./index.html'))));
});
