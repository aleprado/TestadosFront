import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { checkLogin, login } from "./auth.js";
import { db } from "./config.js";

// ####################### LOGIN #######################
if (window.location.pathname.includes("login")) {
    document.addEventListener("DOMContentLoaded", () => {
        const loginButton = document.getElementById("loginButton");
        loginButton?.addEventListener("click", () => {
            const username = document.getElementById("usernameInput").value;
            const password = document.getElementById("passwordInput").value;

            if (username && password) {
                login(username, password);
            } else {
                alert("Por favor, ingrese usuario y contraseña.");
            }
        });
    });
}

// ####################### LOCALIDADES #######################
if (window.location.pathname.includes("localidades")) {
    document.addEventListener("DOMContentLoaded", async () => {
        const username = checkLogin();
        const localidadesList = document.getElementById("localidadesList");

        if (!localidadesList) return;

        localidadesList.innerHTML = "Cargando localidades...";
        try {
            const localidadesRef = collection(doc(db, "Clientes", username), "Localidades");
            const snapshot = await getDocs(localidadesRef);

            localidadesList.innerHTML = "";
            snapshot.forEach((doc) => {
                const localidad = doc.id;
                const listItem = document.createElement("li");
                listItem.textContent = localidad;
                listItem.addEventListener("click", () => {
                    localStorage.setItem("localidad", localidad);
                    window.location.href = "gestionar-rutas.html";
                });
                localidadesList.appendChild(listItem);
            });

            if (snapshot.empty) {
                localidadesList.innerHTML = "No se encontraron localidades.";
            }
        } catch (error) {
            console.error("Error al cargar localidades:", error);
            localidadesList.innerHTML = "Error al cargar localidades.";
        }
    });
}

// ####################### GESTIONAR RUTAS Y USUARIOS #######################
if (window.location.pathname.includes("gestionar-rutas")) {
    document.addEventListener("DOMContentLoaded", async () => {
        const cliente = checkLogin();
        const localidad = localStorage.getItem("localidad");

        if (!cliente || !localidad) {
            alert("Selecciona una localidad para continuar.");
            window.location.href = "localidades.html";
            return;
        }

        await loadRutasPorLocalidad(cliente, localidad);
        await loadUsuariosPorLocalidad(cliente, localidad);

        document.getElementById("rutasList")?.addEventListener("change", async (event) => {
            const rutaId = event.target.getAttribute("data-ruta-id");
            if (rutaId) {
                await updateUserCheckboxes(rutaId);
            }
        });
    });
}

// ####################### FUNCIONES REUSABLES #######################

export async function loadRutasPorLocalidad(cliente, localidad) {
    const rutasList = document.getElementById("rutasList");
    if (!rutasList) return;

    rutasList.innerHTML = "Cargando rutas...";
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            rutasList.innerHTML = "No se encontró la localidad.";
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        rutasList.innerHTML = "";

        for (const rutaRef of rutasRefs) {
            const rutaDoc = await getDoc(rutaRef);
            if (rutaDoc.exists()) {
                const listItem = document.createElement("li");

                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "ruta";
                radio.setAttribute("data-ruta-id", rutaDoc.id);
                listItem.appendChild(radio);
                listItem.appendChild(document.createTextNode(rutaDoc.id));
                rutasList.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error al cargar rutas:", error);
        rutasList.innerHTML = "Error al cargar rutas.";
    }
}

export async function loadUsuariosPorLocalidad(cliente, localidad) {
    const usuariosList = document.getElementById("usuariosList");
    if (!usuariosList) return;

    usuariosList.innerHTML = "Cargando usuarios...";
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            usuariosList.innerHTML = "No se encontró la localidad.";
            return;
        }

        const usuariosRefs = localidadDoc.data().usuarios || [];
        usuariosList.innerHTML = "";

        for (const usuarioRef of usuariosRefs) {
            const usuarioDoc = await getDoc(usuarioRef);
            if (usuarioDoc.exists()) {
                const userData = usuarioDoc.data();
                const listItem = document.createElement("li");
                listItem.setAttribute("data-user-id", usuarioDoc.id);

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.setAttribute("data-user-id", usuarioDoc.id);
                checkbox.addEventListener("change", (e) =>
                    handleUserAssignment(usuarioDoc.id, e.target.checked)
                );

                listItem.appendChild(checkbox);
                listItem.appendChild(
                    document.createTextNode(`${userData.nombre} (${userData.email})`)
                );
                usuariosList.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        usuariosList.innerHTML = "Error al cargar usuarios.";
    }
}

async function updateUserCheckboxes(rutaId) {
    const usuariosList = document.getElementById("usuariosList");
    // Iterar sobre los usuarios visibles en el DOM
    for (const listItem of usuariosList.children) {
        const checkbox = listItem.querySelector("input[type='checkbox']");
        const userId = listItem.getAttribute("data-user-id");
        try {
            const usuarioRef = doc(db, "Usuarios", userId);
            const usuarioDoc = await getDoc(usuarioRef);
            const rutasAsignadas = usuarioDoc.data().rutas.map((ruta) => ruta.path || ruta);

            console.log(`Usuario ${userId} - Rutas asignadas:`, rutasAsignadas);

            // Comparar directamente con includes
            checkbox.checked = rutasAsignadas.includes(`Rutas/${rutaId}`);
        } catch (error) {
            console.error(`Error al consultar el documento del usuario ${userId}:`, error);
            if (checkbox) checkbox.checked = false; // Desmarcar en caso de error
        }
    }
}

export async function handleUserAssignment(userId, isChecked) {
    const rutaId = document.querySelector("input[name='ruta']:checked")?.getAttribute("data-ruta-id");
    if (!rutaId) {
        alert("Selecciona una ruta antes de asignar usuarios.");
        return;
    }

    try {
        const usuarioRef = doc(db, "Usuarios", userId);
        const rutaRef = doc(db, "Rutas", rutaId);

        const updateData = isChecked
            ? { rutas: arrayUnion(rutaRef) }
            : { rutas: arrayRemove(rutaRef) };

        await updateDoc(usuarioRef, updateData);
        console.log(
            `${isChecked ? "Asignada" : "Eliminada"} la ruta ${rutaId} al usuario ${userId}`
        );
    } catch (error) {
        console.error("Error al actualizar la asignación de usuarios:", error);
    }
}
