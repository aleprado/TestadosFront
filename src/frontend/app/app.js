import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    setDoc,
    query,
    where,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { checkLogin, login, logout } from "./auth.js";
import { showPopup, showUserFormPopup } from "./ui.js";
import { db, storageUpload, storageDownload } from "./config.js";

// ####################### LOGIN #######################

document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;

    // Botón de cierre de sesión disponible en todas las páginas
    const logoutButton = document.getElementById("logoutButton");
    logoutButton?.addEventListener("click", () => {
        logout();
    });

    const backButton = document.getElementById("backButton");
    backButton?.addEventListener("click", () => {
        window.location.href = "/localidades";
    });

    if (page === "login") {
        const loginButton = document.getElementById("loginButton");
        loginButton?.addEventListener("click", () => {
            const username = document.getElementById("usernameInput").value;
            const password = document.getElementById("passwordInput").value;

            if (username && password) {
                login(username, password);
            } else {
                showPopup("Por favor, ingrese usuario y contraseña.");
            }
        });
    }

    // ####################### LOCALIDADES #######################
    if (page === "localidades") {
        const username = checkLogin();
        const localidadesList = document.getElementById("localidadesList");
        const addBtn = document.getElementById("agregarLocalidadButton");
        addBtn?.addEventListener("click", async () => {
            const input = document.getElementById("nuevaLocalidadInput");
            const nombre = input.value.trim();
            if (!nombre) {
                showPopup("Ingresa un nombre de localidad.");
                return;
            }
            try {
                await setDoc(doc(db, "Clientes", username, "Localidades", nombre), {
                    rutas: [],
                    usuarios: []
                });
                input.value = "";
                await loadLocalidades(username);
            } catch (error) {
                console.error("Error al agregar localidad:", error);
                showPopup("Error al agregar la localidad.");
            }
        });

        if (!localidadesList) return;

        await loadLocalidades(username);

    }

    // ####################### GESTIONAR RUTAS Y USUARIOS #######################
    if (page === "gestionar-rutas") {
        const cliente = checkLogin();
        console.log("Consulta localidad: " + localStorage.getItem("localidad"))
        const localidad = localStorage.getItem("localidad");

        if (!cliente || !localidad) {
            showPopup("Selecciona una localidad para continuar.");
            window.location.href = "/localidades";
            return;
        }

        try {
            await loadRutasPorLocalidad(cliente, localidad);
            await loadUsuariosPorLocalidad(cliente, localidad);

            document.getElementById("fileInput")?.addEventListener("change", () => {
                subirRuta();
            });

            document.getElementById("registerUserButton")?.addEventListener("click", async () => {
                const data = await showUserFormPopup();
                if (data) {
                    registrarUsuario(cliente, localidad, data.nombre, data.email);
                }
            });

            document.getElementById("rutasList")?.addEventListener("click", async (event) => {
                const listItem = event.target.closest("li");
                if (listItem) {
                    const rutaId = listItem.querySelector("input[type='radio']")?.getAttribute("data-ruta-id");
                    if (rutaId) {
                        const usuariosList = document.getElementById("usuariosList");
                        usuariosList.classList.add("blurred");
                        await updateUserCheckboxes(rutaId);
                        usuariosList.classList.remove("blurred");
                    }
                }
            });
        } catch (error) {
            console.error("Error al gestionar rutas y usuarios:", error);
        }
    }
});

// ####################### FUNCIONES REUSABLES #######################

export async function loadLocalidades(cliente) {
    const localidadesList = document.getElementById("localidadesList");
    if (!localidadesList) return;

    localidadesList.innerHTML = "Cargando localidades...";
    try {
        console.log("localidades del cliente: " + cliente);
        const clienteDoc = await getDoc(doc(collection(db, "Clientes"), cliente));

        if (!clienteDoc.exists()) {
            localidadesList.innerHTML = "No se encontró el cliente.";
            return;
        }

        localidadesList.innerHTML = "";
        const localidadesRef = collection(clienteDoc.ref, "Localidades");
        const localidadesSnapshot = await getDocs(localidadesRef);

        if (localidadesSnapshot.empty) {
            localidadesList.innerHTML = "No se encontraron localidades.";
            return;
        }

        localidadesSnapshot.forEach((localidadDoc) => {
            const localidad = localidadDoc.id;
            const listItem = document.createElement("li");
            listItem.classList.add("list-item-clickable");
            listItem.addEventListener("click", () => {
                localStorage.setItem("localidad", localidad);
                console.log("guardada localidad: " + localidad);
                window.location.href = "/gestionar-rutas";
            });

            const label = document.createElement("label");
            label.textContent = localidad;
            listItem.appendChild(label);

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "\u2716";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                eliminarLocalidad(cliente, localidad);
            });
            listItem.appendChild(deleteBtn);

            localidadesList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error al obtener localidades:", error);
    }
}

