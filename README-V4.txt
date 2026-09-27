GT-GELM REPRODUCTOR v4
=======================

BASE DE LA VERSION
-------------------
Esta V4 se reconstruyó tomando como base la versión 2 que ya reproducía
correctamente desde Cloudflare, en lugar de continuar parchando la V3.

CORRECCIONES CLAVE
------------------
1. config.js expone window.GT_GELM_CONFIG.
2. app.js lee AUDIO_BASE_URL/AUDIO_BASE de forma segura.
3. songs.json puede contener filename, audio, url o incluso URLs antiguas.
4. URLs antiguas de gelm.pages.dev se convierten automáticamente al Worker actual.
5. La reproducción normal va DIRECTA al Worker Cloudflare; CacheStorage no
   está en medio del camino.
6. Save Offline queda como función independiente y no puede romper la reproducción.
7. Inicio predeterminado: pista 048. RESUME_LAST_TRACK está desactivado.
8. El reproductor soporta letras, YouTube, portadas, PWA, Media Session,
   biblioteca oculta, búsqueda y filtros.

ARCHIVOS A COPIAR
------------------
index.html
app.js
config.js
styles.css
sw.js
manifest.webmanifest

NO REEMPLAZAR
-------------
songs.json
lyrics/
img/
youtube.json
cover-map.json
lyrics-map.json

Esos datos pueden conservarse tal como ya están en tu repositorio.

IMPORTANTE PARA LAS PRUEBAS
---------------------------
Después de subir V4 a GitHub Pages:
1. Recarga con Ctrl+F5.
2. Si el navegador sigue mostrando la versión vieja, desinstala la PWA
   anterior o borra los datos del sitio y vuelve a abrir GitHub Pages.
3. Prueba primero 048 y luego 020.
4. Abre “🎵 Audio GT-GELM” y confirma que la URL directa abre el MP3.

No cambies el nombre de songs.json ni la carpeta lyrics/.
