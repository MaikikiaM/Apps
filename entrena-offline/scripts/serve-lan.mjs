// scripts/serve-lan.mjs
// Servidor local puro en Node.js para servir los archivos de dist/ en red local y poder instalar la PWA en el móvil
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: La carpeta "dist" no existe. Ejecuta primero "npm run build".');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(distDir, reqPath);

  // Fallback a index.html para SPA si el archivo no existe
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error interno del servidor');
  }
});

const PORT = 4173;
server.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================================');
  console.log('  🚀 Servidor PWA Offline Listo para Instalación');
  console.log('=====================================================');
  console.log(`- En este PC:          http://localhost:${PORT}`);

  // Mostrar IPs locales
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`- En tu móvil (WiFi):  http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('=====================================================');
  console.log('Abre la dirección en el navegador de tu móvil y pulsa:');
  console.log('Android: Tres puntos ⋮ -> "Instalar aplicación"');
  console.log('iPhone:  Compartir ⎋ -> "Añadir a pantalla de inicio"');
  console.log('=====================================================');
});
