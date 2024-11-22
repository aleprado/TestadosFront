import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { db } from './config.js';
import { highlightUsuariosRelacionados } from './usuarios.js'

// Función para cargar rutas por localidad
export async function loadRutasPorLocalidad(cliente, localidad) {
    const rutasList = document.getElementById("rutasList");
    rutasList.innerHTML = "Cargando rutas...";

    try {
        const localidadRef = doc(db, "Clientes", cliente, "Localidades", localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            rutasList.innerHTML = "No se encontró la localidad.";
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        if (rutasRefs.length === 0) {
            rutasList.innerHTML = "No se encontraron rutas en esta localidad.";
            return;
        }

        rutasList.innerHTML = ""; // Limpiar la lista antes de agregar
        for (const rutaRef of rutasRefs) {
            const rutaDoc = await getDoc(rutaRef);
            if (rutaDoc.exists()) {
                const listItem = document.createElement("li");
                listItem.textContent = rutaDoc.id;
                listItem.setAttribute("data-ruta-id", rutaDoc.id);
                listItem.classList.add("ruta-item");

                // Asociar evento para resaltar usuarios relacionados
                listItem.addEventListener("click", () => {
                    highlightUsuariosRelacionados(rutaDoc.id);
                });

                rutasList.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error al cargar las rutas:", error);
        rutasList.innerHTML = "Error al cargar las rutas.";
    }
}

// Función para subir archivos al bucket de subida
export function SubirRuta(cliente, localidad) {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.addEventListener("change", function () {
            if (!fileInput.files.length) return; // Salir si no hay archivos seleccionados
            const file = fileInput.files[0];
            const storage = getStorage(); // Obtener la instancia de almacenamiento
            const storageRef = ref(storage, `testados-rutas/${cliente}/${file.name}`); // Ruta en el bucket
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                },
                (error) => {
                    console.error('Upload failed:', error);
                    alert('Error al subir el archivo. Inténtalo de nuevo.');
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('File available at', downloadURL);
                    alert('Archivo subido con éxito.');
                    refreshRutas(cliente)
                    // Refrescar la lista de rutas después de la subida
                    setTimeout(() => {
                        loadRutasPorLocalidad(cliente, localidad);
                    }, 5000); // Esperar unos segundos para que los datos se reflejen en Firestore
                }
            );
        });
    }
}

export async function refreshRutas(cliente) {
    const params = new URLSearchParams(window.location.search);
    const localidad = params.get("localidad");
    const rutasList = document.getElementById("rutasList");

    rutasList.innerHTML = "Actualizando rutas...";

    try {
        const localidadRef = doc(collection(doc(db, "Clientes", cliente), "Localidades"), localidad);
        const localidadDoc = await getDoc(localidadRef);

        if (!localidadDoc.exists()) {
            rutasList.innerHTML = "No se encontró la localidad.";
            return;
        }

        const rutasRefs = localidadDoc.data().rutas || [];
        rutasList.innerHTML = ""; // Limpiar la lista

        for (const rutaRef of rutasRefs) {
            const rutaDoc = await getDoc(rutaRef);
            if (rutaDoc.exists()) {
                const listItem = document.createElement("li");
                listItem.textContent = rutaDoc.id; // Mostrar el ID de la ruta
                rutasList.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error al actualizar rutas:", error);
        rutasList.innerHTML = "Error al actualizar las rutas.";
    }
}


// Función para destacar una ruta seleccionada
export function highlightRutaSeleccionada(rutaId) {
    const rutasList = document.getElementById("rutasList");
    Array.from(rutasList.children).forEach((listItem) => {
        if (listItem.getAttribute("data-ruta-id") === rutaId) {
            listItem.classList.add("highlight");
        } else {
            listItem.classList.remove("highlight");
        }
    });
}

// Función para inicializar el módulo de rutas
export function initializeRutas(cliente, localidad) {
    loadRutasPorLocalidad(cliente, localidad);
    initializeFileUpload(cliente, localidad);

    // Agregar evento para resaltar rutas seleccionadas
    const rutasList = document.getElementById("rutasList");
    if (rutasList) {
        rutasList.addEventListener("click", (event) => {
            const rutaId = event.target.getAttribute("data-ruta-id");
            if (rutaId) {
                highlightRutaSeleccionada(rutaId);
            }
        });
    }
}
