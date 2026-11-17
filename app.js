(() => {
  'use strict';
  const AUDIO_BASE = 'https://divine-king-c86b.chapin7839.workers.dev/';
  const STORE = 'gtgelm.player.playlists.v1';
  const $ = id => document.getElementById(id);
  const audio = $('audio');
  const state = { songs:[], view:'catalog', activeList:null, playlists:[], currentId:null, shuffle:true, repeatList:true, bag:[], history:[], query:'', pendingSong:null, switching:false, advancing:false, failedIds:new Set() };

  const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number.isFinite(n) ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '0:00';
  const current = () => state.songs.find(s=>s.id===state.currentId) || null;
  const activeList = () => state.playlists.find(p=>p.id===state.activeList) || null;
  const pool = () => { const p=activeList(); return p ? p.songIds.map(id=>state.songs.find(s=>s.id===id)).filter(Boolean) : state.songs; };

  function saveLists(){ try{localStorage.setItem(STORE,JSON.stringify(state.playlists));}catch(e){setStatus('No se pudieron guardar las listas en este navegador.');} }
  function loadLists(){ try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');state.playlists=Array.isArray(v)?v.filter(p=>p&&p.id&&p.name&&Array.isArray(p.songIds)):[];}catch{state.playlists=[];} }
  function setStatus(t){$('status').textContent=t;}
  function makeBag(excludeCurrent=true){ const ids=pool().map(s=>s.id).filter(id=>!excludeCurrent||id!==state.currentId); for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];} state.bag=ids; }
  function nextId(){ const list=pool(); if(!list.length)return null; if(state.shuffle){ if(!state.bag.length)makeBag(true); if(!state.bag.length && list.length===1)return list[0].id; return state.bag.pop()??list[0].id; } const i=list.findIndex(s=>s.id===state.currentId); if(i<0)return list[0].id; if(i+1<list.length)return list[i+1].id; return state.repeatList?list[0].id:null; }
  function prevId(){ if(state.history.length>1)return state.history[state.history.length-2]; const list=pool(); const i=list.findIndex(s=>s.id===state.currentId); return list[(i-1+list.length)%list.length]?.id??null; }
  function songUrl(file){return /^https?:\/\//i.test(file)?file:AUDIO_BASE+file.split('/').map(encodeURIComponent).join('/');}


  function updateMediaSession(song){
    if(!('mediaSession' in navigator) || !song) return;
    try{
      if('MediaMetadata' in window){
        navigator.mediaSession.metadata = new MediaMetadata({
          title:song.title, artist:'GT-GELM',
          album:activeList()?.name || 'GT-GELM · Catálogo general'
        });
      }
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    }catch(e){ console.debug('Media Session no disponible',e); }
  }
  function bindMediaSession(){
    if(!('mediaSession' in navigator)) return;
    const handlers={
      play:()=>play(), pause:()=>audio.pause(),
      nexttrack:()=>next(), previoustrack:()=>previous(),
      seekbackward:d=>{audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10));},
      seekforward:d=>{audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+(d.seekOffset||10));},
      seekto:d=>{if(Number.isFinite(d.seekTime))audio.currentTime=d.seekTime;}
    };
    for(const [action,handler] of Object.entries(handlers)){
      try{navigator.mediaSession.setActionHandler(action,handler);}catch(_){}
    }
  }

  async function playId(id, autoplay=true){
    const song=pool().find(s=>s.id===id) || state.songs.find(s=>s.id===id);
    if(!song) return false;
    state.switching=true;
    audio.pause();
    state.currentId=song.id;
    $('trackTitle').textContent=song.title;
    $('trackMeta').textContent=`GT-GELM · ${String(song.id).padStart(3,'0')} · ${song.category}`;
    $('sourceLabel').textContent=activeList()?.name || 'CATÁLOGO GENERAL';
    $('cover').textContent='♫';
    $('elapsed').textContent='0:00';
    $('duration').textContent='0:00';
    $('seek').value=0;
    audio.src=songUrl(song.file);
    audio.load();
    renderSongs();
    updateMediaSession(song);
    let started=false;
    if(autoplay){
      try{
        await audio.play();
        started=true;
        setStatus('Reproduciendo');
      }catch(err){
        setStatus(err.name==='NotAllowedError'
          ? 'El navegador pausó la reproducción. Pulsa reproducir para continuar.'
          : 'No se pudo iniciar esta pista. Puedes intentar con la siguiente.');
        console.warn('Audio play error',err);
      }
    }else{
      setStatus('Canción preparada. Pulsa reproducir.');
    }
    state.switching=false;
    return started;
  }
  async function play(){ if(!current()){const list=pool();if(!list.length){setStatus('Esta lista no tiene canciones.');return;} if(state.shuffle){makeBag(false);state.currentId=state.bag.pop();}else state.currentId=list[0].id; await playId(state.currentId,false);} try{await audio.play();setStatus('Reproduciendo');}catch(e){setStatus('El navegador no permitió iniciar el audio. Vuelve a tocar reproducir.');} }
  async function next(){
    if(state.advancing) return;
    state.advancing=true;
    try{
      const id=nextId();
      if(id===null){setStatus('La lista terminó.');return;}
      if(state.history.at(-1)!==state.currentId&&state.currentId!==null)state.history.push(state.currentId);
      if(state.history.length>30)state.history.shift();
      await playId(id,true);
    }finally{
      state.advancing=false;
    }
  }
  async function previous(){const id=prevId();if(id!==null)await playId(id,true);}

  function renderPlaylists(){const area=$('playlistArea');area.innerHTML='';const all=document.createElement('button');all.className='playlist-chip'+(!state.activeList?' active':'');all.textContent='Catálogo general';all.onclick=()=>{state.activeList=null;state.bag=[];if(current())updateMediaSession(current());render();};area.append(all);for(const p of state.playlists){const b=document.createElement('button');b.className='playlist-chip'+(state.activeList===p.id?' active':'');b.textContent=`${p.name} · ${p.songIds.length}`;b.onclick=()=>{state.activeList=p.id;state.bag=[];if(current())updateMediaSession(current());render();};b.oncontextmenu=e=>{e.preventDefault();const action=prompt(`Lista: ${p.name}\nEscribe RENOMBRAR o ELIMINAR`);if(action?.toUpperCase()==='RENOMBRAR'){const n=prompt('Nuevo nombre:',p.name)?.trim();if(n)p.name=n;}if(action?.toUpperCase()==='ELIMINAR'&&confirm(`¿Eliminar ${p.name}?`)){state.playlists=state.playlists.filter(x=>x.id!==p.id);if(state.activeList===p.id)state.activeList=null;}saveLists();renderPlaylists();};area.append(b);}}
  function renderSongs(){const list=$('songs');const q=state.query.toLocaleLowerCase('es');const items=pool().filter(s=>`${s.id} ${s.title} ${s.file}`.toLocaleLowerCase('es').includes(q));$('listTitle').textContent=activeList()?.name||'Todas las canciones';$('resultCount').textContent=`${items.length} canciones`;if(!items.length){list.innerHTML='<div class="empty">No hay canciones en esta selección.</div>';return;}list.innerHTML=items.map(s=>`<div class="song ${s.id===state.currentId?'current':''}"><span class="num">${String(s.id).padStart(3,'0')}</span><button class="song-main" data-play="${s.id}"><b>${escapeHTML(s.title)}</b><small>${escapeHTML(s.category)}</small></button><button class="song-action" data-action="${s.id}" aria-label="${activeList()?'Quitar':'Agregar a lista'}">${activeList()?'−':'＋'}</button></div>`).join('');}
  function render(){ $('playlistArea').hidden=state.view!=='playlists';$('search').hidden=false;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===state.view));renderPlaylists();renderSongs(); }
  function createList(name){const p={id:`pl_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,name,songIds:[]};state.playlists.push(p);state.activeList=p.id;state.view='playlists';state.bag=[];saveLists();render();}
  function addSongToList(songId,listId){const p=state.playlists.find(x=>x.id===listId);if(p&&!p.songIds.includes(songId))p.songIds.push(songId);saveLists();render();}

  async function init(){try{const res=await fetch('songs.json');if(!res.ok)throw Error('No se pudo leer songs.json');const raw=await res.json();state.songs=(Array.isArray(raw)?raw:raw.songs||[]).map((s,i)=>({id:Number(s.id??i+1),file:String(s.file||''),title:String(s.title||s.file||`Canción ${i+1}`),category:String(s.category||'historias').toLowerCase()})).filter(s=>s.file);loadLists();$('libraryCount').textContent=`${state.songs.length} canciones`;if(!state.songs.length)throw Error('El catálogo está vacío');makeBag(false);state.currentId=state.bag.pop();await playId(state.currentId,false);setStatus('Catálogo listo · pulsa reproducir');render();bind();}catch(e){$('trackTitle').textContent='No se pudo iniciar';setStatus(e.message);console.error(e);}}
  function bind(){
    bindMediaSession();
    $('play').onclick=()=>audio.paused?play():audio.pause();$('next').onclick=next;$('prev').onclick=previous;
    $('shuffle').onclick=()=>{state.shuffle=!state.shuffle;state.bag=[];$('shuffle').classList.toggle('active',state.shuffle);setStatus(state.shuffle?'Aleatorio activado':'Orden secuencial activado');};
    $('repeat').onclick=()=>{state.repeatList=!state.repeatList;$('repeat').classList.toggle('active',state.repeatList);$('repeat').title=state.repeatList?'Repetir lista activado':'Repetir lista desactivado';};
    audio.addEventListener('ended',()=>{if(!state.switching)next();});
    audio.addEventListener('play',()=>{$('play').textContent='Ⅱ';if('mediaSession' in navigator)navigator.mediaSession.playbackState='playing';updateMediaSession(current());});
    audio.addEventListener('pause',()=>{$('play').textContent='▶';if('mediaSession' in navigator)navigator.mediaSession.playbackState='paused';});
    audio.addEventListener('timeupdate',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0){$('seek').value=Math.round(audio.currentTime/audio.duration*1000);$('elapsed').textContent=fmt(audio.currentTime);$('duration').textContent=fmt(audio.duration);}});
    audio.addEventListener('error',()=>{
      if(audio.error && current() && !state.switching){
        setStatus('No se pudo cargar esta canción. Pasando a otra…');
        if(!state.failedIds.has(current().id)){
          state.failedIds.add(current().id);
          if(state.failedIds.size < state.songs.length) setTimeout(()=>next(),250);
          else setStatus('No se pudieron reproducir las canciones disponibles. Revisa tu conexión.');
        }
      }
    });
    $('seek').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/1000*audio.duration;};
    $('search').oninput=e=>{state.query=e.target.value;renderSongs();};
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;if(state.view==='catalog')state.activeList=null;render();});
    $('songs').onclick=async e=>{const playBtn=e.target.closest('[data-play]'),action=e.target.closest('[data-action]');if(playBtn){const id=Number(playBtn.dataset.play);state.bag=state.bag.filter(x=>x!==id);await playId(id,true);}else if(action){const id=Number(action.dataset.action);if(activeList()){const p=activeList();p.songIds=p.songIds.filter(x=>x!==id);saveLists();render();}else{state.pendingSong=id;if(!state.playlists.length){alert('Primero crea una lista personal.');return;}$('listChoices').innerHTML=state.playlists.map(p=>`<button class="choice" data-list="${p.id}">${escapeHTML(p.name)} · ${p.songIds.length} canciones</button>`).join('');$('addDialog').showModal();}}};
    $('newList').onclick=()=>$('createDialog').showModal();$('createForm').onsubmit=e=>{e.preventDefault();const name=$('listName').value.trim();if(name){createList(name);$('createDialog').close();$('listName').value='';}};
    $('listChoices').onclick=e=>{const b=e.target.closest('[data-list]');if(b){addSongToList(state.pendingSong,b.dataset.list);$('addDialog').close();}};$('closeAdd').onclick=()=>$('addDialog').close();
  }
  init();
})();
