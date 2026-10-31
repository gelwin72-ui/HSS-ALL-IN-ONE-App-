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
  FolderOpen,
  Zap,
  Laptop,
  Smartphone,
  ShieldCheck,
  Radio,
  ExternalLink
} from 'lucide-react';
import { SchoolProfile, ClassInfo, ClassItem, TeacherInfo, SynthesisReport, ConnectedDevice } from '../types';
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
  const [isSynthesisPopoverOpen, setIsSynthesisPopoverOpen] = useState(false);
  const [synthesisReport, setSynthesisReport] = useState<SynthesisReport | null>(CloudSync.getSynthesisReport());
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const synthesisDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = CloudSync.addListener((status, lastSynced, email, report) => {
      setSyncStatus(status);
      setLastSyncTime(lastSynced);
      setActiveSyncEmail(email || CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email || undefined);
      if (report) {
        setSynthesisReport(report);
      }
    });
    return unsub;
  }, [teacher?.email]);

  const toggleSynthesisPopover = () => {
    const nextState = !isSynthesisPopoverOpen;
    setIsSynthesisPopoverOpen(nextState);
    if (nextState) {
      CloudSync.getConnectedDevices().then(setConnectedDevices).catch(() => {});
      setSynthesisReport(CloudSync.getSynthesisReport());
    }
  };

  const handleDeepSynthesis = async () => {
    setIsManualSyncing(true);
    const res = await CloudSync.forceDeepSynthesis();
    if (res.report) {
      setSynthesisReport(res.report);
    }
    const devs = await CloudSync.getConnectedDevices();
    setConnectedDevices(devs);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (synthesisDropdownRef.current && !synthesisDropdownRef.current.contains(event.target as Node)) {
        setIsSynthesisPopoverOpen(false);
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
            {/* Multi-Device Instant Data Synthesis Badge & Popover */}
            <div className="relative" ref={synthesisDropdownRef}>
              <button
                type="button"
                onClick={toggleSynthesisPopover}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:border-emerald-500/40 text-xs transition shadow-sm cursor-pointer group"
                title="Multi-Device Instant Data Synthesis. Click for details & device fleet."
              >
                {syncStatus === 'syncing' || isManualSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span className="hidden sm:inline text-[11px] font-bold text-purple-300">Synthesizing...</span>
                  </>
                ) : syncStatus === 'synced' || activeSyncEmail ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
                    <span className="hidden sm:inline text-[11px] font-bold text-emerald-300">Instant Synthesis</span>
                    {connectedDevices.length > 1 && (
                      <span className="hidden md:inline px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {connectedDevices.length} Devs
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Offline</span>
                  </>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSynthesisPopoverOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Instant Synthesis Popover Panel */}
              {isSynthesisPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#15171E] border border-[#2D3139] shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Instant Data Synthesis</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 uppercase">
                            Active
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          {activeSyncEmail || 'Local / Guest Mode'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeepSynthesis}
                      disabled={isManualSyncing}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                      title="Force deep synthesis across all devices"
                    >
                      <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                      <span>{isManualSyncing ? 'Merging...' : 'Synthesize'}</span>
                    </button>
                  </div>

                  {/* Synthesis Metrics Breakdown */}
                  {synthesisReport ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-[#0F1115] border border-[#252830]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Classes</span>
                        <span className="text-xs font-bold text-purple-300">{synthesisReport.classesSynthesized}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0F1115] border border-[#252830]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Students</span>
                        <span className="text-xs font-bold text-indigo-300">{synthesisReport.studentsSynthesized}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0F1115] border border-[#252830]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Attend</span>
                        <span className="text-xs font-bold text-emerald-300">{synthesisReport.attendanceSynthesized}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0F1115] border border-[#252830]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Exams</span>
                        <span className="text-xs font-bold text-amber-300">{synthesisReport.examsSynthesized}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#0F1115] border border-[#252830] text-center text-[11px] text-slate-400">
                      ⚡ Ready to synthesize data seamlessly across all devices.
                    </div>
                  )}

                  {/* Connected Devices Fleet */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      <span>Connected Device Fleet</span>
                      <span className="text-emerald-400 font-mono">{connectedDevices.length || 1} online</span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {connectedDevices.length > 0 ? (
                        connectedDevices.map(dev => (
                          <div
                            key={dev.deviceId}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                              dev.isCurrentDevice
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                : 'bg-[#0F1115] border-[#252830] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {dev.platform === 'Android APK' ? (
                                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}
                              <div className="truncate">
                                <span className="font-bold text-[11px] block truncate">{dev.name}</span>
                                <span className="text-[9px] text-slate-400 block truncate">{dev.platform}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 shrink-0">
                              {dev.isCurrentDevice ? 'This Device' : 'Synced'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 text-xs">
                          <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-bold text-[11px]">This Device (Instant Synthesis Active)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Non-Destructive Synthesis Guarantee */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-[10px] text-indigo-300 leading-tight">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Non-destructive bidirectional synthesis: student records, attendance, and exam marks are merged without data loss.</span>
                  </div>
                </div>
              )}
            </div>

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

