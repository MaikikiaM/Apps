package com.entrena.offline;

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
}