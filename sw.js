// GT-GELM · Service Worker
// Ya no hay que cambiar el nombre del caché al actualizar: los archivos de la
// app se piden primero a internet y el caché solo sirve cuando no hay conexión.
const SHELL_CACHE = 'gt-gelm-shell';
const AUDIO_CACHE = 'gt-gelm-audio';
const AUDIO_HOST  = 'divine-king-c86b.chapin7839.workers.dev';
const MAX_AUDIO   = 15; // canciones guardadas para escuchar sin internet

const SHELL = [
  './', './index.html', './styles.css', './app.js', './songs.json', './youtube.json',
  './manifest.webmanifest', './heart-neon.png', './assets/img/default-cover.svg',
  './img/gt-gelm-logo.webp', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === AUDIO_HOST) { event.respondWith(serveAudio(req)); return; }
  if (url.origin !== location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}

async function serveAudio(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(req.url);
  if (!hit) return fetch(req);
  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return hit;
  const buf = await hit.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'cache-audio') event.waitUntil(saveAudio(event.data.url));
});

async function saveAudio(url) {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    if (await cache.match(url)) return;
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return;
    await cache.put(url, res);
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_AUDIO))) await cache.delete(k);
  } catch { /* sin CORS o sin espacio: la canción sigue sonando normal por internet */ }
}
