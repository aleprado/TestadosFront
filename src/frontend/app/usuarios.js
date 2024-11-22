import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { db } from './config.js';

/**
 * Carga los usuarios asociados a una localidad específica.
 * @param {string} cliente - El nombre del cliente (usado en Firestore).
 * @param {string} localidad - La localidad seleccionada.
 */
export async function loadUsuariosPorLocalidad(cliente, localidad) {
    const usuariosList = document.getElementById("usuariosList");
    usuariosList.innerHTML = "Cargando usuarios...";

    try {
        // Referencia a la localidad en Firestore
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            usuariosList.innerHTML = "No se encontró la localidad.";
            return;
        }

        // Obtener el array de referencias a usuarios
        const usuariosRefs = localidadDoc.data().usuarios || [];
        if (usuariosRefs.length === 0) {
            usuariosList.innerHTML = "No se encontraron usuarios en esta localidad.";
            return;
        }

        // Resolver cada referencia de usuario
        usuariosList.innerHTML = ""; // Limpiar la lista antes de agregar
        for (const usuarioRef of usuariosRefs) {
            const usuarioDoc = await getDoc(usuarioRef);
            if (usuarioDoc.exists()) {
                const userData = usuarioDoc.data();
                const listItem = document.createElement("li");
                listItem.textContent = `${userData.nombre} (${userData.email})`; // Mostrar nombre y email del usuario
                listItem.dataset.userId = usuarioDoc.id; // Guardar el ID del usuario como dataset
                usuariosList.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error al cargar los usuarios:", error);
        usuariosList.innerHTML = "Error al cargar los usuarios.";
    }
}

/**
 * Resalta a los usuarios relacionados con una ruta específica.
 * @param {string} rutaId - El ID de la ruta seleccionada.
 */
export function highlightUsuariosRelacionados(rutaId) {
    console.log(`Consultando usuarios relacionados con la ruta ${rutaId}...`);
    const usuariosList = document.getElementById("usuariosList");

    // Iterar sobre los elementos de la lista de usuarios
    Array.from(usuariosList.children).forEach(async (listItem) => {
        const userId = listItem.dataset.userId; // Obtener ID del usuario
        const usuarioRef = `/Usuarios/${userId}`; // Formar la referencia completa

        try {
            const usuarioDoc = await getDoc(doc(db, "Usuarios", userId));
            if (usuarioDoc.exists()) {
                const rutasAsignadas = usuarioDoc.data().rutas || [];
                const isRelated = rutasAsignadas.some((rutaRef) => rutaRef.path.endsWith(rutaId));

                if (isRelated) {
                    console.log(`Usuario ${userId} tiene asignada la ruta ${rutaId}`);
                    listItem.classList.add("highlight"); // Resaltar si está relacionado
                } else {
                    listItem.classList.remove("highlight"); // Quitar resaltado si no está relacionado
                }
            }
        } catch (error) {
            console.error(`Error al verificar la relación del usuario ${userId} con la ruta ${rutaId}:`, error);
        }
    });
}
