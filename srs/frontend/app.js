import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Configuración de Firebase para el bucket de subida
const firebaseConfigUpload = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas",  // Bucket para subir archivos
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Configuración de Firebase para el bucket de descarga
const firebaseConfigDownload = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas-exportadas",  // Bucket para listar y descargar archivos
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase para los dos buckets
const appUpload = initializeApp(firebaseConfigUpload, "uploadApp");
const storageUpload = getStorage(appUpload);

const appDownload = initializeApp(firebaseConfigDownload, "downloadApp");
const storageDownload = getStorage(appDownload);

// Función para subir archivos al bucket de subida
export function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput) return;  // Si no existe el elemento, no se ejecuta

    if (fileInput.files.length === 0) {
        alert('Por favor, selecciona un archivo para subir.');
        return;
    }

    const file = fileInput.files[0];
    const storageRef = ref(storageUpload, file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        },
        (error) => {
            console.error('Upload failed:', error);
            alert('Error al subir el archivo. Inténtalo de nuevo.');
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
                alert('Archivo subido con éxito. Disponible en: ' + downloadURL);
            });
        }
    );
}

// Función para listar archivos y mostrar enlaces de descarga desde el bucket de descarga
export function listFiles() {
    const fileListContainer = document.getElementById("fileList");
    if (!fileListContainer) return;  // Si no existe el elemento, no se ejecuta

    const listRef = ref(storageDownload, 'Cliente 1/');  // Listar archivos desde la carpeta del cliente

    listAll(listRef)
        .then((res) => {
            fileListContainer.innerHTML = '';  // Limpia la lista antes de agregar nuevos enlaces
            res.items.forEach((itemRef) => {
                getDownloadURL(itemRef).then((url) => {
                    const link = document.createElement("a");
                    link.href = url;
                    link.textContent = itemRef.name;
                    link.setAttribute("download", itemRef.name);
                    fileListContainer.appendChild(link);
                    fileListContainer.appendChild(document.createElement("br"));
                });
            });
        }).catch((error) => {
            console.error("Error listing files:", error);
        });
}

// Conectar funciones con botones solo si existen los elementos en la página
if (document.getElementById('uploadButton')) {
    document.getElementById('uploadButton').addEventListener('click', uploadFile);
}

// Listar los archivos automáticamente al cargar la página si es la página de descarga
if (document.getElementById('fileList')) {
    listFiles();
}
