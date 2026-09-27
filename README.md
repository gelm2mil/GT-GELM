# GT-GELM PLAYER V3 PRO MAX

## Objetivo
Versión completa y amarrada del reproductor GT-GELM, preparada para GitHub Pages y para instalación como PWA en teléfono.

## Importante
- **NO incluye los 118 MP3**. El audio se resuelve desde el Worker existente de Cloudflare.
- `songs.json` conserva los 118 nombres limpios y el reproductor construye la URL automáticamente con `AUDIO_BASE`.
- `config.js` concentra la configuración sensible del reproductor.
- `manifest.webmanifest`, `sw.js` e iconos ya están coordinados entre sí.
- `youtube.json`, `cover-map.json` y `lyrics-map.json` son archivos de datos independientes para que futuras mejoras no rompan el reproductor.

## Archivos
- `index.html` — estructura del PWA.
- `app.js` — lógica completa del reproductor.
- `styles.css` — diseño oscuro/neón responsive.
- `config.js` — URL Cloudflare y opciones principales.
- `songs.json` — catálogo 001–118.
- `youtube.json` — videos de YouTube conocidos.
- `cover-map.json` — portadas conocidas; existe fallback automático.
- `lyrics-map.json` — asociación de letras conocidas.
- `manifest.webmanifest` — instalación PWA.
- `sw.js` — caché del shell y soporte de almacenamiento local.
- `icons/` — iconos de instalación.
- `assets/img/default-cover.svg` — portada de respaldo.

## Despliegue
Sube el contenido de esta carpeta al repositorio `GT-GELM` sin borrar la carpeta donde estén tus 118 canciones remotas, porque esas canciones no forman parte del repositorio.

En GitHub Pages, abre la URL publicada y comprueba primero:
1. Canción inicial 048.
2. Siguiente/anterior.
3. Biblioteca.
4. Audio directo.
5. YouTube.
6. Letra.
7. Instalación PWA.

## Audio
El reproductor utiliza:
`https://divine-king-c86b.chapin7839.workers.dev/`

Ejemplo interno para la pista 020:
`https://divine-king-c86b.chapin7839.workers.dev/020-bohemio.mp3`
