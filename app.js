(() => {
  'use strict';

  const cfg = window.GT_GELM_CONFIG || {};
  const AUDIO_BASE = String(cfg.AUDIO_BASE || '').replace(/\/+$/, '') + '/';
  const IMAGE_DIR = cfg.IMAGE_DIR || './img/';
  const DEFAULT_COVER = cfg.DEFAULT_COVER || './assets/img/default-cover.svg';
  const LYRICS_DIR = cfg.LYRICS_DIR || './lyrics/';
  const CHANNEL = cfg.YOUTUBE_CHANNEL || 'https://www.youtube.com/@GT-GELM';
  const INITIAL_ID = Number(cfg.INITIAL_TRACK_ID || 48);

  const $ = id => document.getElementById(id);
  const audio = $('audio');
  const titleEl = $('title');
  const metaEl = $('meta');
  const coverEl = $('cover');
  const playBtn = $('play');
  const seekEl = $('seek');
  const currentEl = $('currentTime');
  const durationEl = $('duration');
  const volumeEl = $('volume');
  const muteBtn = $('mute');
  const libraryPanel = $('libraryPanel');
  const libraryBtn = $('libraryBtn');
  const songList = $('songList');
  const searchEl = $('search');
  const countEl = $('count');
  const lyricsEl = $('lyrics');
  const lyricsToggle = $('lyricsToggle');
  const youtubePanel = $('youtubePanel');
  const videoWrap = $('videoWrap');
  const videoTitle = $('videoTitle');
  const openYoutube = $('openYoutube');
  const videoNote = $('videoNote');
  const toast = $('toast');

  let activeObjectUrl = '';

  const state = {
    songs: [],
    filtered: [],
    index: -1,
    shuffle: true,
    repeat: false,
    filter: 'all',
    query: '',
    lastVolume: 0.85,
    deferredInstall: null,
    youtube: { channelUrl: CHANNEL, videos: {} },
    coverMap: { aliases: {} },
    lyricsMap: {}
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function pad3(n) { return String(n).padStart(3, '0'); }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  }

  function slug(text) {
    return String(text || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function titleFromFilename(file, id) {
    let base = String(file || '').replace(/\.mp3$/i, '');
    base = base.replace(/^\d{3}-/, '');
    base = base.replace(/-+$/g, '');
    base = base
      .replace(/-gt-gelm-mp3-160k$/i, '')
      .replace(/-mp3-160k$/i, '')
      .replace(/-gt-gelm$/i, '')
      .replace(/-1$/i, m => (id === 1 ? m : ''));

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
    if (special[base]) return special[base];

    return base
      .replace(/-+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/\bGt\b/g, 'GT-GELM');
  }

  function categoryFor(song) {
    const t = `${song.id} ${song.title} ${song.file}`.toLowerCase();
    if (t.includes('pmt') || t.includes('chimaltenango-1') || t.includes('chimaltenango-2')) return 'pmt';
    if (/(xinka|quiche|kiche|guatemala|tradiciones|marimba|atlant|belice|huehuetenango|samabaj|tulate|atitlan|chinautla|alotenango|volcan|tierra|patrulleros|tecun|xibalba)/i.test(t)) return 'cultura';
    return 'historias';
  }

  function audioUrl(song) {
    return AUDIO_BASE + encodeURIComponent(song.file).replace(/%2F/g, '/');
  }

  function youtubeInfo(song) {
    const key = pad3(song.id);
    const v = state.youtube?.videos?.[key] || state.youtube?.videos?.[song.id] || null;
    if (!v) return { id: '', url: CHANNEL, title: song.title };
    const id = typeof v === 'string' ? v : v.id;
    return { id, url: id ? `https://www.youtube.com/watch?v=${id}` : CHANNEL, title: (v && v.title) || song.title };
  }

  function coverCandidates(song) {
    const id = pad3(song.id);
    const candidates = [];
    const explicit = state.coverMap?.aliases?.[id];
    if (explicit) candidates.push(IMAGE_DIR + explicit);

    const s = slug(song.title);
    if (s) {
      candidates.push(IMAGE_DIR + `${s}.png`);
      candidates.push(IMAGE_DIR + `${s.toUpperCase()}.png`);
    }

    const aliasRules = [
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
      [/quince.*septiembre|15.*septiembre/i, '15-DE-SEPTIEMBRE-GUATEMALA-LIBRE.png'],
      [/descenso.*xibalba/i, 'EL-DESCENSO-AL-XIBALBA.png'],
      [/vuelo.*quetzal/i, 'EL-VUELO-DEL-QUETZAL.png'],
      [/pozo.*vivo/i, 'POZO-VIVO.png'],
      [/samabaj/i, 'SAMABAJ-LA-ATLANTIDA-MAYA.png'],
      [/suchiate/i, 'SUCHIATE-1.png'],
      [/tecun.*uman.*2/i, 'TE CUN-UMAN-2.png'],
      [/tecun.*uman.*3/i, 'TE CUN-UMAN-3.png'],
      [/xinka/i, 'xinka.png']
    ];
    const hay = `${song.file} ${song.title}`;
    for (const [re, file] of aliasRules) if (re.test(hay)) candidates.push(IMAGE_DIR + file);
    candidates.push(DEFAULT_COVER);
    return [...new Set(candidates)];
  }

  function loadCover(song) {
    const candidates = coverCandidates(song);
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) return;
      coverEl.src = candidates[i++];
    };
    coverEl.onerror = tryNext;
    tryNext();
  }

  async function loadJson(path, fallback) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      return await res.json();
    } catch {
      return fallback;
    }
  }

  async function loadSongs() {
    const data = await loadJson('./songs.json', []);
    state.songs = Array.isArray(data) ? data.map((x, i) => ({
      id: Number(x.id || i + 1),
      file: String(x.file || ''),
      title: x.title || titleFromFilename(x.file, Number(x.id || i + 1)),
      category: x.category || categoryFor({ id: Number(x.id || i + 1), file: x.file || '', title: x.title || '' })
    })).filter(x => x.file) : [];
    countEl.textContent = state.songs.length;
    state.filtered = [...state.songs];
  }

  function currentSong() { return state.songs[state.index] || null; }

  function renderLibrary() {
    const q = state.query.trim().toLowerCase();
    state.filtered = state.songs.filter(song => {
      const categoryOk = state.filter === 'all' || song.category === state.filter;
      const queryOk = !q || `${pad3(song.id)} ${song.title} ${song.file}`.toLowerCase().includes(q);
      return categoryOk && queryOk;
    });

    if (!state.filtered.length) {
      songList.innerHTML = '<div class="song-row"><div class="song-main"><div class="song-title">No se encontraron canciones</div><div class="song-meta">Prueba otra búsqueda</div></div></div>';
      return;
    }

    songList.innerHTML = state.filtered.map(song => {
      const active = song.id === currentSong()?.id ? ' active' : '';
      return `<button class="song-row${active}" type="button" data-id="${song.id}" aria-label="Reproducir ${esc(song.title)}">
        <span class="song-id">${pad3(song.id)}</span>
        <span class="song-main"><span class="song-title">${esc(song.title)}</span><span class="song-meta">GT-GELM · ${esc(song.category)}</span></span>
        <span class="song-play">▶</span>
      </button>`;
    }).join('');
  }

  async function setSongByIndex(index, autoplay = false) {
    if (!state.songs.length) return;
    if (index < 0) index = state.songs.length - 1;
    if (index >= state.songs.length) index = 0;
    state.index = index;
    const song = currentSong();
    if (!song) return;

    audio.pause();
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = ''; }
    const source = await resolveAudioSource(song);
    audio.src = source;
    audio.load();

    titleEl.textContent = song.title;
    metaEl.textContent = `GT-GELM · ${pad3(song.id)} · ${song.category.toUpperCase()}`;
    document.title = `${song.title} · GT-GELM`;
    loadCover(song);
    renderLibrary();
    await loadLyrics(song);
    updateYoutubePanel(song, false);
    updateMediaSession(song);

    seekEl.value = '0';
    currentEl.textContent = '00:00';
    durationEl.textContent = '00:00';
    updatePlayButton();

    if (cfg.RESUME_LAST_TRACK !== false) localStorage.setItem('gt-gelm-last-track', String(song.id));
    if (autoplay) playAudio();
  }


  async function resolveAudioSource(song) {
    const remote = audioUrl(song);
    if (!('caches' in window)) return remote;
    try {
      const cache = await caches.open(cfg.CACHE_NAME || 'gt-gelm-v3-pro-max-audio-v1');
      const response = await cache.match(new Request(remote));
      if (response && response.ok) {
        const blob = await response.blob();
        activeObjectUrl = URL.createObjectURL(blob);
        showToast(`Offline listo · GT-GELM ${pad3(song.id)}`);
        return activeObjectUrl;
      }
    } catch {}
    return remote;
  }

  function setSongById(id, autoplay = false) {
    const idx = state.songs.findIndex(s => s.id === Number(id));
    if (idx >= 0) setSongByIndex(idx, autoplay);
  }

  async function playAudio() {
    try {
      await audio.play();
      updatePlayButton();
    } catch {
      showToast('Pulsa ▶ para iniciar la reproducción.');
    }
  }

  function pauseAudio() { audio.pause(); updatePlayButton(); }

  function updatePlayButton() {
    const playing = !audio.paused && !audio.ended;
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  }

  function next() {
    if (state.repeat) return playAudio();
    if (state.shuffle) {
      let nextIndex = state.index;
      if (state.songs.length > 1) while (nextIndex === state.index) nextIndex = Math.floor(Math.random() * state.songs.length);
      return setSongByIndex(nextIndex, true);
    }
    return setSongByIndex(state.index + 1, true);
  }

  function prev() { return setSongByIndex(state.index - 1, true); }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: 'GT-GELM Producciones',
        album: `GT-GELM · ${pad3(song.id)}`,
        artwork: [
          { src: location.href.split('#')[0].replace(/[^/]*$/, '') + coverEl.getAttribute('src').replace(/^\.\//, ''), sizes: '192x192', type: 'image/png' }
        ]
      });
      navigator.mediaSession.setActionHandler('play', playAudio);
      navigator.mediaSession.setActionHandler('pause', pauseAudio);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
    } catch {}
  }

  async function loadLyrics(song) {
    lyricsEl.textContent = 'Cargando letra…';
    const candidates = [];
    const mapped = state.lyricsMap?.[pad3(song.id)] || state.lyricsMap?.[String(song.id)];
    if (mapped) candidates.push(LYRICS_DIR + mapped);

    const raw = song.file.replace(/\.mp3$/i, '');
    const normalized = raw.replace(/^\d{3}-/, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    candidates.push(LYRICS_DIR + `${normalized}.txt`);

    const tnorm = slug(song.title).replace(/-/g, '_').toUpperCase();
    candidates.push(LYRICS_DIR + `${tnorm}.txt`);
    candidates.push(LYRICS_DIR + `${String(song.title).toUpperCase().replace(/\s+/g,'_')}.txt`);

    let found = false;
    for (const path of [...new Set(candidates)]) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.trim()) {
          lyricsEl.textContent = text;
          found = true;
          break;
        }
      } catch {}
    }
    if (!found) lyricsEl.textContent = 'Letra no disponible todavía en el repositorio.';
  }

  function toggleLibrary(force) {
    const show = typeof force === 'boolean' ? force : libraryPanel.hidden;
    libraryPanel.hidden = !show;
    libraryBtn.setAttribute('aria-expanded', String(show));
    if (show) setTimeout(() => searchEl?.focus(), 50);
  }

  function updateYoutubePanel(song, open = true) {
    const info = youtubeInfo(song);
    videoTitle.textContent = `${song.title} · YouTube`;
    openYoutube.href = info.url || CHANNEL;
    videoWrap.innerHTML = '';
    if (info.id) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(info.id)}?rel=0&modestbranding=1&playsinline=1`;
      iframe.title = info.title || song.title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      videoWrap.appendChild(iframe);
      videoNote.textContent = 'Video de YouTube configurado para esta canción.';
    } else {
      videoWrap.innerHTML = '<div style="display:grid;place-items:center;height:100%;padding:20px;color:#747b90;text-align:center">Esta canción todavía no tiene un video de YouTube configurado.<br><br>Usa “Abrir” para visitar el canal GT-GELM.</div>';
      videoNote.textContent = 'Puedes agregar el ID del video en youtube.json sin tocar el reproductor.';
    }
    youtubePanel.hidden = !open;
  }

  function toggleYoutube() {
    const song = currentSong();
    if (!song) return;
    if (youtubePanel.hidden) updateYoutubePanel(song, true);
    else youtubePanel.hidden = true;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  async function saveOffline() {
    const song = currentSong();
    if (!song || !('caches' in window)) return showToast('El almacenamiento offline no está disponible aquí.');
    const url = audioUrl(song);
    try {
      showToast('Guardando canción offline…');
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const cache = await caches.open(cfg.CACHE_NAME || 'gt-gelm-v3-pro-max-audio-v1');
      await cache.put(new Request(url), response.clone());
      showToast(`Guardada offline: ${pad3(song.id)} · ${song.title}`);
    } catch {
      showToast('No se pudo guardar offline. La reproducción online sigue disponible.');
    }
  }

  function installPwa() {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    state.deferredInstall.userChoice.finally(() => {
      state.deferredInstall = null;
      $('installBtn').hidden = true;
    });
  }

  function registerEvents() {
    playBtn.onclick = () => audio.paused ? playAudio() : pauseAudio();
    $('prev').onclick = prev;
    $('next').onclick = next;
    $('shuffle').onclick = () => {
      state.shuffle = !state.shuffle;
      $('shuffle').setAttribute('aria-pressed', String(state.shuffle));
      showToast(state.shuffle ? 'Aleatorio activado.' : 'Reproducción secuencial activada.');
    };
    $('repeat').onclick = () => {
      state.repeat = !state.repeat;
      $('repeat').setAttribute('aria-pressed', String(state.repeat));
      showToast(state.repeat ? 'Repetir canción activado.' : 'Repetir canción desactivado.');
    };
    seekEl.oninput = () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seekEl.value) / 100) * audio.duration;
    };
    volumeEl.oninput = () => { audio.volume = Number(volumeEl.value); state.lastVolume = audio.volume; };
    muteBtn.onclick = () => {
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? 'Sonido' : 'Silencio';
      muteBtn.setAttribute('aria-pressed', String(audio.muted));
    };
    audio.onplay = updatePlayButton;
    audio.onpause = updatePlayButton;
    audio.ontimeupdate = () => {
      currentEl.textContent = fmt(audio.currentTime);
      if (Number.isFinite(audio.duration)) seekEl.value = String((audio.currentTime / audio.duration) * 100);
    };
    audio.onloadedmetadata = () => durationEl.textContent = fmt(audio.duration);
    audio.onended = next;
    audio.onerror = () => showToast('No se pudo cargar el audio. Revisa la dirección Cloudflare para esta pista.');

    libraryBtn.onclick = () => toggleLibrary();
    $('closeLibrary').onclick = () => toggleLibrary(false);
    searchEl.oninput = e => { state.query = e.target.value; renderLibrary(); };
    document.querySelectorAll('.filter').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('.filter').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter || 'all';
      renderLibrary();
    });
    songList.onclick = e => {
      const row = e.target.closest('[data-id]');
      if (!row) return;
      setSongById(Number(row.dataset.id), true);
      if (window.matchMedia('(max-width:700px)').matches) toggleLibrary(false);
    };

    $('audioDirect').onclick = () => {
      const song = currentSong();
      if (song) window.open(audioUrl(song), '_blank', 'noopener,noreferrer');
    };
    $('youtubeBtn').onclick = toggleYoutube;
    $('closeYoutube').onclick = () => youtubePanel.hidden = true;
    lyricsToggle.onclick = () => {
      const show = lyricsEl.hidden;
      lyricsEl.hidden = !show;
      lyricsToggle.textContent = show ? 'Ocultar' : 'Mostrar';
      lyricsToggle.setAttribute('aria-expanded', String(show));
    };
    $('themeBtn').onclick = () => {
      document.body.classList.toggle('light');
      localStorage.setItem('gt-gelm-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    };
    $('saveOffline').onclick = saveOffline;
    $('installBtn').onclick = installPwa;
  }

  function setupInstall() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredInstall = event;
      $('installBtn').hidden = false;
    });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); audio.paused ? playAudio() : pauseAudio(); }
      else if (e.code === 'ArrowRight') audio.currentTime = Math.min((audio.currentTime || 0) + 5, audio.duration || Infinity);
      else if (e.code === 'ArrowLeft') audio.currentTime = Math.max((audio.currentTime || 0) - 5, 0);
    });
  }

  async function init() {
    if (localStorage.getItem('gt-gelm-theme') === 'light') document.body.classList.add('light');
    registerEvents();
    setupInstall();
    setupKeyboard();
    audio.volume = 0.85;
    await loadSongs();
    state.youtube = await loadJson('./youtube.json', state.youtube);
    state.coverMap = await loadJson('./cover-map.json', state.coverMap);
    state.lyricsMap = await loadJson('./lyrics-map.json', state.lyricsMap);

    renderLibrary();
    const saved = Number(localStorage.getItem('gt-gelm-last-track'));
    const startId = cfg.RESUME_LAST_TRACK && state.songs.some(s => s.id === saved) ? saved : INITIAL_ID;
    setSongById(startId || state.songs[0]?.id || 1, false);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    }
  }

  init();
})();
