import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { storageUpload } from './config.js';
import { refreshRutas } from './rutas.js';

export function subirRuta(file, cliente) {
    const storagePath = `${cliente}/${file.name}`;
    const storageRef = ref(storageUpload, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
        "state_changed",
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log("Upload is " + progress + "% done");
        },
        (error) => {
            console.error("Error al subir el archivo:", error);
            alert("Error al subir el archivo. Inténtalo de nuevo.");
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log("Archivo disponible en:", downloadURL);
                alert("Archivo subido con éxito. Disponible en: " + downloadURL);
                setTimeout(() => {
                    refreshRutas(cliente);
                }, 5000);
            });
        }
    );
}
