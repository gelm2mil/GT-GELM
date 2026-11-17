
/* =====================================================
   GT-GELM · REPRODUCTOR MÓVIL Y PC
   Motor sencillo basado en el reproductor móvil probado.
   Mantiene songs.json, Cloudflare y los controles del HTML.
   ===================================================== */
'use strict';

const AUDIO_BASE = 'https://divine-king-c86b.chapin7839.workers.dev/';
const REPO_RAW = 'https://raw.githubusercontent.com/gelm2mil/GT-GELM/main/';
const DEFAULT_COVER = 'assets/img/default-cover.svg';
const YOUTUBE_PLAYLIST_ID = 'PLJGpqFTRWh98';

const $ = id => document.getElementById(id);
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
const lyricsEl = $('lyrics');

const state = {
  songs: [],
  filtered: [],
  index: -1,
  shuffle: true,
  repeat: false,
  filter: 'all',
  query: '',
  shuffleBag: [],
  seeking: false,
  installPrompt: null
};

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function makeSongURL(file) {
  if (/^https?:\/\//i.test(file)) return file;
  const encoded = String(file).split('/').map(encodeURIComponent).join('/');
  return AUDIO_BASE + encoded;
}

function normalizeSongs(data) {
  const rows = Array.isArray(data)
    ? data
    : (Array.isArray(data?.songs) ? data.songs : []);

  return rows.map((item, i) => {
    const file = String(item.file || item.filename || '').trim();
    if (!file) return null;

    return {
      id: Number(item.id ?? i + 1),
      file,
      title: String(item.title || file.replace(/\.mp3$/i, '')),
      category: String(item.category || 'historias').toLowerCase(),
      cover: item.cover || '',
      youtube: item.youtube || '',
      url: makeSongURL(file)
    };
  }).filter(Boolean);
}

async function loadSongs() {
  let data;

  try {
    const response = await fetch('songs.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`songs.json HTTP ${response.status}`);
    data = await response.json();
  } catch (firstError) {
    console.warn('GT-GELM: intentando cargar songs.json desde GitHub.', firstError);
    const response = await fetch(REPO_RAW + 'songs.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar songs.json (${response.status}).`);
    data = await response.json();
  }

  state.songs = normalizeSongs(data);

  if (!state.songs.length) {
    throw new Error('songs.json no contiene canciones válidas.');
  }

  applyFilters();

  const lastId = Number(storageGet('gt-gelm-last-id'));
  const lastIndex = state.songs.findIndex(song => song.id === lastId);
  const startIndex = lastIndex >= 0
    ? lastIndex
    : Math.floor(Math.random() * state.songs.length);

  playSong(startIndex, false);

  if (state.shuffle) refillShuffleBag();
}

function applyFilters() {
  const q = state.query.trim().toLocaleLowerCase();

  state.filtered = state.songs.filter(song => {
    const categoryOK = state.filter === 'all' || song.category === state.filter;
    const queryOK = !q ||
      `${song.id} ${song.title} ${song.file}`.toLocaleLowerCase().includes(q);

    return categoryOK && queryOK;
  });

  if (countEl) countEl.textContent = state.songs.length;
  renderList();
}

function renderList() {
  if (!songList) return;

  songList.replaceChildren();

  if (!state.filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'panel-note';
    empty.textContent = 'No hay coincidencias.';
    songList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.filtered.forEach(song => {
    const index = state.songs.indexOf(song);
    const row = document.createElement('button');

    row.type = 'button';
    row.dataset.index = String(index);
    row.className = `song-row${index === state.index ? ' active' : ''}`;

    row.innerHTML = `
      <span class="song-id">${String(song.id).padStart(3, '0')}</span>
      <span>
        <span class="song-title">${escapeHTML(song.title)}</span>
        <small class="song-file">${escapeHTML(song.file)}</small>
      </span>
      <span class="song-play">▶</span>
    `;

    row.addEventListener('click', () => playSong(index, true));
    fragment.appendChild(row);
  });

  songList.appendChild(fragment);
}

function updateActiveRow() {
  if (!songList) return;

  songList.querySelectorAll('.song-row').forEach(row => {
    row.classList.toggle(
      'active',
      Number(row.dataset.index) === state.index
    );
  });
}

function updatePlayButton(playing) {
  const button = $('play');
  if (!button) return;

  button.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"></rect></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13L19 12 8 5.5Z" fill="currentColor"></path></svg>';

  button.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
}

function setMediaSession(song) {
  if (!('mediaSession' in navigator) ||
      typeof MediaMetadata === 'undefined') return;

  try {
    const artwork = song.cover || 'icons/icon-192.png';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: 'GT-GELM',
      album: 'Música Variada · GT-GELM',
      artwork: [
        {
          src: artwork,
          sizes: '192x192',
          type: /\.svg(?:$|\?)/i.test(artwork)
            ? 'image/svg+xml'
            : 'image/png'
        },
        {
          src: 'icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    });

    const handler = (action, callback) => {
      try {
        navigator.mediaSession.setActionHandler(action, callback);
      } catch (_) {}
    };

    handler('play', () => {
      audio.play().catch(showPlayError);
    });

    handler('pause', () => audio.pause());
    handler('previoustrack', prev);
    handler('nexttrack', next);

    handler('seekbackward', details => {
      audio.currentTime = Math.max(
        0,
        audio.currentTime - (details.seekOffset || 10)
      );
    });

    handler('seekforward', details => {
      audio.currentTime = Math.min(
        audio.duration || Infinity,
        audio.currentTime + (details.seekOffset || 10)
      );
    });

    handler('seekto', details => {
      if (Number.isFinite(details.seekTime)) {
        audio.currentTime = details.seekTime;
      }
    });

  } catch (error) {
    console.warn('GT-GELM: Media Session no disponible.', error);
  }
}

function updateMetadata(song) {
  if (titleEl) titleEl.textContent = song.title;

  if (metaEl) {
    metaEl.textContent =
      `GT-GELM · ${String(song.id).padStart(3, '0')} · ${song.category.toUpperCase()}`;
  }

  document.title = `${song.title} · GT-GELM`;

  if (coverEl) {
    coverEl.onerror = () => {
      coverEl.onerror = null;
      coverEl.src = DEFAULT_COVER;
    };

    coverEl.src = song.cover || DEFAULT_COVER;
  }
}

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

function chooseNextIndex() {
  if (!state.songs.length) return -1;

  if (!state.shuffle) {
    return (state.index + 1) % state.songs.length;
  }

  if (!state.shuffleBag.length) refillShuffleBag();

  return state.shuffleBag.length
    ? state.shuffleBag.pop()
    : state.index;
}

function cacheCurrentAudio(url) {
  if (!('serviceWorker' in navigator)) return;

  const worker = navigator.serviceWorker.controller;

  if (worker) {
    worker.postMessage({
      type: 'cache-audio',
      url
    });
  }
}

function playSong(index, autoplay = true) {
  const song = state.songs[index];
  if (!song || !audio) return;

  state.index = index;

  storageSet('gt-gelm-last-id', String(song.id));

  updateMetadata(song);
  setMediaSession(song);
  updateActiveRow();
  loadLyrics(song);

  audio.pause();
  audio.src = song.url;
  audio.load();

  if (autoplay) {
    audio.play().then(() => {
      cacheCurrentAudio(song.url);
      updatePlayButton(true);
    }).catch(showPlayError);
  } else {
    updatePlayButton(false);
  }
}

function showPlayError(error) {
  updatePlayButton(false);

  console.warn('GT-GELM: no se pudo iniciar el audio.', error);

  if (metaEl) {
    metaEl.textContent =
      error?.name === 'NotAllowedError'
        ? 'Toca reproducir para iniciar el audio.'
        : 'No se pudo reproducir · revisa conexión o servidor.';
  }
}

function next() {
  if (!state.songs.length) return;

  if (state.repeat && state.index >= 0) {
    playSong(state.index, true);
    return;
  }

  const nextIndex = chooseNextIndex();

  if (nextIndex >= 0) playSong(nextIndex, true);
}

function prev() {
  if (!state.songs.length) return;

  const previous =
    (state.index - 1 + state.songs.length) % state.songs.length;

  playSong(previous, true);
}

/* Reproducción continua: un solo audio y avance automático. */
audio.onended = next;

audio.addEventListener('play', () => {
  updatePlayButton(true);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'playing';
    } catch (_) {}
  }

  $('heroVitals')?.classList.add('is-playing');
});

audio.addEventListener('pause', () => {
  updatePlayButton(false);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused';
    } catch (_) {}
  }

  $('heroVitals')?.classList.remove('is-playing');
});

audio.addEventListener('error', () => {
  console.error('GT-GELM: error de audio', audio.error, audio.currentSrc);

  if (metaEl) {
    metaEl.textContent =
      'Error al cargar esta canción · comprueba la conexión.';
  }
});

audio.addEventListener('loadedmetadata', () => {
  if (durationEl) durationEl.textContent = fmt(audio.duration);
  if (seek && !state.seeking) seek.value = 0;
});

audio.addEventListener('timeupdate', () => {
  if (currentTimeEl) {
    currentTimeEl.textContent = fmt(audio.currentTime);
  }

  if (seek &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0 &&
      !state.seeking) {
    seek.value = (audio.currentTime / audio.duration) * 100;
  }

  if ('mediaSession' in navigator &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        position: audio.currentTime,
        playbackRate: audio.playbackRate || 1
      });
    } catch (_) {}
  }
});

