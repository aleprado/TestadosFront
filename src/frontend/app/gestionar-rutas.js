import { loadRutasPorLocalidad, SubirRuta } from './rutas.js';
import { loadUsuariosPorLocalidad } from './usuarios.js';

// Función principal para gestionar rutas y usuarios
function gestionarRutasUsuarios() {
    // Recuperar parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    let cliente = params.get("username");
    let localidad = params.get("localidad");

    // Si no hay parámetros en la URL, intentar recuperarlos desde localStorage
    if (!cliente || !localidad) {
        cliente = localStorage.getItem("username");
        localidad = localStorage.getItem("localidad");

        if (!cliente || !localidad) {
            alert("Faltan parámetros de cliente o localidad. Por favor, selecciona una localidad nuevamente.");
            window.location.href = "localidades.html";
            return;
        }
    } else {
        // Guardar en localStorage para uso futuro
        localStorage.setItem("username", cliente);
        localStorage.setItem("localidad", localidad);
    }

    // Cargar rutas y usuarios de la localidad
    loadRutasPorLocalidad(cliente, localidad);
    loadUsuariosPorLocalidad(cliente, localidad);

    // Manejar la subida de archivos para nuevas rutas
    const fileInput = document.getElementById("fileInput");
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        SubirRuta(cliente, file, () => {
            // Recargar las rutas después de la subida
            loadRutasPorLocalidad(cliente, localidad);
        });
    });

    // Botón "Volver a Localidades"
    const backButton = document.getElementById("backButton");
    backButton.addEventListener("click", () => {
        window.location.href = `localidades.html`;
    });
}

// Ejecutar la función principal
gestionarRutasUsuarios();
