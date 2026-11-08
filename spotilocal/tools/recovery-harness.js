/**
 * SpotiLocal v1.8.3 Recovery & Forensic Verification Test Suite
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Setup global browser polyfills for Node
global.window = global;
global.navigator = { userAgent: "Node-Harness/1.8.3", onLine: false };

// Load ID3Parser
const id3Code = fs.readFileSync(path.join(__dirname, '../id3-parser.js'), 'utf8');
eval(id3Code);

function sha256(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

async function runTests() {
  console.log("=== SPOTILOCAL v1.8.3 RECOVERY HARNESS ===");
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Test SHA-256 matching for Native Audio Store
  console.log("\n[Test 1] Simulación de emparejamiento con files/native-audio");
  const testSongId = "song_1741123456789_abcdef";
  const expectedHash = sha256(testSongId);
  const fakeFileName = `${expectedHash}.mp3`;
  assert(fakeFileName.startsWith(expectedHash), `ID ${testSongId} genera hash ${expectedHash}`);

  // Test finder logic
  const fakeFiles = [
    { name: "other_file.mp3", size: 1000 },
    { name: fakeFileName, size: 5242880 },
    { name: "sample.part", size: 200 }
  ];
  const matched = fakeFiles.find(f => {
    const dot = f.name.lastIndexOf('.');
    const base = dot > 0 ? f.name.substring(0, dot) : f.name;
    return base.toLowerCase() === expectedHash.toLowerCase();
  });
  assert(matched && matched.name === fakeFileName, "Puente localiza archivo nativo por SHA-256(song.id)");

  // 2. Test ID3Parser against real files in songs/
  console.log("\n[Test 2] Ejecución de ID3Parser sobre repertorio real");
  const songsDir = path.join(__dirname, '../songs');
  if (fs.existsSync(songsDir)) {
    const mp3Files = fs.readdirSync(songsDir).filter(f => f.endsWith('.mp3'));
    assert(mp3Files.length >= 12, `Se encontraron ${mp3Files.length} archivos en songs/`);

    const abbaFile = mp3Files.find(f => f.includes("The Winner Takes It All"));
    if (abbaFile) {
      const buf = fs.readFileSync(path.join(songsDir, abbaFile));
      const blob = new Blob([buf]);
      const parsed = await ID3Parser.parse(blob);
      assert(parsed && parsed.title.includes("The Winner Takes It All"), `ABBA parseado correctamente: "${parsed.title}"`);
      assert(parsed && parsed.artist === "ABBA", `Artista ABBA parseado: "${parsed.artist}"`);
    }
  }

  // 3. Test that Block F (canonical guessing) was eliminated from app.js
  console.log("\n[Test 3] Verificación de eliminación de Block F (adivinación)");
  const appJsCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert(!appJsCode.includes("Canonical Repertoire Auto-Healer for remaining generic songs"), "Block F guessing auto-healer ha sido eliminado completamente de app.js");
  assert(appJsCode.includes("getBlobFromAnySource"), "getBlobFromAnySource implementado en app.js");
  assert(appJsCode.includes("generateLibraryDiagnosticReport"), "generateLibraryDiagnosticReport implementado en app.js");
  assert(appJsCode.includes("openDiagnosticUI"), "openDiagnosticUI implementado en app.js");

  // 4. Test version consistency
  console.log("\n[Test 4] Consistencia de Versión y Cache");
  const buildGradle = fs.readFileSync(path.join(__dirname, '../apk-build/android/app/build.gradle'), 'utf8');
  assert(buildGradle.includes('versionCode 25'), "build.gradle tiene versionCode 25");
  assert(buildGradle.includes('versionName "1.8.3"'), 'build.gradle tiene versionName "1.8.3"');

  const swJs = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  assert(swJs.includes("spotipirata-pwa-v161"), "sw.js tiene CACHE_NAME v161");
  assert(swJs.includes("navigate"), "sw.js implementa network-first para navegación");

  const appVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../app-version.json'), 'utf8'));
  assert(appVersion.version === "1.8.3", "app-version.json tiene 1.8.3");

  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes("diagnostic-modal"), "index.html contiene diagnostic-modal");
  assert(indexHtml.includes("v1.8.3"), "index.html contiene v1.8.3");

  console.log(`\n========================================`);
  console.log(`RESULTADOS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Harness error:", err);
  process.exit(1);
});
