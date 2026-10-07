const AUDIO_BASE = 'https://divine-king-c86b.chapin7839.workers.dev/';
const DEFAULT_COVER = 'img/gt-gelm-logo.webp';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@GT-GELM';
const REPO_RAW = 'https://raw.githubusercontent.com/gelm2mil/GT-GELM/main/';
const DEFAULT_SONG_ID = 0; // 0 = iniciar aleatoriamente

const $ = (id) => document.getElementById(id);
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
const youtubePanel = $('youtubePanel');
const videoWrap = $('videoWrap');
const videoTitle = $('videoTitle');
const videoNote = $('videoNote');
const openYoutube = $('openYoutube');
const lyrics = $('lyrics');

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
  seeking: false
};

function fmt(sec){
  if(!Number.isFinite(sec)) return '00:00';
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function slugify(value){
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\.mp3$/i,'')
    .replace(/^\d{3}-?/,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function humanTitle(file){
  return String(file||'')
    .replace(/\.mp3$/i,'')
    .replace(/^\d{3}-?/,'')
    .replace(/[-_]+/g,' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function categoryOf(song){
  const t = `${song.title} ${song.file}`.toLowerCase();
  if(/pmt|policia|tránsito|transito|chimaltenango/.test(t)) return 'pmt';
  if(/guatemala|xinka|kiche|k'iche|iqu|ixcan|ixc[aá]n|maya|atl[ií]an|quiche|zul|tradiciones|cantos/.test(t)) return 'cultura';
  return 'historias';
}

function normalizeSongs(data){
  const rows = Array.isArray(data) ? data : (data.songs || []);
  return rows.map((s,i) => {
    const file = String(s.file || s.filename || '');
    return {
      id: Number(s.id ?? i+1),
      file,
      title: s.title || humanTitle(file),
      category: s.category || categoryOf({title:s.title || humanTitle(file), file}),
      url: /^https?:\/\//i.test(file) ? file : AUDIO_BASE + encodeURI(file),
      cover: s.cover || '',
      youtube: s.youtube || ''
    };
  }).filter(s => s.file);
}

function applyFilters(){
  const q = state.query.trim().toLowerCase();
  state.filtered = state.songs.filter(s => {
    const categoryOk = state.filter === 'all' || s.category === state.filter;
    const qOk = !q || `${s.id} ${s.title} ${s.file}`.toLowerCase().includes(q);
    return categoryOk && qOk;
  });
  countEl.textContent = state.songs.length;
  renderList();
}

function renderList(){
  songList.innerHTML = '';
  if(!state.filtered.length){
    songList.innerHTML = '<div class="panel-note">No hay coincidencias.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  state.filtered.forEach(song => {
    const idx = state.songs.findIndex(x => x.id === song.id);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `song-row ${idx===state.index?'active':''}`;
    row.innerHTML = `
      <span class="song-id">${String(song.id).padStart(3,'0')}</span>
      <span><span class="song-title">${escapeHtml(song.title)}</span><small class="song-file">${escapeHtml(song.file)}</small></span>
      <span class="song-play">▶</span>`;
    row.addEventListener('click', () => playSong(idx, true));
    frag.appendChild(row);
  });
  songList.appendChild(frag);
}

function escapeHtml(v){
  return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function chooseCover(song){
  return DEFAULT_COVER;
}

function loadCover(song){
  coverEl.onerror = () => { coverEl.onerror = null; coverEl.src = DEFAULT_COVER; };
  coverEl.src = chooseCover(song);
}

function youtubeIdFor(song){
  const raw = song.youtube || state.youtube[String(song.id)] || '';
  if(/^[-_A-Za-z0-9]{11}$/.test(raw)) return raw;
  const m = String(raw).match(/(?:youtu\.be\/|v=|embed\/)([-_A-Za-z0-9]{11})/);
  return m ? m[1] : '';
}

const YOUTUBE_PLAYLIST_ID = 'PLJGpqFTRWh98';

function renderYoutube(song, openPanel=false){
  // YouTube se carga por playlist, no por ID individual de cada canción.
  // El audio principal de GT-GELM permanece independiente y sigue sonando.
  openYoutube.href = `https://www.youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`;
  videoTitle.textContent = 'GT-GELM · YouTube';
  videoWrap.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${YOUTUBE_PLAYLIST_ID}&rel=0&modestbranding=1`;
  iframe.title = 'GT-GELM · Playlist de YouTube';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  videoWrap.appendChild(iframe);
  videoNote.textContent = 'Playlist oficial de GT-GELM. El reproductor de audio continúa por separado.';

  if(openPanel) youtubePanel.hidden = false;
}

async function loadLyrics(song){
  lyrics.hidden = true;
  $('lyricsToggle').textContent = 'Mostrar';
  state.currentLyricsUrl = '';
  const base = song.file.replace(/\.mp3$/i,'');
  const noNum = base.replace(/^\d{3}-?/,'');
  const upper = noNum.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
  const candidates = [
    `lyrics/${base}.txt`,
    `lyrics/${noNum}.txt`,
    `lyrics/${upper}.txt`,
    `lyrics/${slugify(song.title).replace(/-/g,'_')}.txt`,
    `lyrics/${slugify(song.title)}.txt`
  ];
  for(const path of candidates){
    try{
      const r = await fetch(path, {cache:'no-store'});
      if(r.ok){
        const text = await r.text();
        if(text.trim()){
          lyrics.textContent = text;
          state.currentLyricsUrl = path;
          lyrics.hidden = false;
          $('lyricsToggle').textContent = 'Ocultar';
          $('lyricsToggle').setAttribute('aria-expanded', 'true');
          return;
        }
      }
    }catch{}
  }
  lyrics.textContent = 'Letra no disponible todavía en el repositorio.';
}

function updateMeta(song){
  titleEl.textContent = humanTitle(song.title || song.file);
  metaEl.textContent = `GT-GELM · ${String(song.id).padStart(3,'0')} · ${String(song.category).toUpperCase()}`;
  document.title = `${humanTitle(song.title || song.file)} · GT-GELM`;
}

async function playSong(index, userInitiated=false){
  const song = state.songs[index];
  if(!song) return;
  state.index = index;
  updateMeta(song);
  loadCover(song);
  audio.src = song.url;
  audio.load();
  try{ await audio.play(); }catch(e){ if(userInitiated) console.warn('El navegador bloqueó el autoplay:', e); }
  localStorage.setItem('gt-gelm-last-id', String(song.id));
  renderList();
  loadLyrics(song);
  setMediaSession(song);
}

function pickNext(){
  if(!state.songs.length) return -1;
  if(state.shuffle){
    if(state.songs.length===1) return 0;
    let next = state.index;
    while(next===state.index) next = Math.floor(Math.random()*state.songs.length);
    return next;
  }
  return (state.index + 1) % state.songs.length;
}
function pickPrev(){ return state.songs.length ? (state.index - 1 + state.songs.length) % state.songs.length : -1; }
function next(){
  if(state.repeat && state.index >= 0) return playSong(state.index);
  const n = pickNext(); if(n>=0) playSong(n);
}
function prev(){ const p = pickPrev(); if(p>=0) playSong(p); }


function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function setupInstall(){
  const btn = $('installBtn');
  if(!btn) return;

  // Si ya está instalada como PWA, no mostramos el botón.
  if(isStandalone()){
    btn.hidden = true;
    return;
  }

  // El botón queda visible como acceso a instalación.
  // Si el navegador ofrece el instalador automático, usaremos el prompt real.
  btn.hidden = false;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    btn.hidden = true;
  });

  btn.addEventListener('click', async () => {
    if(state.deferredInstallPrompt){
      const promptEvent = state.deferredInstallPrompt;
      state.deferredInstallPrompt = null;

      try{
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if(choice && choice.outcome === 'accepted'){
          btn.hidden = true;
        }
      }catch(err){
        console.warn('No se pudo abrir el instalador:', err);
      }
      return;
    }

    if(isIOS()){
      alert(
        'Para instalar GT-GELM en iPhone/iPad:\n\n' +
        '1. Toca Compartir.\n' +
        '2. Selecciona “Agregar a pantalla de inicio”.\n' +
        '3. Confirma “Agregar”.'
      );
      return;
    }

    // Algunos navegadores (incluido Samsung Browser en determinadas versiones)
    // no exponen beforeinstallprompt. En ese caso la instalación se hace desde
    // el menú del navegador.
    alert(
      'Para instalar GT-GELM:\n\n' +
      'Abre el menú del navegador y busca “Instalar aplicación”, ' +
      '“Instalar GT-GELM” o “Agregar a pantalla de inicio”.'
    );
  });
}

function setMediaSession(song){
  if(!('mediaSession' in navigator)) return;
  try{
    navigator.mediaSession.metadata = new MediaMetadata({title: humanTitle(song.title || song.file), artist:'GT-GELM', album:'GT-GELM Producciones', artwork:[
      {src: chooseCover(song), sizes:'512x512', type:'image/png'}
    ]});
    navigator.mediaSession.setActionHandler('play', ()=>audio.play());
    navigator.mediaSession.setActionHandler('pause', ()=>audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', next);

    const safeAction = (name, handler) => {
      try{ navigator.mediaSession.setActionHandler(name, handler); }catch{}
    };

    safeAction('seekbackward', (details)=>{
      const skip = Number(details.seekOffset) || 10;
      audio.currentTime = Math.max(0, audio.currentTime - skip);
    });

    safeAction('seekforward', (details)=>{
      const skip = Number(details.seekOffset) || 10;
      audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + skip);
    });

    safeAction('seekto', (details)=>{
      if(!Number.isFinite(details.seekTime) || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.min(audio.duration, Math.max(0, details.seekTime));
    });
  }catch{}
}

$('play').addEventListener('click', ()=> audio.paused ? audio.play() : audio.pause());
$('prev').addEventListener('click', prev);
$('next').addEventListener('click', next);
$('shuffle').addEventListener('click', ()=>{state.shuffle=!state.shuffle; $('shuffle').setAttribute('aria-pressed', String(state.shuffle));});
$('repeat').addEventListener('click', ()=>{state.repeat=!state.repeat; $('repeat').setAttribute('aria-pressed', String(state.repeat));});
$('mute').addEventListener('click', ()=>{audio.muted=!audio.muted; $('mute').textContent = audio.muted ? 'Activar sonido' : 'Silencio';});
$('audioDirect').addEventListener('click', ()=>{const s=state.songs[state.index]; if(s) window.open(s.url,'_blank','noopener');});
$('youtubeBtn').addEventListener('click', ()=>{const s=state.songs[state.index]; if(s) renderYoutube(s,true);});
$('closeYoutube').addEventListener('click', ()=>youtubePanel.hidden=true);
$('openYoutube').addEventListener('click', ()=>setTimeout(()=>{youtubePanel.hidden=true},100));
$('libraryBtn').addEventListener('click', ()=>{libraryPanel.hidden=!libraryPanel.hidden; libraryBtn.setAttribute('aria-expanded', String(!libraryPanel.hidden));});
$('closeLibrary').addEventListener('click', ()=>{libraryPanel.hidden=true; libraryBtn.setAttribute('aria-expanded','false');});
$('themeBtn').addEventListener('click', ()=>document.body.classList.toggle('light'));
$('lyricsToggle').addEventListener('click', ()=>{lyrics.hidden=!lyrics.hidden; $('lyricsToggle').textContent=lyrics.hidden?'Mostrar':'Ocultar'; $('lyricsToggle').setAttribute('aria-expanded', String(!lyrics.hidden));});
search.addEventListener('input', e=>{state.query=e.target.value; applyFilters();});
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click', ()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); state.filter=btn.dataset.filter; applyFilters();}));

seek.addEventListener('pointerdown', ()=>{ state.seeking = true; });
seek.addEventListener('pointerup', ()=>{
  state.seeking = false;
  if(Number.isFinite(audio.duration)){
    audio.currentTime = (Number(seek.value)/100) * audio.duration;
    currentTimeEl.textContent = fmt(audio.currentTime);
  }
});
seek.addEventListener('input', ()=>{
  if(Number.isFinite(audio.duration)){
    const position = (Number(seek.value)/100) * audio.duration;
    currentTimeEl.textContent = fmt(position);
  }
});
seek.addEventListener('change', ()=>{
  if(Number.isFinite(audio.duration)){
    audio.currentTime = (Number(seek.value)/100) * audio.duration;
    currentTimeEl.textContent = fmt(audio.currentTime);
  }
});
volume.addEventListener('input', ()=>audio.volume=Number(volume.value));
audio.volume=.85;
audio.addEventListener('loadedmetadata', ()=>{
  durationEl.textContent=fmt(audio.duration);
  seek.value=0;
});
audio.addEventListener('timeupdate', ()=>{
  currentTimeEl.textContent=fmt(audio.currentTime);
  if(audio.duration && !state.seeking){
    seek.value=(audio.currentTime/audio.duration)*100;
  }
  if('mediaSession' in navigator && Number.isFinite(audio.duration) && audio.duration > 0){
    try{
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    }catch{}
  }
});
audio.addEventListener('play', ()=>{
  $('play').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"></rect></svg>';
  if('mediaSession' in navigator){
    try{ navigator.mediaSession.playbackState = 'playing'; }catch{}
  }
});
audio.addEventListener('pause', ()=>{
  $('play').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13L19 12 8 5.5Z" fill="currentColor"></path></svg>';
  if('mediaSession' in navigator){
    try{ navigator.mediaSession.playbackState = 'paused'; }catch{}
  }
});
audio.addEventListener('ended', next);
audio.addEventListener('error', ()=>{ metaEl.textContent = 'No se pudo cargar el audio · revisa la dirección Cloudflare'; });

async function boot(){
  try{
    setupInstall();
    const [songsRes, ytRes] = await Promise.all([
      fetch('songs.json', {cache:'no-store'}),
      fetch('youtube.json', {cache:'no-store'}).catch(()=>null)
    ]);
    if(!songsRes.ok) throw new Error(`songs.json ${songsRes.status}`);
    state.songs = normalizeSongs(await songsRes.json());
    if(ytRes && ytRes.ok) state.youtube = await ytRes.json();
    applyFilters();
    let startIndex = state.songs.length ? Math.floor(Math.random() * state.songs.length) : -1;
    if (DEFAULT_SONG_ID > 0) {
      const configured = state.songs.findIndex(s=>s.id===DEFAULT_SONG_ID);
      if (configured >= 0) startIndex = configured;
    }
    await playSong(startIndex,false);
  }catch(err){
    titleEl.textContent='No se pudo cargar la biblioteca';
    metaEl.textContent=String(err.message||err);
    console.error(err);
  }
}

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

boot();