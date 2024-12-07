import { auth } from './config.js'; // Importa la configuración de Firebase Auth
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';


/**
 * Verifica si el usuario está autenticado.
 * Si no hay un usuario autenticado, redirige al login.
 * @returns {string|null} El nombre de usuario autenticado o null si no hay sesión.
 */
export function checkLogin() {
    const username = localStorage.getItem("username");
    if (!username) {
        alert("Por favor inicia sesión.");
        window.location.href = "/login";
        return null;
    }
    return username;
}

/**
 * Realiza el proceso de inicio de sesión.
 * Guarda el usuario en `localStorage` si las credenciales son correctas.
 * @param {string} username - El nombre de usuario.
 * @param {string} password - La contraseña.
 */
export async function login(username, password) {
    console.log("Iniciando login...");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        const user = userCredential.user;

        console.log("Usuario autenticado:", user);

        // Guardar el usuario en localStorage para persistencia de sesión
        localStorage.setItem("username", username);

        // Redirigir al usuario a la página principal
        window.location.href = "/localidades";
    } catch (error) {
        console.error("Error de autenticación:", error);
        alert("Credenciales incorrectas. Inténtalo de nuevo.");
    }
}

/**
 * Realiza el proceso de cierre de sesión.
 * Elimina el usuario de `localStorage` y redirige al login.
 */
export function logout() {
    localStorage.removeItem("username");
    alert("Sesión cerrada correctamente.");
    window.location.href = "/login";
}