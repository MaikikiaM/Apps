package com.entrena.offline;

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
}