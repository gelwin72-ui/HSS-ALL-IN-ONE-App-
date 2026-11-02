import OneSignal from 'react-onesignal';

export const ONESIGNAL_APP_ID = 'e408c264-cc29-4f91-809f-1e5effc2b43d';

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initializes the OneSignal Web/PWA SDK
 */
export async function initOneSignal(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Determine service worker path dynamically for GitHub Pages sub-directories vs root domain
      const baseUrl = import.meta.env.BASE_URL || '/';
      const swPath = baseUrl.endsWith('/') ? `${baseUrl}OneSignalSDKWorker.js` : `${baseUrl}/OneSignalSDKWorker.js`;

      await (OneSignal.init as any)({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: swPath,
        serviceWorkerParam: { scope: baseUrl }
      });

      isInitialized = true;
      console.log('[OneSignal] Initialized successfully with App ID:', ONESIGNAL_APP_ID, 'SW Path:', swPath);

      // Register listener for foreground notifications
      try {
        OneSignal.Notifications?.addEventListener('foregroundWillDisplay', (event: any) => {
          console.log('[OneSignal] Foreground notification received:', event);
        });
      } catch (e) {
        // ignore listener attach error
      }

      // Register listener for notification clicks
      try {
        OneSignal.Notifications?.addEventListener('click', (event: any) => {
          console.log('[OneSignal] Notification clicked:', event);
          try {
            if (window.focus) window.focus();
          } catch (e) {
            // ignore window focus error
          }
        });
      } catch (e) {
        // ignore listener attach error
      }

      return true;
    } catch (error: any) {
      // Gracefully handle domain restrictions (e.g. App ID restricted to https://gelwin72-ui.github.io during dev preview)
      console.warn('[OneSignal] Initialization note (origin restriction or offline):', error?.message || error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Requests push notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await initOneSignal();
    const granted = await OneSignal.Notifications.requestPermission();
    console.log('[OneSignal] Permission request result:', granted);
    return OneSignal.Notifications.permission;
  } catch (error) {
    console.warn('[OneSignal] Error requesting notification permission:', error);
    // Fallback to native browser permission if OneSignal wrapper failed
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        return res === 'granted';
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}

/**
 * Checks if notifications are currently permitted and subscribed
 */
export async function getNotificationStatus(): Promise<{
  supported: boolean;
  permission: boolean;
  optedIn: boolean;
  subscriptionId?: string | null;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: false, optedIn: false };
  }

  try {
    await initOneSignal();
    const permission = OneSignal.Notifications.permission;
    const optedIn = OneSignal.User.PushSubscription.optedIn ?? false;
    const subscriptionId = OneSignal.User.PushSubscription.id || null;

    return {
      supported: true,
      permission,
      optedIn,
      subscriptionId
    };
  } catch (err) {
    return {
      supported: true,
      permission: Notification.permission === 'granted',
      optedIn: Notification.permission === 'granted'
    };
  }
}

/**
 * Associates the OneSignal subscription with the logged in user profile and tags
 */
export async function setOneSignalUser(params: {
  userId: string;
  email?: string;
  name?: string;
  role: 'teacher' | 'school_admin';
  schoolCode?: string;
  schoolName?: string;
  academicYear?: string;
  assignedClass?: string;
  subject?: string;
}) {
  try {
    await initOneSignal();

    if (params.userId) {
      // Login to associate OneSignal External ID
      await OneSignal.login(params.userId);
    }

    if (params.email) {
      try {
        await OneSignal.User.addEmail(params.email);
      } catch (e) {
        // email may already exist or fail gracefully
      }
    }

    // Set custom tags for segmented notifications from OneSignal Dashboard
    const tags: Record<string, string> = {
      role: params.role,
      app: 'HSS ALL IN ONE'
    };

    if (params.name) tags.name = params.name;
    if (params.schoolCode) tags.school_code = params.schoolCode.toUpperCase();
    if (params.schoolName) tags.school_name = params.schoolName;
    if (params.academicYear) tags.academic_year = params.academicYear;
    if (params.assignedClass) tags.assigned_class = params.assignedClass;
    if (params.subject) tags.subject = params.subject;

    await OneSignal.User.addTags(tags);
    console.log('[OneSignal] User tags set successfully:', tags);
  } catch (error) {
    console.warn('[OneSignal] Error setting user identity:', error);
  }
}

/**
 * Clears OneSignal user session on logout
 */
export async function logoutOneSignalUser() {
  try {
    await initOneSignal();
    await OneSignal.logout();
    console.log('[OneSignal] User logged out successfully');
  } catch (error) {
    console.warn('[OneSignal] Error during OneSignal logout:', error);
  }
}

export default OneSignal;
