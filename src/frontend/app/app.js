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
let usuariosLoadToken = 0;

document.addEventListener('layout:logout', () => {
    logout();
});

document.addEventListener('layout:back', () => {
    const page = document.body.dataset.page;
    if (page === 'gestionar-rutas') {
        window.location.href = '/localidades';
    } else if (page === 'mapa') {
        window.location.href = '/gestionar-rutas';
    } else if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
});

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

            const fileInput = document.getElementById("fileInput");
            const triggerUpload = document.getElementById("triggerRutaUpload");
            triggerUpload?.addEventListener("click", () => fileInput?.click());

            fileInput?.addEventListener("change", () => {
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
                        try {
                            await loadUsuariosPorLocalidad(cliente, localidad);
                        } finally {
                            usuariosList.classList.remove("blurred");
                        }
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
            listItem.classList.add("data-list__item", "list-item-clickable", "localidad-item");
            listItem.addEventListener("click", () => {
                localStorage.setItem("localidad", localidad);
                console.log("guardada localidad: " + localidad);
                window.location.href = "/gestionar-rutas";
            });

            const fila = document.createElement('div');
            fila.classList.add('data-row');

            const body = document.createElement('div');
            body.classList.add('data-row__body');
            const title = document.createElement('span');
            title.classList.add('data-row__title');
            title.textContent = localidad;
            body.appendChild(title);
            fila.appendChild(body);

            const acciones = document.createElement('div');
            acciones.classList.add('data-row__actions');

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "\u2716";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                eliminarLocalidad(cliente, localidad);
            });
            acciones.appendChild(deleteBtn);

            fila.appendChild(acciones);
            listItem.appendChild(fila);

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

                const usuariosAsignados = await obtenerUsuariosAsignados(rutaRef);
                const listItem = document.createElement("li");
                listItem.classList.add("data-list__item", "ruta-item", "list-item-clickable");
                listItem.setAttribute("data-ruta-id", rutaId);

                const heading = document.createElement('div');
                heading.classList.add('ruta-heading');
                heading.textContent = rutaId;
                listItem.appendChild(heading);

                const metaRow = document.createElement('div');
                metaRow.classList.add('ruta-meta-row');

                const metrics = document.createElement('div');
                metrics.classList.add('ruta-metrics');

                const progressLink = document.createElement("span");
                progressLink.classList.add("ruta-progress");
                progressLink.textContent = `${completado.toFixed(2)}%`;
                metrics.appendChild(progressLink);

                const assigneeCount = document.createElement('span');
                assigneeCount.classList.add('ruta-meta-count');
                if (usuariosAsignados.length) {
                    assigneeCount.textContent = `${usuariosAsignados.length} usuari${usuariosAsignados.length === 1 ? 'o' : 'os'} asignad${usuariosAsignados.length === 1 ? 'o' : 'os'}`;
                    assigneeCount.classList.add('has-assignees');
                } else {
                    assigneeCount.textContent = 'Sin asignar';
                }
                metrics.appendChild(assigneeCount);

                metaRow.appendChild(metrics);

                const actions = document.createElement('div');
                actions.classList.add('ruta-actions');

                const downloadBtn = document.createElement("button");
                downloadBtn.classList.add("map-btn", "download-btn");
                downloadBtn.textContent = '⬇';
                if (completado === 0) downloadBtn.disabled = true;
                downloadBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (downloadBtn.disabled) return;
                    exportarYDescargar(cliente, localidad, rutaId);
                });
                actions.appendChild(downloadBtn);

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

                metaRow.appendChild(actions);
                listItem.appendChild(metaRow);
                renderRutaAsignaciones(listItem, usuariosAsignados);
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

    const token = ++usuariosLoadToken;
    usuariosList.innerHTML = '<div class="loading-spinner">Cargando usuarios...</div>';
    
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            if (token === usuariosLoadToken) {
                usuariosList.innerHTML = "No se encontró la localidad.";
            }
            return;
        }

        const usuariosRefs = localidadDoc.data().usuarios || [];
        if (token !== usuariosLoadToken) return;

        usuariosList.innerHTML = "";

        if (usuariosRefs.length > 5 && token === usuariosLoadToken) {
            const progressDiv = document.createElement('div');
            progressDiv.id = 'usuarios-progress';
            progressDiv.innerHTML = `<div class="loading-spinner">Procesando ${usuariosRefs.length} usuarios...</div>`;
            usuariosList.appendChild(progressDiv);
        }

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
        if (token !== usuariosLoadToken) return;

        usuariosList.innerHTML = "";

        for (const usuario of usuarios) {
            if (token !== usuariosLoadToken) return;
            const listItem = document.createElement("li");
            listItem.classList.add("data-list__item", "list-item-clickable", "usuario-item");
            listItem.setAttribute("data-user-id", usuario.id);

            const fila = document.createElement('div');
            fila.classList.add('data-row');

            const body = document.createElement('div');
            body.classList.add('data-row__body');

            const span = document.createElement("span");
            span.classList.add('data-row__title', 'usuario-label');
            span.textContent = `${usuario.data.nombre} (${usuario.data.email})`;
            body.appendChild(span);
            fila.appendChild(body);

            const acciones = document.createElement("div");
            acciones.classList.add("data-row__actions", "usuario-actions");

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

            fila.appendChild(acciones);
            listItem.appendChild(fila);
            usuariosList.appendChild(listItem);
        }


    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        if (token === usuariosLoadToken) {
            usuariosList.innerHTML = "Error al cargar usuarios.";
        }
    } finally {
        if (token === usuariosLoadToken) {
            const progressDiv = document.getElementById('usuarios-progress');
            if (progressDiv) {
                progressDiv.remove();
            }
        }
    }
}



