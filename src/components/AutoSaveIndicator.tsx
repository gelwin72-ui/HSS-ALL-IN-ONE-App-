import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { CloudSync, SaveState } from '../utils/cloudSync';

export const AutoSaveIndicator: React.FC = () => {
  const [saveState, setSaveState] = useState<SaveState>(CloudSync.getSaveState());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleState = (state: SaveState) => {
      setSaveState(state);
      if (state === 'saving' || state === 'saved' || state === 'offline') {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    const unsub = CloudSync.addListener((_status, _time, _email, _report, currentSaveState) => {
      if (currentSaveState) {
        handleState(currentSaveState);
      }
    });

    const handleCustomEvent = (e: any) => {
      if (e.detail?.state) {
        handleState(e.detail.state);
      }
    };

    window.addEventListener('hss:cloud-save-state', handleCustomEvent);

    return () => {
      unsub();
      window.removeEventListener('hss:cloud-save-state', handleCustomEvent);
    };
  }, []);

  if (!visible || saveState === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none no-print transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xl border backdrop-blur-md ${
          saveState === 'saved'
            ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/20'
            : saveState === 'saving'
            ? 'bg-purple-950/85 text-purple-300 border-purple-500/40 ring-1 ring-purple-500/20'
            : 'bg-amber-950/85 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20'
        }`}
      >
        {saveState === 'saving' && (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>Saving changes to cloud...</span>
          </>
        )}
        {saveState === 'saved' && (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>✓ All changes saved to cloud</span>
          </>
        )}
        {saveState === 'offline' && (
          <>
            <CloudOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Saved offline (syncing on reconnect)</span>
          </>
        )}
      </div>
    </div>
  );
};
