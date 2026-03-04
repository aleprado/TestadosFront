import { db } from "./config.js";
import { collection, doc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { showPopup } from "./ui.js";
import { trackEvent } from "./metrics.js";

const parametros = new URLSearchParams(window.location.search);
const rutaId = parametros.get("ruta");
const registrosListCon = document.getElementById("registrosListCon");
const registrosListSin = document.getElementById("registrosListSin");
const resumenCon = document.getElementById("registrosConLectura");
const resumenSin = document.getElementById("registrosSinLectura");
const resumenTotal = document.getElementById("registrosTotal");
const rutaLabel = document.getElementById("rutaIdLabel");
const registrosEmpty = document.getElementById("registrosEmpty");
const resumenConColumn = document.getElementById("registrosConLecturaColumn");
const resumenSinColumn = document.getElementById("registrosSinLecturaColumn");
const inputBusqueda = document.getElementById("registrosBusquedaInput");

let registrosCargados = [];

function limpiarLista() {
    if (registrosListCon) {
        registrosListCon.innerHTML = "";
    }
    if (registrosListSin) {
        registrosListSin.innerHTML = "";
    }
}

function actualizarResumen({ con, sin }) {
    const total = con + sin;
    if (resumenCon) resumenCon.textContent = String(con);
    if (resumenSin) resumenSin.textContent = String(sin);
    if (resumenTotal) resumenTotal.textContent = String(total);
    if (resumenConColumn) resumenConColumn.textContent = String(con);
    if (resumenSinColumn) resumenSinColumn.textContent = String(sin);
}

function mostrarMensajeVacio(mostrar) {
    if (!registrosEmpty) return;
    registrosEmpty.hidden = !mostrar;
}

function normalizarNombreArchivo(valor, fallback = "medidor") {
    return String(valor || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || fallback;
}

function resolverExtensionImagen(url) {
    const sinQuery = String(url || "").split("?")[0];
    const match = sinQuery.match(/\.([a-zA-Z0-9]+)$/);
    if (!match) return "jpg";
    return match[1].toLowerCase();
}

async function descargarImagen(url, medidor) {
    if (!url) return;
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
        throw new Error(`No se pudo descargar la imagen (${respuesta.status})`);
    }
    const blob = await respuesta.blob();
    const enlace = document.createElement("a");
    const enlaceBlob = URL.createObjectURL(blob);
    const extension = resolverExtensionImagen(url);
    const fecha = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const nombre = `${normalizarNombreArchivo(medidor)}_${fecha}.${extension}`;
    enlace.href = enlaceBlob;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlaceBlob);
}

function abrirModalNota(textoInicial = "") {
    const modalExistente = document.querySelector('[data-modal-nota="true"]');
    if (modalExistente) {
        modalExistente.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.dataset.modalNota = "true";
    overlay.style.display = "flex";

    const caja = document.createElement("div");
    caja.className = "popup-box popup-box--nota";

    const titulo = document.createElement("h2");
    titulo.className = "popup-titulo";
    titulo.textContent = "Nota para lecturista";

    const contenido = document.createElement("div");
    contenido.className = "popup-content";

    const textarea = document.createElement("textarea");
    textarea.className = "input-field nota-textarea";
    textarea.placeholder = "Escribí una nota para el usuario";
    textarea.value = String(textoInicial || "");

    const botones = document.createElement("div");
    botones.className = "popup-buttons";

    const botonGuardar = document.createElement("button");
    botonGuardar.type = "button";
    botonGuardar.className = "btn";
    botonGuardar.textContent = "Guardar";

    const botonCancelar = document.createElement("button");
    botonCancelar.type = "button";
    botonCancelar.className = "btn btn-secondary";
    botonCancelar.textContent = "Cancelar";

    contenido.appendChild(textarea);
    botones.appendChild(botonGuardar);
    botones.appendChild(botonCancelar);
    caja.appendChild(titulo);
    caja.appendChild(contenido);
    caja.appendChild(botones);
    overlay.appendChild(caja);
    document.body.appendChild(overlay);

    return new Promise((resolve) => {
        textarea.focus();

        botonGuardar.onclick = () => {
            const texto = textarea.value.trim();
            overlay.remove();
            resolve(texto);
        };

        botonCancelar.onclick = () => {
            overlay.remove();
            resolve(null);
        };

        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        });
    });
}

