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
import { ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { checkLogin, login, logout } from "./auth.js";
import { showPopup, showUserFormPopup, mostrarMapaPopup, showLoading, hideLoading } from "./ui.js";
import { db, exportOnDemandEndpoint, auth, storageUpload } from "./config.js";

let rutaSeleccionada = null;
let usuariosCargados = false;

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
        const username = await checkLogin();
        if (!username) {
            window.location.href = "/login";
            return;
        }
        
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
        const cliente = await checkLogin();
        if (!cliente) {
            window.location.href = "/login";
            return;
        }
        
        console.log("Consulta localidad: " + localStorage.getItem("localidad"))
        const localidad = localStorage.getItem("localidad");

        if (!localidad) {
            showPopup("Selecciona una localidad para continuar.");
            window.location.href = "/localidades";
            return;
        }

        try {
            await loadRutasPorLocalidad(cliente, localidad);
            document.getElementById("usuariosList").innerHTML = "Elige una ruta";

            document.getElementById("fileInput")?.addEventListener("change", () => {
                subirRutas();
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
                    const rutaId = listItem.getAttribute("data-ruta-id");
                    if (rutaId) {
                        rutaSeleccionada = rutaId;
                        document.querySelectorAll(".ruta-item").forEach((el) => el.classList.remove("ruta-seleccionada"));
                        listItem.classList.add("ruta-seleccionada");
                        const usuariosList = document.getElementById("usuariosList");
                        usuariosList.classList.add("blurred");
                        if (!usuariosCargados) {
                            await loadUsuariosPorLocalidad(cliente, localidad);
                            usuariosCargados = true;                        }
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

/**
 * 🔒 SEGURIDAD: Genera URL firmada para descargar archivo de Storage
 * Solo usuarios autenticados pueden generar URLs firmadas
 */
function generarUrlDirecta(cliente, localidad, archivo) {
    // Usar URL directa del bucket público de GCP (configurado en Terraform)
    const bucketName = 'testados-rutas-exportadas';
    const url = `https://storage.googleapis.com/${bucketName}/${cliente}/${localidad}/${archivo}`;
    
    console.log(`✅ URL directa generada para: ${cliente}/${localidad}/${archivo}`);
    console.log(`🔍 URL completa: ${url}`);
    return url;
}

async function exportarYDescargar(cliente, localidad, rutaId) {
    try {
        // ✅ DEBUG: Log de los parámetros que se están enviando
        console.log("🔍 DEBUG exportarYDescargar:");
        console.log("  - cliente:", cliente);
        console.log("  - localidad:", localidad);
        console.log("  - rutaId:", rutaId);
        console.log("  - tipos:", typeof cliente, typeof localidad, typeof rutaId);
        
        showLoading("Generando CSV, por favor espera...");
        
        // ✅ SOLUCIÓN: Enviar parámetros en el body JSON en lugar de en la URL
        const response = await fetch(exportOnDemandEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cliente: cliente,
                localidad: localidad,
                ruta_id: rutaId,
                timestamp: new Date().getTime() // Para asegurar archivo fresco
            })
        });

        // ✅ DEBUG: Log de la respuesta
        console.log("🔍 DEBUG respuesta:", response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json();
            console.log("🔍 DEBUG error data:", errorData);
            throw new Error(errorData.error || 'Error al exportar CSV');
        }

        const data = await response.json();
        console.log("🔍 DEBUG success data:", data);
        
        if (data.filename) {
            try {
                console.log(`🔍 DEBUG filename recibido: ${data.filename}`);
                const nombreArchivo = data.filename.split('/').pop();
                console.log(`🔍 DEBUG nombre archivo extraído: ${nombreArchivo}`);
                
                // Generar URL directa del bucket público de GCP
                const urlDirecta = generarUrlDirecta(cliente, localidad, nombreArchivo);
                
                // Descargar archivo con URL directa
                const link = document.createElement('a');
                link.href = urlDirecta;
                link.download = nombreArchivo;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showPopup("✅ CSV generado y descargado correctamente");
            } catch (error) {
                console.error('Error generando URL directa:', error);
                showPopup("❌ Error al descargar el archivo.");
            }
        } else {
            showPopup("No se recibió información del archivo generado.");
        }
    } catch (error) {
        console.error("Error en la exportación y descarga:", error);
        showPopup(`Error al generar el CSV: ${error.message}`);
    } finally {
        hideLoading();
    }
}

export async function loadLocalidades(cliente) {
    const localidadesList = document.getElementById("localidadesList");
    if (!localidadesList) return;

    // Mostrar spinner mientras se cargan las localidades
    localidadesList.innerHTML = '<div class="loading-spinner">Cargando localidades...</div>';
    
    try {
        console.log("localidades del cliente: " + cliente);
        
        // ✅ OPTIMIZACIÓN: Consulta directa a la subcolección de localidades
        const localidadesRef = collection(db, "Clientes", cliente, "Localidades");
        const localidadesSnapshot = await getDocs(localidadesRef);

        if (localidadesSnapshot.empty) {
            localidadesList.innerHTML = "No se encontraron localidades.";
            return;
        }

        // ✅ OPTIMIZACIÓN: No limpiar la lista hasta que tengamos todas las localidades procesadas
        // Solo mostrar progreso si hay muchas localidades
        if (localidadesSnapshot.size > 5) {
            const progressDiv = document.createElement('div');
            progressDiv.id = 'localidades-progress';
            progressDiv.innerHTML = `<div class="loading-spinner">Procesando ${localidadesSnapshot.size} localidades...</div>`;
            localidadesList.appendChild(progressDiv);
        }

        // ✅ OPTIMIZACIÓN: Procesar todas las localidades antes de limpiar la lista
        const localidadesProcesadas = [];
        
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

            localidadesProcesadas.push(listItem);
        });
        
        // ✅ OPTIMIZACIÓN: Limpiar la lista solo después de procesar todas las localidades
        localidadesList.innerHTML = '';
        localidadesProcesadas.forEach(item => localidadesList.appendChild(item));
        
        // Eliminar el spinner de progreso si existía
        const progressDiv = document.getElementById('localidades-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    } catch (error) {
        console.error("Error al obtener localidades:", error);
        localidadesList.innerHTML = "Error al cargar localidades.";
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

    // Mostrar spinner mientras se cargan las rutas
    rutasList.innerHTML = '<div class="loading-spinner">Cargando rutas...</div>';
    
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
        
        // ✅ SOLUCIÓN: No limpiar la lista hasta que tengamos todas las rutas procesadas
        // Solo mostrar progreso si hay muchas rutas
        if (rutasRefs.length > 5) {
            const progressDiv = document.createElement('div');
            progressDiv.id = 'rutas-progress';
            progressDiv.innerHTML = `<div class="loading-spinner">Procesando ${rutasRefs.length} rutas...</div>`;
            rutasList.appendChild(progressDiv);
        }

        for (const rutaRef of rutasRefs) {
            const rutaDoc = await getDoc(rutaRef);

            if (rutaDoc.exists()) {
                const rutaId = rutaDoc.id;
                const refLecturas = collection(rutaRef,'RutaRecorrido');
                const lecturas = await getDocs(refLecturas);
                const total = lecturas.size;
                const conMedicion = lecturas.docs.filter(d=>d.data().lectura_actual).length;
                const completado = total ? conMedicion/total*100 : 0;

                const asignada = await rutaTieneAsignados(rutaRef);

                const listItem = document.createElement("li");
                listItem.classList.add("list-item-clickable", "ruta-item");
                listItem.setAttribute("data-ruta-id", rutaId);

                const contenido = document.createElement("div");
                contenido.classList.add("ruta-content");
                const nombre = document.createElement("span");
                nombre.classList.add("ruta-label");
                nombre.textContent = rutaId;
                contenido.appendChild(nombre);
                listItem.appendChild(contenido);

                const actions = document.createElement("div");
                actions.classList.add("ruta-actions");

                if (asignada) {
                    const etiqueta = document.createElement("span");
                    etiqueta.classList.add("asignada-label");
                    etiqueta.textContent = "Asignada";
                    actions.appendChild(etiqueta);
                }

                const progressLink = document.createElement("a");
                progressLink.href = "#";
                progressLink.target = "_blank";
                progressLink.classList.add("progreso-link");
                if (completado === 0) {
                    progressLink.classList.add("progreso-disabled");
                }
                progressLink.textContent = `${completado.toFixed(2)}%`;
                progressLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    // ✅ DEBUG: Log antes de llamar a la función
                    console.log("🔍 DEBUG click en progressLink:");
                    console.log("  - cliente:", cliente);
                    console.log("  - localidad:", localidad);
                    console.log("  - rutaId:", rutaId);
                    console.log("  - tipos:", typeof cliente, typeof localidad, typeof rutaId);
                    exportarYDescargar(cliente, localidad, rutaId);
                });
                actions.appendChild(progressLink);

                const mapaBtn = document.createElement("button");
                mapaBtn.innerHTML =
                    '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"></path></svg>';
                mapaBtn.classList.add("map-btn");
                mapaBtn.disabled = completado === 0;
                mapaBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (mapaBtn.disabled) return;
                    mostrarMapaPopup(rutaId);
                });
                actions.appendChild(mapaBtn);

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

        // ✅ SOLUCIÓN: Limpiar la lista solo después de procesar todas las rutas
        // y reemplazar el contenido con las rutas procesadas
        const rutasProcesadas = Array.from(rutasList.children).filter(child => child.classList.contains('ruta-item'));
        rutasList.innerHTML = '';
        rutasProcesadas.forEach(ruta => rutasList.appendChild(ruta));

        // Eliminar el spinner de progreso si existía
        const progressDiv = document.getElementById('rutas-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    } catch (error) {
        console.error("Error al cargar rutas:", error);
        rutasList.innerHTML = "Error al cargar rutas.";
    }
}

