import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Configuración de Firebase para el bucket de subida
const firebaseConfigUpload = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas",  // Bucket para subir archivos
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase para el bucket de subida
const appUpload = initializeApp(firebaseConfigUpload, "uploadApp");
const storageUpload = getStorage(appUpload);

// Obtener el parámetro 'cliente' de la URL
const urlParams = new URLSearchParams(window.location.search);
const cliente = urlParams.get('cliente') || 'Cliente 1';  // Valor por defecto "Cliente 1" si no se proporciona

// Función para subir archivos automáticamente al seleccionarlos
document.getElementById("fileInput").addEventListener("change", function() {
    const fileInput = this;
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const storageRef = ref(storageUpload, `${cliente}/${file.name}`);  // Usar el cliente en la ruta
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Mostrar barra de progreso
    const progressContainer = document.querySelector('.progress-container');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressContainer.style.display = 'block';

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        },
        (error) => {
            console.error('Upload failed:', error);
            alert('Error al subir el archivo. Inténtalo de nuevo.');
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
                alert('Archivo subido con éxito. Disponible en: ' + downloadURL);

                // Ocultar barra de progreso al finalizar
                progressContainer.style.display = 'none';
            });
        }
    );
});
