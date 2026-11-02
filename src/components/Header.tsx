import React, { useState, useRef, useEffect } from 'react';
import {
  School,
  Bell,
  Search,
  Sparkles,
  BookOpen,
  LogOut,
  ChevronDown,
  Check,
  Plus,
  Layers,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { SchoolProfile, ClassInfo, ClassItem, TeacherInfo } from '../types';
import { CloudSync, SyncStatus } from '../utils/cloudSync';
import { auth } from '../utils/firebase';
import { ConfirmDialog } from './ConfirmDialog';

interface HeaderProps {
  schoolName: string;
  schoolCode?: string;
  principalName?: string;
  classNameStr: string;
  classesList?: ClassItem[];
  activeClassId?: string;
  teacher?: TeacherInfo;
  pendingRemindersCount: number;
  onOpenSearch: () => void;
  onOpenReminders: () => void;
  onNavigateHome: () => void;
  onSwitchClass?: (classId: string) => void;
  onOpenAddClass?: () => void;
  onOpenManageClasses?: () => void;
  onDeleteClass?: (classId: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  schoolName,
  schoolCode,
  principalName,
  classNameStr,
  classesList = [],
  activeClassId,
  teacher,
  pendingRemindersCount,
  onOpenSearch,
  onOpenReminders,
  onNavigateHome,
  onSwitchClass,
  onOpenAddClass,
  onOpenManageClasses,
  onDeleteClass,
  onLogout
}) => {
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(CloudSync.getStatus());
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(CloudSync.getLastSyncedAt());
  const [activeSyncEmail, setActiveSyncEmail] = useState<string | undefined>(
    CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email || undefined
  );
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = CloudSync.addListener((status, lastSynced, email) => {
      setSyncStatus(status);
      setLastSyncTime(lastSynced);
      setActiveSyncEmail(email || CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email || undefined);
    });
    return unsub;
  }, [teacher?.email]);

  const handleForceSync = async () => {
    setIsManualSyncing(true);
    await CloudSync.pushToCloud();
    setTimeout(() => setIsManualSyncing(false), 500);
  };

  const teacherInitials = teacher?.teacherName
    ? teacher.teacherName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TR';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0F1115]/95 backdrop-blur-md border-b border-[#2D3139] transition-colors no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left Brand / School & Class Title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              onClick={onNavigateHome}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-950/40 shrink-0 ring-1 ring-purple-400/30 cursor-pointer hover:scale-105 transition"
            >
              <School className="w-5 h-5" />
            </div>

            <div className="min-w-0" id="header-school-brand-details">
              <div className="flex items-center gap-2">
                <h1 
                  onClick={onNavigateHome}
                  className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent truncate cursor-pointer max-w-[190px] sm:max-w-md"
                  title={schoolName || "St.Sebastian's Higher Secondary School"}
                >
                  {schoolName || "St.Sebastian's Higher Secondary School"}
                </h1>

                {/* Class Switcher Pill Button */}
                {classesList && classesList.length > 0 && onSwitchClass && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-600/15 hover:bg-purple-600/25 text-purple-300 border border-purple-600/30 transition shadow-sm"
                      title="Click to switch class or add new class"
                    >
                      <Layers className="w-3 h-3 text-purple-400" />
                      <span className="max-w-[130px] sm:max-w-[180px] truncate">{classNameStr || 'Select Class'}</span>
                      <ChevronDown className="w-3 h-3 text-purple-400 opacity-70" />
                    </button>

                    {/* Dropdown Menu */}
                    {isClassDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-2xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl shadow-black/80 py-2 z-50 animate-fade-in text-slate-200">
                        <div className="px-3.5 py-2 border-b border-[#2D3139] flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-400" /> Switch Active Class ({classesList.length})
                          </span>
                          <span className="text-[10px] font-semibold bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                            Multi-Class
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
                          {classesList.map(c => {
                            const isActive = c.id === activeClassId;
                            return (
                              <div
                                key={c.id}
                                className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition group/item rounded-lg ${
                                  isActive
                                    ? 'bg-purple-600/20 text-white font-bold border-l-2 border-purple-500'
                                    : 'text-slate-300 hover:bg-[#252830] hover:text-white'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSwitchClass) onSwitchClass(c.id);
                                    setIsClassDropdownOpen(false);
                                  }}
                                  className="flex-1 min-w-0 pr-2 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate">{c.className}</span>
                                    {isActive && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Active</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {c.stream} • {c.classStrength || 0} Students
                                  </div>
                                </button>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isActive && <Check className="w-4 h-4 text-purple-400 mr-1" />}
                                  {classesList.length > 1 && onDeleteClass && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setClassToDelete(c);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover/item:opacity-100 transition"
                                      title={`Delete "${c.className}" from directory`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-2 border-t border-[#2D3139] mt-1 space-y-1.5">
                          {onOpenManageClasses && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsClassDropdownOpen(false);
                                onOpenManageClasses();
                              }}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-[#252830] hover:bg-[#2e323c] text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-[#3b3f4a]"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Manage Classes Directory</span>
                            </button>
                          )}

                          {onOpenAddClass && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsClassDropdownOpen(false);
                                onOpenAddClass();
                              }}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Add New Additional Class</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 font-medium">
                {(() => {
                  const des = principalName || 'Principal';
                  return <span className="text-slate-400 shrink-0">{des}: {des}</span>;
                })()}
                {schoolCode && (
                  <span className="text-[10px] font-mono text-amber-400/90 font-bold shrink-0 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                    {schoolCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cloud Sync Status Badge */}
            <button
              type="button"
              onClick={handleForceSync}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:border-purple-500/40 text-xs transition shadow-sm cursor-pointer"
              title={
                activeSyncEmail
                  ? `Multi-device cloud synced with ${activeSyncEmail}. Click to force sync.`
                  : 'Click to sync data across your devices.'
              }
            >
              {syncStatus === 'syncing' || isManualSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span className="hidden sm:inline text-[11px] font-semibold text-purple-300">Syncing...</span>
                </>
              ) : syncStatus === 'synced' || activeSyncEmail ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-[11px] font-semibold text-emerald-300">Cloud Synced</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Offline</span>
                </>
              )}
            </button>

            {/* Quick Search */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-gray-300 hover:text-white hover:bg-[#252830] transition text-xs font-medium shadow-sm"
              title="Search students & records"
            >
              <Search className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">Quick Search</span>
              <kbd className="hidden lg:inline-block text-[10px] bg-[#252830] px-1.5 py-0.5 rounded text-gray-400 border border-[#2D3139] font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Reminder Alert Badge */}
            <button
              onClick={onOpenReminders}
              className="relative p-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-gray-300 hover:text-white hover:bg-[#252830] transition shadow-sm"
              title="Teacher Reminders & Tasks"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              {pendingRemindersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center shadow-lg shadow-rose-950/80 animate-pulse">
                  {pendingRemindersCount}
                </span>
              )}
            </button>

            {/* Teacher Badge (Desktop) */}
            {teacher && (
              <div className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-[#2D3139]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white font-bold text-xs flex items-center justify-center shadow-md overflow-hidden border border-purple-500/30">
                  {teacher.photoUrl ? (
                    <img
                      src={teacher.photoUrl}
                      alt={teacher.teacherName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : teacher.avatar ? (
                    <span className="text-base select-none">{teacher.avatar}</span>
                  ) : (
                    teacherInitials
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white truncate max-w-[110px]">
                    {teacher.teacherName}
                  </span>
                  <span className="text-[9px] text-gray-400 uppercase font-semibold tracking-tight truncate max-w-[110px]">
                    {teacher.designation || 'Class Teacher'}
                  </span>
                </div>
              </div>
            )}

            {/* Logout / Switch Profile Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-gray-400 hover:text-rose-400 hover:bg-[#252830] transition shadow-sm"
                title="Log out / Switch Teacher"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!classToDelete}
        title="Delete Class from Directory"
        message={`Are you sure you want to delete "${classToDelete?.className}"? All enrolled students, attendance records, and exam marks associated with this class will be permanently removed.`}
        confirmLabel="Delete Class"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (classToDelete && onDeleteClass) {
            onDeleteClass(classToDelete.id);
            setClassToDelete(null);
            setIsClassDropdownOpen(false);
          }
        }}
        onCancel={() => setClassToDelete(null)}
      />
    </header>
  );
};

