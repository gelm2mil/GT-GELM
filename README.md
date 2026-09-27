# GT-GELM Reproductor

Nuevo reproductor para GitHub Pages usando como origen de audio el Cloudflare Worker:

`https://divine-king-c86b.chapin7839.workers.dev/`

## Estructura

- `index.html` — interfaz.
- `styles.css` — diseño neon/dark responsive.
- `app.js` — reproductor, búsqueda, filtros, cola y letras.
- `songs.json` — catálogo inicial de 118 MP3.
- `assets/img/default-cover.svg` — portada temporal.
- `lyrics/` — aquí irán las letras con el mismo nombre base del MP3, por ejemplo:
  `lyrics/020-bohemio.txt`
- `manifest.webmanifest` y `sw.js` — base PWA.

## Audio

Las canciones se resuelven así:

`https://divine-king-c86b.chapin7839.workers.dev/` + nombre exacto del archivo.

## Próximo paso

Cuando estén listas las portadas, se pueden agregar en `assets/img/` y actualizar el campo `cover` de `songs.json`.

Cuando estén listas las letras, se colocan en `lyrics/` con el mismo nombre base del MP3. El reproductor intentará cargarlas automáticamente.
