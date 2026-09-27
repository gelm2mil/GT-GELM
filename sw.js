const CACHE = 'gt-gelm-player-v4-shell';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './songs.json',
  './youtube.json',
  './manifest.webmanifest',
  './assets/img/default-cover.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin !== location.origin) return;

  const isDataFile = /\.(json|txt)$/i.test(url.pathname);

  if(isDataFile){
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response=>{
      const clone=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,clone));
      return response;
    }).catch(()=>caches.match('./index.html')))
  );
});
