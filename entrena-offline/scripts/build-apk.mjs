// scripts/build-apk.mjs
// Compilador y empaquetador automático de APK nativo de Android 100% offline
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
const sdkDir = path.join(localAppData, 'Android', 'Sdk');
const buildToolsDir = path.join(sdkDir, 'build-tools', '34.0.0');
const platformJar = path.join(sdkDir, 'platforms', 'android-34', 'android.jar');

const aapt2 = path.join(buildToolsDir, 'aapt2.exe');
const d8 = path.join(buildToolsDir, 'd8.bat');
const zipalign = path.join(buildToolsDir, 'zipalign.exe');
const apksigner = path.join(buildToolsDir, 'apksigner.bat');

console.log('--- 1. Verificando herramientas de Android SDK ---');
if (!fs.existsSync(platformJar)) throw new Error(`No se encontró ${platformJar}`);
if (!fs.existsSync(aapt2)) throw new Error(`No se encontró ${aapt2}`);
if (!fs.existsSync(d8)) throw new Error(`No se encontró ${d8}`);
if (!fs.existsSync(zipalign)) throw new Error(`No se encontró ${zipalign}`);
if (!fs.existsSync(apksigner)) throw new Error(`No se encontró ${apksigner}`);
console.log('✓ Android SDK 34 detectado y listo');

const androidAppDir = path.join(rootDir, 'android-app');
const existingKeystorePath = path.join(androidAppDir, 'release.keystore');
let savedKeystoreBuf = null;
if (fs.existsSync(existingKeystorePath)) {
  savedKeystoreBuf = fs.readFileSync(existingKeystorePath);
}
if (fs.existsSync(androidAppDir)) {
  fs.rmSync(androidAppDir, { recursive: true, force: true });
}
fs.mkdirSync(androidAppDir, { recursive: true });

// 2. Compilar frontend Vite con base relativa
console.log('--- 2. Compilando frontend Vite ---');
execSync('npm.cmd run build', { cwd: rootDir, stdio: 'inherit' });
const distDir = path.join(rootDir, 'dist');

// 3. Crear estructura de recursos Android (res)
console.log('--- 3. Generando recursos Android (iconos, strings, layout) ---');
const resDir = path.join(androidAppDir, 'res');
const valuesDir = path.join(resDir, 'values');
fs.mkdirSync(valuesDir, { recursive: true });

