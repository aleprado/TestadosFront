import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, 'src', 'frontend');
const PORT = process.env.PORT || 5173;

const routeMap = {
  '/': '/html/index.html',
  '/login': '/html/login.html',
  '/contacto': '/html/contacto.html',
  '/localidades': '/html/localidades.html',
  '/gestionar-rutas': '/html/gestionar-rutas.html',
  '/mapa': '/html/mapa.html',
};

const contentTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8',
};

function getType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return contentTypes[ext] || 'application/octet-stream';
}

async function serveFile(res, filePath) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': getType(filePath) });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURI(url.pathname);

    // Rewrites estilo Firebase
    if (routeMap[pathname]) {
      const target = path.join(ROOT, routeMap[pathname]);
      return serveFile(res, target);
    }

    // Archivos estáticos directos
    let filePath = path.join(ROOT, pathname);

    try {
      const st = await stat(filePath);
      if (st.isDirectory()) {
        // servir index.html dentro del directorio si existe
        filePath = path.join(filePath, 'index.html');
      }
      return serveFile(res, filePath);
    } catch (e) {
      // No existe el archivo
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dev server corriendo en http://localhost:${PORT}`);
});
