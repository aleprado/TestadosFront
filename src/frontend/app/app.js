import { checkLogin, logout, login } from './auth.js';
import { loadLocalidades } from './localidades.js';
import { loadRutasPorLocalidad, SubirRuta } from './rutas.js';
import { loadUsuariosPorLocalidad } from './usuarios.js';

if (window.location.pathname.includes("login.html")) {
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
        loginButton.addEventListener("click", () => {
            const username = document.getElementById("usernameInput").value;
            const password = document.getElementById("passwordInput").value;

            if (username && password) {
                login(username, password);
            } else {
                alert("Por favor, ingrese usuario y contraseña.");
            }
        });
    }
}

if (window.location.pathname.includes("localidades.html")) {
    loadLocalidades();
}

if (window.location.pathname.includes("gestionar-rutas.html")) {
    const params = new URLSearchParams(window.location.search);
    const cliente = params.get("username");
    const localidad = params.get("localidad");

    if (cliente && localidad) {
        loadRutasPorLocalidad(cliente, localidad);
        loadUsuariosPorLocalidad(cliente, localidad);
    }

    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (!file) return;

            SubirRuta(cliente, file, () => {
                loadRutasPorLocalidad(cliente, localidad);
            });
        });
    }
}
