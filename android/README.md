# HSS ALL IN ONE - Official Android Studio Project

This is the complete, compilable Android Studio project for **HSS ALL IN ONE**.

The APK is engineered as a high-performance, native web-container connected directly to your live GitHub Pages application:
**`https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/`**

---

## 🌟 Architecture & Live Update Mechanism

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    GitHub Repository                        │
  │     (https://github.com/gelwin72-ui/HSS-ALL-IN-ONE)         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Git Push / Auto Deploy
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    GitHub Pages Live Web                    │
  │       (https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/)       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Always fetched fresh
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              HSS ALL IN ONE Android Container               │
  │  - Native Hardware Acceleration & Chrome Engine             │
  │  - Firebase Auth / Realtime Database / Storage Support      │
  │  - Universal PDF Viewer & Downloader                        │
  │  - Native File Picker & Camera Upload (<input type="file">) │
  │  - Offline Screen & Auto-Reconnect Recovery                 │
  └─────────────────────────────────────────────────────────────┘
```

### 🔔 Firebase Cloud Messaging (FCM) Integration
The Android container includes native Firebase Cloud Messaging:
- ✅ **Native Push Notifications**: Delivers push notices even when the app is completely closed or device is locked.
- ✅ **Notification Channels**: Segregates alerts into Notices, Exam Schedules, Holidays, and Messages.
- ✅ **Lockscreen Privacy**: Protects private messages and directives on locked screens.
- ✅ **Deep Link Navigation**: Tapping a notification opens the exact target screen inside the WebView.
- ✅ **Bridge to Web App**: Shares native FCM token with JavaScript via `window.AndroidApp.getFcmToken()`.

### ⚡ What Updates Automatically (NO APK Rebuild Needed)
Whenever you push changes to your GitHub Pages repository:
- ✅ **All UI changes, pages, screens, and components** update immediately for users upon opening or refreshing the app.
- ✅ **New features, attendance logs, timetables, and exam records** update instantly.
- ✅ **Firebase Realtime Database & Auth updates** take effect immediately.
- ✅ **CSS styles, JavaScript logic, and HTML markup** are loaded live.

### 📦 What Requires Rebuilding the APK
You only need to rebuild a new APK / AAB if you want to change:
- Android App Name or Package ID (`com.hss.allinone`)
- App Launcher Icon or Android Splash Screen graphics
- Google Services configuration (`google-services.json`)
- Hardcoded Target URL in `AppConfig.java`

---

## 🚀 Quick Start: Building & Running in Android Studio

### 1. Open the Project
1. Launch **Android Studio** (Giraffe, Hedgehog, Iguana, Jellyfish, Koala, Ladybug, or newer).
2. Select **File > Open...** (or click **Open** from the welcome screen).
3. Navigate to and select the `android` folder.
4. Click **OK**.

### 2. Gradle Synchronization
Android Studio will automatically detect the Gradle files and start syncing dependencies.
- If prompted, ensure you are using **JDK 17** or **JDK 21** (Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK).
- Wait for the build index to finish (usually 1-2 minutes on first run).

### 3. Running on an Android Device or Emulator
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone via USB cable (or start an Android Studio Virtual Device / Emulator).
3. Click the green **Run (▶)** button in the top toolbar (or press `Shift + F10`).
4. The app will install and immediately load `https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/`.

---

## 🛠️ Generating APK & AAB Files

### Option A: Build Debug APK (For immediate testing & sharing with testers)
1. In Android Studio, go to the top menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
2. Once the build finishes, click the **locate** popup link in the bottom-right corner.
3. Your APK file will be located at:
   `app/build/outputs/apk/debug/app-debug.apk`

---

### Option B: Build Signed Release APK (For direct distribution / website download)
1. In Android Studio, go to **Build > Generate Signed Bundle / APK...**
2. Choose **APK** and click **Next**.
3. Create a new Keystore or choose an existing one:
   - **Key store path**: Choose a secure location on your computer.
   - **Password**: Enter your password.
   - **Key alias**: e.g., `hss_key`
   - **Validity**: 25+ years.
4. Select **release** build variant.
5. Check **V1 (Jar Signature)** and **V2 (Full APK Signature)** if shown.
6. Click **Finish**.
7. The release APK will be in:
   `app/build/outputs/apk/release/app-release.apk`

---

### Option C: Build Signed Android App Bundle - AAB (For Google Play Store)
1. Go to **Build > Generate Signed Bundle / APK...**
2. Choose **Android App Bundle** and click **Next**.
3. Select your Keystore credentials.
4. Select **release** build variant.
5. Click **Finish**.
6. The uploadable `.aab` file will be generated in:
   `app/build/outputs/bundle/release/app-release.aab`
7. Upload this `.aab` file directly to the **Google Play Console**.

---

## ⚙️ Configuration File: `AppConfig.java`

You can customize the target URL and features anytime in `app/src/main/java/com/hss/allinone/AppConfig.java`:

```java
package com.hss.allinone;

public final class AppConfig {
    // Primary URL loaded by the APK
    public static final String TARGET_URL = "https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/";

    // Allowed domain for in-app navigation
    public static final String PRIMARY_DOMAIN = "gelwin72-ui.github.io";

    // Feature Toggles
    public static final boolean ENABLE_PULL_TO_REFRESH = true;
    public static final boolean ENABLE_JAVASCRIPT_BRIDGE = true;
    public static final boolean ENABLE_IN_APP_PDF_VIEWER = true;
    public static final boolean ENABLE_DOUBLE_BACK_TO_EXIT = true;
    public static final boolean ENABLE_DOWNLOAD_MANAGER = true;
}
```

---

## 📱 Included Native Capabilities

| Feature | Android Implementation |
| :--- | :--- |
| **Live Updates** | Loads dynamic GitHub Pages version on every launch with zero cache stalling |
| **PDF Handling** | In-app Google Docs Viewer integration, download manager, and external PDF reader intent |
| **File Uploads** | WebChromeClient `onShowFileChooser` supporting gallery, files, and camera capture |
| **Downloads** | Android `DownloadManager` supporting PDFs, images, docs, with auto notifications |
| **External Links** | Native Android intents for WhatsApp (`wa.me`), phone calls (`tel:`), emails (`mailto:`), and YouTube |
| **Offline State** | Clean branded error view with real-time auto-reconnection and retry button |
| **Navigation** | Hardware back button history navigation with double-tap safety exit |
| **Firebase** | Full DOM Storage, IndexedDB, and third-party cookie persistence enabled |
