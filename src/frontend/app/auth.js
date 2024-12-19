import { auth, db } from './config.js'; // Importa la configuración de Firebase Auth y Firestore
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Verifica si el usuario está autenticado.
 * Si no hay un usuario autenticado, redirige al login.
 * @returns {string|null} El nombre del cliente guardado o null si no hay sesión.
 */
export function checkLogin() {
    const clienteNombre = localStorage.getItem("cliente");
    if (!clienteNombre) {
        alert("Por favor inicia sesión.");
        window.location.href = "/login";
        return null;
    }
    return clienteNombre;
}

/**
 * Obtiene el nombre del cliente desde Firestore usando el email.
 * @param {string} email - El email del usuario autenticado.
 * @returns {Promise<string|null>} El nombre del cliente o null si no se encuentra.
 */
export async function obtenerNombreCliente(email) {
    try {
        const clientesRef = collection(db, "Clientes");
        const q = query(clientesRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error("No se encontró un cliente asociado a este email.");
            return null;
        }

        const clienteDoc = querySnapshot.docs[0];
        const clienteNombre = clienteDoc.id; // Usar el ID del documento como nombre del cliente
        return clienteNombre;
    } catch (error) {
        console.error("Error al obtener el cliente:", error);
        return null;
    }
}

/**
 * Realiza el proceso de inicio de sesión.
 * Guarda el email y el nombre del cliente en `localStorage` si las credenciales son correctas.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña.
 */
export async function login(email, password) {
    console.log("Iniciando login...");
    try {
        // Autenticar al usuario
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log("Usuario autenticado:", user);

        // Obtener el nombre del cliente
        const clienteNombre = await obtenerNombreCliente(user.email);
        if (!clienteNombre) {
            alert("No se encontró un cliente asociado a este email.");
            return;
        }

        // Guardar datos en localStorage
        localStorage.setItem("email", user.email); // Guarda el email
        localStorage.setItem("cliente", clienteNombre); // Guarda el nombre del cliente

        console.log(`Datos guardados - Cliente: ${clienteNombre}, Email: ${user.email}`);

        // Redirigir al usuario a la página principal
        window.location.href = "/localidades";
    } catch (error) {
        console.error("Error de autenticación:", error);
        alert("Credenciales incorrectas. Inténtalo de nuevo.");
    }
}

/**
 * Realiza el proceso de cierre de sesión.
 * Elimina los datos de `localStorage` y redirige al login.
 */
export function logout() {
    localStorage.removeItem("email");
    localStorage.removeItem("cliente");
    alert("Sesión cerrada correctamente.");
    window.location.href = "/login";
}
