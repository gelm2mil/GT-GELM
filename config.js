// GT-GELM Reproductor v4 — configuración central
// IMPORTANTE: esta versión expone la configuración en window para evitar
// el fallo de alcance que dejó AUDIO_BASE vacío en la versión 3.
window.GT_GELM_CONFIG = Object.freeze({
  AUDIO_BASE_URL: 'https://divine-king-c86b.chapin7839.workers.dev/',
  AUDIO_BASE: 'https://divine-king-c86b.chapin7839.workers.dev/',
  YOUTUBE_CHANNEL_URL: 'https://www.youtube.com/@GT-GELM',
  YOUTUBE_CHANNEL: 'https://www.youtube.com/@GT-GELM',
  DEFAULT_COVER: 'img/banner-principal-gtgelm.png',
  FALLBACK_COVER: 'assets/img/default-cover.svg',
  DATA_FILE: 'songs.json',
  YOUTUBE_FILE: 'youtube.json',
  COVER_MAP_FILE: 'cover-map.json',
  LYRICS_MAP_FILE: 'lyrics-map.json',
  IMAGE_DIR: './img/',
  LYRICS_DIR: './lyrics/',
  INITIAL_TRACK_ID: 48,
  RESUME_LAST_TRACK: false,
  CACHE_NAME: 'gt-gelm-player-v4-audio-offline-v1',
  VERSION: '4.0.0'
});
