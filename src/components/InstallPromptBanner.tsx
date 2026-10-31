import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true until verified in useEffect

  const logoSrc = `${import.meta.env.BASE_URL || '/'}icon.png`;

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check dismissal cooldown (7 days)
    const dismissedTime = localStorage.getItem('hss_pwa_dismissed_at');
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
        return;
      }
    }
    setIsDismissed(false);

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edg/.test(userAgent);

    if (isIOSDevice && isSafari) {
      setIsIOS(true);
      setIsInstallable(true);
    }

    // 4. Listen for Chromium / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      setIsDismissed(false);
    };

    // 5. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowIOSInstructions(false);
    localStorage.setItem('hss_pwa_dismissed_at', Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(prev => !prev);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  };

  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  return (
    <div
      id="pwa-install-banner"
      role="region"
      aria-label="Install HSS ALL IN ONE Web App"
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md animate-fade-in"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#1A1C23]/95 border border-purple-500/30 p-4 shadow-2xl shadow-purple-950/50 backdrop-blur-xl transition-all">
        <div className="flex items-center gap-3.5">
          {/* Official HSS ALL IN ONE Logo */}
          <div className="relative shrink-0">
            <img
              src={logoSrc}
              alt="HSS ALL IN ONE Logo"
              width={46}
              height={46}
              className="w-11 h-11 rounded-xl object-contain shadow-md shadow-purple-900/40 border border-purple-500/30"
              onError={(e) => {
                // Fallback to favicon icon if needed
                (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL || '/'}pwa-192x192.png`;
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-black shadow">
              ✓
            </div>
          </div>

          {/* App Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white truncate">HSS ALL IN ONE</h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                Official App
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
              Install for instant offline access & PDF study reports
            </p>
          </div>

          {/* Close / Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            id="btn-install-pwa"
            onClick={handleInstallClick}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-950/40 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIOS ? (showIOSInstructions ? 'Hide Guide' : 'Add to Home Screen') : 'Install App'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="py-2 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Not Now
          </button>
        </div>

        {/* iOS Guided Instructions Tooltip */}
        {isIOS && showIOSInstructions && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 space-y-2 bg-[#0F1115]/70 p-3 rounded-xl">
            <p className="font-bold text-purple-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Install on Apple iOS (Safari):
            </p>
            <ol className="space-y-1 text-[11px] list-decimal list-inside text-slate-300">
              <li>
                Tap the <span className="font-bold text-white inline-flex items-center gap-0.5"><Share className="w-3 h-3 text-sky-400 inline" /> Share</span> icon at bottom of Safari.
              </li>
              <li>
                Scroll down and select <span className="font-bold text-white inline-flex items-center gap-0.5"><PlusSquare className="w-3 h-3 text-purple-400 inline" /> Add to Home Screen</span>.
              </li>
              <li>
                Tap <span className="font-bold text-white">Add</span> in the top right to complete.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
