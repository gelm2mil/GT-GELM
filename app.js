
/* =========================================================
   GT-GELM BLACK PLAYER V2
   Motor musical optimizado
   Reproducción · Biblioteca · Aleatorio · PWA
   ========================================================= */

'use strict';

/* ================= CONFIGURACIÓN ================= */

const AUDIO_BASE = 'https://divine-king-c86b.chapin7839.workers.dev/';
const DEFAULT_COVER = 'img/gt-gelm-logo.webp';
const REPO_RAW = 'https://raw.githubusercontent.com/gelm2mil/GT-GELM/main/';
const DEFAULT_SONG_ID = 0;
const YOUTUBE_PLAYLIST_ID = 'PLJGpqFTRWh98';
const MAX_PLAY_ATTEMPTS = 2;

const $ = id => document.getElementById(id);

/* ================= ELEMENTOS ================= */

const audio = $('audio');
const titleEl = $('title');
const metaEl = $('meta');
const coverEl = $('cover');
const seek = $('seek');
const volume = $('volume');
const currentTimeEl = $('currentTime');
const durationEl = $('duration');
const songList = $('songList');
const search = $('search');
const countEl = $('count');
const libraryPanel = $('libraryPanel');
const libraryBtn = $('libraryBtn');
const openYoutube = $('openYoutube');
const lyrics = $('lyrics');

/* ================= ESTADO ================= */

const state = {
  songs: [],
  filtered: [],
  index: -1,
  shuffle: true,
  repeat: false,
  filter: 'all',
  query: '',
  youtube: {},
  currentLyricsUrl: '',
  deferredInstallPrompt: null,
  seeking: false,
  switching: false,
  requestId: 0,
  shuffleBag: [],
  userStartedPlayback: false
};

let lyricsRequest = 0;

/* ================= UTILIDADES ================= */

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn('GT-GELM: almacenamiento no disponible.', err);
  }
}

function fmt(sec) {
  if (!Number.isFinite(sec)) return '00:00';

  const s = Math.max(0, Math.floor(sec));

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.mp3$/i, '')
    .replace(/^\d{3}-?/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function humanTitle(file) {
  return String(file || '')
    .replace(/\.mp3$/i, '')
    .replace(/^\d{3}-?/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[c]);
}

/* ================= CATEGORÍAS ================= */

function categoryOf(song) {
  const t = `${song.title} ${song.file}`.toLowerCase();

  if (/pmt|policia|tránsito|transito|chimaltenango/.test(t)) {
    return 'pmt';
  }

  if (/guatemala|xinka|kiche|k'iche|iqu|ixcan|ixc[aá]n|maya|atl[ií]an|quiche|zul|tradiciones|cantos/.test(t)) {
    return 'cultura';
  }

  return 'historias';
}

/* ================= NORMALIZAR BIBLIOTECA ================= */

function normalizeSongs(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.songs)
      ? data.songs
      : [];

  return rows.map((s, i) => {
    const file = String(s.file || s.filename || '').trim();

    if (!file) return null;

    const encodedFile = file
      .split('/')
      .map(encodeURIComponent)
      .join('/');

    const url = /^https?:\/\//i.test(file)
      ? file
      : AUDIO_BASE + encodedFile;

    const title = s.title || humanTitle(file);

    return {
      id: Number(s.id ?? i + 1),
      file,
      title,
      category: String(
        s.category || categoryOf({ title, file })
      ).toLowerCase(),
      url,
      cover: s.cover || '',
      youtube: s.youtube || ''
    };
  }).filter(Boolean);
}

/* ================= CARGA DE DATOS ================= */

