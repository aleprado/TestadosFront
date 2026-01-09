# TestadosFront - Documentacion rapida

Objetivo
- Frontend web estatico para gestion de localidades, rutas, usuarios y mapa.
- Se apoya en Firebase (Auth, Firestore, Storage) y una funcion HTTP para exportar CSV.

Stack
- HTML/CSS/JS sin build, servido como sitio estatico.
- Firebase JS SDK via CDN.
- Dev server local en Node (`dev-server.mjs`).

Estructura clave
- `src/frontend/html`: paginas (login, localidades, gestionar-rutas, mapa, etc).
- `src/frontend/app`: logica JS principal.
- `src/frontend/style.css`: estilos globales.
- `dev-server.mjs`: router local para rutas tipo Firebase Hosting.
- `firebase.json`: rewrites de hosting.

Paginas y rutas
- `/login`: login con email/password.
- `/localidades`: lista y CRUD de localidades.
- `/gestionar-rutas`: rutas, asignacion de usuarios, export, mapa.
- `/mapa?ruta=...`: mapa full screen para una ruta.

Flujos principales
- Login:
  - `auth.js` autentica en Firebase Auth.
  - Busca cliente en `Clientes` por email y guarda `cliente` en localStorage.
- Localidades:
  - CRUD en `Clientes/{cliente}/Localidades`.
  - Guarda `localidad` en localStorage y navega a gestionar rutas.
- Rutas:
  - Upload de archivos a Storage (`testados-rutas`).
  - Un proceso backend crea documento en `Rutas/{rutaId}` y subcoleccion `RutaRecorrido`.
  - `Clientes/{cliente}/Localidades/{localidad}.rutas` guarda referencias a rutas.
  - Eliminar ruta limpia subcoleccion y referencias en usuarios.
- Usuarios:
  - `Usuarios` es coleccion global.
  - En localidad se guardan referencias en `Clientes/.../Localidades/.../usuarios`.
  - Asignacion: array `rutas` dentro del usuario.
- Mapa:
  - `mapa.js` carga `Rutas/{ruta}/RutaRecorrido` y dibuja marcadores y polilinea.
  - Tooltip (InfoWindow) con layout custom.

Modelo de datos (resumen)
- `Clientes/{cliente}`: doc con email.
- `Clientes/{cliente}/Localidades/{localidad}`:
  - `rutas`: array de referencias a `Rutas/{rutaId}`.
  - `usuarios`: array de referencias a `Usuarios/{userId}`.
- `Rutas/{rutaId}`:
  - `cliente`: referencia a `Clientes/{cliente}`.
  - `localidad`: referencia a `Clientes/{cliente}/Localidades/{localidad}`.
  - Subcoleccion `RutaRecorrido`.
- `Usuarios/{userId}`:
  - `nombre`, `email`, `rutas` (array de referencias o paths legacy).

Integraciones externas
- Export CSV: `exportOnDemandEndpoint` en `app/config.js`.
- Storage:
  - Subida: `testados-rutas`.
  - Descarga: `testados-rutas-exportadas` (publico).
- Google Maps API Key en `app/config.js`.

UX relevante
- Overlay global para procesos largos: `showLoading` / `hideLoading` en `app/ui.js`.
- Popups de confirmacion y mensajes: `showPopup`.
- Tooltips via `title` en botones de accion.

Desarrollo local
- `npm run dev` en `TestadosFront/` inicia `dev-server.mjs`.
- Sitio en `http://localhost:5173`.

Notas de mantenimiento
- Si agregas rutas nuevas, actualizar `dev-server.mjs` y `firebase.json`.
- Si cambias IDs o paths de colecciones, actualizar `app.js`, `auth.js` y `mapa.js`.
