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
    <string name="app_name">EntrenaOffline v1.7</string>
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
    android:versionCode="8"
    android:versionName="1.7">

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

const nativeBackupStoreJava = `package com.entrena.offline;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;

/**
 * Almacén nativo atómico fuera de WebView IndexedDB/localStorage.
 * Usa escritura en .tmp + sync() de descriptor + renombrado atómico + .bak + copias diarias rotativas.
 */
public final class NativeBackupStore {
    private static final String TAG = "NativeBackupStore";
    private static final String DIR_NAME = "entrena_backups";
    private static final String FILE_MAIN = "entrena_state.json";
    private static final String FILE_BAK = "entrena_state.json.bak";
    private static final String FILE_TMP = "entrena_state.json.tmp";
    private static final String DAILY_PREFIX = "entrena_daily_";
    private static final int MAX_DAILY_BACKUPS = 7;

    private NativeBackupStore() {}

    public static synchronized boolean saveDurableState(Context context, String jsonState) {
        if (context == null || jsonState == null) return false;
        String trimmed = jsonState.trim();
        if (!isValidJsonObject(trimmed)) {
            Log.w(TAG, "Backup rechazado por JSON inválido");
            return false;
        }
        try {
            File dir = ensureDir(context);
            File mainFile = new File(dir, FILE_MAIN);
            File bakFile = new File(dir, FILE_BAK);
            File tmpFile = new File(dir, FILE_TMP);

            byte[] bytes = trimmed.getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream fos = new FileOutputStream(tmpFile, false)) {
                fos.write(bytes);
                fos.flush();
                fos.getFD().sync();
            }

            if (mainFile.exists() && isValidJsonFile(mainFile)) {
                try {
                    copyFile(mainFile, bakFile);
                } catch (Exception bakErr) {
                    Log.w(TAG, "No se pudo actualizar .bak: " + bakErr.getMessage());
                }
            }

            atomicReplace(tmpFile, mainFile);

            // Copia diaria rotativa (1 archivo por fecha, máx. 7 días)
            String dateKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            File dailyFile = new File(dir, DAILY_PREFIX + dateKey + ".json");
            File dailyTmp = new File(dir, DAILY_PREFIX + dateKey + ".tmp");
            try (FileOutputStream dfos = new FileOutputStream(dailyTmp, false)) {
                dfos.write(bytes);
                dfos.flush();
                dfos.getFD().sync();
            }
            atomicReplace(dailyTmp, dailyFile);
            pruneOldDailyFiles(dir);

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error guardando estado nativo: " + e.getMessage());
            return false;
        }
    }

    public static synchronized String loadDurableState(Context context) {
        if (context == null) return "";
        File dir = ensureDir(context);
        File mainFile = new File(dir, FILE_MAIN);
        File bakFile = new File(dir, FILE_BAK);

        String primary = readValidJson(mainFile);
        if (!primary.isEmpty()) return primary;

        String backup = readValidJson(bakFile);
        if (!backup.isEmpty()) {
            Log.w(TAG, "Principal corrupto o ausente; recuperado desde .bak");
            try {
                writeRawFile(mainFile, backup.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) {}
            return backup;
        }

        // Último recurso: diario más reciente
        File[] dailies = listDailyFilesSortedDesc(dir);
        for (File f : dailies) {
            String candidate = readValidJson(f);
            if (!candidate.isEmpty()) {
                Log.w(TAG, "Recuperado desde snapshot diario: " + f.getName());
                return candidate;
            }
        }
        return "";
    }

    public static synchronized String listSnapshotsJson(Context context) {
        JSONArray arr = new JSONArray();
        if (context == null) return arr.toString();
        File dir = ensureDir(context);
        File[] dailies = listDailyFilesSortedDesc(dir);
        for (File f : dailies) {
            arr.put(f.getName());
        }
        return arr.toString();
    }

    public static synchronized String loadSnapshotByName(Context context, String fileName) {
        if (context == null || fileName == null || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\\\")) {
            return "";
        }
        File dir = ensureDir(context);
        File target = new File(dir, fileName);
        return readValidJson(target);
    }

    private static File ensureDir(Context context) {
        File dir = new File(context.getFilesDir(), DIR_NAME);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private static File[] listDailyFilesSortedDesc(File dir) {
        File[] all = dir.listFiles();
        if (all == null) return new File[0];
        java.util.List<File> matched = new java.util.ArrayList<>();
        for (File f : all) {
            if (f.isFile()) {
                String name = f.getName();
                if (name.startsWith(DAILY_PREFIX) && name.endsWith(".json")) {
                    matched.add(f);
                }
            }
        }
        File[] files = matched.toArray(new File[0]);
        for (int i = 0; i < files.length - 1; i++) {
            for (int j = i + 1; j < files.length; j++) {
                if (files[j].getName().compareTo(files[i].getName()) > 0) {
                    File tmp = files[i];
                    files[i] = files[j];
                    files[j] = tmp;
                }
            }
        }
        return files;
    }

    private static void pruneOldDailyFiles(File dir) {
        File[] dailies = listDailyFilesSortedDesc(dir);
        for (int i = MAX_DAILY_BACKUPS; i < dailies.length; i++) {
            try {
                dailies[i].delete();
            } catch (Exception ignored) {}
        }
    }

    private static void copyFile(File src, File dst) throws Exception {
        byte[] data = readBytes(src);
        File tmp = new File(dst.getParentFile(), dst.getName() + ".copytmp");
        writeRawFile(tmp, data);
        atomicReplace(tmp, dst);
    }

    private static void writeRawFile(File target, byte[] data) throws Exception {
        try (FileOutputStream fos = new FileOutputStream(target, false)) {
            fos.write(data);
            fos.flush();
            fos.getFD().sync();
        }
    }

    private static void atomicReplace(File src, File dst) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Files.move(src.toPath(), dst.toPath(),
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
                return;
            } catch (Exception ignored) {
                Files.move(src.toPath(), dst.toPath(),
                        StandardCopyOption.REPLACE_EXISTING);
                return;
            }
        }
        if (dst.exists()) dst.delete();
        if (!src.renameTo(dst)) {
            throw new RuntimeException("No se pudo mover " + src.getName() + " a " + dst.getName());
        }
    }

    private static boolean isValidJsonFile(File file) {
        return !readValidJson(file).isEmpty();
    }

    private static String readValidJson(File file) {
        if (file == null || !file.exists() || !file.isFile() || file.length() == 0) return "";
        try {
            String raw = new String(readBytes(file), StandardCharsets.UTF_8).trim();
            return isValidJsonObject(raw) ? raw : "";
        } catch (Exception e) {
            return "";
        }
    }

    private static byte[] readBytes(File file) throws Exception {
        try (FileInputStream fis = new FileInputStream(file);
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int r;
            while ((r = fis.read(buf)) != -1) {
                bos.write(buf, 0, r);
            }
            return bos.toByteArray();
        }
    }

    private static boolean isValidJsonObject(String s) {
        return s != null && s.length() >= 2 && s.startsWith("{") && s.endsWith("}");
    }
}`;

