(() => {
  'use strict';

  // ============================================================
  // GT-GELM Reproductor v4
  // Base estable: versión 2 que ya reproducía desde Cloudflare.
  // Correcciones principales frente a v3:
  // 1) config.js es global (window.GT_GELM_CONFIG).
  // 2) Audio URL soporta filename, URL Cloudflare y URL antigua.
  // 3) La reproducción NO pasa primero por CacheStorage.
  // 4) IDs y eventos están centralizados para evitar referencias rotas.
  // ============================================================

  const CFG = Object.freeze({
    AUDIO_BASE_URL: 'https://divine-king-c86b.chapin7839.workers.dev/',
    YOUTUBE_CHANNEL_URL: 'https://www.youtube.com/@GT-GELM',
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
    VERSION: '4.0.0',
    ...(window.GT_GELM_CONFIG || {})
  });

  const $ = id => document.getElementById(id);

  const els = {
    audio: $('audio'),
    title: $('title'),
    meta: $('meta'),
    cover: $('cover'),
    status: $('status'),
    play: $('play'),
    prev: $('prev'),
    next: $('next'),
    shuffle: $('shuffle'),
    repeat: $('repeat'),
    seek: $('seek'),
    currentTime: $('currentTime'),
    duration: $('duration'),
    volume: $('volume'),
    mute: $('mute'),
    audioDirect: $('audioDirect'),
    saveOffline: $('saveOffline'),
    libraryBtn: $('libraryBtn'),
    libraryPanel: $('libraryPanel'),
    closeLibrary: $('closeLibrary'),
    search: $('search'),
    count: $('count'),
    songList: $('songList'),
    lyrics: $('lyrics'),
    lyricsToggle: $('lyricsToggle'),
    youtubePanel: $('youtubePanel'),
    youtubeBtn: $('youtubeBtn'),
    closeYoutube: $('closeYoutube'),
    videoWrap: $('videoWrap'),
    videoTitle: $('videoTitle'),
    openYoutube: $('openYoutube'),
    videoNote: $('videoNote'),
    themeBtn: $('themeBtn'),
    installBtn: $('installBtn'),
    toast: $('toast'),
    filterButtons: [...document.querySelectorAll('.filter')]
  };

  const missing = Object.entries(els)
    .filter(([key, value]) => key !== 'filterButtons' && !value)
    .map(([key]) => key);

  if (missing.length) {
    console.error('[GT-GELM v4] Faltan elementos HTML:', missing);
    return;
  }

  const state = {
    songs: [],
    filtered: [],
    index: -1,
    shuffle: false,
    repeat: false,
    filter: 'all',
    query: '',
    deferredInstall: null,
    youtube: { videos: {}, channelUrl: CFG.YOUTUBE_CHANNEL_URL },
    coverMap: { aliases: {} },
    lyricsMap: {},
    pendingLoadToken: 0,
    audioCandidates: [],
    audioCandidateIndex: 0,
    audioLoadToken: 0,
    currentAudioUrl: ''
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch]));
  }

  function pad3(value) {
    return String(value).padStart(3, '0');
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function slug(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function rawSongValue(song) {
    return String(song?.file || song?.audio || song?.url || '').trim();
  }

  function getFilename(song) {
    const raw = rawSongValue(song);
    if (!raw) return '';

    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        return decodeURIComponent(url.pathname.split('/').pop() || '');
      }
    } catch (_) {}

    return decodeURIComponent(raw.split('/').pop() || '');
  }

  function getAudioUrl(song, filenameOverride = '') {
    const raw = rawSongValue(song);
    const filename = filenameOverride || getFilename(song);

    // URL absoluta del Worker actual: conservar exactamente la URL.
    if (/^https?:\/\/[^/]*workers\.dev\//i.test(raw) && !filenameOverride) return raw;

    // Cualquier URL absoluta antigua (gelm.pages.dev, etc.) se migra
    // automáticamente al alojamiento Cloudflare nuevo usando el nombre.
    if (filename) {
      const base = String(CFG.AUDIO_BASE_URL || CFG.AUDIO_BASE || '').replace(/\/+$/, '');
      return `${base}/${encodeURIComponent(filename)}`;
    }

    return raw;
  }

  function cleanAudioSlug(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’`]/g, '-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getAudioCandidates(song) {
    const candidates = [];
    const add = value => {
      if (!value) return;
      const url = String(value);
      if (!candidates.includes(url)) candidates.push(url);
    };

    const raw = rawSongValue(song);
    const filename = getFilename(song);
    add(getAudioUrl(song));

    // Compatibilidad con el lote de MP3 renombrados 001–118:
    // si songs.json todavía trae la URL/nombre antiguo, probamos también
    // el nombre ASCII numerado generado a partir del ID y del título/archivo.
    const id = Number(song.id);
    const prefixes = Number.isFinite(id) ? pad3(id) : '';
    const titleSlug = cleanAudioSlug(song.title);
    const fileBase = cleanAudioSlug(filename.replace(/\.mp3$/i, '').replace(/^\d{3}[-_]?/, ''));

    if (prefixes && titleSlug) add(getAudioUrl(song, `${prefixes}-${titleSlug}.mp3`));
    if (prefixes && fileBase) add(getAudioUrl(song, `${prefixes}-${fileBase}.mp3`));

    // Si el JSON ya trae una URL absoluta que no es workers.dev, el primer
    // candidato ya apunta al Worker nuevo; estos candidatos son solo respaldo.
    if (!candidates.length && raw) add(raw);
    return candidates;
  }

  function titleFromFilename(filename, id) {
    let name = String(filename || '')
      .replace(/\.mp3$/i, '')
      .replace(/^\d{3}[-_]?/, '')
      .replace(/-gt-gelm-mp3-160k$/i, '')
      .replace(/-mp3-160k$/i, '')
      .replace(/-gt-gelm$/i, '')
      .replace(/-+$/g, '');

    const special = {
      'bohemio': 'Bohemio',
      'al-volante-por-la-vida': 'Al Volante por la Vida',
      'guatemala-inmortaal': 'Guatemala Inmortal',
      'esta-es-mi-guatemala-rock': 'Esta Es Mi Guatemala Rock',
      'title-gt-aprendiendo-de-nuestra-bella-guatemala': 'Aprendiendo de Nuestra Bella Guatemala',
      'guatemala-nunca-se-rinde-gt-gelm': 'Guatemala Nunca Se Rinde',
      'las-25-vices-de-guatemala': 'Las 25 Voces de Guatemala',
      'patrulleros-del-norte-ruta-del-setenta-y-cuatro-gt-gelm': 'Patrulleros del Norte · Ruta del Setenta y Cuatro',
      'naj-tunich-el-descenso-al-xibalba-gt-gelm': 'Naj Tunich · El Descenso al Xibalbá'
    };

    if (special[name]) return special[name];

    const result = name
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (result) {
      return result
        .split(' ')
        .map(word => word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\bGt\b/g, 'GT-GELM');
    }

    return `Canción ${pad3(id)}`;
  }

  function categoryFor(song) {
    const text = `${song.id} ${song.title || ''} ${rawSongValue(song)}`.toLowerCase();

    if (/pmt|polic[ií]a|tr[aá]nsito|chimaltenango/.test(text)) return 'pmt';
    if (/(xinka|xinca|quich[eé]|kiche|ixc[aá]n|maya|nawal|at[it]l[aá]n|huehuetenango|belice|samabaj|tulate|chinautla|alotenango|volcan|tierra|patrulleros|tecun|xibalba|guatemala|tradicion|cultura)/i.test(text)) return 'cultura';
    return 'historias';
  }

  function normalizeSong(song, index) {
    const id = Number(song?.id) || index + 1;
    const filename = getFilename(song);
    const title = String(song?.title || titleFromFilename(filename, id)).trim();

    return {
      ...song,
      id,
      file: String(song?.file || filename || '').trim(),
      title,
      category: String(song?.category || categoryFor({ id, title, file: filename })).toLowerCase(),
      author: song?.author || song?.artist || 'GT-GELM Producciones',
      cover: song?.cover || '',
      lyrics: song?.lyrics || '',
      youtube: song?.youtube || song?.youtubeId || ''
    };
  }

  async function loadJson(path, fallback) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (_) {
      return fallback;
    }
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 3000);
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function setAudioStateError() {
    const song = currentSong();
    const url = song ? getAudioUrl(song) : '';
    setStatus('AUDIO ERROR');
    showToast(url ? `No se pudo cargar el audio · ${url}` : 'No se pudo cargar el audio.');
    console.error('[GT-GELM v4] Audio error:', url);
  }

  function currentSong() {
    return state.songs[state.index] || null;
  }

  function renderLibrary() {
    const query = state.query.trim().toLowerCase();

    state.filtered = state.songs.filter(song => {
      const categoryOk = state.filter === 'all' || song.category === state.filter;
      const text = `${pad3(song.id)} ${song.title} ${song.file}`.toLowerCase();
      const queryOk = !query || text.includes(query);
      return categoryOk && queryOk;
    });

    els.count.textContent = String(state.songs.length);

    if (!state.filtered.length) {
      els.songList.innerHTML = '<div class="empty-list">No se encontraron canciones.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(song => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `song-row${song.id === currentSong()?.id ? ' active' : ''}`;
      row.dataset.id = String(song.id);
      row.innerHTML = `
        <span class="song-id">${pad3(song.id)}</span>
        <span class="song-main">
          <strong>${esc(song.title)}</strong>
          <small>GT-GELM · ${esc(song.category.toUpperCase())}</small>
        </span>
        <span class="song-play">▶</span>`;
      fragment.appendChild(row);
    });

    els.songList.replaceChildren(fragment);
  }

  function applyCover(song) {
    const candidates = [];
    const push = value => {
      if (!value) return;
      const normalized = String(value).trim();
      if (!candidates.includes(normalized)) candidates.push(normalized);
    };

    push(song.cover);

    const mapped = state.coverMap?.aliases?.[pad3(song.id)] || state.coverMap?.aliases?.[String(song.id)];
    if (mapped) push(String(CFG.IMAGE_DIR || './img/') + mapped.replace(/^\.\//, ''));

    const key = slug(song.title);
    if (key) {
      push(`img/${key}.png`);
      push(`img/${key}.jpg`);
      push(`img/${key}.webp`);
    }

    const rules = [
      [/guatemala-nunca-se-rinde/i, 'GUATEMALA-NUNCA-SE-RINDE.png'],
      [/guatemala-ruge/i, 'GUATEMALA-RUGE.png'],
      [/guatemala-tierra-de-volcanes/i, 'GUATEMALA-TIERRA-DE-VOLCANES.png'],
      [/guatemala-siempre-tiene-algo-mas/i, 'GUATEMALA-SIEMPRE-TIENE-ALGO-MAS.png'],
      [/alotenango/i, 'ALOTENANGO.png'],
      [/al-volante/i, 'AL-VOLANTE-POR-LA-VIDA.png'],
      [/aprendiendo.*bella.*guatemala/i, 'APRENDIENDO-DE-NUESTRA-BELLA-GUATEMALA.png'],
      [/atitlan.*lago|lago.*atitlan/i, 'ATITLAN-LAGO-VIVO.png'],
      [/belice/i, 'BELICE.png'],
      [/chinautla/i, 'CHINAUTLA.png'],
      [/15.*septiembre|quince.*septiembre/i, '15-DE-SEPTIEMBRE-GUATEMALA-LIBRE.png'],
      [/descenso.*xibalba/i, 'EL-DESCENSO-AL-XIBALBA.png'],
      [/vuelo.*quetzal/i, 'EL-VUELO-DEL-QUETZAL.png'],
      [/pozo.*vivo/i, 'POZO-VIVO.png'],
      [/samabaj/i, 'SAMABAJ-LA-ATLANTIDA-MAYA.png'],
      [/suchiate/i, 'SUCHIATE-1.png'],
      [/tec.?n.*uman.*2/i, 'TE CUN-UMAN-2.png'],
      [/tec.?n.*uman.*3/i, 'TE CUN-UMAN-3.png'],
      [/xinka/i, 'xinka.png']
    ];

    const hay = `${song.file} ${song.title}`;
    rules.forEach(([regex, filename]) => {
      if (regex.test(hay)) push(`img/${filename}`);
    });

    push(CFG.DEFAULT_COVER || 'img/banner-principal-gtgelm.png');
    push(CFG.FALLBACK_COVER || 'assets/img/default-cover.svg');

    let pointer = 0;
    const tryNext = () => {
      if (pointer >= candidates.length) return;
      els.cover.src = candidates[pointer++];
    };

    els.cover.onerror = tryNext;
    tryNext();
  }

  function extractYoutubeId(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^[-_A-Za-z0-9]{11}$/.test(raw)) return raw;

    try {
      const url = new URL(raw);
      if (url.hostname.includes('youtu.be')) return url.pathname.replace(/^\//, '').split('/')[0];
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const embed = url.pathname.match(/\/embed\/([^/]+)/);
      if (embed) return embed[1];
    } catch (_) {}

    const match = raw.match(/(?:youtu\.be\/|v=|embed\/)([-_A-Za-z0-9]{11})/);
    return match ? match[1] : '';
  }

  function youtubeInfo(song) {
    const key = pad3(song.id);
    let value = song.youtube || state.youtube?.videos?.[key] || state.youtube?.videos?.[String(song.id)] || '';

    if (value && typeof value === 'object') value = value.id || value.url || '';
    const id = extractYoutubeId(value);

    return {
      id,
      url: id
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
        : CFG.YOUTUBE_CHANNEL_URL,
      title: id && typeof state.youtube?.videos?.[key] === 'object'
        ? (state.youtube.videos[key].title || song.title)
        : song.title
    };
  }

  function updateYoutubePanel(song, open = false) {
    const info = youtubeInfo(song);

    els.videoTitle.textContent = `${song.title} · YouTube`;
    els.openYoutube.href = info.url;
    els.videoWrap.innerHTML = '';

    if (info.id) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(info.id)}?rel=0&modestbranding=1&playsinline=1`;
      iframe.title = info.title || song.title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      els.videoWrap.appendChild(iframe);
      els.videoNote.textContent = 'Video configurado para esta canción.';
    } else {
      els.videoWrap.innerHTML = '<div class="video-empty">Esta canción todavía no tiene un video configurado.<br><br>Usa “Abrir” para visitar GT-GELM en YouTube.</div>';
      els.videoNote.textContent = 'El reproductor busca primero un ID guardado en youtube.json o en songs.json.';
    }

    if (open) els.youtubePanel.hidden = false;
  }

  function toggleYoutube() {
    const song = currentSong();
    if (!song) return;
    if (els.youtubePanel.hidden) updateYoutubePanel(song, true);
    else els.youtubePanel.hidden = true;
  }

  function lyricsCandidates(song) {
    const candidates = [];

    const mapped = state.lyricsMap?.[pad3(song.id)] || state.lyricsMap?.[String(song.id)];
    if (mapped) candidates.push(String(CFG.LYRICS_DIR) + String(mapped).replace(/^\.\//, ''));

    if (song.lyrics) candidates.push(String(song.lyrics));

    const base = getFilename(song).replace(/\.mp3$/i, '');
    const noNum = base.replace(/^\d{3}[-_]?/, '');
    const upper = noNum
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const titleSlug = slug(song.title).replace(/-/g, '_').toUpperCase();

    candidates.push(`lyrics/${base}.txt`);
    candidates.push(`lyrics/${noNum}.txt`);
    candidates.push(`lyrics/${upper}.txt`);
    candidates.push(`lyrics/${titleSlug}.txt`);
    candidates.push(`lyrics/${String(song.title).toUpperCase().replace(/\s+/g, '_')}.txt`);

    return [...new Set(candidates.filter(Boolean))];
  }

  async function loadLyrics(song) {
    const token = ++state.pendingLoadToken;
    els.lyrics.textContent = 'Cargando letra...';

    for (const path of lyricsCandidates(song)) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = await response.text();
        if (!text.trim()) continue;
        if (token !== state.pendingLoadToken) return;
        els.lyrics.textContent = text.trim();
        return;
      } catch (_) {}
    }

    if (token === state.pendingLoadToken) {
      els.lyrics.textContent = 'Letra no disponible todavía en el repositorio.';
    }
  }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    try {
      const coverSrc = new URL(els.cover.currentSrc || els.cover.src, location.href).href;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: 'GT-GELM Producciones',
        album: `GT-GELM · ${pad3(song.id)}`,
        artwork: [{ src: coverSrc, sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', playAudio);
      navigator.mediaSession.setActionHandler('pause', pauseAudio);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    } catch (_) {}
  }

  async function setSongByIndex(index, autoplay = false) {
    if (!state.songs.length) return;

    if (index < 0) index = state.songs.length - 1;
    if (index >= state.songs.length) index = 0;

    const song = state.songs[index];
    if (!song) return;

    state.index = index;
    const audioCandidates = getAudioCandidates(song);
    const audioToken = ++state.audioLoadToken;
    state.audioCandidates = audioCandidates;
    state.audioCandidateIndex = 0;
    state.currentAudioUrl = audioCandidates[0] || '';

    // PRINCIPAL CORRECCIÓN V4: el audio remoto va directo al elemento audio.
    // No hay resolveAudioSource() intermedio que pueda romper la reproducción.
    els.audio.pause();
    els.audio.src = state.currentAudioUrl;
    els.audio.load();

    els.title.textContent = song.title;
    els.meta.textContent = `GT-GELM · ${pad3(song.id)} · ${String(song.category).toUpperCase()}`;
    document.title = `${song.title} · GT-GELM`;
    els.seek.value = '0';
    els.currentTime.textContent = '00:00';
    els.duration.textContent = '00:00';
    setStatus('LISTO');

    applyCover(song);
    renderLibrary();
    updateYoutubePanel(song, false);
    await loadLyrics(song);
    updateMediaSession(song);

    if (CFG.RESUME_LAST_TRACK !== false) {
      localStorage.setItem('gt-gelm-last-track', String(song.id));
    }

    console.info('[GT-GELM v4] pista:', pad3(song.id), song.title);
    console.info('[GT-GELM v4] audio URL primaria:', state.currentAudioUrl);
    if (audioCandidates.length > 1) console.info('[GT-GELM v4] audio respaldos:', audioCandidates.slice(1));

    if (autoplay) await playAudio();
  }

  async function playAudio() {
    try {
      await els.audio.play();
    } catch (error) {
      console.warn('[GT-GELM v4] play() bloqueado o no disponible:', error);
      showToast('Pulsa ▶ nuevamente para iniciar la reproducción.');
    }
  }

  function pauseAudio() {
    els.audio.pause();
  }

  function nextTrack() {
    if (!state.songs.length) return;
    if (state.repeat) return playAudio();

    if (state.shuffle && state.songs.length > 1) {
      let next = state.index;
      while (next === state.index) next = Math.floor(Math.random() * state.songs.length);
      return setSongByIndex(next, true);
    }

    return setSongByIndex(state.index + 1, true);
  }

  function prevTrack() {
    if (!state.songs.length) return;
    if (els.audio.currentTime > 5) {
      els.audio.currentTime = 0;
      return;
    }
    return setSongByIndex(state.index - 1, true);
  }

  async function loadSongs() {
    try {
      const data = await loadJson(CFG.DATA_FILE, []);
      const rawSongs = Array.isArray(data) ? data : (Array.isArray(data?.songs) ? data.songs : []);
      state.songs = rawSongs
        .map(normalizeSong)
        .filter(song => Boolean(rawSongValue(song)))
        .sort((a, b) => a.id - b.id);

      if (!state.songs.length) {
        throw new Error('songs.json no contiene canciones válidas');
      }

      renderLibrary();
      setStatus(`${state.songs.length} PISTAS`);
      return true;
    } catch (error) {
      console.error('[GT-GELM v4] loadSongs:', error);
      els.songList.innerHTML = `<div class="empty-list error">No se pudo cargar songs.json.<br><small>${esc(error.message)}</small></div>`;
      setStatus('ERROR');
      return false;
    }
  }

  function setInitialSong() {
    if (!state.songs.length) return;

    let targetId = Number(CFG.INITIAL_TRACK_ID || 48);

    if (CFG.RESUME_LAST_TRACK !== false) {
      const saved = Number(localStorage.getItem('gt-gelm-last-track'));
      if (state.songs.some(song => song.id === saved)) targetId = saved;
    }

    const index = state.songs.findIndex(song => song.id === targetId);
    setSongByIndex(index >= 0 ? index : 0, false);
  }

  async function saveOffline() {
    const song = currentSong();
    if (!song) {
      showToast('Selecciona una canción primero.');
      return;
    }

    if (!('caches' in window)) {
      showToast('Este navegador no ofrece almacenamiento offline aquí.');
      return;
    }

    const url = state.currentAudioUrl || getAudioUrl(song);
    try {
      showToast('Guardando canción offline...');
      // Este paso necesita CORS permitido por el Worker Cloudflare.
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const cache = await caches.open(CFG.CACHE_NAME);
      await cache.put(new Request(url), response.clone());
      showToast(`Guardada offline · ${pad3(song.id)} · ${song.title}`);
    } catch (error) {
      console.warn('[GT-GELM v4] No se pudo guardar offline:', error);
      showToast('No se pudo guardar offline. La reproducción online sigue funcionando.');
    }
  }

  function openDirectAudio() {
    const song = currentSong();
    if (!song) return showToast('Selecciona una canción primero.');
    window.open(getAudioUrl(song), '_blank', 'noopener,noreferrer');
  }

  function toggleLibrary(force) {
    const open = typeof force === 'boolean' ? force : els.libraryPanel.hidden;
    els.libraryPanel.hidden = !open;
    els.libraryBtn.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => els.search.focus(), 80);
  }

  function updateControls() {
    const playing = !els.audio.paused && !els.audio.ended;
    els.play.textContent = playing ? '⏸' : '▶';
    els.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    els.shuffle.classList.toggle('active-control', state.shuffle);
    els.repeat.classList.toggle('active-control', state.repeat);
  }

  function registerEvents() {
    els.play.addEventListener('click', () => (els.audio.paused ? playAudio() : pauseAudio()));
    els.prev.addEventListener('click', prevTrack);
    els.next.addEventListener('click', nextTrack);

    els.shuffle.addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      updateControls();
      showToast(state.shuffle ? 'Aleatorio activado.' : 'Reproducción secuencial activada.');
    });

    els.repeat.addEventListener('click', () => {
      state.repeat = !state.repeat;
      updateControls();
      showToast(state.repeat ? 'Repetir canción activado.' : 'Repetir canción desactivado.');
    });

    els.audio.addEventListener('play', () => {
      setStatus('SONANDO');
      updateControls();
    });

    els.audio.addEventListener('pause', () => {
      if (els.status.textContent !== 'AUDIO ERROR') setStatus('PAUSADO');
      updateControls();
    });

    els.audio.addEventListener('loadedmetadata', () => {
      els.duration.textContent = formatTime(els.audio.duration);
      setStatus('LISTO');
    });

    els.audio.addEventListener('timeupdate', () => {
      els.currentTime.textContent = formatTime(els.audio.currentTime);
      if (Number.isFinite(els.audio.duration) && els.audio.duration > 0) {
        els.seek.value = String((els.audio.currentTime / els.audio.duration) * 100);
      }
    });

    els.audio.addEventListener('ended', () => {
      if (state.repeat) {
        els.audio.currentTime = 0;
        playAudio();
      } else {
        nextTrack();
      }
    });

    els.audio.addEventListener('error', () => {
      const token = state.audioLoadToken;
      const hasFallback = state.audioCandidateIndex < state.audioCandidates.length - 1;

      if (token && hasFallback) {
        state.audioCandidateIndex += 1;
        state.currentAudioUrl = state.audioCandidates[state.audioCandidateIndex];
        setStatus('REINTENTANDO');
        console.warn('[GT-GELM v4] Falló candidato de audio; probando respaldo:', state.currentAudioUrl);
        els.audio.src = state.currentAudioUrl;
        els.audio.load();
        if (els.audio.autoplay) playAudio();
        return;
      }

      setAudioStateError();
    });

    els.seek.addEventListener('input', () => {
      if (Number.isFinite(els.audio.duration)) {
        els.audio.currentTime = (Number(els.seek.value) / 100) * els.audio.duration;
      }
    });

    els.volume.addEventListener('input', () => {
      els.audio.volume = Number(els.volume.value);
      localStorage.setItem('gt-gelm-volume', String(els.audio.volume));
      els.audio.muted = false;
      els.mute.textContent = 'Silencio';
    });

    els.mute.addEventListener('click', () => {
      els.audio.muted = !els.audio.muted;
      els.mute.textContent = els.audio.muted ? 'Sonido' : 'Silencio';
    });

    els.audioDirect.addEventListener('click', openDirectAudio);
    els.saveOffline.addEventListener('click', saveOffline);

    els.libraryBtn.addEventListener('click', () => toggleLibrary());
    els.closeLibrary.addEventListener('click', () => toggleLibrary(false));

    els.search.addEventListener('input', event => {
      state.query = event.target.value;
      renderLibrary();
    });

    els.filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        els.filterButtons.forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        state.filter = button.dataset.filter || 'all';
        renderLibrary();
      });
    });

    els.songList.addEventListener('click', event => {
      const row = event.target.closest('[data-id]');
      if (!row) return;
      const id = Number(row.dataset.id);
      const index = state.songs.findIndex(song => song.id === id);
      if (index < 0) return;
      setSongByIndex(index, true);
      if (window.matchMedia('(max-width: 760px)').matches) toggleLibrary(false);
    });

    els.lyricsToggle.addEventListener('click', () => {
      const hidden = els.lyrics.hidden;
      els.lyrics.hidden = !hidden;
      els.lyricsToggle.textContent = hidden ? 'Ocultar' : 'Mostrar';
      els.lyricsToggle.setAttribute('aria-expanded', String(hidden));
    });

    els.youtubeBtn.addEventListener('click', toggleYoutube);
    els.closeYoutube.addEventListener('click', () => { els.youtubePanel.hidden = true; });

    els.themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem('gt-gelm-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    });

    document.addEventListener('keydown', event => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        els.audio.paused ? playAudio() : pauseAudio();
      } else if (event.key === 'ArrowRight') {
        nextTrack();
      } else if (event.key === 'ArrowLeft') {
        prevTrack();
      }
    });

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredInstall = event;
      els.installBtn.hidden = false;
    });

    els.installBtn.addEventListener('click', async () => {
      if (!state.deferredInstall) return;
      state.deferredInstall.prompt();
      try { await state.deferredInstall.userChoice; } catch (_) {}
      state.deferredInstall = null;
      els.installBtn.hidden = true;
    });
  }

  async function init() {
    if (localStorage.getItem('gt-gelm-theme') === 'light') {
      document.body.classList.add('light');
    }

    const savedVolume = Number(localStorage.getItem('gt-gelm-volume'));
    const volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.85;
    els.audio.volume = volume;
    els.volume.value = String(volume);

    updateControls();
    registerEvents();

    const songsOk = await loadSongs();
    if (!songsOk) return;

    state.youtube = await loadJson(CFG.YOUTUBE_FILE, state.youtube);
    state.coverMap = await loadJson(CFG.COVER_MAP_FILE, state.coverMap);
    state.lyricsMap = await loadJson(CFG.LYRICS_MAP_FILE, state.lyricsMap);

    renderLibrary();
    setInitialSong();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .catch(error => console.warn('[GT-GELM v4] Service Worker:', error));
      });
    }

    console.info(`[GT-GELM v4] inicializado · ${state.songs.length} pistas · inicio ${pad3(CFG.INITIAL_TRACK_ID)}`);
  }

  init();
})();
