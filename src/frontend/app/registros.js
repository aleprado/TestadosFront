import { db } from "./config.js";
import { collection, doc, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
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

function crearRegistroCard(registro) {
    const card = document.createElement("li");
    const tieneLectura =
        registro.lectura_actual &&
        String(registro.lectura_actual).trim().length > 0;
    card.classList.add("registro-card");
    card.classList.add(tieneLectura ? "registro-card--completado" : "registro-card--pendiente");

    const nombre = registro.titular || "Sin titular";
    const medidor = registro.medidor || "Sin medidor";

    card.innerHTML = `
        <span class="registro-card__nombre">${nombre}</span>
        <span class="registro-card__medidor">Medidor: ${medidor}</span>
        <span class="registro-card__status ${tieneLectura ? "registro-card__status--completado" : "registro-card__status--pendiente"}">
            ${tieneLectura ? "Lectura registrada" : "Sin lectura"}
        </span>
    `;

    return card;
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
        const registros = ordenarRegistros(recorridoSnap.docs);

        limpiarLista();
        let conLectura = 0;
        let sinLectura = 0;

        if (registros.length === 0) {
            mostrarMensajeVacio(true);
        } else {
            registros.forEach((documento) => {
                const datos = documento.data() || {};
                const tieneLectura = datos.lectura_actual && String(datos.lectura_actual).trim().length > 0;
                if (tieneLectura) {
                    conLectura += 1;
                } else {
                    sinLectura += 1;
                }
                const card = crearRegistroCard(datos);
                if (tieneLectura) {
                    if (registrosListCon) {
                        registrosListCon.appendChild(card);
                    }
                } else {
                    if (registrosListSin) {
                        registrosListSin.appendChild(card);
                    }
                }
            });
            mostrarMensajeVacio(false);
        }

        actualizarResumen({ con: conLectura, sin: sinLectura });
        trackEvent("ruta_records_load_success", {
            rutaId,
            total: conLectura + sinLectura,
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
    cargarRegistros();
});
