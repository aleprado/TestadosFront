import { db } from './config.js'
import { doc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'
const parametros = new URLSearchParams(window.location.search)
const ruta = parametros.get('ruta')
const mapa = L.map('mapa').setView([0,0],13)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{}).addTo(mapa)
async function dibujar(){
    const refRuta = doc(db,'Rutas',ruta)
    const refRecorrido = collection(refRuta,'RutaRecorrido')
    const resultado = await getDocs(refRecorrido)
    const datos = resultado.docs
        .sort((a,b)=>parseInt(a.id)-parseInt(b.id))
        .filter(d=>d.data().latitud!=='' && d.data().longitud!=='')
    const puntos = datos.map(d=>({
        latitud:d.data().latitud,
        longitud:d.data().longitud,
        fecha:d.data().fecha_hora_lectura
    }))
    if(puntos.length){
        mapa.setView([puntos[0].latitud,puntos[0].longitud],13)
        const coords = puntos.map(p=>[p.latitud,p.longitud])
        L.polyline(coords,{color:'green',dashArray:'4 6'}).addTo(mapa)
        puntos.forEach(p=>{
            L.circleMarker([p.latitud,p.longitud],{radius:4,color:'red',fillColor:'red',fillOpacity:0.8})
                .bindTooltip(p.fecha)
                .addTo(mapa)
        })
    }
}
dibujar()