const nativeBridgeJava = `package com.entrena.offline;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class EntrenaNativeBridge {
    private static final String TAG = "EntrenaNativeBridge";
    private final Context appContext;

    public EntrenaNativeBridge(Context context) {
        this.appContext = context.getApplicationContext();
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    @JavascriptInterface
    public boolean saveDurableBackup(String json) {
        return NativeBackupStore.saveDurableState(appContext, json);
    }

    @JavascriptInterface
    public String loadDurableBackup() {
        return NativeBackupStore.loadDurableState(appContext);
    }

    @JavascriptInterface
    public String listNativeSnapshots() {
        return NativeBackupStore.listSnapshotsJson(appContext);
    }

    @JavascriptInterface
    public String loadNativeSnapshot(String filename) {
        return NativeBackupStore.loadSnapshotByName(appContext, filename);
    }

    @JavascriptInterface
    public String exportBackupToDownloads(String filename, String jsonContent) {
        if (jsonContent == null || jsonContent.trim().isEmpty()) return "";
        String safeName = (filename == null || filename.trim().isEmpty())
                ? "entrena_offline_backup.json"
                : filename.replaceAll("[^a-zA-Z0-9._-]", "_");

        byte[] data = jsonContent.getBytes(StandardCharsets.UTF_8);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentResolver resolver = appContext.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/EntrenaOffline");
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        if (os != null) {
                            os.write(data);
                            os.flush();
                            return "Descargas/EntrenaOffline/" + safeName;
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "MediaStore fallback: " + e.getMessage());
            }
        }

        try {
            File extDir = appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (extDir == null) extDir = appContext.getFilesDir();
            if (!extDir.exists()) extDir.mkdirs();
            File outFile = new File(extDir, safeName);
            try (FileOutputStream fos = new FileOutputStream(outFile, false)) {
                fos.write(data);
                fos.flush();
                fos.getFD().sync();
            }
            return outFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e(TAG, "Error exportando backup: " + e.getMessage());
            return "";
        }
    }
}`;

