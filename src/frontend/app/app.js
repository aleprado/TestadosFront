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
import { db, storageUpload, storageDownload } from "./config.js";

// ####################### LOGIN #######################

document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;

    // Botón de cierre de sesión disponible en todas las páginas
    const logoutButton = document.getElementById("logoutButton");
    logoutButton?.addEventListener("click", () => {
        logout();
    });

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
          console.log("localidades del cliente: " + username);
          const clientesRef = collection(db, "Clientes");

          // Actualización: ahora consulta por el ID del documento que coincide con el username
          const docRef = doc(clientesRef, username);
          const clienteDoc = await getDoc(docRef);

          if (!clienteDoc.exists()) {
              localidadesList.innerHTML = "No se encontró el cliente.";
              return;
          }

          // Limpiar la lista de localidades
          localidadesList.innerHTML = "";

          // Obtener la referencia a la subcolección "Localidades"
          const localidadesRef = collection(clienteDoc.ref, "Localidades");
          const localidadesSnapshot = await getDocs(localidadesRef);

          // Verificar si hay localidades
          if (localidadesSnapshot.empty) {
              localidadesList.innerHTML = "No se encontraron localidades.";
              return;
          }

          // Iterar sobre las localidades y agregar cada una a la lista
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
                  eliminarLocalidad(username, localidad);
              });
              listItem.appendChild(deleteBtn);

              localidadesList.appendChild(listItem);
          });
        } catch (error) {
          console.error("Error al obtener localidades:", error);
        }

    }

    // ####################### GESTIONAR RUTAS Y USUARIOS #######################
    if (page === "gestionar-rutas") {
        const cliente = checkLogin();
        console.log("Consulta localidad: " + localStorage.getItem("localidad"))
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

            document.getElementById("registerUserButton")?.addEventListener("click", () => {
                registrarUsuario(cliente, localidad);
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

async function registrarUsuario(cliente, localidad) {
    const nombreUsuario = prompt("Ingrese el nombre del usuario:");
    const emailUsuario = prompt("Ingrese el email del usuario:");

    if (!nombreUsuario || !emailUsuario) {
        alert("Se requiere el nombre y el email del usuario.");
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

        alert("Usuario registrado exitosamente.");
        await loadUsuariosPorLocalidad(cliente, localidad); // Recargar usuarios
    } catch (error) {
        console.error("Error al registrar el usuario:", error);
        alert("Error al registrar el usuario.");
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
        const confirmacion = confirm(`\u00bfEliminar la ruta ${rutaId}?`);
        if (!confirmacion) return;

        const rutaRef = doc(db, "Rutas", rutaId);
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);

        // Obtener usuarios para quitar la referencia de la ruta
        const localidadDoc = await getDoc(localidadRef);
        const usuariosRefs = localidadDoc.data().usuarios || [];
        for (const usuarioRef of usuariosRefs) {
            await updateDoc(usuarioRef, { rutas: arrayRemove(rutaRef) });
        }

        // Quitar referencia de la localidad y eliminar el documento de la ruta
        await updateDoc(localidadRef, { rutas: arrayRemove(rutaRef) });
        await deleteDoc(rutaRef);

        await loadRutasPorLocalidad(cliente, localidad);
        await loadUsuariosPorLocalidad(cliente, localidad);
    } catch (error) {
        console.error("Error al eliminar la ruta:", error);
        alert("Error al eliminar la ruta.");
    }
}

async function eliminarUsuario(cliente, localidad, userId) {
    try {
        const confirmacion = confirm(`\u00bfEliminar el usuario ${userId}?`);
        if (!confirmacion) return;

        const usuarioRef = doc(db, "Usuarios", userId);
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);

        await updateDoc(localidadRef, { usuarios: arrayRemove(usuarioRef) });
        await deleteDoc(usuarioRef);

        await loadUsuariosPorLocalidad(cliente, localidad);
    } catch (error) {
        console.error("Error al eliminar el usuario:", error);
        alert("Error al eliminar el usuario.");
    }
}

async function eliminarLocalidad(cliente, localidad) {
    const confirm1 = confirm(`\u00bfEliminar la localidad ${localidad}?`);
    if (!confirm1) return;
    const confirm2 = confirm(
        "Se eliminar\xE1n todas las rutas y usuarios asociados. \xBFDeseas continuar?"
    );
    if (!confirm2) return;

    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            alert("La localidad no existe.");
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

        alert("Localidad eliminada correctamente.");
        window.location.reload();
    } catch (error) {
        console.error("Error al eliminar la localidad:", error);
        alert("Error al eliminar la localidad.");
    }
}
