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
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { checkLogin, login, logout } from "./auth.js";
import { showPopup, showUserFormPopup, mostrarMapaPopup, showLoading, hideLoading } from "./ui.js";
import { db, exportOnDemandEndpoint, auth, storageUpload } from "./config.js";
import { trackEvent, auditLog } from "./metrics.js";

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
        const usernameInput = document.getElementById("usernameInput");
        const passwordInput = document.getElementById("passwordInput");
        const submitLogin = async () => {
            const username = usernameInput?.value;
            const password = passwordInput?.value;

            if (username && password) {
                showLoading("Validando contraseña...");
                try {
                    await login(username, password);
                } finally {
                    hideLoading();
                }
            } else {
                showPopup("Por favor, ingrese usuario y contraseña.");
            }
        };

        loginButton?.addEventListener("click", submitLogin);
        const handleEnter = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submitLogin();
            }
        };
        usernameInput?.addEventListener("keydown", handleEnter);
        passwordInput?.addEventListener("keydown", handleEnter);
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
                trackEvent('localidad_create_attempt', { localidad: nombre });
                await setDoc(doc(db, "Clientes", username, "Localidades", nombre), {
                    rutas: [],
                    usuarios: []
                });
                trackEvent('localidad_create_success', { localidad: nombre });
                auditLog('localidad_create', { localidad: nombre });
                input.value = "";
                await loadLocalidades(username);
            } catch (error) {
                console.error("Error al agregar localidad:", error);
                trackEvent('localidad_create_error', { localidad: nombre, error: error.message });
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
            rutaSeleccionada = null;
            await loadRutasPorLocalidad(cliente, localidad);
            await loadUsuariosPorLocalidad(cliente, localidad);

            const fileInput = document.getElementById("fileInput");
            const triggerUpload = document.getElementById("triggerRutaUpload");
            triggerUpload?.addEventListener("click", () => {
                if (fileInput) {
                    fileInput.value = "";
                }
                fileInput?.click();
            });

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
                        try {
                            await loadUsuariosPorLocalidad(cliente, localidad);
                        } finally {
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
    const start = performance.now();
    try {
        // ✅ DEBUG: Log de los parámetros que se están enviando
        console.log("🔍 DEBUG exportarYDescargar:");
        console.log("  - cliente:", cliente);
        console.log("  - localidad:", localidad);
        console.log("  - rutaId:", rutaId);
        console.log("  - tipos:", typeof cliente, typeof localidad, typeof rutaId);
        
        showLoading(`Generando CSV de ${rutaId}...`);
        
        // ✅ SOLUCIÓN: Enviar parámetros en el body JSON en lugar de en la URL
        trackEvent('ruta_download_request', { rutaId });
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
                showLoading(`Descargando ${nombreArchivo}...`);
                link.click();
                document.body.removeChild(link);
                showPopup("CSV generado y descargado correctamente");
                trackEvent('ruta_download_success', {
                    rutaId,
                    elapsed_ms: Math.round(performance.now() - start)
                });
                auditLog('ruta_download', { rutaId, filename: nombreArchivo });
            } catch (error) {
                console.error('Error generando URL directa:', error);
                trackEvent('ruta_download_error', {
                    rutaId,
                    error: error.message,
                    elapsed_ms: Math.round(performance.now() - start)
                });
                showPopup("Error al descargar el archivo.");
            }
        } else {
            showPopup("No se recibió información del archivo generado.");
        }
    } catch (error) {
        console.error("Error en la exportación y descarga:", error);
        trackEvent('ruta_download_error', {
            rutaId,
            error: error.message,
            elapsed_ms: Math.round(performance.now() - start)
        });
        showPopup(`Error al generar el CSV: ${error.message}`);
    } finally {
        hideLoading();
    }
}