async function fetchJSON(url) {
  const response = await fetch(url, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchSongsWithFallback() {
  try {
    const data = await fetchJSON('songs.json');
    const songs = normalizeSongs(data);

    if (songs.length) return songs;

    throw new Error('Biblioteca local vacía.');
  } catch (err) {
    console.warn('GT-GELM: intentando respaldo de GitHub.', err);
  }

  try {
    const data = await fetchJSON(REPO_RAW + 'songs.json');
    const songs = normalizeSongs(data);

    if (songs.length) return songs;

    throw new Error('Respaldo de GitHub sin canciones.');
  } catch (err) {
    console.error('GT-GELM: fallaron los respaldos.', err);
    throw new Error('No se pudo cargar songs.json. Revisa la conexión y el repositorio.');
  }
}

/* ================= BIBLIOTECA ================= */

function applyFilters() {
  const q = state.query.trim().toLowerCase();

  state.filtered = state.songs.filter(song => {
    const categoryOk =
      state.filter === 'all' || song.category === state.filter;

    const queryOk =
      !q || `${song.id} ${song.title} ${song.file}`
        .toLowerCase()
        .includes(q);

    return categoryOk && queryOk;
  });

  if (countEl) {
    countEl.textContent = state.songs.length;
  }

  renderList();
}

function renderList() {
  if (!songList) return;

  songList.innerHTML = '';

  if (!state.filtered.length) {
    songList.innerHTML =
      '<div class="panel-note">No hay coincidencias.</div>';
    return;
  }

  const frag = document.createDocumentFragment();

  state.filtered.forEach(song => {
    const idx = state.songs.indexOf(song);

    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.index = String(idx);
    row.className = `song-row ${idx === state.index ? 'active' : ''}`;

    row.innerHTML = `
      <span class="song-id">${String(song.id).padStart(3, '0')}</span>
      <span>
        <span class="song-title">${escapeHtml(song.title)}</span>
        <small class="song-file">${escapeHtml(song.file)}</small>
      </span>
      <span class="song-play">▶</span>
    `;

    row.addEventListener('click', () => {
      playSong(idx, true, 'user');
    });

    frag.appendChild(row);
  });

  songList.appendChild(frag);
}

function updateActiveRow() {
  if (!songList) return;

  songList.querySelectorAll('.song-row').forEach(row => {
    const idx = Number(row.dataset.index);
    row.classList.toggle('active', idx === state.index);
  });
}

/* ================= PORTADAS ================= */

function chooseCover(song) {
  return song?.cover || DEFAULT_COVER;
}

function loadCover(song) {
  if (!coverEl) return;

  coverEl.onerror = () => {
    coverEl.onerror = null;
    coverEl.src = DEFAULT_COVER;
  };

  coverEl.src = chooseCover(song);
}

/* ================= INFORMACIÓN ================= */

function updateMeta(song) {
  if (titleEl) {
    titleEl.textContent = humanTitle(song.title || song.file);
  }

  if (metaEl) {
    metaEl.textContent =
      `GT-GELM · ${String(song.id).padStart(3, '0')} · ${String(song.category).toUpperCase()}`;
  }

  document.title =
    `${humanTitle(song.title || song.file)} · GT-GELM`;
}

function updatePlayButton(playing) {
  const btn = $('play');
  if (!btn) return;

  btn.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"></rect></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13L19 12 8 5.5Z" fill="currentColor"></path></svg>';

  btn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  btn.title = playing ? 'Pausar' : 'Reproducir';
}

/* ================= ALEATORIO ================= */

function refillShuffleBag() {
  state.shuffleBag = state.songs
    .map((_, i) => i)
    .filter(i => i !== state.index);

  for (let i = state.shuffleBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [state.shuffleBag[i], state.shuffleBag[j]] =
      [state.shuffleBag[j], state.shuffleBag[i]];
  }
}

function pickNext() {
  if (!state.songs.length) return -1;

  if (state.shuffle) {
    if (!state.shuffleBag.length) {
      refillShuffleBag();
    }

    return state.shuffleBag.pop() ?? state.index;
  }

  return (state.index + 1) % state.songs.length;
}

function pickPrev() {
  if (!state.songs.length) return -1;

  return (state.index - 1 + state.songs.length) % state.songs.length;
}

/* ================= LETRAS ================= */

async function loadLyrics(song) {
  const request = ++lyricsRequest;

  if (!lyrics) return;

  lyrics.hidden = true;

  const toggle = $('lyricsToggle');

  if (toggle) {
    toggle.textContent = 'Mostrar';
    toggle.setAttribute('aria-expanded', 'false');
  }

  state.currentLyricsUrl = '';

  const base = song.file.replace(/\.mp3$/i, '');
  const noNum = base.replace(/^\d{3}-?/, '');

  const upper = noNum
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const candidates = [
    `lyrics/${base}.txt`,
    `lyrics/${noNum}.txt`,
    `lyrics/${upper}.txt`,
    `lyrics/${slugify(song.title).replace(/-/g, '_')}.txt`,
    `lyrics/${slugify(song.title)}.txt`
  ];

  for (const path of candidates) {
    try {
      const response = await fetch(path, {
        cache: 'no-store'
      });

      if (request !== lyricsRequest) return;

      if (response.ok) {
        const text = await response.text();

        if (request !== lyricsRequest) return;

        if (text.trim()) {
          lyrics.textContent = text;
          state.currentLyricsUrl = path;
          return;
        }
      }
    } catch (_) {
      // Las letras son opcionales.
    }
  }

  if (request === lyricsRequest) {
    lyrics.textContent =
      'Letra no disponible todavía en el repositorio.';
  }
}

/* ================= YOUTUBE ================= */

function renderYoutube() {
  const url =
    `https://www.youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`;

  if (openYoutube) {
    openYoutube.href = url;
    openYoutube.target = '_blank';
    openYoutube.rel = 'noopener noreferrer';
  }

  const tab = window.open(url, '_blank', 'noopener,noreferrer');

  if (!tab && metaEl) {
    metaEl.textContent = 'Permite las ventanas emergentes para abrir YouTube.';
  }
}

/* ================= MEDIA SESSION ================= */

function setMediaSession(song) {
  if (
    !('mediaSession' in navigator) ||
    typeof MediaMetadata === 'undefined'
  ) return;

  try {
    const art = chooseCover(song);

    const type = /\.webp(?:$|\?)/i.test(art)
      ? 'image/webp'
      : 'image/png';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: humanTitle(song.title || song.file),
      artist: 'GT-GELM',
      album: 'GT-GELM Producciones',
      artwork: [
        { src: art, sizes: '512x512', type },
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }
      ]
    });

    const safeAction = (name, handler) => {
      try {
        navigator.mediaSession.setActionHandler(name, handler);
      } catch (_) {}
    };

    safeAction('play', playCurrentFromGesture);
    safeAction('pause', () => audio.pause());
    safeAction('previoustrack', prev);
    safeAction('nexttrack', () => next('user'));

    safeAction('seekbackward', details => {
      const skip = Number(details?.seekOffset) || 10;
      audio.currentTime = Math.max(0, audio.currentTime - skip);
    });

    safeAction('seekforward', details => {
      const skip = Number(details?.seekOffset) || 10;
      audio.currentTime =
        Math.min(audio.duration || Infinity, audio.currentTime + skip);
    });

    safeAction('seekto', details => {
      if (!Number.isFinite(details?.seekTime)) return;
      if (!Number.isFinite(audio.duration)) return;

      audio.currentTime =
        Math.min(audio.duration, Math.max(0, details.seekTime));
    });

  } catch (err) {
    console.warn('GT-GELM: Media Session no disponible.', err);
  }
}

