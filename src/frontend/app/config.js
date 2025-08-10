import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js'; // Importar auth

// Configuración principal de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAksqUv9fz5XqluvoIla1Ih9mzwpZFls7k",
  authDomain: "estado-eb18c.firebaseapp.com",
  projectId: "estado-eb18c",
  storageBucket: "estado-eb18c.appspot.com",
  messagingSenderId: "749071992711",
  appId: "1:749071992711:web:9c4caaca8e2ff42c27b522",
  measurementId: "G-39F53TQ6WP"
};

// Configuración de Firebase para el bucket de subida
const firebaseConfigUpload = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas", // Nombre del bucket para subida
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Configuración de Firebase para el bucket de descarga
const firebaseConfigDownload = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas-exportadas", // Nombre del bucket para descarga
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // Inicializar Auth

// Inicializar Firebase para los buckets de subida y descarga
export const appUpload = initializeApp(firebaseConfigUpload, "uploadApp");
export const storageUpload = getStorage(appUpload);

export const appDownload = initializeApp(firebaseConfigDownload, "downloadApp");
export const storageDownload = getStorage(appDownload);

// Endpoint HTTP de la función de exportación on-demand (derivado del proyecto/región)
export const exportOnDemandEndpoint = "https://us-central1-estado-eb18c.cloudfunctions.net/exportCSVOnDemand";