async function esperarActualizacionRutas(cliente, localidad, cantidadAnterior) {
    for (let i = 0; i < 10; i++) {
        await loadRutasPorLocalidad(cliente, localidad);
        const lista = document.getElementById("rutasList");
        if (lista && lista.children.length > cantidadAnterior) return;
        await new Promise((r) => setTimeout(r, 2000));
    }
}

export async function loadRutasPorLocalidad(cliente, localidad) {
    const rutasList = document.getElementById("rutasList");
    if (!rutasList) return;

    rutasList.innerHTML = "Cargando rutas...";
    try {
        // Referencia a la localidad
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            rutasList.innerHTML = "No se encontró la localidad.";
            return;
        }

        // Obtener las referencias de las rutas
        const rutasRefs = localidadDoc.data().rutas || [];
        rutasList.innerHTML = ""; // Limpia las rutas actuales

        for (const rutaRef of rutasRefs) {
            const rutaDoc = await getDoc(rutaRef);

            if (rutaDoc.exists()) {
                const rutaId = rutaDoc.id;
                const rutaData = rutaDoc.data();

                // Obtener el campo "completado"
                const completado = rutaData.completado || 0;

                // Enlace al archivo CSV en el bucket
                const bucketUrl = `https://storage.googleapis.com/testados-rutas-exportadas/testados-rutas-exportadas/${cliente}/${localidad}/${rutaId}.csv`;

                // Crear el elemento de la lista
                const listItem = document.createElement("li");
                listItem.classList.add("list-item-clickable", "ruta-item");

                listItem.addEventListener("click", () => {
                    const radio = listItem.querySelector("input[type='radio']");
                    if (radio) radio.checked = true;
                });

                // Contenido principal con el nombre de la ruta
                listItem.innerHTML = `
                    <div class="ruta-content">
                        <input type="radio" name="ruta" id="${rutaId}" data-ruta-id="${rutaId}">
                        <label for="${rutaId}" class="ruta-label">${rutaId}</label>
                    </div>
                `;

                // Contenedor de acciones a la derecha
                const actions = document.createElement("div");
                actions.classList.add("ruta-actions");

                const progressLink = document.createElement("a");
                progressLink.href = bucketUrl;
                progressLink.target = "_blank";
                progressLink.classList.add("progreso-link");
                progressLink.textContent = `${completado.toFixed(2)}%`;
                actions.appendChild(progressLink);

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "\u2716";
                deleteBtn.classList.add("delete-btn");
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    eliminarRuta(cliente, localidad, rutaId);
                });
                actions.appendChild(deleteBtn);

                listItem.appendChild(actions);

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
                listItem.classList.add("list-item-clickable", "usuario-item");
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

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "\u2716";
                deleteBtn.classList.add("delete-btn");
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    eliminarUsuario(cliente, localidad, usuarioDoc.id);
                });
                listItem.appendChild(deleteBtn);
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
        showPopup("Selecciona una ruta antes de asignar usuarios.");
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

async function subirRuta() {
    const cliente = checkLogin();
    const localidad = localStorage.getItem("localidad");
    if (!cliente || !localidad) {
        showPopup("Selecciona una localidad para continuar.");
        return;
    }

    const archivoInput = document.getElementById("fileInput");
    const archivo = archivoInput?.files[0];
    const listaRutas = document.getElementById("rutasList");
    const cantidadAnterior = listaRutas ? listaRutas.children.length : 0;

    if (!archivo) {
        showPopup("Selecciona un archivo para subir.");
        return;
    }

    // Validar que el archivo tenga una extensión válida
    const extensionesValidas = [".txt", ".csv"];
    if (!extensionesValidas.some((ext) => archivo.name.endsWith(ext))) {
        showPopup("Solo se permiten archivos .txt o .csv.");
        return;
    }

    try {
        // Usar la configuración específica para subida e incluir la localidad en la ruta
        const referenciaArchivo = ref(
            storageUpload,
            `/${cliente}/${localidad}/${archivo.name}`
        );
        const tareaSubida = uploadBytesResumable(referenciaArchivo, archivo);

        tareaSubida.on(
            "state_changed",
            (instantanea) => {
                const progreso = (instantanea.bytesTransferred / instantanea.totalBytes) * 100;
                console.log(`Progreso de subida: ${progreso}%`);
            },
            (error) => {
                console.error("Error durante la subida del archivo:", error);
                showPopup("Error al subir el archivo.");
            },
            async () => {
                showPopup("Ruta cargada exitosamente.");
                await esperarActualizacionRutas(cliente, localidad, cantidadAnterior);
            }
        );
    } catch (error) {
        console.error("Error general al subir el archivo:", error);
    }
}