/* ================= CACHÉ DE AUDIO ================= */

function cacheAudio(url) {
  if (!('serviceWorker' in navigator)) return;

  const sw = navigator.serviceWorker.controller;

  if (!sw) return;

  sw.postMessage({
    type: 'cache-audio',
    url
  });
}

/* ================= REPRODUCCIÓN PRINCIPAL ================= */

async function playSong(index, autoplay = false, source = 'user') {
  const song = state.songs[index];

  if (!song || !audio) return false;

  const request = ++state.requestId;

  state.switching = true;
  state.index = index;

  if (source === 'user' && state.shuffle) {
    state.shuffleBag = state.shuffleBag.filter(i => i !== index);
  }

  updateMeta(song);
  loadCover(song);
  renderList();
  updateActiveRow();

  safeStorageSet('gt-gelm-last-id', String(song.id));

  setMediaSession(song);
  loadLyrics(song);

  audio.pause();
  audio.src = song.url;
  audio.load();

  state.switching = false;

  if (!autoplay) {
    updatePlayButton(false);
    return true;
  }

  for (let attempt = 1; attempt <= MAX_PLAY_ATTEMPTS; attempt++) {
    try {
      await audio.play();

      if (request !== state.requestId) return false;

      state.userStartedPlayback = true;
      updatePlayButton(true);
      cacheAudio(song.url);

      return true;

    } catch (err) {
      if (request !== state.requestId) return false;

      if (attempt < MAX_PLAY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      updatePlayButton(false);

      if (metaEl) {
        metaEl.textContent =
          err?.name === 'NotAllowedError'
            ? 'Toca reproducir para iniciar el audio'
            : 'No se pudo iniciar esta canción · toca reproducir para reintentar';
      }

      console.warn(
        `GT-GELM: error reproduciendo "${song.title}"`,
        err
      );

      return false;
    }
  }

  return false;
}

async function playCurrentFromGesture() {
  if (!audio) return;

  if (state.index < 0 && state.songs.length) {
    const first = Math.floor(Math.random() * state.songs.length);
    return playSong(first, true, 'user');
  }

  try {
    await audio.play();

    state.userStartedPlayback = true;
    updatePlayButton(true);

    const song = state.songs[state.index];

    if (song) cacheAudio(song.url);

  } catch (err) {
    updatePlayButton(false);

    console.warn('GT-GELM: no se pudo iniciar el audio.', err);

    if (metaEl) {
      metaEl.textContent = 'No se pudo iniciar · vuelve a tocar reproducir';
    }
  }
}

/* ================= SIGUIENTE Y ANTERIOR ================= */

async function next(source = 'user') {
  if (!state.songs.length) return;

  if (source === 'ended' && state.repeat && state.index >= 0) {
    await playSong(state.index, true, 'ended');
    return;
  }

  const nextIndex = pickNext();

  if (nextIndex < 0) return;

  const ok = await playSong(nextIndex, true, source);

  if (!ok && source === 'ended' && metaEl) {
    metaEl.textContent =
      'La siguiente canción no pudo iniciar · revisa conexión o servidor de audio';
  }
}

function prev() {
  const previous = pickPrev();

  if (previous >= 0) {
    playSong(previous, true, 'user');
  }
}

/* ================= INSTALACIÓN PWA ================= */

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function setupInstall() {
  const btn = $('installBtn');

  if (!btn) return;

  if (isStandalone()) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    btn.hidden = true;
  });

  btn.addEventListener('click', async () => {
    if (state.deferredInstallPrompt) {
      const promptEvent = state.deferredInstallPrompt;
      state.deferredInstallPrompt = null;

      try {
        await promptEvent.prompt();

        const choice = await promptEvent.userChoice;

        if (choice?.outcome === 'accepted') {
          btn.hidden = true;
        }
      } catch (err) {
        console.warn('No se pudo abrir el instalador:', err);
      }

      return;
    }

    if (isIOS()) {
      alert(
        'Para instalar GT-GELM en iPhone/iPad:\n\n' +
        '1. Toca Compartir.\n' +
        '2. Selecciona “Agregar a pantalla de inicio”.\n' +
        '3. Confirma “Agregar”.'
      );

      return;
    }

    alert(
      'Para instalar GT-GELM:\n\n' +
      'Abre el menú del navegador y busca “Instalar aplicación”, ' +
      '“Instalar GT-GELM” o “Agregar a pantalla de inicio”.'
    );
  });
}

