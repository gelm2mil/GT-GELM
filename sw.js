
/* =========================================================
   GT-GELM · SERVICE WORKER V2
   Caché inteligente + audio por rangos + PWA
   ========================================================= */

const SHELL_CACHE = 'gt-gelm-shell';
const AUDIO_CACHE = 'gt-gelm-audio';

const AUDIO_HOST = 'divine-king-c86b.chapin7839.workers.dev';
const MAX_AUDIO = 15;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './songs.json',
  './youtube.json',
  './manifest.webmanifest',
  './heart-neon.png',
  './assets/img/default-cover.svg',
  './img/gt-gelm-logo.webp',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* =========================================================
   INSTALACIÓN
   ========================================================= */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(async cache => {
        await Promise.allSettled(
          SHELL.map(url => cache.add(url))
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* =========================================================
   ACTIVACIÓN
   ========================================================= */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key !== SHELL_CACHE &&
              key !== AUDIO_CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* =========================================================
   INTERCEPTAR SOLICITUDES
   ========================================================= */

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Audio alojado en Cloudflare Worker
  if (url.hostname === AUDIO_HOST) {
    event.respondWith(serveAudio(req));
    return;
  }

  // No interceptar servicios externos
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});

/* =========================================================
   ARCHIVOS DE LA APLICACIÓN
   INTERNET PRIMERO, CACHÉ COMO RESPALDO
   ========================================================= */

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(req, {
      cache: 'no-cache'
    });

    if (response.ok) {
      try {
        await cache.put(req, response.clone());
      } catch (err) {
        // Si no se puede guardar, la respuesta sigue funcionando.
        console.warn('GT-GELM: no se pudo actualizar caché.', err);
      }
    }

    return response;

  } catch (err) {
    const cached = await cache.match(req, {
      ignoreSearch: true
    });

    if (cached) return cached;

    if (req.mode === 'navigate') {
      return (
        await cache.match('./index.html')
      ) || Response.error();
    }

    return Response.error();
  }
}

/* =========================================================
   AUDIO
   SOPORTE PARA SOLICITUDES RANGE
   ========================================================= */

async function serveAudio(req) {
  const cache = await caches.open(AUDIO_CACHE);

  const cached = await cache.match(req.url);

  // Si no existe en caché, solicitarlo normalmente.
  if (!cached) {
    return fetch(req);
  }

  const range = req.headers.get('range');

  // Sin Range: entregar archivo completo.
  if (!range) {
    return cached;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());

  if (!match || (!match[1] && !match[2])) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': 'bytes */' +
          (cached.headers.get('Content-Length') || '*')
      }
    });
  }

  const buffer = await cached.arrayBuffer();
  const size = buffer.byteLength;

  let start;
  let end;

  if (!match[1]) {
    // Solicitud de los últimos N bytes.
    const suffix = Number(match[2]);

    if (!Number.isFinite(suffix) || suffix <= 0) {
      return rangeNotSatisfiable(size);
    }

    start = Math.max(0, size - suffix);
    end = size - 1;

  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return rangeNotSatisfiable(size);
  }

  end = Math.min(end, size - 1);

  const chunk = buffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    headers: {
      'Content-Type':
        cached.headers.get('Content-Type') || 'audio/mpeg',

      'Content-Range':
        `bytes ${start}-${end}/${size}`,

      'Content-Length':
        String(chunk.byteLength),

      'Accept-Ranges': 'bytes'
    }
  });
}

function rangeNotSatisfiable(size) {
  return new Response(null, {
    status: 416,
    headers: {
      'Content-Range': `bytes */${size}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

/* =========================================================
   MENSAJES DESDE APP.JS
   ========================================================= */

self.addEventListener('message', event => {
  const data = event.data;

  if (
    data &&
    data.type === 'cache-audio' &&
    typeof data.url === 'string'
  ) {
    event.waitUntil(saveAudio(data.url));
  }
});

/* =========================================================
   GUARDAR CANCIONES PARA USO SIN INTERNET
   ========================================================= */

async function saveAudio(url) {
  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== AUDIO_HOST
    ) {
      return;
    }

    const cache = await caches.open(AUDIO_CACHE);

    // No descargar una canción que ya está guardada.
    if (await cache.match(url)) return;

    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-store'
    });

    // Guardar únicamente archivos completos y válidos.
    if (
      !response.ok ||
      response.status !== 200 ||
      response.type === 'opaque'
    ) {
      return;
    }

    const contentType =
      response.headers.get('Content-Type') || '';

    if (
      contentType &&
      !contentType.includes('audio') &&
      !contentType.includes('octet-stream')
    ) {
      return;
    }

    await cache.put(url, response);

    // Mantener únicamente las últimas 15 canciones.
    const keys = await cache.keys();

    const excess = keys.length - MAX_AUDIO;

    if (excess > 0) {
      for (const key of keys.slice(0, excess)) {
        await cache.delete(key);
      }
    }

  } catch (err) {
    console.warn(
      'GT-GELM: no se pudo guardar el audio en caché.',
      err
    );
  }
}
