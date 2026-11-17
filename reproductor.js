(() => {
  "use strict";
  const AUDIO_BASE = "https://divine-gentle-king-c86b.chapin7839.workers.dev/";
  const FALLBACK_COVER = "img/gt-gelm-logo.webp";
  const $ = id => document.getElementById(id);
  const audio = $("audio");
  const state = {
    songs: [], filtered: [], index: -1, category: "all", query: "",
    shuffle: false, repeat: false, playlists: [], activePlaylist: null,
    editingPlaylistId: null, actionSongId: null, coverMap: {}
  };
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[c]);
  const fmt = value => {
    if (!Number.isFinite(value)) return "00:00";
    const n = Math.max(0, Math.floor(value));
    return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
  };
  const currentSong = () => state.songs[state.index];
  const playlistStorageKey = "gt_gelm_playlists_v1";

  async function init() {
    try {
      const [songRes, coverRes] = await Promise.all([
        fetch("songs.json", {cache:"no-store"}),
        fetch("cover-map.json").catch(() => null)
      ]);
      if (!songRes.ok) throw new Error("No se pudo cargar songs.json");
      const raw = await songRes.json();
      state.songs = (Array.isArray(raw) ? raw : raw.songs || []).map((s,i) => ({
        id:Number(s.id ?? i+1), file:String(s.file || ""),
        title:String(s.title || s.file || `Canción ${i+1}`),
        category:String(s.category || "historias").toLowerCase(),
        cover:s.cover || "", url:/^https?:\/\//i.test(s.file || "") ? s.file : AUDIO_BASE + encodeURIComponent(s.file || "").replace(/%2F/g,"/")
      })).filter(s => s.file);
      if (coverRes && coverRes.ok) state.coverMap = await coverRes.json();
      loadPlaylists();
      $("libraryCount").textContent = `${state.songs.length} canciones`;
      renderPlaylistStrip();
      applyFilters();
      if (state.songs.length) selectSong(0, false);
      bindEvents();
    } catch (err) {
      $("songList").innerHTML = `<div class="empty">${escapeHTML(err.message)}. Revisa que songs.json esté en la raíz del repositorio.</div>`;
    }
  }

  function loadPlaylists() {
    try {
      const parsed = JSON.parse(localStorage.getItem(playlistStorageKey) || "[]");
      state.playlists = Array.isArray(parsed) ? parsed.filter(p => p && p.id && p.name) : [];
    } catch { state.playlists = []; }
  }
  function savePlaylists() {
    localStorage.setItem(playlistStorageKey, JSON.stringify(state.playlists));
    renderPlaylistStrip();
  }
  function getActivePlaylist() {
    return state.playlists.find(p => p.id === state.activePlaylist) || null;
  }
  function applyFilters() {
    const q = state.query.trim().toLocaleLowerCase("es");
    let pool = state.songs;
    if (state.activePlaylist) {
      const pl = getActivePlaylist();
      pool = pl ? pl.songIds.map(id => state.songs.find(s => s.id === id)).filter(Boolean) : state.songs;
    }
    state.filtered = pool.filter(s =>
      (state.category === "all" || s.category === state.category) &&
      (!q || `${s.id} ${s.title} ${s.file}`.toLocaleLowerCase("es").includes(q))
    );
    renderSongs();
  }
  function renderSongs() {
    $("listTitle").textContent = getActivePlaylist()?.name || (
      state.category === "all" ? "Todas las canciones" : state.category.toUpperCase()
    );
    $("resultCount").textContent = `${state.filtered.length} resultados`;
    const list = $("songList");
    if (!state.filtered.length) {
      list.innerHTML = '<div class="empty">No hay canciones en esta selección.</div>';
      return;
    }
    list.innerHTML = state.filtered.map(song => `
      <div class="song-row ${currentSong()?.id === song.id ? "active" : ""}">
        <span class="song-num">${String(song.id).padStart(3,"0")}</span>
        <button class="song-copy" type="button" data-play="${song.id}" style="background:none;border:0;color:inherit;text-align:left;min-width:0">
          <span class="song-title">${escapeHTML(song.title)}</span>
          <span class="song-category">${escapeHTML(song.category)}</span>
        </button>
        <button class="song-action" type="button" data-add="${song.id}" aria-label="${state.activePlaylist ? "Quitar de esta lista" : "Añadir a lista"}" title="${state.activePlaylist ? "Quitar de esta lista" : "Añadir a lista"}">${state.activePlaylist ? "−" : "＋"}</button>
      </div>`).join("");
  }
  function renderPlaylistStrip() {
    const strip = $("playlistStrip");
    strip.innerHTML = `<button class="playlist-pill ${!state.activePlaylist ? "active" : ""}" data-playlist="all" type="button">Biblioteca</button>` +
      state.playlists.map(p => `<span class="playlist-item"><button class="playlist-pill ${state.activePlaylist===p.id ? "active" : ""}" data-playlist="${escapeHTML(p.id)}" type="button">${escapeHTML(p.name)} · ${p.songIds.length}</button><button class="playlist-manage" data-manage="${escapeHTML(p.id)}" type="button" aria-label="Editar o eliminar ${escapeHTML(p.name)}">⋯</button></span>`).join("");
  }
  function coverFor(song) {
    if (song.cover) return song.cover;
    const map = state.coverMap || {};
    return map[String(song.id)] || map[song.file] || map[song.title] || FALLBACK_COVER;
  }
  function selectSong(index, autoplay=true) {
    if (!state.songs.length) return;
    state.index = (index + state.songs.length) % state.songs.length;
    const song = currentSong();
    $("trackTitle").textContent = song.title;
    $("trackArtist").textContent = `GT-GELM · ${String(song.id).padStart(3,"0")} · ${song.category.toUpperCase()}`;
    $("categoryLabel").textContent = "AHORA SUENA";
    $("cover").onerror = () => { $("cover").onerror = null; $("cover").src = FALLBACK_COVER; };
    $("cover").src = coverFor(song);
    audio.pause();
    audio.src = song.url;
    audio.load();
    updateListActive();
    if (autoplay) playAudio();
    else setPlayIcon(false);
  }
  async function playAudio() {
    if (!currentSong()) selectSong(0, false);
    try { await audio.play(); setPlayIcon(true); }
    catch (err) {
      setPlayIcon(false);
      $("categoryLabel").textContent = "NO SE PUDO INICIAR · REVISA EL ENLACE MP3";
      console.error("Error al reproducir:", err);
    }
  }
  function setPlayIcon(playing) {
    $("playBtn").textContent = playing ? "Ⅱ" : "▶";
    $("playBtn").setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  }
  function updateListActive() {
    document.querySelectorAll("[data-play]").forEach(btn => {
      btn.closest(".song-row")?.classList.toggle("active", Number(btn.dataset.play) === currentSong()?.id);
    });
  }
  function nextSong() {
    if (!state.songs.length) return;
    if (state.repeat === "one") { audio.currentTime = 0; playAudio(); return; }
    let idx;
    if (state.shuffle) {
      idx = state.songs.length > 1 ? Math.floor(Math.random()*state.songs.length) : state.index;
      if (state.songs.length > 1 && idx === state.index) idx = (idx+1)%state.songs.length;
    } else idx = (state.index+1)%state.songs.length;
    selectSong(idx, true);
  }
  function previousSong() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    selectSong((state.index-1+state.songs.length)%state.songs.length, true);
  }
  function createPlaylist() {
    state.editingPlaylistId = null;
    $("dialogTitle").textContent = "Crear lista";
    $("playlistName").value = "";
    $("playlistDialog").showModal();
    $("playlistName").focus();
  }
  function editPlaylist(id) {
    const pl = state.playlists.find(p => p.id === id);
    if (!pl) return;
    state.editingPlaylistId = id;
    $("dialogTitle").textContent = "Editar nombre de lista";
    $("playlistName").value = pl.name;
    $("playlistDialog").showModal();
  }
  function savePlaylistFromDialog(event) {
    event.preventDefault();
    const name = $("playlistName").value.trim();
    if (!name) return;
    if (state.editingPlaylistId) {
      const pl = state.playlists.find(p => p.id === state.editingPlaylistId);
      if (pl) pl.name = name;
    } else {
      const id = `pl_${Date.now()}`;
      state.playlists.push({id, name, songIds:[]});
      state.activePlaylist = id;
    }
    savePlaylists();
    $("playlistDialog").close();
    applyFilters();
  }
  function openSongActions(id) {
    state.actionSongId = Number(id);
    const song = state.songs.find(s => s.id === state.actionSongId);
    $("songActionTitle").textContent = `Añadir: ${song?.title || "Canción"}`;
    const choices = $("playlistChoices");
    choices.innerHTML = state.playlists.length ? state.playlists.map(p =>
      `<button class="choice-btn" type="button" data-choice="${escapeHTML(p.id)}">${escapeHTML(p.name)} · ${p.songIds.length} canciones</button>`
    ).join("") : '<p class="empty">Primero crea una lista de reproducción.</p>';
    $("songActionsDialog").showModal();
  }
  function bindEvents() {
    $("playBtn").addEventListener("click", () => audio.paused ? playAudio() : audio.pause());
    $("prevBtn").addEventListener("click", previousSong);
    $("nextBtn").addEventListener("click", nextSong);
    $("shuffleBtn").addEventListener("click", () => {
      state.shuffle = !state.shuffle;
      $("shuffleBtn").classList.toggle("active", state.shuffle);
    });
    $("repeatBtn").addEventListener("click", () => {
      state.repeat = state.repeat === false ? "all" : state.repeat === "all" ? "one" : false;
      $("repeatBtn").classList.toggle("active", !!state.repeat);
      $("repeatBtn").title = state.repeat === "one" ? "Repetir canción" : state.repeat === "all" ? "Repetir lista" : "Repetir desactivado";
    });
    audio.addEventListener("play", () => setPlayIcon(true));
    audio.addEventListener("pause", () => setPlayIcon(false));
    audio.addEventListener("ended", () => {
      if (state.repeat === "one") { audio.currentTime=0; playAudio(); }
      else nextSong();
    });
    audio.addEventListener("timeupdate", () => {
      if (!Number.isFinite(audio.duration)) return;
      $("seek").value = Math.round(audio.currentTime/audio.duration*1000);
      $("currentTime").textContent = fmt(audio.currentTime);
      $("duration").textContent = fmt(audio.duration);
    });
    $("seek").addEventListener("input", e => {
      if (Number.isFinite(audio.duration)) audio.currentTime = Number(e.target.value)/1000*audio.duration;
    });
    $("volume").addEventListener("input", e => audio.volume = Number(e.target.value));
    audio.volume = .85;
    $("searchInput").addEventListener("input", e => { state.query=e.target.value; applyFilters(); });
    $("clearSearch").addEventListener("click", () => { $("searchInput").value=""; state.query=""; applyFilters(); });
    $("categoryFilters").addEventListener("click", e => {
      const b=e.target.closest("[data-category]"); if(!b) return;
      state.category=b.dataset.category;
      $("categoryFilters").querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x===b));
      applyFilters();
    });
    $("songList").addEventListener("click", e => {
      const add=e.target.closest("[data-add]"), play=e.target.closest("[data-play]");
      if(add && state.activePlaylist) {
        const pl=getActivePlaylist();
        if(pl) pl.songIds=pl.songIds.filter(id=>id!==Number(add.dataset.add));
        savePlaylists(); applyFilters();
      } else if(add) openSongActions(add.dataset.add);
      else if(play) {
        const idx=state.songs.findIndex(s=>s.id===Number(play.dataset.play));
        if(idx>=0) selectSong(idx,true);
      }
    });
    $("playlistCreate").addEventListener("click", createPlaylist);
    $("playlistForm").addEventListener("submit", savePlaylistFromDialog);
    $("playlistStrip").addEventListener("click", e => {
      const b=e.target.closest("[data-playlist]"); if(!b) return;
      if(b.dataset.playlist==="all") state.activePlaylist=null;
      else state.activePlaylist=b.dataset.playlist;
      state.category="all";
      $("categoryFilters").querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x.dataset.category==="all"));
      renderPlaylistStrip(); applyFilters();
    });
    $("playlistStrip").addEventListener("contextmenu", e => {
      const b=e.target.closest("[data-playlist]"); if(!b || b.dataset.playlist==="all") return;
      e.preventDefault();
      const pl=state.playlists.find(p=>p.id===b.dataset.playlist); if(!pl) return;
      const action=prompt(`Lista: ${pl.name}\nEscribe: editar / eliminar`);
      if(action?.toLowerCase()==="editar") editPlaylist(pl.id);
      if(action?.toLowerCase()==="eliminar" && confirm(`¿Eliminar la lista "${pl.name}"?`)) {
        state.playlists=state.playlists.filter(p=>p.id!==pl.id);
        if(state.activePlaylist===pl.id) state.activePlaylist=null;
        savePlaylists(); applyFilters();
      }
    });
    $("playlistChoices").addEventListener("click", e => {
      const b=e.target.closest("[data-choice]"); if(!b) return;
      const pl=state.playlists.find(p=>p.id===b.dataset.choice);
      if(pl && !pl.songIds.includes(state.actionSongId)) pl.songIds.push(state.actionSongId);
      savePlaylists(); $("songActionsDialog").close(); applyFilters();
    });
    $("closeSongActions").addEventListener("click", () => $("songActionsDialog").close());
  }
  init();
})();