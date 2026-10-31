package com.hss.allinone;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.hss.allinone.databinding.ActivityMainBinding;

/**
 * Main Activity for HSS ALL IN ONE Android Application.
 *
 * Connects directly to the live GitHub Pages website:
 * https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/
 *
 * Features:
 * - Live update loading on every launch
 * - High performance modern WebView container
 * - Full client-side Firebase Auth, Firestore, and Storage support
 * - Native File upload / Camera chooser (<input type="file">)
 * - Native Android DownloadManager integration
 * - In-app PDF Viewer & External PDF Intent support
 * - Branded offline/reconnect screen with auto-retry
 * - Swipe-down to Refresh
 * - Predictive Back navigation & double-tap to exit
 */
public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private DownloadHandler downloadHandler;
    private FileChooserHandler fileChooserHandler;
    private ConnectivityManager.NetworkCallback networkCallback;

    private boolean isOffline = false;
    private boolean isInitialLoaded = false;
    private long lastBackPressTime = 0;

    public static final String EXTRA_TARGET_URL = "extra_target_url";
    public static final String EXTRA_FROM_NOTIFICATION = "extra_from_notification";

    // Activity Result Launcher for File Chooser
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (fileChooserHandler != null) {
                    fileChooserHandler.onActivityResult(result.getResultCode(), result.getData());
                }
            });

    // Permission Launcher
    private final ActivityResultLauncher<String[]> permissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                // Permissions handled
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        downloadHandler = new DownloadHandler(this);
        fileChooserHandler = new FileChooserHandler(this);

        setupBackNavigation();
        setupWebView();
        setupSwipeRefresh();
        setupNoInternetView();
        setupNetworkMonitoring();

        // Initialize Firebase Messaging and Token
        initFirebaseMessaging();

        // Request notification permission for Android 13+
        requestNotificationPermissionExplicit();

        // Handle incoming intent if launched via Push Notification
        if (getIntent() != null && getIntent().hasExtra(EXTRA_TARGET_URL)) {
            handleNotificationIntent(getIntent());
        } else {
            // Load the live target website
            loadTargetUrl();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent != null && intent.hasExtra(EXTRA_TARGET_URL)) {
            String targetUrl = intent.getStringExtra(EXTRA_TARGET_URL);
            if (targetUrl != null && !targetUrl.isEmpty() && binding != null && binding.webView != null) {
                hideNoInternetScreen();
                binding.webView.loadUrl(targetUrl);
                return;
            }
        }
        loadTargetUrl();
    }

    public void requestNotificationPermissionExplicit() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(new String[]{android.Manifest.permission.POST_NOTIFICATIONS});
            }
        }
    }

    private void initFirebaseMessaging() {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (task.isSuccessful() && task.getResult() != null) {
                            String token = task.getResult();
                            android.util.Log.d("MainActivity", "FCM token retrieved: " + token);
                            getSharedPreferences(HSSFirebaseMessagingService.PREFS_NAME, MODE_PRIVATE)
                                    .edit()
                                    .putString(HSSFirebaseMessagingService.PREF_FCM_TOKEN, token)
                                    .apply();
                        }
                    });
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "Firebase messaging initialization note:", e);
        }
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isOffline) {
                    finish();
                    return;
                }

                if (binding.webView.canGoBack()) {
                    binding.webView.goBack();
                } else {
                    if (AppConfig.ENABLE_DOUBLE_BACK_TO_EXIT) {
                        long currentTime = System.currentTimeMillis();
                        if (currentTime - lastBackPressTime < 2000) {
                            finish();
                        } else {
                            lastBackPressTime = currentTime;
                            Toast.makeText(MainActivity.this, R.string.press_again_to_exit, Toast.LENGTH_SHORT).show();
                        }
                    } else {
                        finish();
                    }
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebView webView = binding.webView;
        WebSettings settings = webView.getSettings();

        // Core JavaScript and Storage settings
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        // Responsive viewport and zoom
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        // Performance & live loading settings
        settings.setCacheMode(WebSettings.LOAD_DEFAULT); // Ensures latest live updates from GitHub Pages
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Security: HTTPS enforcement
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        // Append custom user agent identifier
        String defaultUserAgent = settings.getUserAgentString();
        settings.setUserAgentString(defaultUserAgent + AppConfig.USER_AGENT_SUFFIX);

        // Cookie configuration (Essential for Firebase & session persistence)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        // JavaScript Interface bridge
        if (AppConfig.ENABLE_JAVASCRIPT_BRIDGE) {
            webView.addJavascriptInterface(new WebAppInterface(this, downloadHandler), "AndroidApp");
        }

        // Download Listener
        if (AppConfig.ENABLE_DOWNLOAD_MANAGER) {
            webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                if (isPdfUrl(url) && AppConfig.ENABLE_IN_APP_PDF_VIEWER) {
                    openPdfViewer(url, "Document");
                } else {
                    downloadHandler.downloadFile(url, userAgent, contentDisposition, mimeType);
                }
            });
        }

        // WebChromeClient for Progress, Alerts, File Picking, Geolocation
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    binding.progressBar.setVisibility(View.VISIBLE);
                    binding.progressBar.setProgress(newProgress);
                } else {
                    binding.progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                return fileChooserHandler.onShowFileChooser(filePathCallback, fileChooserParams, fileChooserLauncher);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        // WebViewClient for navigation, error handling, scheme intercepting
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                binding.progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                binding.progressBar.setVisibility(View.GONE);
                binding.swipeRefreshLayout.setRefreshing(false);

                // Dismiss initial splash loader once first page has rendered
                if (!isInitialLoaded) {
                    isInitialLoaded = true;
                    binding.layoutLoading.setVisibility(View.GONE);
                }

                // Flush cookies to persistent storage
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().flush();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                String url = request.getUrl().toString();
                return handleUrlNavigation(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrlNavigation(url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showNoInternetScreen();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                    if (!NetworkUtils.isNetworkAvailable(MainActivity.this)) {
                        showNoInternetScreen();
                    }
                }
            }
        });
    }

    private boolean handleUrlNavigation(String url) {
        if (url == null) return false;

        // Check for PDF files or Firebase Storage PDF links
        if (isPdfUrl(url)) {
            if (AppConfig.ENABLE_IN_APP_PDF_VIEWER) {
                openPdfViewer(url, "PDF Document");
                return true;
            }
        }

        // Handle external schemes (WhatsApp, Phone, Email, SMS, Maps, YouTube, PlayStore)
        if (url.startsWith("whatsapp:") || url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("tel:")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("mailto:")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("sms:")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("geo:")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("intent://")) {
            return handleIntentScheme(url);
        } else if (url.startsWith("market://") || url.startsWith("https://play.google.com/store/")) {
            return launchExternalIntent(url);
        } else if (url.startsWith("https://www.youtube.com/") || url.startsWith("https://youtu.be/")) {
            return launchExternalIntent(url);
        }

        // Keep internal website navigation inside WebView
        if (url.startsWith("https://" + AppConfig.PRIMARY_DOMAIN) ||
            url.startsWith("http://" + AppConfig.PRIMARY_DOMAIN) ||
            url.contains("firebaseapp.com") ||
            url.contains("googleapis.com")) {
            return false; // Load inside WebView
        }

        // For other external HTTPS links, allow WebView navigation if desired, or open externally
        return false;
    }

    private boolean isPdfUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return lower.endsWith(".pdf") ||
               lower.contains(".pdf?") ||
               (lower.contains("firebasestorage.googleapis.com") && lower.contains(".pdf")) ||
               (lower.contains("drive.google.com/file/d/") && lower.contains("/view"));
    }

    private void openPdfViewer(String pdfUrl, String title) {
        try {
            Intent intent = new Intent(this, PdfViewerActivity.class);
            intent.putExtra(PdfViewerActivity.EXTRA_PDF_URL, pdfUrl);
            intent.putExtra(PdfViewerActivity.EXTRA_PDF_TITLE, title);
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            downloadHandler.downloadFile(pdfUrl, null, "attachment; filename=\"" + title + ".pdf\"", "application/pdf");
        }
    }

    private boolean launchExternalIntent(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.app_not_found, Toast.LENGTH_SHORT).show();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private boolean handleIntentScheme(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            if (intent != null) {
                if (getPackageManager().resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) != null) {
                    startActivity(intent);
                    return true;
                }
                // Fallback to market url if fallback string is provided
                String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                if (fallbackUrl != null) {
                    binding.webView.loadUrl(fallbackUrl);
                    return true;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return true;
    }

    private void setupSwipeRefresh() {
        if (!AppConfig.ENABLE_PULL_TO_REFRESH) {
            binding.swipeRefreshLayout.setEnabled(false);
            return;
        }

        binding.swipeRefreshLayout.setColorSchemeColors(
                getColor(R.color.primary),
                getColor(R.color.accent)
        );

        binding.swipeRefreshLayout.setOnRefreshListener(() -> {
            if (NetworkUtils.isNetworkAvailable(this)) {
                hideNoInternetScreen();
                binding.webView.reload();
            } else {
                binding.swipeRefreshLayout.setRefreshing(false);
                showNoInternetScreen();
            }
        });

        // Only allow swipe to refresh when WebView is at the very top
        binding.webView.getViewTreeObserver().addOnScrollChangedListener(() -> {
            binding.swipeRefreshLayout.setEnabled(binding.webView.getScrollY() == 0);
        });
    }

    private void setupNoInternetView() {
        binding.noInternetView.btnRetry.setOnClickListener(v -> {
            if (NetworkUtils.isNetworkAvailable(this)) {
                hideNoInternetScreen();
                loadTargetUrl();
            } else {
                Toast.makeText(this, R.string.no_internet_title, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setupNetworkMonitoring() {
        networkCallback = NetworkUtils.registerNetworkCallback(this, new NetworkUtils.NetworkStateListener() {
            @Override
            public void onNetworkAvailable() {
                runOnUiThread(() -> {
                    if (isOffline) {
                        hideNoInternetScreen();
                        loadTargetUrl();
                    }
                });
            }

            @Override
            public void onNetworkLost() {
                // Connection lost
            }
        });
    }

    private void loadTargetUrl() {
        if (!NetworkUtils.isNetworkAvailable(this)) {
            showNoInternetScreen();
            return;
        }

        hideNoInternetScreen();
        binding.webView.loadUrl(AppConfig.TARGET_URL);
    }

    private void showNoInternetScreen() {
        isOffline = true;
        binding.layoutLoading.setVisibility(View.GONE);
        binding.swipeRefreshLayout.setVisibility(View.GONE);
        binding.noInternetView.layoutNoInternet.setVisibility(View.VISIBLE);
    }

    private void hideNoInternetScreen() {
        isOffline = false;
        binding.noInternetView.layoutNoInternet.setVisibility(View.GONE);
        binding.swipeRefreshLayout.setVisibility(View.VISIBLE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        binding.webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        binding.webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (networkCallback != null) {
            NetworkUtils.unregisterNetworkCallback(this, networkCallback);
        }
        if (binding != null && binding.webView != null) {
            binding.webView.stopLoading();
            binding.webView.destroy();
        }
        super.onDestroy();
    }
}
