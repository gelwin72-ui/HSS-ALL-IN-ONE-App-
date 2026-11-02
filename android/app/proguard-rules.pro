# Add project specific ProGuard rules here.
# Keep WebKit and JavaScript interfaces
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebAppInterface methods
-keep class com.hss.allinone.WebAppInterface {
    public *;
}

# Keep Android WebKit classes
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}

# Keep models and config
-keep class com.hss.allinone.AppConfig { *; }

# Keep AndroidX core
-keep class androidx.webkit.** { *; }
-keep class androidx.swiperefreshlayout.** { *; }
