// GT-GELM Reproductor v4 — configuración central
// Compatible con el reproductor actual y con futuras versiones.

window.GT_GELM_CONFIG = Object.freeze({
  // ==============================
  // AUDIO / CLOUDFLARE
  // ==============================
  AUDIO_BASE_URL: 'https://divine-king-c86b.chapin7839.workers.dev/',
  AUDIO_BASE: 'https://divine-king-c86b.chapin7839.workers.dev/',

  // ==============================
  // YOUTUBE
  // ==============================
  YOUTUBE_CHANNEL_URL: 'https://www.youtube.com/@GT-GELM',
  YOUTUBE_CHANNEL: 'https://www.youtube.com/@GT-GELM',

  // ==============================
  // PORTADAS
  // ==============================
  DEFAULT_COVER: 'img/banner-principal-gtgelm.png',
  FALLBACK_COVER: 'assets/img/default-cover.svg',

  // ==============================
  // ARCHIVOS DE DATOS
  // ==============================
  DATA_FILE: 'songs.json',
  YOUTUBE_FILE: 'youtube.json',
  COVER_MAP_FILE: 'cover-map.json',
  LYRICS_MAP_FILE: 'lyrics-map.json',

  // ==============================
  // DIRECTORIOS
  // ==============================
  IMAGE_DIR: './img/',
  LYRICS_DIR: './lyrics/',

  // ==============================
  // REPRODUCTOR
  // ==============================
  INITIAL_TRACK_ID: 48,
  RESUME_LAST_TRACK: false,

  // ==============================
  // CACHE / PWA
  // ==============================
  CACHE_NAME: 'gt-gelm-player-v4-audio-offline-v1',

  // ==============================
  // VERSION
  // ==============================
  VERSION: '4.0.0'
});