async function obtenerUsuariosAsignados(rutaRef) {
    const consulta = query(collection(db, "Usuarios"), where("rutas", "array-contains", rutaRef));
    const resultado = await getDocs(consulta);
    return resultado.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
            id: docSnap.id,
            nombre: data.nombre || docSnap.id,
            email: data.email || '',
        };
    });
}

function renderRutaAsignaciones(listItem, usuarios) {
    let container = listItem.querySelector('.ruta-assignees');
    if (!container) {
        container = document.createElement('div');
        container.classList.add('ruta-assignees');
        listItem.appendChild(container);
    }

    container.innerHTML = '';
    if (!usuarios || usuarios.length === 0) {
        container.classList.remove('is-open');
        listItem.classList.remove('ruta-item--assigned');
        const count = listItem.querySelector('.ruta-meta-count');
        if (count) {
            count.textContent = 'Sin asignar';
            count.classList.remove('has-assignees');
        }
        return;
    }

    listItem.classList.add('ruta-item--assigned');
    container.classList.add('is-open');

    const count = listItem.querySelector('.ruta-meta-count');
    if (count) {
        count.textContent = `${usuarios.length} usuari${usuarios.length === 1 ? 'o' : 'os'} asignad${usuarios.length === 1 ? 'o' : 'os'}`;
        count.classList.add('has-assignees');
    }

    const label = document.createElement('span');
    label.classList.add('ruta-assignees__label');
    label.textContent = 'Asignada a:';
    container.appendChild(label);

    const list = document.createElement('ul');
    list.classList.add('ruta-assignees__list');
    usuarios.forEach(({ nombre, email }) => {
        const li = document.createElement('li');
        li.textContent = email ? `${nombre} (${email})` : nombre;
        list.appendChild(li);
    });
    container.appendChild(list);
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
        const item = document.querySelector(`li[data-ruta-id="${rutaId}"]`);
        if (item) {
            const usuariosAsignados = await obtenerUsuariosAsignados(rutaRef);
            renderRutaAsignaciones(item, usuariosAsignados);
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