export async function loadLocalidades(cliente) {
    const localidadesList = document.getElementById("localidadesList");
    if (!localidadesList) return;
    const start = performance.now();
    trackEvent('localidades_load_start');

    // Mostrar spinner mientras se cargan las localidades
    localidadesList.classList.add("data-list--loading");
    localidadesList.innerHTML = '<div class="loading-spinner">Cargando localidades...</div>';
    
    try {
        console.log("localidades del cliente: " + cliente);
        
        // ✅ OPTIMIZACIÓN: Consulta directa a la subcolección de localidades
        const localidadesRef = collection(db, "Clientes", cliente, "Localidades");
        const localidadesSnapshot = await getDocs(localidadesRef);

        if (localidadesSnapshot.empty) {
            localidadesList.classList.remove("data-list--loading");
            localidadesList.innerHTML = "No se encontraron localidades.";
            trackEvent('localidades_load_success', {
                count: 0,
                elapsed_ms: Math.round(performance.now() - start)
            });
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
                trackEvent('localidad_select', { localidad });
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
            deleteBtn.title = "Eliminar localidad";
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
        localidadesList.classList.remove("data-list--loading");
        localidadesList.innerHTML = '';
        localidadesProcesadas.forEach(item => localidadesList.appendChild(item));
        
        // Eliminar el spinner de progreso si existía
        const progressDiv = document.getElementById('localidades-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
        trackEvent('localidades_load_success', {
            count: localidadesSnapshot.size,
            elapsed_ms: Math.round(performance.now() - start)
        });
    } catch (error) {
        console.error("Error al obtener localidades:", error);
        localidadesList.classList.remove("data-list--loading");
        localidadesList.innerHTML = "Error al cargar localidades.";
        trackEvent('localidades_load_error', { error: error.message });
    }
}

function obtenerNombreRutaDesdeArchivo(archivo) {
    const nombre = archivo.name;
    const punto = nombre.lastIndexOf(".");
    return punto === -1 ? nombre : nombre.slice(0, punto);
}

function obtenerValoresRutaParaRemover(rutaRef) {
    const rutaPath = rutaRef?.path;
    if (!rutaPath) return [rutaRef];
    return [rutaRef, rutaPath, `/${rutaPath}`];
}

async function obtenerUsuariosConRuta(rutaRef) {
    const usuariosRef = collection(db, "Usuarios");
    const rutaPath = rutaRef?.path;
    const consultas = [query(usuariosRef, where("rutas", "array-contains", rutaRef))];
    if (rutaPath) {
        consultas.push(query(usuariosRef, where("rutas", "array-contains", rutaPath)));
        consultas.push(query(usuariosRef, where("rutas", "array-contains", `/${rutaPath}`)));
    }

    const resultados = await Promise.all(consultas.map((c) => getDocs(c)));
    const usuarios = new Map();
    resultados.forEach((snapshot) => {
        snapshot.forEach((docSnap) => {
            usuarios.set(docSnap.id, docSnap.ref);
        });
    });

    return Array.from(usuarios.values());
}

function buscarItemPorDataset(selector, key, valor) {
    const items = document.querySelectorAll(selector);
    for (const item of items) {
        if (item.dataset[key] === valor) return item;
    }
    return null;
}

function resaltarTemporal(item, duracion = 2400) {
    if (!item) return;
    item.classList.add("data-list__item--flash");
    setTimeout(() => {
        item.classList.remove("data-list__item--flash");
    }, duracion);
}

async function esperarActualizacionRutas(cliente, localidad, rutasEsperadas = []) {
    if (rutasEsperadas.length === 0) return { completadas: true, fallidas: [] };

    const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);

    for (let i = 0; i < 10; i++) {
        const localidadDoc = await getDoc(localidadRef);
        if (localidadDoc.exists()) {
            const rutasRefs = localidadDoc.data().rutas || [];
            const refsPorId = new Map(
                rutasRefs
                    .map((ref) => [ref.id || ref.path.split("/").pop(), ref])
                    .filter(([id]) => id)
            );
            const pendientes = rutasEsperadas.filter((id) => !refsPorId.has(id));
            if (pendientes.length === 0) {
                const rutasDocs = await Promise.all(
                    rutasEsperadas.map((id) => getDoc(refsPorId.get(id)))
                );
                const fallidas = [];
                const enProceso = [];

                rutasDocs.forEach((rutaDoc) => {
                    if (!rutaDoc.exists()) return;
                    const data = rutaDoc.data() || {};
                    const estado = data.procesamiento?.estado || data.procesamiento_estado;
                    if (estado === "error") {
                        fallidas.push(rutaDoc.id);
                    } else if (estado === "procesando") {
                        enProceso.push(rutaDoc.id);
                    }
                });

                if (fallidas.length > 0) return { completadas: false, fallidas };
                if (enProceso.length === 0) return { completadas: true, fallidas: [] };
            }
        }
        await new Promise((r) => setTimeout(r, 2000));
    }

    return { completadas: false, fallidas: [] };
}

export async function loadRutasPorLocalidad(cliente, localidad, { showSpinner = true } = {}) {
    const rutasList = document.getElementById("rutasList");
    if (!rutasList) return;
    const start = performance.now();
    trackEvent('rutas_load_start', { localidad });

    let loadingItem = null;
    if (showSpinner) {
        rutasList.classList.add("data-list--loading");
        rutasList.innerHTML = '';
        loadingItem = document.createElement('div');
        loadingItem.classList.add('loading-spinner');
        loadingItem.textContent = 'Cargando rutas...';
        rutasList.appendChild(loadingItem);
    }
    
    try {
        // Referencia a la localidad
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            rutasList.classList.remove("data-list--loading");
            rutasList.innerHTML = "No se encontró la localidad.";
            trackEvent('rutas_load_error', { localidad, error: 'localidad_not_found' });
            return;
        }

        // Obtener las referencias de las rutas
        const rutasRefs = localidadDoc.data().rutas || [];

        if (loadingItem && rutasRefs.length > 5) {
            loadingItem.textContent = `Procesando ${rutasRefs.length} rutas...`;
        }

        const rutasProcesadas = [];
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
                if (completado === 0) {
                    downloadBtn.disabled = true;
                    downloadBtn.title = "Descarga disponible al completar la ruta";
                } else {
                    downloadBtn.title = "Descargar CSV";
                }
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
                if (completado === 0) {
                    mapaBtn.disabled = true;
                    mapaBtn.title = "Mapa disponible al completar la ruta";
                } else {
                    mapaBtn.title = "Ver mapa";
                }
                mapaBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (mapaBtn.disabled) return;
                    trackEvent('ruta_map_open', { rutaId });
                    auditLog('ruta_map_open', { rutaId });
                    mostrarMapaPopup(rutaId);
                });
                actions.appendChild(mapaBtn);

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "\u2716";
                deleteBtn.classList.add("delete-btn");
                deleteBtn.title = "Eliminar ruta";
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    eliminarRuta(cliente, localidad, rutaId);
                });
                actions.appendChild(deleteBtn);

                metaRow.appendChild(actions);
                listItem.appendChild(metaRow);
                renderRutaAsignaciones(listItem, usuariosAsignados);
                rutasProcesadas.push(listItem);
            }
        }

        rutasList.classList.remove("data-list--loading");
        rutasList.innerHTML = '';
        rutasProcesadas.forEach(ruta => rutasList.appendChild(ruta));
        trackEvent('rutas_load_success', {
            localidad,
            count: rutasProcesadas.length,
            elapsed_ms: Math.round(performance.now() - start)
        });
    } catch (error) {
        console.error("Error al cargar rutas:", error);
        rutasList.classList.remove("data-list--loading");
        rutasList.innerHTML = "Error al cargar rutas.";
        trackEvent('rutas_load_error', { localidad, error: error.message });
    }
}

