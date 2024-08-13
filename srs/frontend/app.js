import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas",  // Aquí especificas tu bucket personalizado de GCP
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Función para subir archivos
export function uploadFile() {
    const file = document.getElementById("fileInput").files[0];
    const storageRef = ref(storage, file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        },
        (error) => {
            console.error('Upload failed:', error);
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
            });
        }
    );
}

// Función para listar archivos y mostrar enlaces de descarga
export function listFiles() {
    const listRef = ref(storage, 'exportados/');
    const fileListContainer = document.getElementById("fileList");

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

// Conectar funciones con botones
document.getElementById('uploadButton').addEventListener('click', uploadFile);
document.getElementById('listFilesButton').addEventListener('click', listFiles);
