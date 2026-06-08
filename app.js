async function cargarCanciones() {

    const contenedor =
    document.getElementById("contenedorCanciones");

    try {

        const respuesta =
        await fetch("songs.json");

        const canciones =
        await respuesta.json();

        canciones.forEach(cancion => {

            const card =
            document.createElement("div");

            card.className = "card";

            card.innerHTML = `

                <h3>${cancion.titulo}</h3>

                <p>
                    Letra disponible en la colección
                    histórica GT-GELM.
                </p>

                <a
                href="lyrics/${cancion.archivo}"
                target="_blank">

                📜 Ver Letra

                </a>

            `;

            contenedor.appendChild(card);

        });

    }
    catch(error){

        console.error(error);

        contenedor.innerHTML =
        "<p>Error cargando canciones.</p>";

    }

}

cargarCanciones();