fs.writeFileSync(
  path.join(valuesDir, 'strings.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">EntrenaOffline v1.2</string>
</resources>`.trim()
);

// Copiar iconos en mipmap-*
const mipmapDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
const iconSrc = path.join(rootDir, 'public', 'pwa-512x512.png');
for (const mDir of mipmapDirs) {
  const targetDir = path.join(resDir, mDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(iconSrc, path.join(targetDir, 'ic_launcher.png'));
}
console.log('✓ Recursos Android e iconos generados');

// 4. AndroidManifest.xml
console.log('--- 4. Creando AndroidManifest.xml ---');
const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.entrena.offline"
    android:versionCode="3"
    android:versionName="1.2">

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="34" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

const manifestPath = path.join(androidAppDir, 'AndroidManifest.xml');
fs.writeFileSync(manifestPath, manifestXml.trim());
console.log('✓ AndroidManifest.xml creado');

// 5. Código Java nativo de WebView offline
console.log('--- 5. Compilando WebView nativo en Java ---');
const srcDir = path.join(androidAppDir, 'src', 'com', 'entrena', 'offline');
fs.mkdirSync(srcDir, { recursive: true });

const mainActivityJava = `package com.entrena.offline;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.Window;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0b1120"));
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);

        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebChromeClient(new OfflineWebChromeClient());
        webView.setWebViewClient(new OfflineWebViewClient(this));
        webView.loadUrl("https://localhost/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

const offlineChromeJava = `package com.entrena.offline;

import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;

public class OfflineWebChromeClient extends WebChromeClient {
    @Override
    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        Log.d("EntrenaJS", consoleMessage.message() + " -- Line "
                + consoleMessage.lineNumber() + " of "
                + consoleMessage.sourceId());
        return true;
    }
}`;

const offlineClientJava = `package com.entrena.offline;

import android.content.Context;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.net.URLConnection;

public class OfflineWebViewClient extends WebViewClient {
    private static final String TAG = "EntrenaOffline";
    private Context context;

    public OfflineWebViewClient(Context ctx) {
        this.context = ctx;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (url.startsWith("https://localhost") || url.startsWith("http://localhost")) {
            String path = request.getUrl().getPath();
            if (path != null && path.startsWith("/")) {
                path = path.substring(1);
            }
            if (path == null || path.isEmpty()) {
                path = "index.html";
            }

            try {
                InputStream is = context.getAssets().open(path);
                String mime = getMimeType(path);
                return new WebResourceResponse(mime, "UTF-8", is);
            } catch (Exception e) {
                if (path.endsWith(".html") || !path.contains(".")) {
                    try {
                        InputStream is = context.getAssets().open("index.html");
                        return new WebResourceResponse("text/html", "UTF-8", is);
                    } catch (Exception ignored) {}
                }
                Log.w(TAG, "Asset no encontrado: " + path);
                return null;
            }
        }
        return super.shouldInterceptRequest(view, request);
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".ico")) return "image/x-icon";
        String mime = URLConnection.guessContentTypeFromName(path);
        return mime != null ? mime : "application/octet-stream";
    }

    @Override
    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        Log.e(TAG, "Error WebView (" + errorCode + "): " + description + " en " + failingUrl);
    }
}`;

fs.writeFileSync(path.join(srcDir, 'MainActivity.java'), mainActivityJava.trim());
fs.writeFileSync(path.join(srcDir, 'OfflineWebChromeClient.java'), offlineChromeJava.trim());
fs.writeFileSync(path.join(srcDir, 'OfflineWebViewClient.java'), offlineClientJava.trim());

const binDir = path.join(androidAppDir, 'bin');
if (fs.existsSync(binDir)) {
  fs.rmSync(binDir, { recursive: true, force: true });
}
fs.mkdirSync(binDir, { recursive: true });

execSync(`javac -source 8 -target 8 -cp "${platformJar}" -d "${binDir}" "${path.join(srcDir, 'OfflineWebChromeClient.java')}" "${path.join(srcDir, 'OfflineWebViewClient.java')}" "${path.join(srcDir, 'MainActivity.java')}"`, { stdio: 'inherit' });
console.log('✓ Código Java compilado a .class (Java 8 compatible)');

// 6. Convertir bytecode a Dalvik DEX con d8
console.log('--- 6. Generando Dalvik DEX (classes.dex) ---');
const compiledClassFiles = fs.readdirSync(path.join(binDir, 'com', 'entrena', 'offline'))
  .filter(f => f.endsWith('.class'))
  .map(f => path.join(binDir, 'com', 'entrena', 'offline', f));

execSync(`"${d8}" --output "${binDir}" --lib "${platformJar}" ${compiledClassFiles.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
const dexFile = path.join(binDir, 'classes.dex');
if (!fs.existsSync(dexFile)) throw new Error('No se generó classes.dex');
console.log('✓ classes.dex generado con éxito');

// 7. Compilar recursos con aapt2
console.log('--- 7. Compilando y empaquetando recursos con aapt2 ---');
const compiledResZip = path.join(androidAppDir, 'res.zip');
execSync(`"${aapt2}" compile --dir "${resDir}" -o "${compiledResZip}"`, { stdio: 'inherit' });

const unalignedApk = path.join(androidAppDir, 'unaligned.apk');
execSync(
  `"${aapt2}" link -I "${platformJar}" --manifest "${manifestPath}" -o "${unalignedApk}" "${compiledResZip}"`,
  { stdio: 'inherit' }
);
console.log('✓ APK base empaquetado');

// 8. Inyectar classes.dex y assets asegurando barras inclinadas '/' con Python
console.log('--- 8. Inyectando classes.dex y assets web con barras estándar ---');
const packPy = path.join(__dirname, 'pack-apk.py');
execSync(`python "${packPy}" "${unalignedApk}" "${distDir}" "${dexFile}"`, { stdio: 'inherit' });
console.log('✓ classes.dex y assets inyectados con éxito');

// 9. Alinear APK con zipalign a 4 bytes
console.log('--- 9. Optimizando y alineando con zipalign ---');
const alignedApk = path.join(androidAppDir, 'aligned.apk');
execSync(`"${zipalign}" -v -p 4 "${unalignedApk}" "${alignedApk}"`, { stdio: 'pipe' });
console.log('✓ APK alineado a 4 bytes');

// 10. Reutilizar o crear keystore y firmar APK con apksigner
console.log('--- 10. Firmando APK con apksigner ---');
const keystorePath = path.join(androidAppDir, 'release.keystore');
if (savedKeystoreBuf) {
  fs.writeFileSync(keystorePath, savedKeystoreBuf);
  console.log('✓ Reutilizado release.keystore existente para conservar la firma');
} else {
  execSync(
    `keytool -genkeypair -v -keystore "${keystorePath}" -alias entrena -keyalg RSA -keysize 2048 -validity 10000 -storepass entrena123 -keypass entrena123 -dname "CN=Entrena, OU=App, O=Offline, L=Madrid, ST=Madrid, C=ES"`,
    { stdio: 'pipe' }
  );
}

const finalApkPath = path.join(rootDir, 'EntrenaOffline_v1.2.apk');
execSync(
  `"${apksigner}" sign --ks "${keystorePath}" --ks-pass pass:entrena123 --out "${finalApkPath}" "${alignedApk}"`,
  { stdio: 'inherit' }
);
// Mantener también copia genérica
fs.copyFileSync(finalApkPath, path.join(rootDir, 'EntrenaOffline.apk'));
console.log('✓ APK firmado correctamente como EntrenaOffline_v1.2.apk');

// 11. Verificar firma
execSync(`"${apksigner}" verify --verbose "${finalApkPath}"`, { stdio: 'inherit' });

const stats = fs.statSync(finalApkPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('=====================================================');
console.log('  🎉 ¡APK GENERADO CON ÉXITO!');
console.log(`  Archivo: ${finalApkPath}`);
console.log(`  Tamaño:  ${sizeMb} MB`);
console.log('=====================================================');
