// Importar las bibliotecas necesarias de Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

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

// Configuración de Firebase para Firestore
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase para Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Verificar si el usuario está logueado
function checkLogin() {
    const username = localStorage.getItem("username");
    if (!username) {
        // Redirigir al login si no hay un usuario logueado
        window.location.href = "login.html";
        return null;
    }
    return username; // Retornar el nombre de usuario logueado
}

document.addEventListener("DOMContentLoaded", function() {
    // Verificar si existe el botón 'Volver' en la página
    const backButton = document.getElementById("backButton");
    if (backButton) {
        backButton.addEventListener("click", function() {
            window.location.href = "menu.html";  // Redirigir al menú principal
        });
    }

    // Vincular el botón de inicio de sesión a la función login
    document.getElementById("loginButton").addEventListener("click", function() {
        const cliente = document.getElementById("usernameInput").value;
        const password = document.getElementById("passwordInput").value;

        if (cliente && password) {
            login(cliente, password);
        } else {
            alert("Por favor ingrese un cliente y contraseña.");
        }
    });
});

// Función para manejar el inicio de sesión
function login(username, password) {
    // Aquí puedes reemplazar esta validación simple con Firebase Auth o alguna otra lógica de autenticación
    if (password === "password") {
        localStorage.setItem("username", username);
        window.location.href = "localidades.html"; // Redirigir al menú si el login es correcto
    } else {
        alert("Credenciales incorrectas. Inténtalo de nuevo.");
    }
}

// Función para cerrar sesión
function logout() {
    localStorage.removeItem("username");
    window.location.href = "login.html"; // Redirigir al login después de cerrar sesión
}

// Función para subir archivos al bucket de subida automáticamente al seleccionarlos
const fileInput = document.getElementById("fileInput");
if (fileInput) {
    fileInput.addEventListener("change", function() {
        if (!fileInput.files.length) return;  // Si no hay archivos seleccionados, salir
        const file = fileInput.files[0];
        const storageRef = ref(storageUpload, `${cliente}/${file.name}`);  // Usar el cliente en la ruta
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
    });
}

async function loadLocalidades() {
    const username = checkLogin(); // Verifica el login y obtiene el username
    if (!username) return;

    const localidadesList = document.getElementById("localidadesList");
    localidadesList.innerHTML = "Cargando localidades...";

    const localidadesRef = db.collection("Clientes").doc(username).collection("Localidades");
    const snapshot = await localidadesRef.get();

    localidadesList.innerHTML = ""; // Limpiar la lista antes de agregar
    snapshot.forEach(doc => {
        const localidad = doc.id; // Usar el ID de la localidad
        const listItem = document.createElement("li");
        listItem.textContent = localidad;
        listItem.onclick = () => {
            window.location.href = `gestionar-rutas.html?localidad=${encodeURIComponent(localidad)}&username=${encodeURIComponent(username)}`;
        };
        localidadesList.appendChild(listItem);
    });
}

if (window.location.pathname.includes("localidades.html")) {
    loadLocalidades();
}

async function loadRutasYUsuarios() {
    const params = new URLSearchParams(window.location.search);
    const localidad = params.get("localidad");
    const username = localStorage.getItem("username");

    if (!username || !localidad) {
        window.location.href = "localidades.html";
        return;
    }

    const rutasRef = db.collection("Clientes").doc(username).collection("Localidades").doc(localidad);
    const rutasDoc = await rutasRef.get();

    const rutasList = document.getElementById("rutasList");
    const usuariosList = document.getElementById("usuariosList");

    if (rutasDoc.exists) {
        const rutas = rutasDoc.data().rutas || [];
        rutasList.innerHTML = "";
        rutas.forEach(ruta => {
            const listItem = document.createElement("li");
            listItem.textContent = ruta;
            rutasList.appendChild(listItem);
        });
    }

    const usuariosRef = db.collection("Usuarios").where("rutas", "array-contains-any", rutasDoc.data().rutas || []);
    const usuariosSnapshot = await usuariosRef.get();
    usuariosList.innerHTML = "";
    usuariosSnapshot.forEach(userDoc => {
        const listItem = document.createElement("li");
        listItem.textContent = userDoc.id; // Mostrar el ID del usuario
        usuariosList.appendChild(listItem);
    });
}

if (window.location.pathname.includes("gestionar-rutas.html")) {
    loadRutasYUsuarios();
}


// Función para listar archivos y mostrar enlaces de descarga desde el bucket de descarga
export function listFiles() {
    const fileListContainer = document.getElementById("fileList");
    const loadingIndicator = document.getElementById("loadingIndicator");

    if (!fileListContainer || !loadingIndicator) return;  // Si no existen los elementos, no se ejecuta

    // Mostrar el indicador de carga
    loadingIndicator.style.display = 'block';

    const listRef = ref(storageDownload, `${cliente}/`);  // Usar el cliente en la ruta

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
        })
        .catch((error) => {
            console.error("Error listing files:", error);
        })
        .finally(() => {
            // Ocultar el indicador de carga después de completar la lectura
            loadingIndicator.style.display = 'none';
        });
}