/* ================= CONTROLES ================= */

$('play')?.addEventListener('click', () => {
  if (audio.paused) {
    playCurrentFromGesture();
  } else {
    audio.pause();
  }
});

$('prev')?.addEventListener('click', prev);
$('next')?.addEventListener('click', () => next('user'));

$('shuffle')?.addEventListener('click', () => {
  state.shuffle = !state.shuffle;

  $('shuffle').setAttribute(
    'aria-pressed',
    String(state.shuffle)
  );

  if (state.shuffle) refillShuffleBag();
});

$('repeat')?.addEventListener('click', () => {
  state.repeat = !state.repeat;

  $('repeat').setAttribute(
    'aria-pressed',
    String(state.repeat)
  );
});

$('mute')?.addEventListener('click', () => {
  audio.muted = !audio.muted;

  $('mute').textContent =
    audio.muted ? 'Activar sonido' : 'Silencio';

  $('mute').setAttribute(
    'aria-pressed',
    String(audio.muted)
  );
});

$('audioDirect')?.addEventListener('click', () => {
  const song = state.songs[state.index];

  if (song) {
    window.open(song.url, '_blank', 'noopener,noreferrer');
  }
});

$('youtubeBtn')?.addEventListener('click', renderYoutube);

$('openYoutube')?.addEventListener('click', () => {
  if (!openYoutube) return;

  openYoutube.target = '_blank';
  openYoutube.rel = 'noopener noreferrer';
});

