import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { getNotificationStatus, requestNotificationPermission } from '../utils/onesignal';

const DISMISSED_KEY = 'hss_push_banner_dismissed_v1';

export const NotificationPermissionBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: boolean;
    optedIn: boolean;
    subscriptionId?: string | null;
  }>({ supported: true, permission: false, optedIn: false });

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      // Check if user already dismissed the prompt
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      const notifStatus = await getNotificationStatus();
      
      if (!isMounted) return;
      setStatus(notifStatus);

      // Only show banner if supported, not yet granted, and not recently dismissed
      if (notifStatus.supported && !notifStatus.permission && !dismissed) {
        // Slight delay so the UI loads smoothly first
        const timer = setTimeout(() => {
          if (isMounted) setIsVisible(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAllowNotifications = async () => {
    try {
      setIsRequesting(true);
      const granted = await requestNotificationPermission();
      const updatedStatus = await getNotificationStatus();
      setStatus(updatedStatus);

      if (granted) {
        localStorage.setItem(DISMISSED_KEY, 'granted');
        setTimeout(() => {
          setIsVisible(false);
        }, 1500);
      } else {
        localStorage.setItem(DISMISSED_KEY, 'denied_or_closed');
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
    localStorage.setItem(DISMISSED_KEY, 'dismissed_' + Date.now());
    setIsVisible(false);
  };

  if (!isVisible || !status.supported || status.permission) {
    return null;
  }

  return (
    <div
      id="onesignal-notification-permission-prompt"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 bg-[#1A1C23]/95 backdrop-blur-md border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-black/80 text-white animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 shrink-0">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
              OneSignal Push
            </span>
            <span className="text-xs text-slate-400 font-medium">HSS ALL IN ONE</span>
          </div>

          <h4 className="text-sm font-bold text-white mt-1">
            Enable Push Directives & Alerts?
          </h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Get instant institutional circulars, principal directives, and exam schedule updates directly on this device.
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <button
              id="btn-allow-push-notifications"
              type="button"
              onClick={handleAllowNotifications}
              disabled={isRequesting}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isRequesting ? (
                <span>Enabling...</span>
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
              className="px-3 py-1.5 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-300 font-medium text-xs border border-[#2D3139] transition active:scale-95"
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#252830] transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
