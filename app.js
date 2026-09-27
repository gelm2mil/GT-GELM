const AUDIO_BASE = 'https://divine-king-c86b.chapin7839.workers.dev/';
const DEFAULT_COVER = 'assets/img/default-cover.svg';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@GT-GELM';

const state = {
  tracks: [],
  filtered: [],
  index: -1,
  shuffle: false,
  repeat: false,
  filter: 'all'
};

const $ = (id) => document.getElementById(id);
const audio = $('audio');
const title = $('title');
const meta = $('meta');
const cover = $('cover');
const lyrics = $('lyrics');
const playlist = $('playlist');
const search = $('search');
const seek = $('seek');
const volume = $('volume');

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

function humanTitle(file) {
  return file
    .replace(/^\d{3}-/, '')
    .replace(/\.mp3$/i, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFor(track) {
  const s = `${track.title} ${track.file}`.toLowerCase();
  if (s.includes('pmt')) return 'pmt';
  if (/(maya|kiche|xinka|ixcan|atitlan|amatitlan|huehuetenango|zaculeu|xibalba|chimaltenango|guatemala|belice|samabaj|pozo|suchiate)/i.test(s)) return 'cultura';
  if (/(historia|cronicas|relato|senderos|jornadas|mapa|patrulleros|turno|fortalezas)/i.test(s)) return 'historia';
  return 'all';
}

function applyCategory(tracks) {
  if (state.filter === 'all') return tracks;
  return tracks.filter(t => categoryFor(t) === state.filter);
}

function makeTrack(raw) {
  const file = raw.file;
  return {
    ...raw,
    title: raw.title || humanTitle(file),
    audio: raw.audio || AUDIO_BASE + encodeURIComponent(file).replace(/%2F/g, '/'),
    cover: raw.cover || DEFAULT_COVER,
    lyrics: raw.lyrics || `lyrics/${file.replace(/\.mp3$/i, '.txt')}`,
  };
}

async function loadCatalog() {
  const res = await fetch('songs.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo abrir songs.json (${res.status})`);
  const data = await res.json();
  state.tracks = data.map(makeTrack).sort((a,b) => a.id - b.id);
  $('countLabel').textContent = `${state.tracks.length} canciones disponibles`;
  render();
}

function render() {
  const q = search.value.trim().toLowerCase();
  const category = applyCategory(state.tracks);
  state.filtered = category.filter(t => `${t.id} ${t.title} ${t.file}`.toLowerCase().includes(q));

  playlist.innerHTML = '';
  if (!state.filtered.length) {
    playlist.innerHTML = '<div class="track"><div class="track-main"><div class="track-title">No hay coincidencias</div><div class="track-sub">Prueba otra búsqueda.</div></div></div>';
    return;
  }

  state.filtered.forEach((track) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `track ${state.tracks[state.index]?.id === track.id ? 'active' : ''}`;
    row.setAttribute('role','option');
    row.innerHTML = `
      <span class="track-num">${String(track.id).padStart(3,'0')}</span>
      <span class="track-main"><span class="track-title">${escapeHtml(track.title)}</span><span class="track-sub">${escapeHtml(track.file)}</span></span>
      <span class="track-play">▶</span>`;
    row.addEventListener('click', () => loadTrackById(track.id, true));
    playlist.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

async function loadLyrics(track) {
  lyrics.textContent = 'Buscando letra…';
  try {
    const res = await fetch(track.lyrics, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const text = await res.text();
    lyrics.textContent = text.trim() || 'El archivo de letra está vacío.';
  } catch {
    lyrics.textContent = 'Todavía no hay letra cargada para esta canción.\n\nLa estructura ya está lista para colocarla en lyrics/ con el mismo nombre del MP3.';
  }
}

function loadTrackById(id, autoplay=false) {
  const idx = state.tracks.findIndex(t => t.id === id);
  if (idx < 0) return;
  state.index = idx;
  const track = state.tracks[idx];
  title.textContent = track.title;
  meta.textContent = `GT-GELM · ${String(track.id).padStart(3,'0')} · ${track.category || categoryFor(track)}`;
  cover.src = track.cover;
  cover.onerror = () => { cover.src = DEFAULT_COVER; };
  audio.src = track.audio;
  audio.load();
  loadLyrics(track);
  render();
  document.title = `${track.title} · GT-GELM`;
  if (autoplay) audio.play().catch(() => {});
}

function next() {
  if (!state.tracks.length) return;
  if (state.shuffle) {
    let n = state.index;
    if (state.tracks.length > 1) while (n === state.index) n = Math.floor(Math.random()*state.tracks.length);
    loadTrackById(state.tracks[n].id, true);
    return;
  }
  let n = state.index + 1;
  if (n >= state.tracks.length) n = 0;
  loadTrackById(state.tracks[n].id, true);
}
function prev() {
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  let n = state.index - 1;
  if (n < 0) n = state.tracks.length - 1;
  loadTrackById(state.tracks[n].id, true);
}

$('playBtn').addEventListener('click', () => {
  if (state.index < 0) {
    if (state.tracks[0]) loadTrackById(state.tracks[0].id, true);
    return;
  }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
});
$('prevBtn').addEventListener('click', prev);
$('nextBtn').addEventListener('click', next);
$('shuffleBtn').addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  $('shuffleBtn').setAttribute('aria-pressed', state.shuffle);
});
$('repeatBtn').addEventListener('click', () => {
  state.repeat = !state.repeat;
  $('repeatBtn').setAttribute('aria-pressed', state.repeat);
  audio.loop = state.repeat;
});
$('muteBtn').addEventListener('click', () => { audio.muted = !audio.muted; });
audio.volume = 0.85;
volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = false; });
audio.addEventListener('play', () => $('playBtn').textContent = '❚❚');
audio.addEventListener('pause', () => $('playBtn').textContent = '▶');
audio.addEventListener('ended', () => { if (!state.repeat) next(); });
audio.addEventListener('loadedmetadata', () => { $('duration').textContent = fmt(audio.duration); });
audio.addEventListener('timeupdate', () => {
  $('currentTime').textContent = fmt(audio.currentTime);
  seek.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
});
seek.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = (Number(seek.value)/100) * audio.duration;
});
search.addEventListener('input', render);
document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.filter = btn.dataset.filter;
  render();
}));
$('youtubeBtn').addEventListener('click', () => window.open(YOUTUBE_CHANNEL, '_blank', 'noopener'));
$('themeBtn').addEventListener('click', () => document.body.classList.toggle('alt'));
$('queueBtn').addEventListener('click', () => $('libraryPanel').classList.add('open'));
$('closeQueueBtn').addEventListener('click', () => $('libraryPanel').classList.remove('open'));
$('copyLyricsBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lyrics.textContent); } catch {}
});

loadCatalog().catch(err => {
  $('countLabel').textContent = 'Error cargando catálogo';
  playlist.innerHTML = `<div class="track"><div class="track-main"><div class="track-title">No se pudo cargar songs.json</div><div class="track-sub">${escapeHtml(err.message)}</div></div></div>`;
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
