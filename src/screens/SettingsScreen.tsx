import React, { useRef, useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  Sparkles,
  ShieldAlert,
  Plus,
  User,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
  Smartphone,
  Globe,
  Check,
  FolderOpen,
  ArrowRight
} from 'lucide-react';
import {
  SchoolProfile,
  ClassInfo,
  ClassItem,
  TeacherInfo,
  Student,
  AttendanceRecord,
  Exam,
  ExamMarksRecord,
  Reminder
} from '../types';
import { StorageService } from '../utils/storage';
import { exportStudentsToCSV, exportAttendanceToCSV } from '../utils/csvHelper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { auth, googleProvider, signInWithPopup, signOut } from '../utils/firebase';
import { CloudSync, SyncStatus } from '../utils/cloudSync';
import { getNotificationStatus, requestNotificationPermission, ONESIGNAL_APP_ID } from '../utils/onesignal';

interface SettingsScreenProps {
  school: SchoolProfile;
  classInfo: ClassInfo;
  classesList?: ClassItem[];
  activeClassId?: string;
  teacher: TeacherInfo;
  students: Student[];
  attendance: AttendanceRecord[];
  exams: Exam[];
  examMarksMap: Record<string, ExamMarksRecord>;
  reminders: Reminder[];
  onOpenReminderModal: () => void;
  onOpenAddClass?: () => void;
  onSwitchClass?: (classId: string) => void;
  onDeleteClass?: (classId: string) => void;
  onDataRestored: () => void;
  onResetToDefaults: () => void;
  onClearAllData: () => void;
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  school,
  classInfo,
  classesList = [],
  activeClassId,
  teacher,
  students,
  attendance,
  exams,
  examMarksMap,
  reminders,
  onOpenReminderModal,
  onOpenAddClass,
  onSwitchClass,
  onDeleteClass,
  onDataRestored,
  onResetToDefaults,
  onClearAllData,
  onLogout
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);

  // Cloud Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(CloudSync.getStatus());
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(CloudSync.getLastSyncedAt());
  const [syncEmail, setSyncEmail] = useState<string | undefined>(CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email);
  const [firebaseUser, setFirebaseUser] = useState(auth?.currentUser || null);
  const [isSyncingAction, setIsSyncingAction] = useState(false);

  // OneSignal Push Notification State
  const [pushStatus, setPushStatus] = useState<{
    supported: boolean;
    permission: boolean;
    optedIn: boolean;
    subscriptionId?: string | null;
  }>({ supported: true, permission: false, optedIn: false });
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  useEffect(() => {
    getNotificationStatus().then(status => {
      setPushStatus(status);
    }).catch(() => {});
  }, []);

  const handleTogglePushPermission = async () => {
    try {
      setIsEnablingPush(true);
      const granted = await requestNotificationPermission();
      const status = await getNotificationStatus();
      setPushStatus(status);
      if (granted) {
        setSuccessMsg('Push notifications enabled! Device is subscribed to OneSignal and school broadcasts.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg('Notification permission was not granted. Please allow notifications in browser/Android settings.');
        setTimeout(() => setErrorMsg(null), 4000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error configuring push notifications');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsEnablingPush(false);
    }
  };

  useEffect(() => {
    const unsub = CloudSync.addListener((status, lastSynced, email) => {
      setSyncStatus(status);
      setLastSyncTime(lastSynced);
      setSyncEmail(email || CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email);
      setFirebaseUser(auth?.currentUser || null);
    });
    return unsub;
  }, [teacher?.email]);

  const handlePushToCloud = async () => {
    try {
      setIsSyncingAction(true);
      setErrorMsg(null);
      const success = await CloudSync.pushToCloud();
      if (success) {
        setSuccessMsg('All student records, timetables, and attendance pushed to cloud & synced with other devices!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg('Failed to sync to cloud. Please check your internet connection.');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error pushing to cloud');
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsSyncingAction(false);
    }
  };

  const handlePullFromCloud = async () => {
    try {
      setIsSyncingAction(true);
      setErrorMsg(null);

      const activeEmail = CloudSync.getActiveSyncEmail() || auth?.currentUser?.email || teacher?.email;

      if (auth?.currentUser) {
        const res = await CloudSync.fetchFromCloud(auth.currentUser);
        if (res.found) {
          onDataRestored();
          setSuccessMsg('Latest data retrieved from cloud and updated on this device!');
          setTimeout(() => setSuccessMsg(null), 3000);
          return;
        }
      }

      if (activeEmail) {
        const res = await CloudSync.fetchAccountByEmail(activeEmail);
        if (res.found && res.appData) {
          CloudSync.applyCloudBundle(res.appData);
          onDataRestored();
          setSuccessMsg(`Latest data for ${activeEmail} retrieved from cloud and updated on this device!`);
          setTimeout(() => setSuccessMsg(null), 3000);
          return;
        }
      }

      setErrorMsg('No existing cloud backup found for this account. Push your latest data first.');
      setTimeout(() => setErrorMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error fetching cloud data');
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsSyncingAction(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsSyncingAction(true);
      setErrorMsg(null);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        setFirebaseUser(res.user);
        if (res.user.email) {
          CloudSync.setActiveSyncEmail(res.user.email);
        }
        await CloudSync.pushToCloud(res.user);
        CloudSync.startRealtimeSync(res.user, onDataRestored);
        setSuccessMsg(`Connected to ${res.user.email}! Real-time cross-device sync active.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || 'Failed to connect Google account');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } finally {
      setIsSyncingAction(false);
    }
  };

  // Confirmation dialog states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Backup Export
  const handleExportBackup = () => {
    try {
      const backupJson = StorageService.exportAllDataAsJSON();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `HSS_ALL_IN_ONE_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMsg('Complete database backup JSON exported successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(`Failed to export backup: ${err.message}`);
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  // Restore Backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const success = StorageService.importBackupJSON(text);
        if (success) {
          onDataRestored();
          setSuccessMsg('Database restored successfully from backup!');
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setErrorMsg('Invalid backup file format. Please use a valid HSS JSON backup.');
          setTimeout(() => setErrorMsg(null), 3000);
        }
      } catch (err: any) {
        setErrorMsg('Corrupt backup file.');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Calculate approximate storage usage
  const approxStorageBytes = (() => {
    let total = 0;
    try {
      for (let key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith('hss_')) {
          const itemVal = localStorage.getItem(key);
          if (itemVal) {
            total += ((itemVal?.length || 0) + (key?.length || 0)) * 2;
          }
        }
      }
    } catch (e) {
      console.warn('Storage calculation error:', e);
    }
    return (total / 1024).toFixed(1);
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-1">
          <Settings className="w-3.5 h-3.5" /> App Administration
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          SETTINGS & DATA MANAGEMENT
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Manage Google Account Cloud synchronization, local offline database backups, and storage.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-3 text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. GOOGLE ACCOUNT & AUTOMATIC CLOUD SYNC CARD */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1E1B2E] to-[#14161D] border border-purple-500/30 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Multi-Device Cloud Synchronization</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Realtime Active
                </span>
              </div>
              <p className="text-xs text-purple-200/70">
                Log into another phone, laptop, or tablet with the same email or Google account to access and edit your exact records in real-time.
              </p>
            </div>
          </div>

          {!firebaseUser && (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={isSyncingAction}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Connect Gmail Sync</span>
            </button>
          )}
        </div>

        {/* Sync Status Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#0F1115]/80 border border-[#2D3139]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Connected Multi-Device Email
            </span>
            <span className="font-bold text-white text-sm truncate block mt-0.5">
              {syncEmail || firebaseUser?.email || 'Active Email Account'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0F1115]/80 border border-[#2D3139]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Sync Status
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {syncStatus === 'syncing' || isSyncingAction ? (
                <span className="text-purple-300 font-bold flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synchronizing Changes...
                </span>
              ) : syncStatus === 'quota-exceeded' ? (
                <span className="text-amber-400 font-bold flex items-center gap-1.5" title="Firestore daily free write quota reached. Local offline database active.">
                  <AlertTriangle className="w-3.5 h-3.5" /> Local Offline Mode (Quota Limit)
                </span>
              ) : syncStatus === 'error' ? (
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Sync Offline / Local Storage
                </span>
              ) : (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> All Changes Saved to Cloud
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0F1115]/80 border border-[#2D3139]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Last Cloud Timestamp
            </span>
            <span className="font-mono text-slate-300 text-xs truncate block mt-0.5">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live (Instant)'}
            </span>
          </div>
        </div>

        {syncStatus === 'quota-exceeded' && (
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Firestore Free Daily Write Limit Reached</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Your data is 100% safe and actively preserved in local device storage. Cloud writes will automatically resume when the free daily quota resets, or you can manage project quotas directly in the Firebase Console.
            </p>
            <div className="pt-1">
              <a
                href="https://console.firebase.google.com/project/perfect-triumph-6ds98/firestore/databases/ai-studio-hssallinone-118fd682-5b2b-4225-b897-922c9c6c2fa8/data?openUpgradeDialog=true"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 underline hover:text-amber-100"
              >
                <span>Open Firebase Database Quota & Upgrade Settings &rarr;</span>
              </a>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handlePushToCloud}
            disabled={isSyncingAction}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Push Latest Changes to Cloud</span>
          </button>

          <button
            type="button"
            onClick={handlePullFromCloud}
            disabled={isSyncingAction}
            className="px-4 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] text-slate-200 border border-[#2D3139] font-bold text-xs transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pull & Restore Data from Another Device</span>
          </button>
        </div>
      </div>

      {/* ONESIGNAL PUSH NOTIFICATIONS & DEVICE ALERTS */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2D3139] gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">ONESIGNAL PUSH NOTIFICATIONS</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  pushStatus.permission
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {pushStatus.permission ? 'Active & Subscribed' : 'Permission Required'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                OneSignal App ID: <span className="font-mono text-slate-300 font-bold">{ONESIGNAL_APP_ID}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTogglePushPermission}
            disabled={isEnablingPush}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition flex items-center gap-2 active:scale-95 disabled:opacity-50 self-start sm:self-auto ${
              pushStatus.permission
                ? 'bg-[#0F1115] hover:bg-[#252830] text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-950/40'
            }`}
          >
            {pushStatus.permission ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Subscribed to Push Notifications</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>{isEnablingPush ? 'Requesting Permission...' : 'Enable Push Notifications'}</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Notification Status</span>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${pushStatus.permission ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {pushStatus.permission ? 'Notifications Allowed' : 'Permission Not Yet Granted'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Device State</span>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              Android APK / PWA Compatible
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Dashboard Directives</span>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              OneSignal Admin Broadcasts Active
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">Push Notifications & OneSignal Dashboard Testing</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              When push notifications are enabled on this device, broadcasts sent from your OneSignal Dashboard (with App ID <span className="font-mono text-amber-200">{ONESIGNAL_APP_ID}</span>) will be delivered whether the application is open, in the background, or closed.
            </p>
          </div>
        </div>
      </div>

      {/* MY CLASSES DIRECTORY & ROSTER MANAGER */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2D3139] gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">MY CLASSES DIRECTORY</h2>
              <p className="text-xs text-slate-400">
                Manage all registered classes ({classesList.length} configured). Switch active class or delete unneeded classes.
              </p>
            </div>
          </div>

          {onOpenAddClass && (
            <button
              type="button"
              onClick={onOpenAddClass}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition flex items-center gap-1.5 active:scale-95 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add New Class</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {classesList.map(item => {
            const isActive = item.id === activeClassId;
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                  isActive
                    ? 'bg-purple-900/20 border-purple-500 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/30'
                    : 'bg-[#0F1115] border-[#2D3139] hover:border-slate-600'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {item.academicYear || '2025-2026'}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active Class
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500">
                        Directory Entry
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-extrabold text-white">
                    {item.className}
                  </h4>

                  <p className="text-xs text-slate-400">
                    {item.stream} • Section {item.section} • <span className="font-mono text-cyan-300 font-bold">{item.classStrength || 0} Students</span>
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[#2D3139]">
                  {!isActive && onSwitchClass ? (
                    <button
                      type="button"
                      onClick={() => onSwitchClass(item.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow active:scale-95"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Switch Active</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Selected Class
                    </span>
                  )}

                  {classesList.length > 1 && onDeleteClass ? (
                    <button
                      type="button"
                      onClick={() => setClassToDelete(item)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition flex items-center gap-1.5 active:scale-95"
                      title={`Delete "${item.className}" from directory`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-600 font-medium italic">
                      Default Class
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. BACKUP & RESTORE */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D3139]">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Offline Database Backup & Restore</h2>
            <p className="text-xs text-slate-400">
              Export complete class data snapshot or restore to transfer to another device
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] hover:border-purple-500/40 text-left transition space-y-2 group"
          >
            <div className="p-2.5 w-fit rounded-xl bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">
              EXPORT ALL DATA AS BACKUP
            </h3>
            <p className="text-xs text-slate-400">
              Download a single JSON file containing all students, attendance records, exam marks, and school profile.
            </p>
          </button>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] hover:border-blue-500/40 text-left transition space-y-2 group cursor-pointer"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleRestoreFile}
              className="hidden"
            />
            <div className="p-2.5 w-fit rounded-xl bg-blue-600/20 text-blue-300 group-hover:bg-blue-600 group-hover:text-white transition">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
              RESTORE FROM BACKUP
            </h3>
            <p className="text-xs text-slate-400">
              Select and restore an existing HSS ALL IN ONE backup JSON file to recover all data.
            </p>
          </div>
        </div>
      </div>

      {/* 2. TEACHER TASK REMINDERS */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#2D3139]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Teacher Task Reminders</h2>
              <p className="text-xs text-slate-400">
                {reminders.filter(r => !r.isCompleted).length} pending class tasks scheduled
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenReminderModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-900/30 transition flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Tasks</span>
          </button>
        </div>

        {reminders.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No tasks or reminders added yet.</p>
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 3).map(rem => (
              <div
                key={rem.id}
                className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      rem.isCompleted
                        ? 'bg-slate-600'
                        : rem.priority === 'high'
                        ? 'bg-rose-500'
                        : 'bg-indigo-400'
                    }`}
                  />
                  <div>
                    <p className={`font-semibold ${rem.isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>
                      {rem.title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {rem.date} at {rem.time}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    rem.isCompleted
                      ? 'bg-[#252830] text-slate-400'
                      : 'bg-indigo-500/10 text-indigo-300'
                  }`}
                >
                  {rem.isCompleted ? 'Completed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. TEACHER ACCOUNT & ACCESS PORTAL */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#2D3139]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Teacher Access & Profile</h2>
              <p className="text-xs text-slate-400">Currently logged in educator session</p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch / Sign Out</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Teacher Name</span>
            <span className="font-bold text-white text-sm">{teacher.teacherName || 'Prof. Lincy Thomas'}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Designation</span>
            <span className="font-bold text-purple-300 text-sm">{teacher.designation || 'Class Teacher'}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Assigned School</span>
            <span className="font-bold text-indigo-300 text-sm truncate block">{school.schoolName || "St. Sebastian's Higher Secondary School"}</span>
          </div>
        </div>
      </div>

      {/* 4. APP INFO & STORAGE STATS */}
      <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D3139]">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">App & Storage Diagnostics</h2>
            <p className="text-xs text-slate-400">Offline database memory footprint</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px]">App Version</span>
            <span className="font-bold text-white font-mono">2.4.0 (Gold)</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px]">Students Enrolled</span>
            <span className="font-bold text-purple-300 font-mono">{students.length}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px]">Attendance Records</span>
            <span className="font-bold text-emerald-300 font-mono">{attendance.length}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
            <span className="text-slate-500 block text-[10px]">Estimated Storage</span>
            <span className="font-bold text-cyan-300 font-mono">{approxStorageBytes} KB</span>
          </div>
        </div>
      </div>

      {/* 4. DANGER ZONE / RESET */}
      <div className="rounded-3xl bg-rose-950/20 border border-rose-500/30 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-rose-500/20">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Data Reset & Maintenance</h2>
            <p className="text-xs text-rose-300/80">Manage database wipe and test sample resets</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] hover:bg-[#252830] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Reset to Clean State</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe All Local Storage Data</span>
          </button>
        </div>
      </div>

      {/* Confirm Reset to Defaults Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset to Clean State?"
        message="This will clear all local records (students, attendance, exams, and marks) and start with a clean empty database."
        confirmLabel="Yes, Clear & Reset"
        isDestructive={false}
        onConfirm={() => {
          onResetToDefaults();
          setShowResetConfirm(false);
          setSuccessMsg('Local database reset to clean state successfully.');
          setTimeout(() => setSuccessMsg(null), 3000);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirm Wipe All Data Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Permanently Wipe All Data?"
        message="DANGER: This will delete ALL students, all attendance records, all exams, and all marks from local storage. This action CANNOT be undone unless you have a backup JSON."
        confirmLabel="Yes, Wipe Database"
        isDestructive={true}
        onConfirm={() => {
          onClearAllData();
          setShowClearConfirm(false);
          setSuccessMsg('All local database records cleared.');
          setTimeout(() => setSuccessMsg(null), 3000);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!classToDelete}
        title="Delete Class from Directory"
        message={`Are you sure you want to delete "${classToDelete?.className}"? This will permanently remove this class along with all enrolled students, attendance records, and exam marks.`}
        confirmLabel="Delete Class"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (classToDelete && onDeleteClass) {
            onDeleteClass(classToDelete.id);
            setClassToDelete(null);
          }
        }}
        onCancel={() => setClassToDelete(null)}
      />
    </div>
  );
};
