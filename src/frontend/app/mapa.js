import { db } from './config.js'
import { doc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'
const parametros = new URLSearchParams(window.location.search)
const ruta = parametros.get('ruta')
console.log('Ruta ID:', ruta)
const mapa = L.map('mapa').setView([0,0],13)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{}).addTo(mapa)
async function dibujar(){
    try {
        if (!ruta) {
            console.error('No se proporcionó ID de ruta')
            return
        }
        console.log('Consultando ruta:', ruta)
        const refRuta = doc(db,'Rutas',ruta)
        const refRecorrido = collection(refRuta,'RutaRecorrido')
        console.log('Consultando subcolección RutaRecorrido...')
        const resultado = await getDocs(refRecorrido)
        console.log('Documentos encontrados:', resultado.docs.length)
        
        if (resultado.docs.length === 0) {
            console.log('No se encontraron documentos en RutaRecorrido')
            return
        }
        
        const datos = resultado.docs
            .sort((a,b)=>parseInt(a.id)-parseInt(b.id))
            .filter(d=>{
                const lat = d.data().latitud
                const lng = d.data().longitud
                const isValid = lat && lng && lat !== '' && lng !== '' && 
                       !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) &&
                       parseFloat(lat) !== 0 && parseFloat(lng) !== 0
                if (!isValid) {
                    console.log('Coordenada inválida encontrada:', { id: d.id, lat, lng, data: d.data() })
                }
                return isValid
            })
        console.log('Documentos con coordenadas válidas:', datos.length)
        
        const puntos = datos.map(d=>({
            latitud:parseFloat(d.data().latitud),
            longitud:parseFloat(d.data().longitud),
            fecha:d.data().fecha_hora_lectura,
            medidor:d.data().medidor
        }))
        if(puntos.length){
            mapa.setView([puntos[0].latitud,puntos[0].longitud],13)
            const coords = puntos.map(p=>[p.latitud,p.longitud])
            if(coords.length > 0){
                L.polyline(coords,{color:'green',dashArray:'4 6'}).addTo(mapa)
                puntos.forEach(p=>{
                    L.circleMarker([p.latitud,p.longitud],{radius:4,color:'red',fillColor:'red',fillOpacity:0.8})
                        .bindTooltip(`Lectura: ${p.fecha}<br>Medidor: ${p.medidor}`)
                        .addTo(mapa)
                })
            }
        }
    } catch (error) {
        console.error('Error al consultar la base de datos:', error)
    }
}
dibujar()
