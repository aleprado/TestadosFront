import { db } from './config.js'
import { doc, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'
const parametros = new URLSearchParams(window.location.search)
const ruta = parametros.get('ruta')
const mapa = L.map('mapa').setView([0,0],13)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{}).addTo(mapa)
async function dibujar(){
    const refRuta = doc(db,'Rutas',ruta)
    const refRecorrido = collection(refRuta,'RutaRecorrido')
    const consulta = query(refRecorrido, orderBy('Orden'))
    const snap = await getDocs(consulta)
    const puntos = snap.docs.map(d=>[d.data().latitud,d.data().longitud])
    if(puntos.length){
        mapa.setView(puntos[0],13)
        L.polyline(puntos,{color:'green'}).addTo(mapa)
    }
}
dibujar()