/* CONTROLES PRINCIPALES */

$('play')?.addEventListener('click', () => {
  if (audio.paused) {
    if (state.index < 0 && state.songs.length) {
      playSong(Math.floor(Math.random() * state.songs.length), true);
    } else {
      audio.play().catch(showPlayError);
    }
  } else {
    audio.pause();
  }
});

$('prev')?.addEventListener('click', prev);
$('next')?.addEventListener('click', next);

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

if (volume) {
  audio.volume = Number(volume.value || 0.85);

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
  });
}

/* BARRA DE PROGRESO */

if (seek) {
  seek.addEventListener('pointerdown', () => {
    state.seeking = true;
  });

  seek.addEventListener('pointerup', () => {
    state.seeking = false;

    if (Number.isFinite(audio.duration)) {
      audio.currentTime =
        Number(seek.value) / 100 * audio.duration;
    }
  });

  seek.addEventListener('pointercancel', () => {
    state.seeking = false;
  });

  seek.addEventListener('change', () => {
    state.seeking = false;

    if (Number.isFinite(audio.duration)) {
      audio.currentTime =
        Number(seek.value) / 100 * audio.duration;
    }
  });
}

/* BIBLIOTECA */

libraryBtn?.addEventListener('click', () => {
  if (!libraryPanel) return;

  libraryPanel.hidden = !libraryPanel.hidden;

  libraryBtn.setAttribute(
    'aria-expanded',
    String(!libraryPanel.hidden)
  );
});