export async function loadUsuariosPorLocalidad(cliente, localidad, { showSpinner = true } = {}) {
    const usuariosList = document.getElementById("usuariosList");
    if (!usuariosList) return;
    const start = performance.now();
    trackEvent('usuarios_load_start', { localidad });

    const token = ++usuariosLoadToken;
    if (showSpinner) {
        usuariosList.classList.add("data-list--loading");
        usuariosList.innerHTML = '<div class="loading-spinner">Cargando usuarios...</div>';
    }
    
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            if (token === usuariosLoadToken) {
                usuariosList.classList.remove("data-list--loading");
                usuariosList.innerHTML = "No se encontró la localidad.";
                trackEvent('usuarios_load_error', { localidad, error: 'localidad_not_found' });
            }
            return;
        }

        const usuariosRefs = localidadDoc.data().usuarios || [];
        if (token !== usuariosLoadToken) return;

        usuariosList.classList.remove("data-list--loading");
        usuariosList.innerHTML = "";

        if (showSpinner && usuariosRefs.length > 5 && token === usuariosLoadToken) {
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

        usuariosList.classList.remove("data-list--loading");
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

            if (rutaSeleccionada) {
                const rutasAsignadas = (usuario.data.rutas || []).map((ruta) => ruta.path || ruta);
                const asignado = rutasAsignadas.includes(`Rutas/${rutaSeleccionada}`);

                const estado = document.createElement("span");
                estado.classList.add("estado-asignacion");
                estado.textContent = asignado ? "Desasignar" : "Asignar";
                estado.title = asignado ? "Desasignar ruta" : "Asignar ruta";
                estado.dataset.asignado = String(asignado);
                estado.style.color = asignado ? "#4caf50" : "#2196f3";
                estado.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const nuevoEstado = estado.dataset.asignado !== "true";
                    const estadoOriginal = estado.textContent;
                    const colorOriginal = estado.style.color;
                    estado.textContent = "";
                    const spinner = document.createElement("span");
                    spinner.classList.add("spinner", "spinner--inline");
                    estado.appendChild(spinner);
                    estado.style.color = "#d32f2f";
                    estado.disabled = true;
                    estado.setAttribute("data-loading", "true");
                    
                    try {
                        await handleUserAssignment(usuario.id, nuevoEstado);
                        estado.textContent = nuevoEstado ? "Desasignar" : "Asignar";
                        estado.style.color = nuevoEstado ? "#4caf50" : "#2196f3";
                        estado.dataset.asignado = String(nuevoEstado);
                        estado.title = nuevoEstado ? "Desasignar ruta" : "Asignar ruta";
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
            }

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "\u2716";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.title = "Eliminar usuario";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                eliminarUsuario(cliente, localidad, usuario.id);
            });
            acciones.appendChild(deleteBtn);

            fila.appendChild(acciones);
            listItem.appendChild(fila);
            usuariosList.appendChild(listItem);
        }
        trackEvent('usuarios_load_success', {
            localidad,
            count: usuarios.length,
            elapsed_ms: Math.round(performance.now() - start)
        });


    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        if (token === usuariosLoadToken) {
            usuariosList.classList.remove("data-list--loading");
            usuariosList.innerHTML = "Error al cargar usuarios.";
        }
        trackEvent('usuarios_load_error', { localidad, error: error.message });
    } finally {
        if (showSpinner && token === usuariosLoadToken) {
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
            : { rutas: arrayRemove(...obtenerValoresRutaParaRemover(rutaRef)) };

        await updateDoc(usuarioRef, updateData);
        const item = document.querySelector(`li[data-ruta-id="${rutaId}"]`);
        if (item) {
            const usuariosAsignados = await obtenerUsuariosAsignados(rutaRef);
            renderRutaAsignaciones(item, usuariosAsignados);
        }
        console.log(`${asignar ? "Asignada" : "Eliminada"} la ruta ${rutaId} al usuario ${userId}`);
        trackEvent(asignar ? 'usuario_assign_route' : 'usuario_unassign_route', {
            rutaId,
            userId
        });
        auditLog(asignar ? 'usuario_assign_route' : 'usuario_unassign_route', {
            rutaId,
            userId
        });
    } catch (error) {
        console.error("Error al actualizar la asignación de usuarios:", error);
        trackEvent('usuario_assign_error', { rutaId, userId, error: error.message });
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

    if (!archivos || archivos.length === 0) {
        showPopup("Selecciona un archivo para subir.");
        return;
    }

    const extensionesValidas = [".txt", ".csv"];
    const rutasEsperadas = [];
    const totalSize = Array.from(archivos).reduce((acc, file) => acc + file.size, 0);
    trackEvent('ruta_upload_start', { file_count: archivos.length, total_size: totalSize });
    showLoading("Subiendo rutas...");
    for (const archivo of archivos) {
        if (!extensionesValidas.some((ext) => archivo.name.endsWith(ext))) {
            showPopup("Solo se permiten archivos .txt o .csv.");
            trackEvent('ruta_upload_invalid', { file_name: archivo.name });
            continue;
        }

        try {
            showLoading(`Subiendo ${archivo.name}...`);
            const referenciaArchivo = ref(
                storageUpload,
                `/${cliente}/${localidad}/${archivo.name}`
            );
            const tareaSubida = uploadBytesResumable(referenciaArchivo, archivo);

            const subidaExitosa = await new Promise((resolve) => {
                tareaSubida.on(
                    "state_changed",
                    null,
                    (error) => {
                        console.error("Error durante la subida del archivo:", error);
                        showPopup("Error al subir el archivo.");
                        trackEvent('ruta_upload_error', { file_name: archivo.name, error: error.message });
                        resolve(false);
                    },
                    () => resolve(true)
                );
            });
            if (subidaExitosa) {
                rutasEsperadas.push(obtenerNombreRutaDesdeArchivo(archivo));
                trackEvent('ruta_upload_success', { file_name: archivo.name, file_size: archivo.size });
                auditLog('ruta_upload', { file_name: archivo.name });
            }
        } catch (error) {
            console.error("Error general al subir el archivo:", error);
            trackEvent('ruta_upload_error', { file_name: archivo.name, error: error.message });
        }
    }

    if (rutasEsperadas.length === 0) {
        hideLoading();
        if (archivoInput) {
            archivoInput.value = "";
        }
        return;
    }

    showLoading(
        rutasEsperadas.length === 1
            ? "Procesando ruta..."
            : `Procesando ${rutasEsperadas.length} rutas...`
    );
    trackEvent('ruta_processing_wait', { count: rutasEsperadas.length });
    const resultado = await esperarActualizacionRutas(cliente, localidad, rutasEsperadas);
    await loadRutasPorLocalidad(cliente, localidad, { showSpinner: false });
    hideLoading();

    const primerRuta = rutasEsperadas[0];
    const item = primerRuta
        ? buscarItemPorDataset('li[data-ruta-id]', 'rutaId', primerRuta)
        : null;
    if (item) {
        item.scrollIntoView({ behavior: "smooth", block: "center" });
        resaltarTemporal(item);
    }

    if (resultado.fallidas.length > 0) {
        const mensaje =
            resultado.fallidas.length === 1
                ? `El procesamiento de la ruta ${resultado.fallidas[0]} falló.`
                : `El procesamiento de ${resultado.fallidas.length} rutas falló.`;
        showPopup(mensaje);
    } else if (!resultado.completadas) {
        showPopup("Las rutas se subieron, pero aun estan en proceso. Revisa en unos segundos.");
    }
    trackEvent('ruta_processing_complete', {
        count: rutasEsperadas.length,
        failed_count: resultado.fallidas.length,
        completed: resultado.completadas
    });

    if (archivoInput) {
        archivoInput.value = "";
    }
}

async function registrarUsuario(cliente, localidad, nombreUsuario, emailUsuario) {
    if (!nombreUsuario || !emailUsuario) {
        showPopup("Se requiere el nombre y el email del usuario.");
        return;
    }

    try {
        trackEvent('usuario_create_attempt', { userId: nombreUsuario });
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

        await loadUsuariosPorLocalidad(cliente, localidad);
        trackEvent('usuario_create_success', { userId: nombreUsuario });
        auditLog('usuario_create', { userId: nombreUsuario, email: emailUsuario });
        const item = buscarItemPorDataset('li[data-user-id]', 'userId', nombreUsuario);
        if (item) {
            item.scrollIntoView({ behavior: "smooth", block: "center" });
            resaltarTemporal(item);
        }
    } catch (error) {
        console.error("Error al registrar el usuario:", error);
        trackEvent('usuario_create_error', { userId: nombreUsuario, error: error.message });
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

async function borrarSubcoleccion(docRef, nombre) {
    // Firestore no elimina subcolecciones al borrar el doc; limpiamos primero.
    const subRef = collection(docRef, nombre);
    const snapshot = await getDocs(subRef);
    if (snapshot.empty) return;

    let batch = writeBatch(db);
    let operaciones = 0;

    for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        operaciones += 1;

        if (operaciones === 500) {
            await batch.commit();
            batch = writeBatch(db);
            operaciones = 0;
        }
    }

    if (operaciones > 0) {
        await batch.commit();
    }
}

async function eliminarRuta(cliente, localidad, rutaId) {
    const confirmacion = await showPopup(`\u00bfEliminar la ruta ${rutaId}?`, { confirm: true });
    if (!confirmacion) return;

    let errorMessage = null;
    trackEvent('ruta_delete_attempt', { rutaId });
    showLoading(`Eliminando ruta ${rutaId}...`);
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);
        if (!localidadDoc.exists()) {
            errorMessage = "La localidad no existe.";
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        const rutaRef = rutasRefs.find((ref) => ref.id === rutaId || ref.path.endsWith(`/${rutaId}`));

        if (!rutaRef) {
            console.error(`No se encontr\xF3 la referencia a la ruta ${rutaId}`);
            return;
        }

        const valoresRuta = obtenerValoresRutaParaRemover(rutaRef);
        const usuariosAsignados = await obtenerUsuariosConRuta(rutaRef);
        for (const usuarioRef of usuariosAsignados) {
            await updateDoc(usuarioRef, { rutas: arrayRemove(...valoresRuta) });
        }

        const updateLocalidad = { rutas: arrayRemove(...valoresRuta) };
        await updateDoc(localidadRef, updateLocalidad);
        await borrarSubcoleccion(rutaRef, "RutaRecorrido");
        await deleteDoc(rutaRef);

        await loadRutasPorLocalidad(cliente, localidad, { showSpinner: false });
        await loadUsuariosPorLocalidad(cliente, localidad, { showSpinner: false });
        trackEvent('ruta_delete_success', { rutaId });
        auditLog('ruta_delete', { rutaId });
    } catch (error) {
        console.error("Error al eliminar la ruta:", error);
        errorMessage = "Error al eliminar la ruta.";
        trackEvent('ruta_delete_error', { rutaId, error: error.message });
    } finally {
        hideLoading();
    }

    if (errorMessage) {
        showPopup(errorMessage);
    }
}

async function eliminarUsuario(cliente, localidad, userId) {
    const confirmacion = await showPopup(`\u00bfEliminar el usuario ${userId}?`, { confirm: true });
    if (!confirmacion) return;

    let errorMessage = null;
    trackEvent('usuario_delete_attempt', { userId });
    showLoading(`Eliminando usuario ${userId}...`);
    try {
        const usuarioRef = doc(db, "Usuarios", userId);
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);

        await updateDoc(localidadRef, { usuarios: arrayRemove(usuarioRef) });
        await deleteDoc(usuarioRef);

        await loadUsuariosPorLocalidad(cliente, localidad, { showSpinner: false });
        trackEvent('usuario_delete_success', { userId });
        auditLog('usuario_delete', { userId });
    } catch (error) {
        console.error("Error al eliminar el usuario:", error);
        errorMessage = "Error al eliminar el usuario.";
        trackEvent('usuario_delete_error', { userId, error: error.message });
    } finally {
        hideLoading();
    }

    if (errorMessage) {
        showPopup(errorMessage);
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

    let errorMessage = null;
    trackEvent('localidad_delete_attempt', { localidad });
    showLoading(`Eliminando localidad ${localidad}...`);
    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            errorMessage = "La localidad no existe.";
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        const usuariosRefs = localidadDoc.data().usuarios || [];

        for (const rutaRef of rutasRefs) {
            await borrarSubcoleccion(rutaRef, "RutaRecorrido");
            await deleteDoc(rutaRef);
        }

        for (const usuarioRef of usuariosRefs) {
            await deleteDoc(usuarioRef);
        }

        await deleteDoc(localidadRef);

        showPopup("Localidad eliminada correctamente.");
        trackEvent('localidad_delete_success', { localidad });
        auditLog('localidad_delete', { localidad });
        window.location.reload();
    } catch (error) {
        console.error("Error al eliminar la localidad:", error);
        errorMessage = "Error al eliminar la localidad.";
        trackEvent('localidad_delete_error', { localidad, error: error.message });
    } finally {
        hideLoading();
    }

    if (errorMessage) {
        showPopup(errorMessage);
    }
}
