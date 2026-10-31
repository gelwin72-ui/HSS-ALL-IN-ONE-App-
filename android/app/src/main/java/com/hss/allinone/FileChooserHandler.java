package com.hss.allinone;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Handles HTML5 file input (<input type="file">) and camera capture for Android WebView.
 */
public class FileChooserHandler {

    private final Activity activity;
    private ValueCallback<Uri[]> filePathCallback;
    private String cameraPhotoPath;

    public FileChooserHandler(Activity activity) {
        this.activity = activity;
    }

    /**
     * Handles WebChromeClient.onShowFileChooser call.
     */
    public boolean onShowFileChooser(
            ValueCallback<Uri[]> filePathCallback,
            WebChromeClient.FileChooserParams fileChooserParams,
            ActivityResultLauncher<Intent> fileChooserLauncher) {

        if (this.filePathCallback != null) {
            this.filePathCallback.onReceiveValue(null);
            this.filePathCallback = null;
        }

        this.filePathCallback = filePathCallback;

        Intent takePictureIntent = null;
        boolean captureMode = fileChooserParams.isCaptureEnabled();

        // Create camera intent if photos are allowed
        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (cameraIntent.resolveActivity(activity.getPackageManager()) != null) {
            File photoFile = null;
            try {
                photoFile = createImageFile();
            } catch (IOException ex) {
                ex.printStackTrace();
            }

            if (photoFile != null) {
                cameraPhotoPath = "file:" + photoFile.getAbsolutePath();
                Uri photoURI = FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        photoFile
                );
                cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI);
                takePictureIntent = cameraIntent;
            }
        }

        Intent contentSelectionIntent = fileChooserParams.createIntent();

        Intent[] intentArray;
        if (takePictureIntent != null) {
            intentArray = new Intent[]{takePictureIntent};
        } else {
            intentArray = new Intent[0];
        }

        Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
        chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
        chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select File or Take Photo");
        chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

        try {
            fileChooserLauncher.launch(chooserIntent);
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            if (this.filePathCallback != null) {
                this.filePathCallback.onReceiveValue(null);
                this.filePathCallback = null;
            }
            return false;
        }
    }

    /**
     * Handles the result from the file picker activity.
     */
    public void onActivityResult(int resultCode, Intent data) {
        if (filePathCallback == null) return;

        Uri[] results = null;

        if (resultCode == Activity.RESULT_OK) {
            if (data == null || data.getData() == null) {
                // Camera capture result
                if (cameraPhotoPath != null) {
                    results = new Uri[]{Uri.parse(cameraPhotoPath)};
                }
            } else {
                // File picker result
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int numSelectedFiles = data.getClipData().getItemCount();
                    results = new Uri[numSelectedFiles];
                    for (int i = 0; i < numSelectedFiles; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }
}
