package com.hss.allinone;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.text.TextUtils;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Handles web file downloads using Android DownloadManager with proper permissions and notification.
 */
public class DownloadHandler {

    public static final int REQUEST_WRITE_STORAGE = 1001;

    private final Activity activity;

    public DownloadHandler(Activity activity) {
        this.activity = activity;
    }

    /**
     * Initiates download for a given URL.
     */
    public void downloadFile(String url, String userAgent, String contentDisposition, String mimeType) {
        if (TextUtils.isEmpty(url)) {
            Toast.makeText(activity, "Invalid download URL", Toast.LENGTH_SHORT).show();
            return;
        }

        // Check storage permission for Android 9 (API 28) and below
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(activity, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        activity,
                        new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        REQUEST_WRITE_STORAGE
                );
                Toast.makeText(activity, R.string.permission_storage_required, Toast.LENGTH_LONG).show();
                return;
            }
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

            // Extract file name
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            if (TextUtils.isEmpty(fileName) || fileName.endsWith(".bin")) {
                if (url.contains(".pdf")) {
                    fileName = "HSS_Document_" + System.currentTimeMillis() + ".pdf";
                } else if (url.contains(".jpg") || url.contains(".jpeg")) {
                    fileName = "HSS_Image_" + System.currentTimeMillis() + ".jpg";
                } else if (url.contains(".png")) {
                    fileName = "HSS_Image_" + System.currentTimeMillis() + ".png";
                }
            }

            // Set MIME type
            if (!TextUtils.isEmpty(mimeType)) {
                request.setMimeType(mimeType);
            }

            // Attach cookies for authenticated downloads (e.g. Firebase or session cookies)
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) {
                request.addRequestHeader("cookie", cookies);
            }
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }

            request.setDescription("Downloading " + fileName);
            request.setTitle(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

            // Save to public Downloads directory
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager != null) {
                downloadManager.enqueue(request);
                Toast.makeText(activity, activity.getString(R.string.download_started) + ": " + fileName, Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(activity, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }
}
