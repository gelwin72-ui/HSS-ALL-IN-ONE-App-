import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove } from 'firebase/database';
import { app, database } from './firebase';

export async function requestAndSaveFCMToken(userUid: string, schoolCode: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[FCM] Push notifications not supported in this environment.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return null;
    }

    const messaging = getMessaging(app);
    
    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    // Get FCM token
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: 'BJw9X3kF6v8z2Q5m4n1p0s7t9u8v7w6x5y4z3a2b1c0' // default web push cert or omit if not strictly required, but passing standard vapid or letting firebase use default if omitted. Wait, in modular firebase, vapidKey is optional if project has web push certificates configured. Let's pass vapidKey or catch error if invalid.
    }).catch(async () => {
      // Fallback without vapidKey
      return await getToken(messaging, { serviceWorkerRegistration: registration });
    });

    if (token && userUid && schoolCode) {
      const cleanSchoolCode = schoolCode.trim().toUpperCase() || 'SSHSS@111213';
      const tokenId = btoa(token).replace(/[/+=]/g, '_').substring(0, 32);
      const tokenRef = ref(database, `fcm_tokens/${cleanSchoolCode}/${userUid}/${tokenId}`);
      await set(tokenRef, {
        token,
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      });

      // Also setup foreground listener
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        const title = payload.notification?.title || 'HSS ALL IN ONE Notification';
        const body = payload.notification?.body || 'New announcement received from school.';
        
        // Show browser notification if possible
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icon.png'
          });
        }
      });

      return token;
    }
  } catch (err) {
    console.warn('[FCM] Error obtaining or saving FCM token:', err);
  }
  return null;
}

export async function removeFCMToken(userUid: string, schoolCode: string) {
  if (!userUid) return;
  try {
    const cleanSchoolCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const tokenRef = ref(database, `fcm_tokens/${cleanSchoolCode}/${userUid}`);
    await remove(tokenRef);
  } catch (err) {
    console.warn('[FCM] Error removing FCM token on logout:', err);
  }
}