/* ================= BIBLIOTECA ================= */

libraryBtn?.addEventListener('click', () => {
  if (!libraryPanel) return;

  libraryPanel.hidden = !libraryPanel.hidden;

  libraryBtn.setAttribute(
    'aria-expanded',
    String(!libraryPanel.hidden)
  );
});

$('closeLibrary')?.addEventListener('click', () => {
  if (!libraryPanel) return;

  libraryPanel.hidden = true;
  libraryBtn?.setAttribute('aria-expanded', 'false');
});

/* ================= TEMA ================= */

$('themeBtn')?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

/* ================= LETRAS ================= */

$('lyricsToggle')?.addEventListener('click', () => {
  if (!lyrics) return;

  lyrics.hidden = !lyrics.hidden;

  $('lyricsToggle').textContent =
    lyrics.hidden ? 'Mostrar' : 'Ocultar';

  $('lyricsToggle').setAttribute(
    'aria-expanded',
    String(!lyrics.hidden)
  );
});

/* ================= BUSCADOR ================= */

search?.addEventListener('input', event => {
  state.query = event.target.value;
  applyFilters();
});

/* ================= CATEGORÍAS ================= */

document.querySelectorAll('.filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(item => {
      item.classList.remove('active');
    });

    btn.classList.add('active');
    state.filter = btn.dataset.filter || 'all';

    applyFilters();
  });
});

/* ================= PROGRESO ================= */

seek?.addEventListener('pointerdown', () => {
  state.seeking = true;
});

seek?.addEventListener('pointerup', () => {
  state.seeking = false;

  if (Number.isFinite(audio.duration)) {
    audio.currentTime =
      (Number(seek.value) / 100) * audio.duration;

    if (currentTimeEl) {
      currentTimeEl.textContent = fmt(audio.currentTime);
    }
  }
});

seek?.addEventListener('pointercancel', () => {
  state.seeking = false;
});

seek?.addEventListener('input', () => {
  if (Number.isFinite(audio.duration) && currentTimeEl) {
    currentTimeEl.textContent =
      fmt((Number(seek.value) / 100) * audio.duration);
  }
});

seek?.addEventListener('change', () => {
  if (Number.isFinite(audio.duration)) {
    audio.currentTime =
      (Number(seek.value) / 100) * audio.duration;

    if (currentTimeEl) {
      currentTimeEl.textContent = fmt(audio.currentTime);
    }
  }
});

/* ================= VOLUMEN ================= */

if (volume) {
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
  });

  audio.volume = Number(volume.value || 0.85);
}

/* ================= EVENTOS DE AUDIO ================= */

audio.addEventListener('loadedmetadata', () => {
  if (durationEl) {
    durationEl.textContent = fmt(audio.duration);
  }

  if (seek && !state.seeking) {
    seek.value = 0;
  }
});

audio.addEventListener('timeupdate', () => {
  if (currentTimeEl) {
    currentTimeEl.textContent = fmt(audio.currentTime);
  }

  if (seek && audio.duration && !state.seeking) {
    seek.value = (audio.currentTime / audio.duration) * 100;
  }

  if (
    'mediaSession' in navigator &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0
  ) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (_) {}
  }
});

/* ================= ESTADO VISUAL ================= */

