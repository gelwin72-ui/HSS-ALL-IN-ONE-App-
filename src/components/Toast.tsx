import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface SingleToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<SingleToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 3000
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  let borderClass = 'border-slate-700 shadow-slate-950/50';
  let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

  if (type === 'success') {
    borderClass = 'border-emerald-500/50 shadow-emerald-950/40';
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
  } else if (type === 'error') {
    borderClass = 'border-rose-500/50 shadow-rose-950/40';
    icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
  } else if (type === 'warning') {
    borderClass = 'border-amber-500/50 shadow-amber-950/40';
    icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92vw] sm:w-auto animate-fade-in pointer-events-auto">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border backdrop-blur-md shadow-2xl text-white ${borderClass}`}
      >
        {icon}
        <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug">{message}</p>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        let bgClass = 'bg-slate-900 border-slate-700 text-white';
        let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

        if (toast.type === 'success') {
          bgClass = 'bg-slate-900 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/40';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
        } else if (toast.type === 'error') {
          bgClass = 'bg-slate-900 border-rose-500/50 text-white shadow-lg shadow-rose-950/40';
          icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
        } else if (toast.type === 'warning') {
          bgClass = 'bg-slate-900 border-amber-500/50 text-white shadow-lg shadow-amber-950/40';
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bgClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message && <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