const mainActivityJava = `package com.entrena.offline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.Window;
import android.graphics.Color;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST_CODE = 4412;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

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

        webView.addJavascriptInterface(new EntrenaNativeBridge(this), "EntrenaNative");
        webView.setWebChromeClient(new OfflineWebChromeClient(this));
        webView.setWebViewClient(new OfflineWebViewClient(this));
        webView.loadUrl("https://localhost/index.html");
    }

    public boolean launchFileChooser(ValueCallback<Uri[]> callback) {
        if (this.filePathCallback != null) {
            this.filePathCallback.onReceiveValue(null);
        }
        this.filePathCallback = callback;

        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain"});
            startActivityForResult(Intent.createChooser(intent, "Seleccionar copia JSON"), FILE_CHOOSER_REQUEST_CODE);
            return true;
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                fallback.addCategory(Intent.CATEGORY_OPENABLE);
                fallback.setType("*/*");
                startActivityForResult(Intent.createChooser(fallback, "Seleccionar copia JSON"), FILE_CHOOSER_REQUEST_CODE);
                return true;
            } catch (Exception ex) {
                if (this.filePathCallback != null) {
                    this.filePathCallback.onReceiveValue(null);
                    this.filePathCallback = null;
                }
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                if (results == null && resultCode == RESULT_OK && data != null && data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
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

import android.net.Uri;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

public class OfflineWebChromeClient extends WebChromeClient {
    private final MainActivity activity;

    public OfflineWebChromeClient(MainActivity activity) {
        this.activity = activity;
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        return activity != null && activity.launchFileChooser(filePathCallback);
    }

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

fs.writeFileSync(path.join(srcDir, 'NativeBackupStore.java'), nativeBackupStoreJava.trim());
fs.writeFileSync(path.join(srcDir, 'EntrenaNativeBridge.java'), nativeBridgeJava.trim());
fs.writeFileSync(path.join(srcDir, 'MainActivity.java'), mainActivityJava.trim());
fs.writeFileSync(path.join(srcDir, 'OfflineWebChromeClient.java'), offlineChromeJava.trim());
fs.writeFileSync(path.join(srcDir, 'OfflineWebViewClient.java'), offlineClientJava.trim());

const binDir = path.join(androidAppDir, 'bin');
if (fs.existsSync(binDir)) {
  fs.rmSync(binDir, { recursive: true, force: true });
}
fs.mkdirSync(binDir, { recursive: true });

execSync(`javac -source 8 -target 8 -cp "${platformJar}" -d "${binDir}" "${path.join(srcDir, 'NativeBackupStore.java')}" "${path.join(srcDir, 'EntrenaNativeBridge.java')}" "${path.join(srcDir, 'OfflineWebChromeClient.java')}" "${path.join(srcDir, 'OfflineWebViewClient.java')}" "${path.join(srcDir, 'MainActivity.java')}"`, { stdio: 'inherit' });
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

const finalApkPath = path.join(rootDir, 'EntrenaOffline_v1.7.apk');
execSync(
  `"${apksigner}" sign --ks "${keystorePath}" --ks-pass pass:entrena123 --out "${finalApkPath}" "${alignedApk}"`,
  { stdio: 'inherit' }
);
// Mantener también copia genérica
fs.copyFileSync(finalApkPath, path.join(rootDir, 'EntrenaOffline.apk'));
console.log('✓ APK firmado correctamente como EntrenaOffline_v1.7.apk');

// 11. Verificar firma
execSync(`"${apksigner}" verify --verbose "${finalApkPath}"`, { stdio: 'inherit' });

const stats = fs.statSync(finalApkPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('=====================================================');
console.log('  🎉 ¡APK GENERADO CON ÉXITO!');
console.log(`  Archivo: ${finalApkPath}`);
console.log(`  Tamaño:  ${sizeMb} MB`);
console.log('=====================================================');