const musicPulse = $('musicPulse');
const brandPulse = $('brandPulse');
const heroVitals = $('heroVitals');

function setMusicPulse(playing) {
  const active = Boolean(playing);

  [musicPulse, brandPulse, heroVitals].forEach(el => {
    if (el) el.classList.toggle('is-playing', active);
  });

  if (musicPulse) {
    musicPulse.setAttribute(
      'aria-label',
      active ? 'Pulso musical activo' : 'Pulso musical detenido'
    );
  }
}

audio.addEventListener('play', () => {
  setMusicPulse(true);
  updatePlayButton(true);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'playing';
    } catch (_) {}
  }
});

audio.addEventListener('playing', () => {
  if (metaEl && metaEl.textContent.includes('no pudo')) {
    const song = state.songs[state.index];
    if (song) updateMeta(song);
  }

  if (metaEl) {
    delete metaEl.dataset.waiting;
  }
});

audio.addEventListener('pause', () => {
  setMusicPulse(false);
  updatePlayButton(false);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused';
    } catch (_) {}
  }
});

/* ================= CAMBIO AUTOMÁTICO ================= */

audio.addEventListener('ended', () => {
  next('ended');
});

audio.addEventListener('waiting', () => {
  if (metaEl && audio.currentSrc) {
    metaEl.dataset.waiting = 'true';
  }
});

audio.addEventListener('error', () => {
  if (state.switching) return;

  const song = state.songs[state.index];

  if (metaEl) {
    metaEl.textContent =
      `Error de audio${song ? ` · ${song.title}` : ''} · revisa conexión o servidor`;
  }

  updatePlayButton(false);

  console.error(
    'GT-GELM audio error:',
    audio.error,
    song ? song.url : '(sin canción)'
  );
});

/* ================= CARGA INICIAL ================= */

async function boot() {
  if (!audio) {
    console.error('GT-GELM: falta el elemento audio en index.html.');
    return;
  }

  try {
    setupInstall();

    if (metaEl) metaEl.textContent = 'Cargando biblioteca...';

    const [songs, ytData] = await Promise.all([
      fetchSongsWithFallback(),
      fetchJSON('youtube.json').catch(err => {
        console.warn('GT-GELM: youtube.json no disponible.', err);
        return {};
      })
    ]);

    state.songs = songs;
    state.youtube = ytData || {};

    if (!state.songs.length) {
      throw new Error('La biblioteca no contiene canciones válidas.');
    }

    applyFilters();

    let startIndex = Math.floor(Math.random() * state.songs.length);

    const lastId = Number(safeStorageGet('gt-gelm-last-id') || 0);

    if (DEFAULT_SONG_ID > 0) {
      const configured = state.songs.findIndex(
        song => song.id === DEFAULT_SONG_ID
      );

      if (configured >= 0) startIndex = configured;

    } else if (lastId > 0) {
      const previous = state.songs.findIndex(
        song => song.id === lastId
      );

      if (previous >= 0) startIndex = previous;
    }

    await playSong(startIndex, false, 'boot');

    if (state.shuffle) refillShuffleBag();

    $('shuffle')?.setAttribute('aria-pressed', 'true');
    $('repeat')?.setAttribute('aria-pressed', 'false');

    if (metaEl) {
      metaEl.textContent =
        `GT-GELM · ${String(state.songs[startIndex].id).padStart(3, '0')} · ${state.songs[startIndex].category.toUpperCase()}`;
    }

    console.info(
      `GT-GELM: biblioteca cargada. ${state.songs.length} canciones.`
    );

  } catch (err) {
    if (titleEl) {
      titleEl.textContent = 'No se pudo cargar la biblioteca';
    }

    if (metaEl) {
      metaEl.textContent = String(err.message || err);
    }

    console.error('GT-GELM boot:', err);
  }
}

/* ================= SERVICE WORKER ================= */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(
      'sw.js',
      { updateViaCache: 'none' }
    )
      .then(reg => reg.update())
      .catch(err => {
        console.warn('GT-GELM: Service Worker no registrado.', err);
      });
  });
}

/* ================= INICIAR ================= */

boot();
