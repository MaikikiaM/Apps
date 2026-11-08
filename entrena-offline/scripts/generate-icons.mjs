// scripts/generate-icons.mjs
// Genera iconos PNG y SVG válidos para PWA sin ninguna dependencia externa usando Node.js puro y zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Guardar SVG de alta calidad
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#0b1120"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="url(#glow)" stroke-width="8" opacity="0.4"/>
  
  <!-- Icono Central: Olas de natación + Barra de fuerza -->
  <g transform="translate(96, 120)">
    <!-- Mancuerna / Barra estilizada -->
    <rect x="60" y="50" width="200" height="24" rx="12" fill="url(#glow)"/>
    <rect x="36" y="26" width="32" height="72" rx="8" fill="#38bdf8"/>
    <rect x="252" y="26" width="32" height="72" rx="8" fill="#38bdf8"/>
    <rect x="16" y="38" width="24" height="48" rx="6" fill="#0ea5e9"/>
    <rect x="280" y="38" width="24" height="48" rx="6" fill="#0ea5e9"/>

    <!-- Olas hidrodinámicas de natación -->
    <path d="M 10,160 C 50,130 90,190 130,160 C 170,130 210,190 250,160 C 280,135 310,170 320,160" 
          fill="none" stroke="#06b6d4" stroke-width="18" stroke-linecap="round"/>
    <path d="M 0,205 C 40,175 80,235 120,205 C 160,175 200,235 240,205 C 275,180 305,215 320,205" 
          fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent.trim());
console.log('✓ Creado public/favicon.svg');

// 2. Generador de PNG puro con CRC32
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}
const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function generatePngBuffer(width, height) {
  // Color palette: Fondo azul oscuro (#0b1120) con gradiente radial y borde cian/verde
  const bytesPerPixel = 4; // RGBA
  const rowLength = width * bytesPerPixel + 1; // 1 byte de filtro al inicio de cada fila
  const rawData = Buffer.alloc(rowLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const rMax = width * 0.46;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Fondo base deportivo (#0b1120)
      let r = 11, g = 17, b = 32, a = 255;

      // Anillo cian/esmeralda
      if (dist >= rMax - (width * 0.05) && dist <= rMax) {
        // Cian hacia esmeralda
        const t = (x / width);
        r = Math.round(6 * (1 - t) + 16 * t);
        g = Math.round(182 * (1 - t) + 185 * t);
        b = Math.round(212 * (1 - t) + 129 * t);
      } else if (dist < rMax - (width * 0.05)) {
        // Núcleo central con sutil iluminación
        const t = Math.max(0, 1 - dist / (rMax * 0.8));
        r = Math.min(255, Math.round(11 + t * 25));
        g = Math.min(255, Math.round(17 + t * 45));
        b = Math.min(255, Math.round(32 + t * 70));
      }

      // Dibujar barra central de mancuerna estilizada
      const inBarX = (x >= width * 0.28 && x <= width * 0.72);
      const inBarY = (y >= height * 0.38 && y <= height * 0.44);
      if (inBarX && inBarY) {
        r = 6; g = 182; b = 212; // Cyan 500
      }

      // Placas de pesas
      const inWeight1 = (x >= width * 0.23 && x <= width * 0.29 && y >= height * 0.32 && y <= height * 0.50);
      const inWeight2 = (x >= width * 0.71 && x <= width * 0.77 && y >= height * 0.32 && y <= height * 0.50);
      if (inWeight1 || inWeight2) {
        r = 56; g = 189; b = 248; // Sky 400
      }

      // Onda de natación inferior
      const waveY = height * 0.62 + Math.sin(x / (width * 0.12)) * (height * 0.04);
      if (Math.abs(y - waveY) <= (height * 0.025) && x >= width * 0.2 && x <= width * 0.8) {
        r = 16; g = 185; b = 129; // Emerald 500
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth: 8
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generar iconos requeridos para PWA e iOS
const pwa192 = generatePngBuffer(192, 192);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
console.log('✓ Creado public/pwa-192x192.png (192x192)');

const pwa512 = generatePngBuffer(512, 512);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
console.log('✓ Creado public/pwa-512x512.png (512x512)');

const appleTouch = generatePngBuffer(180, 180);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
console.log('✓ Creado public/apple-touch-icon.png (180x180)');

console.log('¡Todos los iconos PWA generados con éxito!');
