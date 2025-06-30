import { db } from './config.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'
const p = new URLSearchParams(window.location.search)
const r = p.get('ruta')
const m = L.map('mapa').setView([0,0],13)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{}).addTo(m)
async function dibujar(){
    const ref = doc(db,'Rutas',r)
    const s = await getDoc(ref)
    if(!s.exists())return
    const d = s.data()
    const recorrido = d.recorrido || []
    if(recorrido.length){
        const puntos = recorrido.map(p=>[p.latitud,p.longitud])
        L.polyline(puntos,{color:'green'}).addTo(m)
    }
}
dibujar()
