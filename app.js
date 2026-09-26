document.addEventListener("DOMContentLoaded", () => {
    let songsData = [];
    const playlistElement = document.getElementById("playlist");
    const audioPlayer = document.getElementById("main-audio");
    const currentCover = document.getElementById("current-cover");
    const currentTitle = document.getElementById("current-title");
    const lyricsBox = document.getElementById("lyrics-box");
    const searchInput = document.getElementById("search-input");

    // 1. Cargar las canciones de manera automática desde el JSON
    fetch("songs.json")
        .then(response => {
            if (!response.ok) throw new Error("Error al abrir base de datos de música");
            return response.json();
        })
        .then(data => {
            songsData = data;
            renderPlaylist(songsData);
        })
        .catch(err => {
            console.error(err);
            playlistElement.innerHTML = `<li class="loading-item" style="color: red;">Error al sincronizar canciones.</li>`;
        });

    // 2. Pintar las canciones en la barra lateral
    function renderPlaylist(tracks) {
        playlistElement.innerHTML = "";
        if (tracks.length === 0) {
            playlistElement.innerHTML = `<li class="loading-item">No se encontraron temas coincidentes.</li>`;
            return;
        }

        tracks.forEach(track => {
            const li = document.createElement("li");
            li.innerHTML = `<i class="fa-solid fa-play" style="opacity: 0.5; font-size: 11px;"></i> <span>${track.title}</span>`;
            li.addEventListener("click", () => selectTrack(track, li));
            playlistElement.appendChild(li);
        });
    }

    // 3. Gestionar la reproducción y cambio de elementos multimedia
    function selectTrack(track, activeElement) {
        // Marcar la canción seleccionada visualmente
        document.querySelectorAll(".playlist li").forEach(li => li.classList.remove("active"));
        activeElement.classList.add("active");

        // Cambiar títulos e inicializar la pista pesada desde Cloudflare
        currentTitle.textContent = track.title;
        audioPlayer.src = track.audio;
        
        // Manejo dinámico de carátula (Usa la imagen por defecto del banner si no existe la portada individual)
        currentCover.src = track.cover;
        currentCover.onerror = () => {
            currentCover.src = "img/banner-principal-gtgelm.png";
        };

        // Iniciar la reproducción automáticamente
        audioPlayer.play();

        // 4. Intentar cargar la letra del tema desde tu repositorio local de GitHub
        lyricsBox.innerHTML = `<p class="lyrics-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Cargando letra...</p>`;
        
        fetch(track.lyrics)
            .then(res => {
                if (!res.ok) throw new Error("Letra no disponible");
                return res.text();
            })
            .then(text => {
                lyricsBox.innerHTML = `<p>${text}</p>`;
            })
            .catch(() => {
                lyricsBox.innerHTML = `<p class="lyrics-placeholder" style="color: #884444;"><i class="fa-solid fa-circle-exclamation"></i> Letra no encontrada en el sistema local.</p>`;
            });
    }

    // 5. Motor del Buscador en tiempo real
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filteredSongs = songsData.filter(song => 
            song.title.toLowerCase().includes(query)
        );
        renderPlaylist(filteredSongs);
    });
});
