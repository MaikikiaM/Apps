package com.entrena.offline;

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
        if (context == null || fileName == null || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
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
}