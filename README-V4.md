# GT-GELM PLAYER V4

Esta V4 parte directamente de la versión V2.1 que ya funcionaba con el audio,
biblioteca, YouTube, letras, portadas y Cloudflare.

## Corrección V4
Se agregó únicamente el flujo de instalación PWA:
- Botón `＋ Instalar`.
- Detecta `beforeinstallprompt` en navegadores compatibles.
- Oculta el botón cuando la app ya está instalada.
- Maneja `appinstalled`.
- Mantiene intacta la lógica de reproducción de audio.

## Audio
La versión conserva:
- Cloudflare Workers como origen de los MP3.
- Canción inicial 048.
- Biblioteca desplegable.
- Búsqueda y filtros.
- YouTube.
- Letras.
- Media Session.

## Importante
Conserva tu `songs.json`, `lyrics/`, `img/`, `assets/` e `icons/`.
Los 118 MP3 siguen fuera de GitHub, en Cloudflare Workers.

## Publicación
Reemplaza estos archivos en la raíz del repositorio:
- `index.html`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `styles.css` (puede conservarse, es la misma versión funcional)

No reemplaces `songs.json`, `lyrics/`, `img/`, `assets/` ni `icons/`.
