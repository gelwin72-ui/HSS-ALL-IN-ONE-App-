import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck, Sparkles, Smartphone, CheckCircle2 } from 'lucide-react';
import { requestAndSaveFCMToken, isRunningInAndroidApp, getCachedFCMToken } from '../utils/fcm';
import { auth } from '../utils/firebase';
import { StorageService } from '../utils/storage';

const DISMISSED_KEY = 'hss_push_banner_dismissed_v2';

export const NotificationPermissionBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isGranted, setIsGranted] = useState(false);
  const isAndroid = isRunningInAndroidApp();

  useEffect(() => {
    let isMounted = true;

    const checkPermissionState = async () => {
      // If already granted, don't show prompt
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setIsGranted(true);
          return;
        }
        if (Notification.permission === 'denied') {
          // If denied, respect user decision and do not repeatedly prompt
          return;
        }
      }

      // Check if user previously dismissed prompt
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        // Only re-check after 7 days if previously dismissed
        if (!isNaN(dismissedTime) && Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
      }

      // If running inside Android APK and notifications are already enabled
      if (isAndroid) {
        const androidApp = (window as any).AndroidApp;
        if (androidApp && androidApp.areNotificationsEnabled && androidApp.areNotificationsEnabled()) {
          setIsGranted(true);
          return;
        }
      }

      // Delay prompt slightly so the page and auth settle smoothly first
      const timer = setTimeout(() => {
        if (isMounted) setIsVisible(true);
      }, 2500);

      return () => clearTimeout(timer);
    };

    checkPermissionState();

    return () => {
      isMounted = false;
    };
  }, [isAndroid]);

  const handleAllowNotifications = async () => {
    try {
      setIsRequesting(true);

      const session = StorageService.getAuthSession();
      const userUid = auth?.currentUser?.uid || session.currentTeacher?.id || session.currentAdmin?.id || session.currentAdmin?.email || 'user';
      const schoolCode = session.currentTeacher?.schoolCode || session.currentAdmin?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
      const role = session.role || 'teacher';

      // Request and register token with FCM
      const token = await requestAndSaveFCMToken(userUid, schoolCode, role);

      if (token) {
        setIsGranted(true);
        localStorage.setItem(DISMISSED_KEY, 'granted');
        setTimeout(() => {
          setIsVisible(false);
        }, 1500);
      } else {
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
        setIsVisible(false);
      }
    } catch (err) {
      console.warn('Error enabling notifications from banner:', err);
      setIsVisible(false);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || isGranted) {
    return null;
  }

  return (
    <div
      id="fcm-notification-permission-prompt"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 bg-[#1E3A8A]/95 backdrop-blur-md border border-amber-400/40 rounded-2xl p-4 shadow-2xl shadow-black/80 text-white animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black tracking-wider uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
              {isAndroid ? 'Android FCM Push' : 'Firebase Web Push'}
            </span>
            <span className="text-xs text-blue-200 font-medium">HSS ALL IN ONE</span>
          </div>

          <h4 className="text-sm font-bold text-white mt-1">
            Enable Push Directives &amp; Alerts?
          </h4>
          <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
            Get instant institutional circulars, exam schedule updates, and principal directives delivered to this device.
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <button
              id="btn-allow-push-notifications"
              type="button"
              onClick={handleAllowNotifications}
              disabled={isRequesting}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-extrabold text-xs shadow-md shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isRequesting ? (
                <span>Registering Device...</span>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Allow Notifications</span>
                </>
              )}
            </button>

            <button
              id="btn-dismiss-push-prompt"
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-blue-200 font-medium text-xs border border-blue-700/50 transition active:scale-95 cursor-pointer"
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-blue-300 hover:text-white hover:bg-blue-800/50 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
