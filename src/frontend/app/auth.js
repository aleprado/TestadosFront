import { auth, db } from './config.js'; // Importa la configuración de Firebase Auth y Firestore
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { showPopup } from './ui.js';
import { trackEvent, auditLog } from './metrics.js';

/**
 * Verifica si el usuario está autenticado.
 * Si no hay un usuario autenticado, redirige al login.
 * @returns {Promise<string|null>} El nombre del cliente guardado o null si no hay sesión.
 */
export async function checkLogin() {
    try {
        // ✅ SEGURIDAD: Verificar si hay usuario autenticado en Firebase
        let user = auth.currentUser;
        
        if (!user) {
            // Intentar obtener usuario de la sesión persistente
            user = await new Promise((resolve) => {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
            });
        }
        
        if (!user) {
            showPopup("Por favor inicia sesión.");
            window.location.href = "/login";
            return null;
        }
        
        // ✅ SEGURIDAD: Verificar token válido
        const token = await user.getIdToken();
        if (!token) {
            showPopup("Sesión expirada. Por favor inicia sesión nuevamente.");
            window.location.href = "/login";
            return null;
        }
        
        // Obtener cliente desde localStorage (ya verificado)
        const clienteNombre = localStorage.getItem("cliente");
        if (!clienteNombre) {
            showPopup("Error de sesión. Por favor inicia sesión nuevamente.");
            window.location.href = "/login";
            return null;
        }
        
        return clienteNombre;
    } catch (error) {
        console.error("Error de verificación:", error);
        showPopup("Error de autenticación. Por favor inicia sesión nuevamente.");
        window.location.href = "/login";
        return null;
    }
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
    const start = performance.now();
    try {
        trackEvent('login_attempt', { email_present: Boolean(email) });
        // Autenticar al usuario
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log("Usuario autenticado:", user);
        trackEvent('login_success', { elapsed_ms: Math.round(performance.now() - start) });
        auditLog('login_success', { email: user.email });

        // Obtener el nombre del cliente
        const clienteNombre = await obtenerNombreCliente(user.email);
        if (!clienteNombre) {
            showPopup("No se encontró un cliente asociado a este email.");
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
        trackEvent('login_error', {
            code: error.code || 'unknown',
            elapsed_ms: Math.round(performance.now() - start)
        });
        showPopup("Credenciales incorrectas. Inténtalo de nuevo.");
    }
}

/**
 * Realiza el proceso de cierre de sesión.
 * Elimina los datos de `localStorage` y redirige al login.
 */
export async function logout() {
    try {
        // ✅ SEGURIDAD: Cerrar sesión de Firebase
        await auth.signOut();
        
        // Limpiar localStorage
        localStorage.removeItem("email");
        localStorage.removeItem("cliente");
        
        trackEvent('logout');
        auditLog('logout');
        showPopup("Sesión cerrada correctamente.");
        window.location.href = "/login";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        // Limpiar localStorage de todas formas
        localStorage.removeItem("email");
        localStorage.removeItem("cliente");
        trackEvent('logout_error', { code: error.code || 'unknown' });
        showPopup("Sesión cerrada correctamente.");
        window.location.href = "/login";
    }
}
