import React, { useEffect, useState } from 'react';
import { GraduationCap, Sparkles, BookOpen, Award, CheckCircle2 } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 100);
          return 100;
        }
        return prev + 40;
      });
    }, 60);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0F1115] px-6 py-12 text-white select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Tagline */}
      <div className="pt-6 text-center z-10 animate-fade-in">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
          <Sparkles className="w-3.5 h-3.5" /> Higher Secondary Education
        </span>
      </div>

      {/* Center Logo & Brand */}
      <div className="flex flex-col items-center text-center z-10 my-auto">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-purple-600/40 ring-4 ring-purple-500/20 animate-pulse">
            <GraduationCap className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg border-2 border-[#0F1115]">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-purple-300">
          HSS ALL IN ONE
        </h1>

        <p className="mt-2 text-base font-medium text-purple-200/90 tracking-wide">
          Smart School & Class Management
        </p>

        <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
          The Complete Smart Assistant for Higher Secondary School Teachers
        </p>

        {/* Feature Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1A1C23] border border-[#2D3139]">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Offline Database
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1A1C23] border border-[#2D3139]">
            <CheckCircle2 className="w-3 h-3 text-purple-400" /> Instant PDF Reports
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1A1C23] border border-[#2D3139]">
            <CheckCircle2 className="w-3 h-3 text-blue-400" /> Mark Calculation
          </span>
        </div>
      </div>

      {/* Bottom Loading Bar */}
      <div className="w-full max-w-xs flex flex-col items-center z-10 pb-6">
        <div className="w-full h-1.5 bg-[#1A1C23] rounded-full overflow-hidden mb-2 border border-[#2D3139]">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between w-full text-[11px] text-slate-400">
          <span>Loading Class Database...</span>
          <span className="font-mono">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