function crearRegistroCard(registro) {
    const card = document.createElement("li");
    const tieneLectura =
        registro.lectura_actual &&
        String(registro.lectura_actual).trim().length > 0;
    card.classList.add("registro-card");
    card.classList.add(tieneLectura ? "registro-card--completado" : "registro-card--pendiente");

    const nombre = registro.titular || "Sin titular";
    const medidor = registro.medidor || "Sin medidor";

    const contenido = document.createElement("div");
    contenido.className = "registro-card__contenido";
    contenido.innerHTML = `
        <span class="registro-card__nombre">${nombre}</span>
        <span class="registro-card__medidor">Medidor: ${medidor}</span>
        <span class="registro-card__status ${tieneLectura ? "registro-card__status--completado" : "registro-card__status--pendiente"}">
            ${tieneLectura ? "Lectura registrada" : "Sin lectura"}
        </span>
    `;
    card.appendChild(contenido);

    const acciones = document.createElement("div");
    acciones.className = "registro-card__acciones";

    const urlImagen = registro.imagenUrl ? String(registro.imagenUrl).trim() : "";
    if (urlImagen) {
        const botonDescargar = document.createElement("button");
        botonDescargar.type = "button";
        botonDescargar.className = "btn btn-secondary registro-card__boton";
        botonDescargar.textContent = "Descargar imagen";
        botonDescargar.onclick = async () => {
            try {
                await descargarImagen(urlImagen, medidor);
                trackEvent("ruta_record_image_download", { rutaId, medidor });
            } catch (error) {
                console.error("No se pudo descargar la imagen:", error);
                showPopup("No se pudo descargar la imagen del registro.");
            }
        };
        acciones.appendChild(botonDescargar);
    } else if (!tieneLectura) {
        const botonNota = document.createElement("button");
        botonNota.type = "button";
        botonNota.className = "btn registro-card__boton";
        botonNota.textContent = registro.observacionlecturista ? "Editar nota" : "Agregar nota";
        botonNota.onclick = async () => {
            const nota = await abrirModalNota(registro.observacionlecturista || "");
            if (nota === null) return;
            try {
                await updateDoc(registro.ref, { observacionlecturista: nota });
                registro.observacionlecturista = nota;
                botonNota.textContent = nota ? "Editar nota" : "Agregar nota";
                const notaVisible = card.querySelector(".registro-card__nota");
                if (notaVisible) {
                    notaVisible.remove();
                }
                if (nota) {
                    const notaElemento = document.createElement("span");
                    notaElemento.className = "registro-card__nota";
                    notaElemento.textContent = `Nota: ${nota}`;
                    card.appendChild(notaElemento);
                }
                trackEvent("ruta_record_note_saved", { rutaId, medidor });
                showPopup("Nota guardada correctamente.");
            } catch (error) {
                console.error("No se pudo guardar la nota:", error);
                showPopup("No se pudo guardar la nota.");
            }
        };
        acciones.appendChild(botonNota);
    }

    if (acciones.children.length > 0) {
        card.appendChild(acciones);
    }

    if (registro.observacionlecturista) {
        const nota = document.createElement("span");
        nota.className = "registro-card__nota";
        nota.textContent = `Nota: ${registro.observacionlecturista}`;
        card.appendChild(nota);
    }

    return { card, tieneLectura };
}

function ordenarRegistros(records) {
    return records.sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        if (!Number.isNaN(aId) && !Number.isNaN(bId)) {
            return aId - bId;
        }
        return a.id.localeCompare(b.id);
    });
}

function aplicarFiltroRegistros(texto) {
    const termino = String(texto || "").trim().toLowerCase();
    if (!termino) return registrosCargados;
    return registrosCargados.filter((registro) => {
        const titular = String(registro.titular || "").toLowerCase();
        const medidor = String(registro.medidor || "").toLowerCase();
        return titular.includes(termino) || medidor.includes(termino);
    });
}

function renderizarRegistros(registrosFiltrados) {
    limpiarLista();

    if (registrosFiltrados.length === 0) {
        actualizarResumen({ con: 0, sin: 0 });
        mostrarMensajeVacio(true);
        return;
    }

    let conLectura = 0;
    let sinLectura = 0;

    registrosFiltrados.forEach((registro) => {
        const { card, tieneLectura } = crearRegistroCard(registro);
        if (tieneLectura) {
            conLectura += 1;
            if (registrosListCon) registrosListCon.appendChild(card);
        } else {
            sinLectura += 1;
            if (registrosListSin) registrosListSin.appendChild(card);
        }
    });

    actualizarResumen({ con: conLectura, sin: sinLectura });
    mostrarMensajeVacio(false);
}

function configurarBusqueda() {
    if (!inputBusqueda) return;
    inputBusqueda.addEventListener("input", () => {
        const registrosFiltrados = aplicarFiltroRegistros(inputBusqueda.value);
        renderizarRegistros(registrosFiltrados);
    });
}

async function cargarRegistros() {
    if (rutaLabel) {
        rutaLabel.textContent = rutaId || "-";
    }

    if (!rutaId) {
        if (registrosEmpty) {
            registrosEmpty.hidden = false;
        }
        showPopup("No se proporcionó una ruta para listar registros.");
        return;
    }

    limpiarLista();
    mostrarMensajeVacio(false);
    if (registrosListCon) {
        registrosListCon.innerHTML = '<li class="loading-spinner">Cargando registros...</li>';
    }
    if (registrosListSin) {
        registrosListSin.innerHTML = '<li class="loading-spinner">Cargando registros...</li>';
    }

    trackEvent("ruta_records_load_start", { rutaId });

    try {
        const rutaRef = doc(db, "Rutas", rutaId);
        const recorridoRef = collection(rutaRef, "RutaRecorrido");
        const recorridoSnap = await getDocs(recorridoRef);
        const documentos = ordenarRegistros(recorridoSnap.docs);

        registrosCargados = documentos.map((documento) => {
            const datos = documento.data() || {};
            return {
                ref: documento.ref,
                id: documento.id,
                titular: datos.titular || "",
                medidor: datos.medidor || "",
                lectura_actual: datos.lectura_actual || "",
                imagenUrl: datos.imagenUrl || "",
                observacionlecturista: datos.observacionlecturista || datos.nota_lecturista || ""
            };
        });

        const registrosFiltrados = aplicarFiltroRegistros(inputBusqueda?.value || "");
        renderizarRegistros(registrosFiltrados);

        const conLectura = registrosCargados.filter((registro) => registro.lectura_actual && String(registro.lectura_actual).trim().length > 0).length;
        const sinLectura = registrosCargados.length - conLectura;

        trackEvent("ruta_records_load_success", {
            rutaId,
            total: registrosCargados.length,
            conLectura,
            sinLectura
        });
    } catch (error) {
        console.error("Error al cargar registros:", error);
        trackEvent("ruta_records_load_error", { rutaId, error: error.message });
        showPopup("No se pudieron cargar los registros de la ruta.");
        limpiarLista();
        mostrarMensajeVacio(true);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    configurarBusqueda();
    cargarRegistros();
});
