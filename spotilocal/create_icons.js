const fs = require('fs');
const zlib = require('zlib');

// Create an SVG icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1ed760;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#121212;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad)"/>
  <circle cx="256" cy="256" r="190" fill="#121212"/>
  <path d="M160 350 A 160 160 0 0 1 352 350" stroke="#1ed760" stroke-width="36" stroke-linecap="round" fill="none"/>
  <path d="M185 275 A 110 110 0 0 1 327 275" stroke="#1ed760" stroke-width="30" stroke-linecap="round" fill="none"/>
  <path d="M210 200 A 60 60 0 0 1 302 200" stroke="#1ed760" stroke-width="24" stroke-linecap="round" fill="none"/>
</svg>`;

fs.writeFileSync(__dirname + '/icon.svg', svgIcon);

// Pure Node.js uncompressed / standard PNG generator for 192x192 and 512x512 with green gradient
function createPng(size, filename) {
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.45;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Spotify Green gradient
        const t = y / height;
        const red = Math.round(29 * (1 - t) + 18 * t);
        const green = Math.round(185 * (1 - t) + 215 * t);
        const blue = Math.round(84 * (1 - t) + 96 * t);
        
        // Sound waves pattern
        const d1 = Math.abs(Math.sqrt((x - cx)*(x - cx) + (y - (cy + size*0.1))*(y - (cy + size*0.1))) - size*0.3);
        const d2 = Math.abs(Math.sqrt((x - cx)*(x - cx) + (y - (cy + size*0.1))*(y - (cy + size*0.1))) - size*0.2);
        const d3 = Math.abs(Math.sqrt((x - cx)*(x - cx) + (y - (cy + size*0.1))*(y - (cy + size*0.1))) - size*0.1);

        if ((d1 < size*0.035 && y > cy - size*0.2 && y < cy + size*0.25) ||
            (d2 < size*0.03 && y > cy - size*0.15 && y < cy + size*0.2) ||
            (d3 < size*0.025 && y > cy - size*0.1 && y < cy + size*0.15)) {
          buffer[idx] = 18;
          buffer[idx + 1] = 18;
          buffer[idx + 2] = 18;
          buffer[idx + 3] = 255;
        } else {
          buffer[idx] = red;
          buffer[idx + 1] = green;
          buffer[idx + 2] = blue;
          buffer[idx + 3] = 255;
        }
      } else {
        // Transparent outside
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Construct valid PNG
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // Filter: None
    buffer.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      crc ^= byte;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([sig, ihdr, idat, iend]);
  fs.writeFileSync(__dirname + '/' + filename, pngBuffer);
  console.log('Saved ' + filename + ' (' + pngBuffer.length + ' bytes)');
}

createPng(192, 'icon-192.png');
createPng(512, 'icon-512.png');
console.log('Icons generated successfully!');
