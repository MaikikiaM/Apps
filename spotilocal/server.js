const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const SONGS_DIR = path.join(__dirname, 'songs');

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.lrc': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // Global CORS Headers for WebViews & Mobile APK
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = decodeURIComponent(req.url.split('?')[0]);

  // API endpoint to auto-scan songs folder
  if (parsedUrl === '/api/songs') {
    fs.readdir(SONGS_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      const audioFiles = files.filter(file => file.match(/\.(flac|mp3|wav|m4a|ogg|aac|webm)$/i));
      const songList = audioFiles.map(file => ({
        name: file,
        url: `/songs/${encodeURIComponent(file)}`
      }));

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(songList));
    });
    return;
  }

  // API endpoint for version check
  if (parsedUrl === '/api/version') {
    let currentVer = '1.7.3';
    try {
      const vData = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-version.json'), 'utf8'));
      if (vData && vData.version) currentVer = vData.version;
    } catch (e) {}
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      version: currentVer,
      fileName: `SpotiLocal_v${currentVer}.apk`,
      downloadUrl: `/SpotiLocal_v${currentVer}.apk`,
      timestamp: Date.now(),
      updateTime: new Date().toISOString()
    }));
    return;
  }
  // Serve APK with versioned filename (Supports SpotiPirata and SpotiLocal)
  if (parsedUrl === '/SpotiPirata.apk' || parsedUrl.match(/^\/SpotiPirata_v[\d.]+\.apk$/) || parsedUrl === '/SpotiLocal.apk' || parsedUrl.match(/^\/SpotiLocal_v[\d.]+\.apk$/)) {
    const reqFileName = path.basename(parsedUrl);
    let apkPath = path.join(__dirname, reqFileName);
    if (!fs.existsSync(apkPath)) {
      const versionCandidate = path.join(__dirname, 'versions', reqFileName);
      if (fs.existsSync(versionCandidate)) {
        apkPath = versionCandidate;
      } else if (reqFileName.startsWith('SpotiPirata')) {
        apkPath = path.join(__dirname, 'versions', 'SpotiPirata_alias_v1.5.1.apk');
      } else {
        apkPath = path.join(__dirname, 'SpotiLocal.apk');
      }
    }
    fs.stat(apkPath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('APK not found');
        return;
      }
      const outName = reqFileName === 'SpotiPirata.apk' ? 'SpotiPirata_v1.6.apk' : reqFileName;
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stats.size,
        'Content-Disposition': `attachment; filename="${outName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
      fs.createReadStream(apkPath).pipe(res);
    });
    return;
  }

  let filePath = path.join(__dirname, parsedUrl === '/' ? 'index.html' : parsedUrl);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stats.size;
    const range = req.headers.range;

    // HTTP Range Request Handling (206 Partial Content) for FLAC & Audio Streaming
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  });
});

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

const localIps = getLocalIps();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log('🎵 SpotiLocal Server en ejecución con soporte HTTP Range!');
  console.log('==================================================');
  console.log(`💻 Desde este ordenador:   http://localhost:${PORT}`);
  localIps.forEach(ip => {
    console.log(`📱 Desde tu teléfono móvil: http://${ip}:${PORT}`);
  });
  console.log('==================================================\n');
});
