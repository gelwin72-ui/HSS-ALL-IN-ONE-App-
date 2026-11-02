package com.hss.allinone;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.appbar.MaterialToolbar;
import com.hss.allinone.databinding.ActivityPdfViewerBinding;

import java.net.URLEncoder;

/**
 * High-performance Document and PDF viewer activity.
 * Supports viewing online PDFs, Firebase Storage PDFs, Google Drive PDFs,
 * sharing documents, and downloading locally.
 */
public class PdfViewerActivity extends AppCompatActivity {

    public static final String EXTRA_PDF_URL = "extra_pdf_url";
    public static final String EXTRA_PDF_TITLE = "extra_pdf_title";

    private ActivityPdfViewerBinding binding;
    private String pdfUrl;
    private String pdfTitle;
    private DownloadHandler downloadHandler;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityPdfViewerBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        pdfUrl = getIntent().getStringExtra(EXTRA_PDF_URL);
        pdfTitle = getIntent().getStringExtra(EXTRA_PDF_TITLE);
        if (pdfTitle == null || pdfTitle.isEmpty()) {
            pdfTitle = getString(R.string.pdf_viewer_title);
        }

        downloadHandler = new DownloadHandler(this);

        setupToolbar();
        setupWebView();
        loadPdf();
    }

    private void setupToolbar() {
        MaterialToolbar toolbar = binding.pdfToolbar;
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle(pdfTitle);
        }
        toolbar.setNavigationOnClickListener(v -> finish());
    }

    private void setupWebView() {
        WebSettings settings = binding.pdfWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        binding.pdfWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    binding.pdfProgressBar.setVisibility(View.VISIBLE);
                } else {
                    binding.pdfProgressBar.setVisibility(View.GONE);
                }
            }
        });

        binding.pdfWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                binding.pdfProgressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showErrorState();
                }
            }
        });

        binding.btnOpenPdfExternal.setOnClickListener(v -> openInExternalViewer());
    }

    private void loadPdf() {
        if (pdfUrl == null || pdfUrl.isEmpty()) {
            showErrorState();
            return;
        }

        binding.layoutPdfError.setVisibility(View.GONE);
        binding.pdfWebView.setVisibility(View.VISIBLE);
        binding.pdfProgressBar.setVisibility(View.VISIBLE);

        try {
            // Use Google Docs viewer as standard universal renderer for web PDFs
            String viewerUrl = "https://docs.google.com/gview?embedded=true&url=" + URLEncoder.encode(pdfUrl, "UTF-8");
            binding.pdfWebView.loadUrl(viewerUrl);
        } catch (Exception e) {
            e.printStackTrace();
            binding.pdfWebView.loadUrl(pdfUrl);
        }
    }

    private void showErrorState() {
        binding.pdfProgressBar.setVisibility(View.GONE);
        binding.pdfWebView.setVisibility(View.GONE);
        binding.layoutPdfError.setVisibility(View.VISIBLE);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.pdf_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == android.R.id.home) {
            finish();
            return true;
        } else if (id == R.id.action_download) {
            downloadPdf();
            return true;
        } else if (id == R.id.action_share) {
            sharePdf();
            return true;
        } else if (id == R.id.action_open_external) {
            openInExternalViewer();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void downloadPdf() {
        if (pdfUrl != null && !pdfUrl.isEmpty()) {
            downloadHandler.downloadFile(pdfUrl, null, "attachment; filename=\"" + pdfTitle + ".pdf\"", "application/pdf");
        }
    }

    private void sharePdf() {
        if (pdfUrl == null) return;
        try {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, pdfTitle);
            shareIntent.putExtra(Intent.EXTRA_TEXT, pdfUrl);
            startActivity(Intent.createChooser(shareIntent, getString(R.string.pdf_share)));
        } catch (Exception e) {
            Toast.makeText(this, "Unable to share link", Toast.LENGTH_SHORT).show();
        }
    }

    private void openInExternalViewer() {
        if (pdfUrl == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(pdfUrl), "application/pdf");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
        } catch (Exception e) {
            // If no dedicated PDF reader, open in default browser
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(pdfUrl));
                startActivity(browserIntent);
            } catch (Exception ex) {
                Toast.makeText(this, R.string.app_not_found, Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (binding != null && binding.pdfWebView != null) {
            binding.pdfWebView.stopLoading();
            binding.pdfWebView.destroy();
        }
        super.onDestroy();
    }
}
