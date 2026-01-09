import { db } from './config.js'
import { doc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'

const parametros = new URLSearchParams(window.location.search)
const ruta = parametros.get('ruta')
console.log('Ruta ID:', ruta)

// Variable global para el mapa de Google
let mapa;

// Función que será llamada por el HTML cuando Google Maps esté listo
function initMapFromModule() {
    console.log('Inicializando mapa desde módulo...');
    
    try {
        // Verificar si Google Maps está disponible
        if (!window.google || !window.google.maps) {
            throw new Error('Google Maps no está disponible');
        }
        
        mapa = new google.maps.Map(document.getElementById('mapa'), {
            zoom: 13,
            center: { lat: 0, lng: 0 },
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        const leyenda = document.getElementById('leyenda-colores');
        if (leyenda) {
            mapa.controls[google.maps.ControlPosition.TOP_LEFT].push(leyenda);
        }
        
        // Iniciar la carga de datos una vez que el mapa esté listo
        dibujar();
        
    } catch (error) {
        console.error('Error al inicializar Google Maps:', error);
        
        // Mostrar mensaje de error al usuario
        const mapaDiv = document.getElementById('mapa');
        if (mapaDiv) {
            mapaDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #d32f2f;">
                    <h3>⚠️ Error al cargar el mapa</h3>
                    <p>No se pudo cargar Google Maps. Posibles causas:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>API key no autorizada</li>
                        <li>APIs no habilitadas en Google Cloud Console</li>
                        <li>Restricciones de dominio o IP</li>
                        <li>Cuota de API excedida</li>
                    </ul>
                    <p><strong>Para solucionar:</strong></p>
                    <ol style="text-align: left; display: inline-block;">
                        <li>Ve a <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                        <li>Habilita "Maps JavaScript API"</li>
                        <li>Verifica restricciones de la API key</li>
                        <li>Recarga la página</li>
                    </ol>
                </div>
            `;
        }
        
        // Aún así, intentar cargar los datos para mostrar información
        dibujar();
    }
}

// Exponer la función globalmente para que el HTML pueda llamarla
window.initMapFromModule = initMapFromModule;

// Si Google Maps ya está cargado, inicializar inmediatamente
if (window.google && window.google.maps) {
    console.log('Google Maps ya está cargado, inicializando inmediatamente...');
    initMapFromModule();
}

// Funciones auxiliares
function validarCoordenadas(documento) {
    const lat = documento.data().latitud
    const lng = documento.data().longitud
    const isValid = lat && lng && lat !== '' && lng !== '' && 
           !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) &&
           parseFloat(lat) !== 0 && parseFloat(lng) !== 0
    
    if (!isValid) {
        console.log('Coordenada inválida encontrada:', { id: documento.id, lat, lng, data: documento.data() })
    }
    return isValid
}

function procesarDatos(documentos) {
    return documentos
        .sort((a,b) => parseInt(a.id) - parseInt(b.id))
        .filter(validarCoordenadas)
        .map(d => ({
            latitud: parseFloat(d.data().latitud),
            longitud: parseFloat(d.data().longitud),
            fecha: d.data().fecha_hora_lectura,
            medidor: d.data().medidor,
            novedad: d.data().novedades,
            lectura_actual: d.data().lectura_actual,
            imageUrl: d.data().imagenUrl
        }))
}

function determinarColor(punto) {
    if (punto.imageUrl && punto.imageUrl.trim() !== '') {
        return 'red'
    } else if (punto.novedad && punto.novedad.trim() !== '') {
        return 'yellow'
    } else {
        return 'green'
    }
}

function obtenerEstadoPunto(punto) {
    if (punto.imageUrl && punto.imageUrl.trim() !== '') {
        return { label: 'Con imagen', className: 'mapa-info__badge--danger' }
    }
    if (punto.novedad && punto.novedad.trim() !== '') {
        return { label: 'Con novedad', className: 'mapa-info__badge--warning' }
    }
    return { label: 'Sin novedad', className: 'mapa-info__badge--ok' }
}

function crearTooltip(punto) {
    const estado = obtenerEstadoPunto(punto)
    const fecha = punto.fecha || 'N/A'
    const medidor = punto.medidor || 'N/A'
    const lectura = punto.lectura_actual && punto.lectura_actual.trim() !== '' ? punto.lectura_actual : 'N/A'
    const novedad = punto.novedad && punto.novedad.trim() !== '' ? punto.novedad : ''
    const imagen = punto.imageUrl && punto.imageUrl.trim() !== '' ? punto.imageUrl : ''

    let contenido = `
        <div class="mapa-info">
            <div class="mapa-info__header">
                <div class="mapa-info__title">Detalle del punto</div>
                <span class="mapa-info__badge ${estado.className}">${estado.label}</span>
            </div>
            <div class="mapa-info__body">
                <div class="mapa-info__row">
                    <span class="mapa-info__label">Fecha</span>
                    <span class="mapa-info__value">${fecha}</span>
                </div>
                <div class="mapa-info__row">
                    <span class="mapa-info__label">Medidor</span>
                    <span class="mapa-info__value">${medidor}</span>
                </div>
                <div class="mapa-info__row">
                    <span class="mapa-info__label">Lectura</span>
                    <span class="mapa-info__value">${lectura}</span>
                </div>
    `

    if (novedad) {
        contenido += `
                <div class="mapa-info__row">
                    <span class="mapa-info__label">Novedad</span>
                    <span class="mapa-info__value">${novedad}</span>
                </div>
        `
    }

    if (imagen) {
        contenido += `
                <a class="mapa-info__image" href="${imagen}" target="_blank" rel="noopener noreferrer" title="Ver imagen completa">
                    <img src="${imagen}" alt="Imagen del punto" onerror="this.style.display='none'">
                </a>
        `
    }

    contenido += `
            </div>
        </div>
    `

    return contenido
}

function crearMarcadores(puntos) {
    if (puntos.length === 0) return;
    
    // Crear coordenadas para la polilínea
    const coords = puntos.map(p => ({ lat: p.latitud, lng: p.longitud }));
    
    // Dibujar línea que conecta los puntos
    new google.maps.Polyline({
        path: coords,
        geodesic: true,
        strokeColor: '#00FF00',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        strokeDashArray: [10, 5], // Línea punteada
        map: mapa
    });
    
    // Crear marcadores individuales
    puntos.forEach(p => {
        const color = determinarColor(p);
        const tooltip = crearTooltip(p);
        
        // Crear marcador circular personalizado
        const marker = new google.maps.Marker({
            position: { lat: p.latitud, lng: p.longitud },
            map: mapa,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 0.8,
                scale: 6,
                strokeColor: color,
                strokeWeight: 2
            }
        });
        
        // Crear InfoWindow para el tooltip
        const infoWindow = new google.maps.InfoWindow({
            content: tooltip
        });
        
        // Mostrar InfoWindow al hacer click
        marker.addListener('click', () => {
            // Cerrar otras InfoWindows abiertas
            if (window.currentInfoWindow) {
                window.currentInfoWindow.close();
            }
            infoWindow.open(mapa, marker);
            window.currentInfoWindow = infoWindow;
        });
        
        // Opcional: Mostrar al hacer hover
        marker.addListener('mouseover', () => {
            if (window.currentInfoWindow) {
                window.currentInfoWindow.close();
            }
            infoWindow.open(mapa, marker);
            window.currentInfoWindow = infoWindow;
        });
    });
}

async function dibujar(){
    try {
        if (!ruta) {
            console.error('No se proporcionó ID de ruta')
            return
        }
        
        console.log('Consultando ruta:', ruta)
        const refRuta = doc(db, 'Rutas', ruta)
        const refRecorrido = collection(refRuta, 'RutaRecorrido')
        
        console.log('Consultando subcolección RutaRecorrido...')
        const resultado = await getDocs(refRecorrido)
        console.log('Documentos encontrados:', resultado.docs.length)
        
        if (resultado.docs.length === 0) {
            console.log('No se encontraron documentos en RutaRecorrido')
            return
        }
        
        const puntos = procesarDatos(resultado.docs)
        console.log('Documentos con coordenadas válidas:', puntos.length)
        
        // Solo intentar dibujar en el mapa si está disponible
        if (mapa && puntos.length > 0) {
            // Centrar el mapa en el primer punto
            mapa.setCenter({ lat: puntos[0].latitud, lng: puntos[0].longitud });
            mapa.setZoom(13);
            
            // Crear marcadores
            crearMarcadores(puntos);
            
            // Ajustar automáticamente el zoom para mostrar todos los puntos
            if (puntos.length > 1) {
                const bounds = new google.maps.LatLngBounds();
                puntos.forEach(p => {
                    bounds.extend({ lat: p.latitud, lng: p.longitud });
                });
                mapa.fitBounds(bounds);
            }
        }
        
    } catch (error) {
        console.error('Error al consultar la base de datos:', error)
        
        // Mostrar error al usuario
        const mapaDiv = document.getElementById('mapa');
        if (mapaDiv && !mapaDiv.querySelector('h3')) {
            mapaDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #d32f2f;">
                    <h3>❌ Error al cargar datos</h3>
                    <p>No se pudieron cargar los datos de la ruta.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                </div>
            `;
        }
    }
}
