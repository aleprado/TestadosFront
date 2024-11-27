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
export function login(username, password) {
    console.log("iniciando login")
    // Ejemplo de validación de credenciales simple
    if (password === "pass") {
        localStorage.setItem("username", username);
        alert("Inicio de sesión exitoso.");
        window.location.href = "/localidades";
    } else {
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