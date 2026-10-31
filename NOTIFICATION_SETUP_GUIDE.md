# HSS ALL IN ONE - Push Notification Architecture & Configuration Guide

This guide documents the enterprise-grade **Firebase Cloud Messaging (FCM)** push notification system implemented across both the live **HSS ALL IN ONE** web application (hosted on GitHub Pages) and the compilable **Android Studio APK** container.

---

## 🌟 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    School Principal / Administrator    │
                      │  (Directives / Exams / Holidays / etc) │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Trusted Backend (server.ts / Cloud) │
                      │  - Firebase Admin SDK Multicast        │
                      │  - Role Authorization & Rate Limiting  │
                      │  - Automatic Stale Token Pruning       │
                      └───────────────────┬────────────────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     │                                         │
                     ▼                                         ▼
       ┌───────────────────────────┐             ┌───────────────────────────┐
       │     Firebase Web Push     │             │     Android Native APK    │
       │  - GitHub Pages Subpath   │             │  - FCM Service & Channels │
       │  - Service Worker Scope   │             │  - Lock-Screen Privacy    │
       │  - Foreground Toast & Sw  │             │  - In-App Deep Links      │
       └───────────────────────────┘             └───────────────────────────┘
```

---

## 📋 2. Supported Notification Event Categories

| Category | Description | Android Channel | Lockscreen Visibility |
| :--- | :--- | :--- | :--- |
| **📢 School Notices** | Principal circulars, official administrative directives | `hss_channel_notices` | Public |
| **📝 Exam Schedules** | Timetables, exam declarations, marks published | `hss_channel_exams` | Public |
| **🏖️ Holidays** | Special holidays and institutional schedule changes | `hss_channel_holidays` | Public |
| **📚 Assignments** | Homework and academic task assignments | `hss_channel_assignments` | Public |
| **💬 Staff Messages** | Staff greetings, birthday celebrations, direct notes | `hss_channel_messages` | **Private** (Hidden until unlocked) |
| **🔒 Account Updates** | Teacher credential approvals, account activations | `hss_channel_notices` | Public |

Users can selectively toggle any of these categories on and off in the **Settings > Firebase Push Notifications** screen.

---

## 🛠️ 3. Firebase Console Setup

### A. Web Push Configuration (VAPID Key)
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`hss-all-in-one`** (or create a new project).
3. Navigate to **Project Settings** (gear icon) > **Cloud Messaging** tab.
4. Under **Web configuration**, scroll to **Web Push certificates**.
5. Click **Generate key pair**.
6. Copy the generated **Key pair** (VAPID public key).
7. In your deployment environment or `.env` file, set:
   ```env
   VITE_FIREBASE_VAPID_KEY=your_generated_vapid_public_key_here
   ```
*(Note: If omitted, the web SDK gracefully falls back to the default project certificate.)*

### B. Android App Registration
1. In Firebase Console > **Project Settings** > **General** tab.
2. Under **Your apps**, click **Add app** > Select **Android** (robot icon).
3. Enter the Android package name:
   ```
   com.hss.allinone
   ```
4. App nickname: `HSS ALL IN ONE Android`
5. Click **Register app**.
6. Download `google-services.json`.
7. Place `google-services.json` inside the `android/app/` folder of your project:
   ```
   android/
     └── app/
          └── google-services.json   <-- (Place downloaded file here)
   ```
*(A pre-configured template file is already bundled in the repository.)*

---

## 🌐 4. GitHub Pages Deployment & Service Worker Scoping

The live application is hosted at:
```
https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/
```

### GitHub Pages Base Path Handling:
- The service worker file is located at `public/firebase-messaging-sw.js`.
- The Web client in `src/utils/fcm.ts` automatically detects whether the app is hosted under the GitHub Pages subpath `/HSS-ALL-IN-ONE/` or the root `/`, and registers the Service Worker with the matching scope:
  ```ts
  const basePath = window.location.pathname.startsWith('/HSS-ALL-IN-ONE') ? '/HSS-ALL-IN-ONE/' : '/';
  navigator.serviceWorker.register(`${basePath}firebase-messaging-sw.js`, { scope: basePath });
  ```
- Notification icons, badges, and click-action deep links automatically resolve relative to the client origin without 404 broken asset errors.

---

## 📱 5. Android Studio Project Build & Compilation

The compilable Android Studio project is located in `android/` and bundled as `public/HSS-ALL-IN-ONE-Android-Project.zip`.

### Key Native Components:
- **`HSSFirebaseMessagingService.java`**:
  - Handles `onNewToken` and stores the active token in Android `SharedPreferences`.
  - Handles `onMessageReceived` and creates notification channels (`hss_channel_notices`, `hss_channel_exams`, etc.).
  - Builds high-priority notifications with Android sound, vibration, and custom icons.
  - Enforces `VISIBILITY_PRIVATE` for sensitive staff messages.
- **`MainActivity.java`**:
  - Automatically requests the modern `POST_NOTIFICATIONS` runtime permission on Android 13+ (API 33+).
  - Fetches the active FCM token via `FirebaseMessaging.getInstance().getToken()`.
  - Handles incoming notification deep links (`EXTRA_TARGET_URL`) to navigate straight to the relevant screen when tapped.
- **`WebAppInterface.java`**:
  - Exposes `@JavascriptInterface public String getFcmToken()` and `areNotificationsEnabled()` so the web application seamlessly recognizes the native Android device token.

### Building in Android Studio:
1. Open Android Studio.
2. Select **File > Open** and choose the `android` folder.
3. Allow Gradle to synchronize dependencies.
4. To build a debug APK:
   ```bash
   ./gradlew assembleDebug
   ```
5. Output APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 6. Security Rules & Database Schema

### Realtime Database Rules (`database.rules.json`):
```json
{
  "rules": {
    "fcm_tokens": {
      "$schoolCode": {
        ".read": "auth != null",
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid == $uid"
        }
      }
    },
    "notification_preferences": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

### Cloud Firestore Rules (`firestore.rules`):
```javascript
match /fcm_tokens/{tokenId} {
  allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isSchoolAdmin(resource.data.schoolCode));
  allow create, update: if isSignedIn() && request.resource.data.userId == request.auth.uid;
  allow delete: if isSignedIn() && (resource.data.userId == request.auth.uid || isSchoolAdmin(resource.data.schoolCode));
}

match /notification_preferences/{userId} {
  allow read, write: if isSignedIn() && request.auth.uid == userId;
}
```

### Server-Side Backend Protection:
- All broadcasts sent through `/api/send-fcm` are authenticated using Firebase Auth ID Tokens (`Bearer <token>`).
- Rate limiting enforces a strict cap of 15 broadcasts per minute per school code.
- Stale or unregistered tokens are automatically pruned from the database upon delivery failure (`messaging/registration-token-not-registered`).

---

## 🧪 7. Safe Diagnostic & Verification Test Suite

Inside the app, navigate to **Settings > Firebase Push Notifications (FCM)** to run the 6 built-in verification tests:

1. **Test 1: In-App Foreground Test**
   - Triggers an instant in-app toast and browser foreground notification.
2. **Test 2: Background Web Push Test**
   - Dispatches a push notice with a 4-second delay so you can minimize the browser tab or lock your screen to verify background service worker delivery.
3. **Test 3: Android Lock-Screen Test**
   - Simulates notification channel priorities and validates that personal messages are configured with `VISIBILITY_PRIVATE`.
4. **Test 4: Real Event Trigger Test**
   - Dispatches a real exam schedule notification through the full FCM pipeline.
5. **Test 5: Permission-Denied Resilience Check**
   - Verifies that even if a user declines notifications, 100% of the application's attendance, marks, reports, PDF export, and cloud sync features remain fully operational.
6. **Test 6: Unauthorized User Security Audit**
   - Simulates an unauthenticated broadcast attempt to verify that the server strictly rejects unauthorized requests with an HTTP 403 Forbidden status code.
