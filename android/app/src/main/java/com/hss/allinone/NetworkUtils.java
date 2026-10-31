package com.hss.allinone;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

/**
 * Utility class to check and monitor network connectivity status.
 */
public class NetworkUtils {

    public interface NetworkStateListener {
        void onNetworkAvailable();
        void onNetworkLost();
    }

    /**
     * Checks if the device currently has an active internet connection.
     */
    public static boolean isNetworkAvailable(Context context) {
        if (context == null) return false;
        ConnectivityManager connectivityManager =
                (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network activeNetwork = connectivityManager.getActiveNetwork();
            if (activeNetwork == null) return false;
            NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(activeNetwork);
            return capabilities != null &&
                    (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                     capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                     capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
        } else {
            android.net.NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
            return activeNetworkInfo != null && activeNetworkInfo.isConnected();
        }
    }

    /**
     * Registers a network callback to receive realtime connection updates.
     */
    public static ConnectivityManager.NetworkCallback registerNetworkCallback(
            Context context,
            final NetworkStateListener listener) {

        if (context == null || listener == null) return null;
        final ConnectivityManager connectivityManager =
                (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return null;

        final Handler mainHandler = new Handler(Looper.getMainLooper());

        ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                mainHandler.post(listener::onNetworkAvailable);
            }

            @Override
            public void onLost(Network network) {
                mainHandler.post(listener::onNetworkLost);
            }
        };

        try {
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            connectivityManager.registerNetworkCallback(request, callback);
            return callback;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Unregisters the network callback.
     */
    public static void unregisterNetworkCallback(
            Context context,
            ConnectivityManager.NetworkCallback callback) {
        if (context == null || callback == null) return;
        try {
            ConnectivityManager connectivityManager =
                    (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null) {
                connectivityManager.unregisterNetworkCallback(callback);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
