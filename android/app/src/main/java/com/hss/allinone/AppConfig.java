package com.hss.allinone;

/**
 * Global Configuration for HSS ALL IN ONE Android Application.
 *
 * The primary target URL is hosted on GitHub Pages:
 * https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/
 *
 * Any updates published to GitHub Pages are loaded live in this app
 * without requiring the user to reinstall or update the APK.
 */
public final class AppConfig {

    private AppConfig() {
        // Prevent instantiation
    }

    /**
     * Primary live web application URL.
     * Edit this constant if your GitHub Pages or domain URL changes in the future.
     */
    public static final String TARGET_URL = "https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/";

    /**
     * Primary domain allowed for internal navigation.
     */
    public static final String PRIMARY_DOMAIN = "gelwin72-ui.github.io";

    /**
     * Application Name
     */
    public static final String APP_NAME = "HSS ALL IN ONE";

    /**
     * Feature Flags
     */
    public static final boolean ENABLE_PULL_TO_REFRESH = true;
    public static final boolean ENABLE_JAVASCRIPT_BRIDGE = true;
    public static final boolean ENABLE_IN_APP_PDF_VIEWER = true;
    public static final boolean ENABLE_DOUBLE_BACK_TO_EXIT = true;
    public static final boolean ENABLE_DOWNLOAD_MANAGER = true;

    /**
     * User Agent suffix for identifying the Android APK container in analytics/scripts
     */
    public static final String USER_AGENT_SUFFIX = " HSS_Android_App/1.0.0";
}
