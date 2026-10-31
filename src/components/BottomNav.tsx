import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  TrendingUp,
  FileText,
  Settings
} from 'lucide-react';

export type ScreenTab =
  | 'dashboard'
  | 'school_profile'
  | 'students'
  | 'attendance'
  | 'timetable'
  | 'exams'
  | 'progress'
  | 'reports'
  | 'settings';

interface BottomNavProps {
  activeTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'timetable', label: 'Timetable', icon: CalendarDays },
    { id: 'exams', label: 'Exams & Marks', icon: FileSpreadsheet },
    { id: 'progress', label: 'Trajectory', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A1C23]/95 backdrop-blur-xl border-t border-[#2D3139] px-1 py-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] transition-colors no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-0.5 sm:gap-1.5 px-1 w-full">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id as ScreenTab)}
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 sm:px-1.5 rounded-xl transition-all duration-200 active:scale-95 touch-manipulation ${
                isActive
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#252830]/60 border border-transparent'
              }`}
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center relative mb-0.5">
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-purple-400" />
                )}
              </div>
              <span className={`text-[8px] sm:text-[10px] font-medium tracking-tighter sm:tracking-tight truncate w-full text-center ${isActive ? 'text-purple-300 font-semibold' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