$('closeLibrary')?.addEventListener('click', () => {
  if (libraryPanel) libraryPanel.hidden = true;

  libraryBtn?.setAttribute('aria-expanded', 'false');
});

search?.addEventListener('input', event => {
  state.query = event.target.value;
  applyFilters();
});

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(item => {
      item.classList.remove('active');
    });

    button.classList.add('active');
    state.filter = button.dataset.filter || 'all';

    applyFilters();
  });
});

/* AUDIO DIRECTO Y YOUTUBE */

$('audioDirect')?.addEventListener('click', () => {
  const song = state.songs[state.index];

  if (song) {
    window.open(song.url, '_blank', 'noopener,noreferrer');
  }
});

$('youtubeBtn')?.addEventListener('click', () => {
  const url =
    `https://www.youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`;

  const link = $('openYoutube');

  if (link) link.href = url;

  window.open(url, '_blank', 'noopener,noreferrer');
});

$('closeYoutube')?.addEventListener('click', () => {
  const panel = $('youtubePanel');
  if (panel) panel.hidden = true;
});

/* TEMA */

$('themeBtn')?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

/* LETRAS */

async function loadLyrics(song) {
  if (!lyricsEl) return;

  lyricsEl.hidden = true;

  const toggle = $('lyricsToggle');

  if (toggle) {
    toggle.textContent = 'Mostrar';
    toggle.setAttribute('aria-expanded', 'false');
  }

  const base = song.file.replace(/\.mp3$/i, '');
  const noNumber = base.replace(/^\d{3}-?/, '');

  const upper = noNumber
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const candidates = [
    `lyrics/${base}.txt`,
    `lyrics/${noNumber}.txt`,
    `lyrics/${upper}.txt`
  ];

  for (const path of candidates) {
    try {
      const response = await fetch(path);

      if (response.ok) {
        const text = await response.text();

        if (text.trim()) {
          lyricsEl.textContent = text;
          return;
        }
      }
    } catch (_) {}
  }

  lyricsEl.textContent =
    'Letra no disponible todavía en el repositorio.';
}

$('lyricsToggle')?.addEventListener('click', () => {
  if (!lyricsEl) return;

  lyricsEl.hidden = !lyricsEl.hidden;

  $('lyricsToggle').textContent =
    lyricsEl.hidden ? 'Mostrar' : 'Ocultar';

  $('lyricsToggle').setAttribute(
    'aria-expanded',
    String(!lyricsEl.hidden)
  );
});

/* INSTALACIÓN PWA */

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function setupInstall() {
  const button = $('installBtn');
  if (!button) return;

  if (isStandalone()) {
    button.hidden = true;
    return;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.installPrompt = event;
  });

  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    button.hidden = true;
  });

  button.addEventListener('click', async () => {
    if (state.installPrompt) {
      const prompt = state.installPrompt;
      state.installPrompt = null;

      await prompt.prompt();

      const result = await prompt.userChoice;

      if (result?.outcome === 'accepted') {
        button.hidden = true;
      }
    } else {
      alert(
        'Abre el menú del navegador y selecciona ' +
        '“Instalar aplicación” o “Agregar a pantalla de inicio”.'
      );
    }
  });
}

setupInstall();

/* SERVICE WORKER */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.warn(
        'GT-GELM: Service Worker no registrado.',
        error
      );
    });
  });
}

/* INICIAR REPRODUCTOR */

loadSongs().catch(error => {
  console.error('GT-GELM:', error);

  if (titleEl) {
    titleEl.textContent = 'No se pudo cargar la biblioteca';
  }

  if (metaEl) {
    metaEl.textContent = error.message;
  }
});
