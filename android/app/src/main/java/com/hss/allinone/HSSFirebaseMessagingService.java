package com.hss.allinone;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Native Firebase Cloud Messaging Service for HSS ALL IN ONE.
 *
 * Receives background and foreground push notifications from the school administration,
 * routes notifications to distinct notification channels (Notices, Exams, Holidays, Messages),
 * enforces lockscreen privacy, and handles deep links into MainActivity.
 */
public class HSSFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "HSS_FCM_Service";
    public static final String PREFS_NAME = "hss_app_prefs";
    public static final String PREF_FCM_TOKEN = "fcm_token";

    // Notification Channel IDs
    public static final String CHANNEL_NOTICES = "hss_channel_notices";
    public static final String CHANNEL_EXAMS = "hss_channel_exams";
    public static final String CHANNEL_HOLIDAYS = "hss_channel_holidays";
    public static final String CHANNEL_ASSIGNMENTS = "hss_channel_assignments";
    public static final String CHANNEL_MESSAGES = "hss_channel_messages";
    public static final String CHANNEL_GENERAL = "hss_channel_general";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token received: " + token);

        // Store token in SharedPreferences
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();

        // Broadcast token locally so MainActivity can sync with WebView if active
        Intent intent = new Intent("com.hss.allinone.FCM_TOKEN_UPDATED");
        intent.putExtra("token", token);
        sendBroadcast(intent);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM message received from: " + remoteMessage.getFrom());

        // Extract title & body from Notification or Data payload
        String title = "HSS ALL IN ONE";
        String body = "New update from school.";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (remoteMessage.getNotification().getBody() != null) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        Map<String, String> data = remoteMessage.getData();
        if (data.containsKey("title")) {
            title = data.get("title");
        }
        if (data.containsKey("body")) {
            body = data.get("body");
        }

        String category = data.containsKey("category") ? data.get("category") : "notices";
        String targetUrl = data.containsKey("url") ? data.get("url") : AppConfig.TARGET_URL;

        // Show native notification
        showNotification(title, body, category, targetUrl);
    }

    /**
     * Builds and displays the Android Notification with the appropriate Channel and Deep Link.
     */
    private void showNotification(String title, String body, String category, String targetUrl) {
        createNotificationChannels();

        String channelId = getChannelIdForCategory(category);
        boolean isPrivate = "messages".equalsIgnoreCase(category);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(MainActivity.EXTRA_TARGET_URL, targetUrl);
        intent.putExtra(MainActivity.EXTRA_FROM_NOTIFICATION, true);

        int requestCode = (int) System.currentTimeMillis();
        int pendingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_ONE_SHOT;

        PendingIntent pendingIntent = PendingIntent.getActivity(this, requestCode, intent, pendingFlags);

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setContentIntent(pendingIntent)
                .setColor(Color.parseColor("#1E3A8A"))
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        // Lockscreen visibility: private for direct messages/sensitive notes
        if (isPrivate) {
            builder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        } else {
            builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        try {
            int notificationId = (int) (System.currentTimeMillis() % 100000);
            notificationManager.notify(notificationId, builder.build());
        } catch (SecurityException se) {
            Log.w(TAG, "Notification permission missing on Android 13+", se);
        }
    }

    /**
     * Resolves appropriate Notification Channel based on message category.
     */
    private String getChannelIdForCategory(String category) {
        if (category == null) return CHANNEL_GENERAL;
        switch (category.toLowerCase()) {
            case "notices":
                return CHANNEL_NOTICES;
            case "exams":
                return CHANNEL_EXAMS;
            case "holidays":
                return CHANNEL_HOLIDAYS;
            case "assignments":
                return CHANNEL_ASSIGNMENTS;
            case "messages":
                return CHANNEL_MESSAGES;
            default:
                return CHANNEL_GENERAL;
        }
    }

    /**
     * Creates all notification channels for Android 8.0+ (API 26+)
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. School Notices Channel (High Importance)
            NotificationChannel noticesChannel = new NotificationChannel(
                    CHANNEL_NOTICES,
                    "School Notices & Directives",
                    NotificationManager.IMPORTANCE_HIGH
            );
            noticesChannel.setDescription("Official circulars and principal broadcast directives.");
            noticesChannel.enableLights(true);
            noticesChannel.setLightColor(Color.BLUE);
            noticesChannel.enableVibration(true);
            manager.createNotificationChannel(noticesChannel);

            // 2. Exam Schedules Channel (High Importance)
            NotificationChannel examsChannel = new NotificationChannel(
                    CHANNEL_EXAMS,
                    "Exam Schedules & Results",
                    NotificationManager.IMPORTANCE_HIGH
            );
            examsChannel.setDescription("Examination schedules, revision timetables, and mark sheets.");
            examsChannel.enableLights(true);
            manager.createNotificationChannel(examsChannel);

            // 3. Holidays Channel (Default Importance)
            NotificationChannel holidaysChannel = new NotificationChannel(
                    CHANNEL_HOLIDAYS,
                    "Holidays & Calendar",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            holidaysChannel.setDescription("Institutional holidays and calendar changes.");
            manager.createNotificationChannel(holidaysChannel);

            // 4. Assignments Channel (Default Importance)
            NotificationChannel assignmentsChannel = new NotificationChannel(
                    CHANNEL_ASSIGNMENTS,
                    "Assignments & Homework",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            assignmentsChannel.setDescription("Classwork directives and assignment updates.");
            manager.createNotificationChannel(assignmentsChannel);

            // 5. Messages Channel (High Importance, Private)
            NotificationChannel messagesChannel = new NotificationChannel(
                    CHANNEL_MESSAGES,
                    "Direct Messages & Staff Greetings",
                    NotificationManager.IMPORTANCE_HIGH
            );
            messagesChannel.setDescription("Personal messages and staff birthday greetings.");
            messagesChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(messagesChannel);

            // 6. General Announcements Channel
            NotificationChannel generalChannel = new NotificationChannel(
                    CHANNEL_GENERAL,
                    "General Announcements",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("General school notifications.");
            manager.createNotificationChannel(generalChannel);
        }
    }
}
