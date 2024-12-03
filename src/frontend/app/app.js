import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { checkLogin, login } from "./auth.js";
import { db, storageUpload } from "./config.js";

// ####################### LOGIN #######################

document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;

    if (page === "login") {
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
    }

    // ####################### LOCALIDADES #######################
    if (page === "localidades") {
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
                listItem.classList.add("list-item-clickable");
                listItem.addEventListener("click", () => {
                    localStorage.setItem("localidad", localidad);
                    window.location.href = "/gestionar-rutas";
                });

                const label = document.createElement("label");
                label.textContent = localidad;
                listItem.appendChild(label);
                localidadesList.appendChild(listItem);
            });

            if (snapshot.empty) {
                localidadesList.innerHTML = "No se encontraron localidades.";
            }
        } catch (error) {
            console.error("Error al cargar localidades:", error);
            localidadesList.innerHTML = "Error al cargar localidades.";
        }
    }

    // ####################### GESTIONAR RUTAS Y USUARIOS #######################
    if (page === "gestionar-rutas") {
        const cliente = checkLogin();
        const localidad = localStorage.getItem("localidad");

        if (!cliente || !localidad) {
            alert("Selecciona una localidad para continuar.");
            window.location.href = "/localidades";
            return;
        }

        try {
            await loadRutasPorLocalidad(cliente, localidad);
            await loadUsuariosPorLocalidad(cliente, localidad);

            document.getElementById("fileInput")?.addEventListener("change", () => {
                        subirRuta(cliente, localidad);
                    });

            document.getElementById("rutasList")?.addEventListener("click", async (event) => {
                const listItem = event.target.closest("li");
                if (listItem) {
                    const rutaId = listItem.querySelector("input[type='radio']")?.getAttribute("data-ruta-id");
                    if (rutaId) {
                        await updateUserCheckboxes(rutaId);
                    }
                }
            });
        } catch (error) {
            console.error("Error al gestionar rutas y usuarios:", error);
        }
    }
});

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
                listItem.classList.add("list-item-clickable");
                listItem.addEventListener("click", () => {
                    const radio = listItem.querySelector("input[type='radio']");
                    if (radio) radio.checked = true;
                });

                const label = document.createElement("label");
                label.setAttribute("for", rutaDoc.id);
                label.classList.add("ruta-label");

                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "ruta";
                radio.id = rutaDoc.id;
                radio.setAttribute("data-ruta-id", rutaDoc.id);

                const span = document.createElement("span");
                span.textContent = rutaDoc.id;

                label.appendChild(radio);
                label.appendChild(span);
                listItem.appendChild(label);
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
                listItem.classList.add("list-item-clickable");
                listItem.setAttribute("data-user-id", usuarioDoc.id);
                listItem.addEventListener("click", () => {
                    const checkbox = listItem.querySelector("input[type='checkbox']");
                    if (checkbox) checkbox.checked = !checkbox.checked;
                    handleUserAssignment(usuarioDoc.id, checkbox.checked);
                });

                const label = document.createElement("label");
                label.setAttribute("for", usuarioDoc.id);
                label.classList.add("usuario-label");

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = usuarioDoc.id;
                checkbox.setAttribute("data-user-id", usuarioDoc.id);
                checkbox.addEventListener("change", (e) =>
                    handleUserAssignment(usuarioDoc.id, e.target.checked)
                );

                const span = document.createElement("span");
                span.textContent = `${userData.nombre} (${userData.email})`;

                label.appendChild(checkbox);
                label.appendChild(span);
                listItem.appendChild(label);
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
    for (const listItem of usuariosList.children) {
        const checkbox = listItem.querySelector("input[type='checkbox']");
        const userId = listItem.getAttribute("data-user-id");
        try {
            const usuarioRef = doc(db, "Usuarios", userId);
            const usuarioDoc = await getDoc(usuarioRef);
            const rutasAsignadas = usuarioDoc.data().rutas.map((ruta) => ruta.path || ruta);

            checkbox.checked = rutasAsignadas.includes(`Rutas/${rutaId}`);
        } catch (error) {
            console.error(`Error al consultar el documento del usuario ${userId}:`, error);
            if (checkbox) checkbox.checked = false;
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

async function subirRuta(cliente, localidad) {
    const archivoInput = document.getElementById("fileInput");
    const archivo = archivoInput?.files[0];

    if (!archivo) {
        alert("Selecciona un archivo para subir.");
        return;
    }

    // Validar que el archivo tenga una extensión válida
    const extensionesValidas = [".txt", ".csv"];
    if (!extensionesValidas.some((ext) => archivo.name.endsWith(ext))) {
        alert("Solo se permiten archivos .txt o .csv.");
        return;
    }

    try {
        // Usar la configuración específica para subida
        const referenciaArchivo = ref(storageUpload, `/${cliente}/${archivo.name}`);
        const tareaSubida = uploadBytesResumable(referenciaArchivo, archivo);

        tareaSubida.on(
            "state_changed",
            (instantanea) => {
                const progreso = (instantanea.bytesTransferred / instantanea.totalBytes) * 100;
                console.log(`Progreso de subida: ${progreso}%`);
            },
            (error) => {
                console.error("Error durante la subida del archivo:", error);
                alert("Error al subir el archivo.");
            },
            async () => {
                // Archivo subido correctamente
                alert("Archivo subido exitosamente.");

                // Agregar referencia a Firestore
                const rutaRef = doc(db, "Clientes", cliente, "Localidades", localidad);
                const nuevaRuta = `/Rutas/${archivo.name}`;
                try {
                    console.log("Ruta registrada exitosamente en la base de datos.");
                    await loadRutasPorLocalidad(cliente, localidad); // Recargar rutas
                } catch (error) {
                    console.error("Error al registrar la ruta en la base de datos:", error);
                }
            }
        );
    } catch (error) {
        console.error("Error general al subir el archivo:", error);
    }
}