// Listar los archivos automáticamente al cargar la página si es la página de descarga
if (document.getElementById('fileList')) {
    listFiles();
}

// Funcionalidades para Firestore

// Obtener el parámetro 'cliente' de la URL
const urlParams = new URLSearchParams(window.location.search);
const cliente = urlParams.get('cliente') || 'Cliente 1';  // Valor por defecto "Cliente 1" si no se proporciona

// Referencia al documento del cliente en Firestore
const docRef = doc(db, "Rutas", cliente);

// Función para cargar y mostrar los correos electrónicos actuales
async function loadEmails() {
    try {
        const docSnap = await getDoc(docRef);
        const emailList = document.getElementById('emailList');
        emailList.innerHTML = '';  // Limpia la lista de correos

        if (docSnap.exists()) {
            const emails = docSnap.data().emails || [];  // Obtener el campo 'emails' del documento

            if (emails.length === 0) {
                // Mostrar un correo electrónico por defecto si la lista está vacía
                showDefaultEmail(emailList);
            } else {
                // Iterar sobre los correos electrónicos y crear elementos para cada uno
                emails.forEach(email => {
                    const emailItem = document.createElement('div');
                    emailItem.textContent = email;

                    // Botón para eliminar un email
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Eliminar';
                    deleteButton.onclick = () => removeEmail(email);
                    emailItem.appendChild(deleteButton);

                    emailList.appendChild(emailItem);
                });
            }
        } else {
            console.log("No se encontró el documento del cliente.");
            alert("No se encontraron datos para el cliente seleccionado.");
            showDefaultEmail(emailList);
        }
    } catch (error) {
        console.error("Error al cargar los correos electrónicos: ", error);
        alert("Error al cargar los correos electrónicos.");
        const emailList = document.getElementById('emailList');
        showDefaultEmail(emailList);
    }
}

// Función para mostrar un correo electrónico por defecto
function showDefaultEmail(emailList) {
    const defaultEmail = "ale.nesti@gmail.com";  // Correo electrónico por defecto
    const emailItem = document.createElement('div');
    emailItem.textContent = defaultEmail;

    emailList.appendChild(emailItem);
}

// Función para agregar un correo electrónico a Firestore
async function addEmailToFirestore(email) {
    try {
        await updateDoc(docRef, {
            emails: arrayUnion(email)  // Agrega el email al array
        });
        alert('Email agregado exitosamente.');
        loadEmails();  // Recargar la lista de correos
    } catch (error) {
        console.error("Error al agregar el email: ", error);
        alert('Error al agregar el email.');
    }
}

// Función para eliminar un correo electrónico de Firestore
async function removeEmail(email) {
    try {
        await updateDoc(docRef, {
            emails: arrayRemove(email)  // Elimina el email del array
        });
        alert('Email eliminado exitosamente.');
        loadEmails();  // Recargar la lista de correos
    } catch (error) {
        console.error("Error al eliminar el email: ", error);
        alert('Error al eliminar el email.');
    }
}

// Evento para manejar el clic en el botón de agregar
if (document.getElementById('addEmailButton')) {
    document.getElementById('addEmailButton').addEventListener('click', () => {
        const email = document.getElementById('emailInput').value;
        if (email) {
            addEmailToFirestore(email);
        } else {
            alert('Por favor, ingresa un correo electrónico válido.');
        }
    });
}

// Cargar los correos electrónicos al iniciar la página
if (document.getElementById('emailList')) {
    loadEmails();
}

// Función para redirigir a las otras páginas pasando el nombre de usuario
function goToPage(page) {
    const username = checkLogin();
    if (username) {
        window.location.href = `${page}.html?username=${encodeURIComponent(username)}`;
    }
}

// Ejemplo de navegación desde el menú
if (document.getElementById("uploadPageLink")) {
    document.getElementById("uploadPageLink").addEventListener("click", function() {
        goToPage("upload");
    });
}

if (document.getElementById("downloadPageLink")) {
    document.getElementById("downloadPageLink").addEventListener("click", function() {
        goToPage("download");
    });
}

if (document.getElementById("userManagementPageLink")) {
    document.getElementById("userManagementPageLink").addEventListener("click", function() {
        goToPage("manage-users");
    });
}

// Evento para cerrar sesión desde el menú
if (document.getElementById("logoutButton")) {
    document.getElementById("logoutButton").addEventListener("click", function() {
        logout();
    });
}
