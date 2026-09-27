(() => {
  'use strict';

  const CFG = window.GT_GELM_CONFIG || {
    AUDIO_BASE_URL: 'https://divine-king-c86b.chapin7839.workers.dev/',
    YOUTUBE_CHANNEL_URL: 'https://www.youtube.com/@GT-GELM',
    DEFAULT_COVER: 'img/banner-principal-gtgelm.png',
    DATA_FILE: 'songs.json',
    VERSION: '2.0.0'
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    playlist: $('playlist'),
    search: $('searchInput'),
    songCount: $('songCount'),
    audio: $('main-audio'),
    cover: $('current-cover'),
    title: $('current-title'),
    author: $('current-author'),
    meta: $('current-meta'),
    status: $('statusPill'),
    play: $('playBtn'),
    prev: $('prevBtn'),
    next: $('nextBtn'),
    shuffle: $('shuffleBtn'),
    repeat: $('repeatBtn'),
    seek: $('seek'),
    currentTime: $('currentTime'),
    duration: $('duration'),
    volume: $('volume'),
    mute: $('muteBtn'),
    openAudio: $('openAudioBtn'),
    lyrics: $('lyricsBox'),
    lyricsToggle: $('lyricsToggle'),
    audioMode: $('audioModeBtn'),
    youtubeMode: $('youtubeModeBtn'),
    youtubePanel: $('youtubePanel'),
    youtubeFrame: $('youtubeFrame'),
    youtubeEmpty: $('youtubeEmpty'),
    youtubeTitle: $('youtubeTitle'),
    youtubeExternal: $('youtubeExternal'),
    themeBtn: $('themeBtn'),
    installBtn: $('installBtn')
  };

  let songs = [];
  let filtered = [];
  let currentIndex = -1;
  let currentSong = null;
  let activeFilter = 'all';
  let shuffle = false;
  let repeat = false;
  let lyricsVisible = true;
  let deferredInstallPrompt = null;

  const titleFromFilename = (filename = '') => {
    let name = filename.split('/').pop().replace(/\.mp3$/i, '');
    name = decodeURIComponent(name);
    name = name.replace(/^\d{3}[-_]?/, '');
    return name
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Canción sin título';
  };

  const getFilename = (song) => {
    const candidate = song.file || song.audio || '';
    try {
      if (/^https?:\/\//i.test(candidate)) {
        const u = new URL(candidate);
        return decodeURIComponent(u.pathname.split('/').pop() || '');
      }
    } catch (_) {}
    return decodeURIComponent(String(candidate).split('/').pop() || '');
  };

  const getAudioUrl = (song) => {
    const raw = String(song?.file || song?.audio || '').trim();
    const filename = getFilename(song);
    if (!filename && !raw) return '';

    // Acepta tanto nombre de archivo como URL completa.
    // Para el catálogo GT-GELM preferimos SIEMPRE el nombre limpio y
    // construimos una sola ruta desde AUDIO_BASE_URL.
    if (filename) {
      return `${CFG.AUDIO_BASE_URL.replace(/\/$/, '')}/${encodeURIComponent(filename)}`;
    }
    return raw;
  };

  const describeMediaError = () => {
    const e = els.audio.error;
    if (!e) return 'Error desconocido de audio.';
    const labels = {
      1: 'Carga cancelada.',
      2: 'Error de red al cargar el MP3.',
      3: 'Error al decodificar el MP3.',
      4: 'El formato o la fuente del MP3 no es compatible.'
    };
    return labels[e.code] || `Error de audio (código ${e.code}).`;
  };

  const slugify = (value = '') => decodeURIComponent(String(value))
    .replace(/\.mp3$/i, '')
    .replace(/^\d{3}[-_]*/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  const getLyricsCandidates = (song) => {
    if (song?.lyrics) return [song.lyrics];
    const filename = getFilename(song);
    const base = slugify(filename);
    const title = slugify(song?.title || '');
    const candidates = [];
    for (const key of [base, title]) {
      if (key) {
        candidates.push(`lyrics/${encodeURIComponent(key)}.txt`);
        candidates.push(`lyrics/${encodeURIComponent(key.replace(/_+/g, '_'))}.txt`);
      }
    }
    return [...new Set(candidates)];
  };

  const getLyricsUrl = (song) => getLyricsCandidates(song)[0] || '';

  const categoryOf = (song) => {
    const text = `${song.title || ''} ${song.file || ''}`.toLowerCase();
    if (/pmt|polic[ií]a|tr[aá]nsito|chimaltenango/.test(text)) return 'pmt';
    if (/maya|xinka|xinca|quich[eé]|quiche|ixc[aá]n|sag|nawal|at[it]l[aá]n|hu[h]ue|belice|sambaj|cult|tradici|guatemala/.test(text)) return 'cultura';
    return 'historias';
  };

  const normalizeSong = (song, i) => {
    const filename = getFilename(song);
    return {
      ...song,
      id: Number(song.id) || i + 1,
      title: song.title || titleFromFilename(filename || song.file),
      category: song.category || categoryOf(song),
      author: song.author || song.artist || 'GT-GELM Producciones',
      file: song.file || filename,
      cover: song.cover || CFG.DEFAULT_COVER,
      lyrics: song.lyrics || '',
      youtube: song.youtube || song.youtubeId || ''
    };
  };

  const formatTime = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const extractYoutubeId = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const u = new URL(raw);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/embed\/([^/]+)/);
      if (m) return m[1];
    } catch (_) {}
    return '';
  };

  function renderPlaylist(list) {
    filtered = list;
    els.songCount.textContent = String(songs.length);
    els.playlist.innerHTML = '';

    if (!list.length) {
      els.playlist.innerHTML = '<div class="loading-item">No se encontraron canciones.</div>';
      return;
    }

    list.forEach((song, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `track-row${song === currentSong ? ' active' : ''}`;
      row.dataset.index = String(index);
      row.innerHTML = `
        <span class="track-num">${String(song.id).padStart(3, '0')}</span>
        <span class="track-copy">
          <strong>${escapeHtml(song.title)}</strong>
          <small>${escapeHtml(getFilename(song))}</small>
        </span>
        <span class="track-play">▶</span>`;
      row.addEventListener('click', () => playSong(song));
      els.playlist.appendChild(row);
    });
  }

  function applyFilters() {
    const q = els.search.value.toLowerCase().trim();
    let list = songs;

    if (activeFilter !== 'all') list = list.filter(s => s.category === activeFilter);
    if (q) {
      list = list.filter(s => `${s.id} ${s.title} ${s.file}`.toLowerCase().includes(q));
    }
    renderPlaylist(list);
  }

  function updateMode() {
    const id = extractYoutubeId(currentSong?.youtube);
    const hasYoutube = Boolean(id);
    els.audioMode.classList.toggle('active', els.youtubePanel.classList.contains('hidden'));
    els.youtubeMode.classList.toggle('active', !els.youtubePanel.classList.contains('hidden'));
    els.youtubeEmpty.classList.toggle('hidden', hasYoutube);
    els.youtubeFrame.classList.toggle('hidden', !hasYoutube);
    els.youtubeFrame.src = hasYoutube
      ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
      : '';
    els.youtubeTitle.textContent = currentSong ? `${currentSong.title} · YouTube` : 'YouTube GT-GELM';
    els.youtubeExternal.href = hasYoutube
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
      : CFG.YOUTUBE_CHANNEL_URL;
  }

  async function loadLyrics(song) {
    const urls = getLyricsCandidates(song);
    if (!urls.length) {
      els.lyrics.textContent = 'Esta canción todavía no tiene letra enlazada.';
      return;
    }

    els.lyrics.textContent = 'Cargando letra...';
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = await response.text();
        if (text.trim()) {
          els.lyrics.textContent = text.trim();
          return;
        }
      } catch (_) {}
    }
    els.lyrics.textContent = 'Letra no disponible todavía en el repositorio.';
  }

  function selectIndexFor(song) {
    return filtered.findIndex(s => s.id === song.id);
  }

  function markActive() {
    document.querySelectorAll('.track-row').forEach(btn => {
      const id = Number(btn.dataset.index);
      btn.classList.toggle('active', filtered[id]?.id === currentSong?.id);
    });
  }

  function playSong(song, autoplay = true) {
    currentSong = song;
    currentIndex = songs.findIndex(s => s.id === song.id);

    els.title.textContent = song.title;
    els.meta.textContent = `GT-GELM · ${String(song.id).padStart(3, '0')} · ${song.category}`;
    els.author.textContent = song.author;
    els.status.textContent = 'CARGANDO';

    const audioUrl = getAudioUrl(song);
    if (!audioUrl) {
      els.status.textContent = 'SIN AUDIO';
      els.lyrics.textContent = 'Esta pista no tiene un archivo de audio configurado.';
      return;
    }

    console.info('[GT-GELM] Audio:', audioUrl);
    els.audio.pause();
    els.audio.removeAttribute('src');
    els.audio.load();
    els.audio.src = audioUrl;
    els.audio.preload = 'metadata';
    els.audio.load();

    els.cover.src = song.cover || CFG.DEFAULT_COVER;
    els.cover.onerror = () => {
      els.cover.onerror = null;
      els.cover.src = CFG.DEFAULT_COVER;
    };

    markActive();
    loadLyrics(song);
    updateMode();

    if (autoplay) {
      els.audio.play().then(() => {
        els.play.textContent = '⏸';
        els.status.textContent = 'SONANDO';
      }).catch(() => {
        els.play.textContent = '▶';
        els.status.textContent = 'LISTO';
      });
    }
  }

  function nextTrack() {
    if (!songs.length) return;
    if (shuffle) {
      let next = Math.floor(Math.random() * songs.length);
      if (songs.length > 1 && next === currentIndex) next = (next + 1) % songs.length;
      return playSong(songs[next]);
    }
    const next = currentIndex < 0 ? 0 : (currentIndex + 1) % songs.length;
    playSong(songs[next]);
  }

  function prevTrack() {
    if (!songs.length) return;
    if (els.audio.currentTime > 5) {
      els.audio.currentTime = 0;
      return;
    }
    const prev = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
    playSong(songs[prev]);
  }

  async function loadSongs() {
    try {
      const response = await fetch(CFG.DATA_FILE, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('songs.json no contiene un arreglo');
      songs = data.map(normalizeSong).sort((a, b) => a.id - b.id);
      applyFilters();
      els.status.textContent = `${songs.length} PISTAS`;
    } catch (error) {
      console.error(error);
      els.playlist.innerHTML = `<div class="loading-item error">No se pudo cargar songs.json.<br><small>${escapeHtml(error.message)}</small></div>`;
      els.status.textContent = 'ERROR';
    }
  }

  els.play.addEventListener('click', () => {
    if (!els.audio.src && songs[0]) return playSong(songs[0]);
    if (els.audio.paused) {
      els.audio.play().catch(() => {});
    } else {
      els.audio.pause();
    }
  });

  els.prev.addEventListener('click', prevTrack);
  els.next.addEventListener('click', nextTrack);
  els.shuffle.addEventListener('click', () => {
    shuffle = !shuffle;
    els.shuffle.classList.toggle('active-control', shuffle);
  });
  els.repeat.addEventListener('click', () => {
    repeat = !repeat;
    els.repeat.classList.toggle('active-control', repeat);
  });

  els.audio.addEventListener('play', () => {
    els.play.textContent = '⏸';
    els.status.textContent = 'SONANDO';
  });
  els.audio.addEventListener('pause', () => {
    els.play.textContent = '▶';
    if (els.status.textContent !== 'ERROR') els.status.textContent = 'PAUSADO';
  });
  els.audio.addEventListener('loadedmetadata', () => {
    els.duration.textContent = formatTime(els.audio.duration);
  });
  els.audio.addEventListener('timeupdate', () => {
    els.currentTime.textContent = formatTime(els.audio.currentTime);
    if (Number.isFinite(els.audio.duration) && els.audio.duration > 0) {
      els.seek.value = String((els.audio.currentTime / els.audio.duration) * 100);
    }
  });
  els.audio.addEventListener('ended', () => {
    if (repeat) {
      els.audio.currentTime = 0;
      els.audio.play().catch(() => {});
      return;
    }
    nextTrack();
  });
  els.audio.addEventListener('loadstart', () => {
    if (currentSong) els.status.textContent = 'CARGANDO';
  });
  els.audio.addEventListener('canplay', () => {
    if (!els.audio.paused) els.status.textContent = 'SONANDO';
    else if (currentSong) els.status.textContent = 'LISTO';
  });
  els.audio.addEventListener('error', () => {
    const message = describeMediaError();
    console.error('[GT-GELM] Audio error:', message, els.audio.currentSrc || els.audio.src);
    els.status.textContent = 'AUDIO ERROR';
    els.openAudio.title = message;
  });

  els.seek.addEventListener('input', () => {
    if (Number.isFinite(els.audio.duration)) {
      els.audio.currentTime = (Number(els.seek.value) / 100) * els.audio.duration;
    }
  });
  els.volume.addEventListener('input', () => {
    els.audio.volume = Number(els.volume.value);
    els.audio.muted = false;
  });
  els.mute.addEventListener('click', () => {
    els.audio.muted = !els.audio.muted;
    els.mute.textContent = els.audio.muted ? 'Activar' : 'Silencio';
  });
  els.openAudio.addEventListener('click', () => {
    if (currentSong) window.open(getAudioUrl(currentSong), '_blank', 'noopener');
  });

  els.search.addEventListener('input', applyFilters);
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  els.lyricsToggle.addEventListener('click', () => {
    lyricsVisible = !lyricsVisible;
    els.lyrics.classList.toggle('collapsed', !lyricsVisible);
    els.lyricsToggle.textContent = lyricsVisible ? 'Ocultar' : 'Mostrar';
  });

  els.audioMode.addEventListener('click', () => {
    els.youtubePanel.classList.add('hidden');
    updateMode();
  });
  els.youtubeMode.addEventListener('click', () => {
    els.youtubePanel.classList.remove('hidden');
    updateMode();
  });

  els.themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dim-mode');
    localStorage.setItem('gt-gelm-dim', document.body.classList.contains('dim-mode') ? '1' : '0');
  });
  if (localStorage.getItem('gt-gelm-dim') === '1') document.body.classList.add('dim-mode');

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); els.play.click(); }
    if (e.key === 'ArrowRight') nextTrack();
    if (e.key === 'ArrowLeft') prevTrack();
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  els.audio.volume = 0.8;
  loadSongs();
})();
