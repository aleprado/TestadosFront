// Configuración de Firebase con un bucket específico
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "testados-rutas", // Especificar el bucket aquí
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencia al bucket específico
const storage = firebase.storage();
const storageRef = storage.ref();

// Subir archivo
function uploadFile() {
    const file = document.getElementById("fileInput").files[0];
    const uploadTask = storageRef.child('uploads/' + file.name).put(file);

    uploadTask.on('state_changed', function(snapshot) {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
    }, function(error) {
        console.error('Upload failed:', error);
    }, function() {
        uploadTask.snapshot.ref.getDownloadURL().then(function(downloadURL) {
            console.log('File available at', downloadURL);
        });
    });
}