export async function loadUsuariosPorLocalidad(cliente, localidad) {
    const usuariosList = document.getElementById("usuariosList");
    if (!usuariosList) return;

    // Mostrar spinner mientras se cargan los usuarios
    usuariosList.innerHTML = '<div class="loading-spinner">Cargando usuarios...</div>';
    
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            usuariosList.innerHTML = "No se encontró la localidad.";
            return;
        }

        const usuariosRefs = localidadDoc.data().usuarios || [];
        usuariosList.innerHTML = "";

        // Mostrar progreso si hay muchos usuarios
        if (usuariosRefs.length > 5) {
            const progressDiv = document.createElement('div');
            progressDiv.id = 'usuarios-progress';
            progressDiv.innerHTML = `<div class="loading-spinner">Procesando ${usuariosRefs.length} usuarios...</div>`;
            usuariosList.appendChild(progressDiv);
        }

        // ✅ SOLUCIÓN OPTIMIZADA: Cargar todos los usuarios en paralelo (más rápida)
        const usuariosPromises = usuariosRefs.map(async (usuarioRef) => {
            try {
                const usuarioDoc = await getDoc(usuarioRef);
                return usuarioDoc.exists() ? { id: usuarioRef.id, data: usuarioDoc.data() } : null;
            } catch (error) {
                console.error(`Error al cargar usuario ${usuarioRef.id}:`, error);
                return null;
            }
        });

        const usuarios = (await Promise.all(usuariosPromises)).filter(u => u !== null);

        // Renderizar todos los usuarios de una vez
        for (const usuario of usuarios) {
            const listItem = document.createElement("li");
            listItem.classList.add("list-item-clickable", "usuario-item");
            listItem.setAttribute("data-user-id", usuario.id);

            const label = document.createElement("label");
            label.classList.add("usuario-label");

            const span = document.createElement("span");
            span.textContent = `${usuario.data.nombre} (${usuario.data.email})`;

            label.appendChild(span);
            listItem.appendChild(label);

            const acciones = document.createElement("div");
            acciones.classList.add("usuario-actions");

            // ✅ RESTAURAR: Verificar si el usuario ya tiene asignada la ruta actual
            const rutasAsignadas = usuario.data.rutas.map((ruta) => ruta.path || ruta);
            const asignado = rutasAsignadas.includes(`Rutas/${rutaSeleccionada}`);
            
            const estado = document.createElement("span");
            estado.classList.add("estado-asignacion");
            estado.textContent = asignado ? "Desasignar" : "Asignar";
            estado.dataset.asignado = String(asignado);
            estado.style.color = asignado ? "#4caf50" : "#2196f3";
            estado.addEventListener("click", async (e) => {
                e.stopPropagation();
                const nuevoEstado = estado.dataset.asignado !== "true";
                
                // ✅ SOLUCIÓN: Mostrar spinner en el botón mientras se procesa
                const estadoOriginal = estado.textContent;
                const colorOriginal = estado.style.color;
                estado.textContent = "⏳";
                estado.style.color = "#ff9800";
                estado.disabled = true;
                estado.setAttribute("data-loading", "true");
                
                try {
                    await handleUserAssignment(usuario.id, nuevoEstado);
                    estado.textContent = nuevoEstado ? "Desasignar" : "Asignar";
                    estado.style.color = nuevoEstado ? "#4caf50" : "#2196f3";
                    estado.dataset.asignado = String(nuevoEstado);
                } catch (error) {
                    // Restaurar estado original en caso de error
                    estado.textContent = estadoOriginal;
                    estado.style.color = colorOriginal;
                    console.error("Error en asignación:", error);
                } finally {
                    estado.disabled = false;
                    estado.removeAttribute("data-loading");
                }
            });
            acciones.appendChild(estado);

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "\u2716";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                eliminarUsuario(cliente, localidad, usuario.id);
            });
            acciones.appendChild(deleteBtn);

            listItem.appendChild(acciones);
            usuariosList.appendChild(listItem);
        }


    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        usuariosList.innerHTML = "Error al cargar usuarios.";
    } finally {
        // Eliminar el spinner de progreso si existía
        const progressDiv = document.getElementById('usuarios-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }
}



async function rutaTieneAsignados(rutaRef) {
    const consulta = query(collection(db, "Usuarios"), where("rutas", "array-contains", rutaRef));
    const resultado = await getDocs(consulta);
    return !resultado.empty;
}

export async function handleUserAssignment(userId, asignar) {
    const rutaId = rutaSeleccionada;
    if (!rutaId) {
        showPopup("Selecciona una ruta antes de asignar usuarios.");
        return;
    }

    try {
        const usuarioRef = doc(db, "Usuarios", userId);
        const rutaRef = doc(db, "Rutas", rutaId);

    const updateData = asignar
        ? { rutas: arrayUnion(rutaRef) }
        : { rutas: arrayRemove(rutaRef) };

        await updateDoc(usuarioRef, updateData);
        const asignada = await rutaTieneAsignados(rutaRef);
        const item = document.querySelector(`li[data-ruta-id="${rutaId}"]`);
        if (item) {
            const contenedor = item.querySelector(".ruta-actions");
            let etiqueta = contenedor.querySelector(".asignada-label");
            if (asignada) {
                if (!etiqueta) {
                    etiqueta = document.createElement("span");
                    etiqueta.classList.add("asignada-label");
                    etiqueta.textContent = "Asignada";
                    contenedor.prepend(etiqueta);
                }
            } else {
                etiqueta?.remove();
            }
        }
        console.log(`${asignar ? "Asignada" : "Eliminada"} la ruta ${rutaId} al usuario ${userId}`);
    } catch (error) {
        console.error("Error al actualizar la asignación de usuarios:", error);
    }
}

async function subirRutas() {
    const cliente = await checkLogin();
    if (!cliente) {
        showPopup("Error de autenticación. Por favor inicia sesión nuevamente.");
        return;
    }
    
    const localidad = localStorage.getItem("localidad");
    if (!localidad) {
        showPopup("Selecciona una localidad para continuar.");
        return;
    }

    const archivoInput = document.getElementById("fileInput");
    const archivos = archivoInput?.files;
    const listaRutas = document.getElementById("rutasList");
    const cantidadAnterior = listaRutas ? listaRutas.children.length : 0;

    if (!archivos || archivos.length === 0) {
        showPopup("Selecciona un archivo para subir.");
        return;
    }

    const extensionesValidas = [".txt", ".csv"];
    for (const archivo of archivos) {
        if (!extensionesValidas.some((ext) => archivo.name.endsWith(ext))) {
            showPopup("Solo se permiten archivos .txt o .csv.");
            continue;
        }

        try {
            const referenciaArchivo = ref(
                storageUpload,
                `/${cliente}/${localidad}/${archivo.name}`
            );
            const tareaSubida = uploadBytesResumable(referenciaArchivo, archivo);

            await new Promise((resolve) => {
                tareaSubida.on(
                    "state_changed",
                    null,
                    (error) => {
                        console.error("Error durante la subida del archivo:", error);
                        showPopup("Error al subir el archivo.");
                        resolve();
                    },
                    () => resolve()
                );
            });

            showPopup("Ruta cargada exitosamente.");
        } catch (error) {
            console.error("Error general al subir el archivo:", error);
        }
    }
    await esperarActualizacionRutas(cliente, localidad, cantidadAnterior);
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
        await loadUsuariosPorLocalidad(cliente, localidad);
        usuariosCargados = true;
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
        usuariosCargados = true;
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
        usuariosCargados = true;
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