async function registrarUsuario(cliente, localidad, nombreUsuario, emailUsuario) {
    if (!nombreUsuario || !emailUsuario) {
        showPopup("Se requiere el nombre y el email del usuario.");
        return;
    }

    try {
        // Crear un nuevo documento para el usuario en la colección 'Usuarios'
        const usuarioRef = doc(collection(db, "Usuarios"), nombreUsuario);
        await setDoc(usuarioRef, {
            nombre: nombreUsuario,
            email: emailUsuario,
            rutas: []
        });

        // Agregar referencia del usuario en la localidad actual
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        await updateDoc(localidadRef, {
            usuarios: arrayUnion(usuarioRef)
        });

        showPopup("Usuario registrado exitosamente.");
        await loadUsuariosPorLocalidad(cliente, localidad); // Recargar usuarios
    } catch (error) {
        console.error("Error al registrar el usuario:", error);
        showPopup("Error al registrar el usuario.");
    }
}

function mostrarLoaderUsuarios(mostrar) {
    const usuariosList = document.getElementById("usuariosList");
    if (mostrar) {
        usuariosList.classList.add("blurred");
    } else {
        usuariosList.classList.remove("blurred");
    }
}

async function eliminarRuta(cliente, localidad, rutaId) {
    try {
        const confirmacion = await showPopup(`\u00bfEliminar la ruta ${rutaId}?`, { confirm: true });
        if (!confirmacion) return;

        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);
        if (!localidadDoc.exists()) {
            showPopup("La localidad no existe.");
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        const rutaRef = rutasRefs.find((ref) => ref.id === rutaId || ref.path.endsWith(`/${rutaId}`));

        if (!rutaRef) {
            console.error(`No se encontr\xF3 la referencia a la ruta ${rutaId}`);
            return;
        }

        const usuariosRefs = localidadDoc.data().usuarios || [];
        for (const usuarioRef of usuariosRefs) {
            await updateDoc(usuarioRef, { rutas: arrayRemove(rutaRef) });
        }

        await updateDoc(localidadRef, { rutas: arrayRemove(rutaRef) });
        await deleteDoc(rutaRef);

        await loadRutasPorLocalidad(cliente, localidad);
        await loadUsuariosPorLocalidad(cliente, localidad);
    } catch (error) {
        console.error("Error al eliminar la ruta:", error);
        showPopup("Error al eliminar la ruta.");
    }
}

async function eliminarUsuario(cliente, localidad, userId) {
    try {
        const confirmacion = await showPopup(`\u00bfEliminar el usuario ${userId}?`, { confirm: true });
        if (!confirmacion) return;

        const usuarioRef = doc(db, "Usuarios", userId);
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);

        await updateDoc(localidadRef, { usuarios: arrayRemove(usuarioRef) });
        await deleteDoc(usuarioRef);

        await loadUsuariosPorLocalidad(cliente, localidad);
    } catch (error) {
        console.error("Error al eliminar el usuario:", error);
        showPopup("Error al eliminar el usuario.");
    }
}

async function eliminarLocalidad(cliente, localidad) {
    const confirm1 = await showPopup(`\u00bfEliminar la localidad ${localidad}?`, { confirm: true });
    if (!confirm1) return;
    const confirm2 = await showPopup(
        "Se eliminar\xE1n todas las rutas y usuarios asociados. \xBFDeseas continuar?",
        { confirm: true }
    );
    if (!confirm2) return;

    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            showPopup("La localidad no existe.");
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        const usuariosRefs = localidadDoc.data().usuarios || [];

        for (const rutaRef of rutasRefs) {
            await deleteDoc(rutaRef);
        }

        for (const usuarioRef of usuariosRefs) {
            await deleteDoc(usuarioRef);
        }

        await deleteDoc(localidadRef);

        showPopup("Localidad eliminada correctamente.");
        window.location.reload();
    } catch (error) {
        console.error("Error al eliminar la localidad:", error);
        showPopup("Error al eliminar la localidad.");
    }
}
