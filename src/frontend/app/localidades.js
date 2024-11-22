import { collection, getDocs, doc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { db } from './config.js';

export async function loadLocalidades() {
    const username = localStorage.getItem("username");
    const localidadesList = document.getElementById("localidadesList");

    localidadesList.innerHTML = "Cargando localidades...";

    try {
        const localidadesRef = collection(doc(db, "Clientes", username), "Localidades");
        const snapshot = await getDocs(localidadesRef);

        localidadesList.innerHTML = "";
        snapshot.forEach(doc => {
            const localidad = doc.id;
            const listItem = document.createElement("li");
            listItem.textContent = localidad;
            listItem.onclick = () => {
                localStorage.setItem("localidad", localidad);
                window.location.href = "gestionar-rutas.html";
            };
            localidadesList.appendChild(listItem);
        });
        if (snapshot.empty) {
            localidadesList.innerHTML = "No se encontraron localidades.";
        }
    } catch (error) {
        console.error("Error al cargar localidades:", error);
        localidadesList.innerHTML = "Error al cargar localidades.";
    }
}

