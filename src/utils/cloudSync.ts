import {
  database,
  auth,
  FirebaseUser,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  firestore,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc,
  fsDeleteDoc,
  fsCollection,
  fsQuery,
  fsWhere,
  fsGetDocs,
  fsOnSnapshot,
  fsGetDocFromServer,
  testFirestoreConnection
} from './firebase';
import {
  SchoolProfile,
  ClassInfo,
  ClassItem,
  TeacherInfo,
  Student,
  AttendanceRecord,
  Exam,
  ExamMarksRecord,
  Reminder,
  AppSettings,
  TeacherAccount,
  TeacherActivityItem,
  SchoolAdminAccount,
  TimetableSlot,
  PrincipalBroadcast,
  AuditLogItem,
  SynthesisReport,
  ConnectedDevice
} from '../types';
import { StorageService, registerStorageMutationListener, setStorageMutationSilenced } from './storage';

export interface ClassScopedData {
  students: Student[];
  attendance: AttendanceRecord[];
  exams: Exam[];
  examMarksMap: Record<string, ExamMarksRecord>;
}

export interface UserCloudBundle {
  version: string;
  lastSyncedAt: string;
  deviceId?: string;
  schoolProfile: SchoolProfile;
  teacherInfo: TeacherInfo;
  classesCatalog: ClassItem[];
  activeClassId: string;
  classInfo: ClassInfo;
  reminders: Reminder[];
  settings: AppSettings;
  teacherAccounts: TeacherAccount[];
  schoolAdmins?: SchoolAdminAccount[];
  timetables?: TimetableSlot[];
  classData: Record<string, ClassScopedData>;
  students?: Student[];
  attendance?: AttendanceRecord[];
  exams?: Exam[];
  examMarks?: Record<string, ExamMarksRecord>;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'quota-exceeded';
export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export type SyncListener = (
  status: SyncStatus,
  lastSyncedAt?: string,
  userEmail?: string,
  report?: SynthesisReport | null,
  saveState?: SaveState
) => void;

class CloudSyncManager {
  private currentStatus: SyncStatus = 'idle';
  private saveState: SaveState = 'idle';
  private savedResetTimer: any = null;
  private retryTimer: any = null;
  private retryAttempt: number = 0;
  private lastSyncedAt: string | undefined = undefined;
  private listeners: Set<SyncListener> = new Set();
  private debounceTimer: any = null;
  private unsubscribeSnapshot: (() => void) | null = null;
  private unsubscribeEmailSnapshot: (() => void) | null = null;
  private unsubscribeFirestoreEmailSnapshot: (() => void) | null = null;
  private unsubscribeFirestoreUserSnapshot: (() => void) | null = null;
  private unsubscribeBroadcastsSnapshot: (() => void) | null = null;
  private isApplyingRemoteUpdate = false;
  private lastSavedPayloadHash: string = '';
  private quotaExhaustedUntil: number = 0;
  private activeSyncEmail: string | undefined = undefined;
  private lastSynthesisReport: SynthesisReport | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private deviceId: string = (() => {
    let id = '';
    try {
      id = localStorage.getItem('hss_client_device_id') || '';
    } catch {}
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      try {
        localStorage.setItem('hss_client_device_id', id);
      } catch {}
    }
    return id;
  })();

  constructor() {
    this.lastSyncedAt = localStorage.getItem('hss_last_cloud_sync') || undefined;
    this.activeSyncEmail = localStorage.getItem('hss_active_sync_email') || undefined;

    try {
      const storedReport = localStorage.getItem('hss_last_synthesis_report');
      if (storedReport) {
        this.lastSynthesisReport = JSON.parse(storedReport);
      }
    } catch {}

    // Check for pending offline changes from previous session
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hss_pending_offline_sync') === 'true') {
      this.saveState = 'offline';
      setTimeout(() => this.flushPendingOfflineSync(), 1500);
    }

    // Real-time Storage to Cloud Hook: Automatically trigger sync whenever local data is modified
    registerStorageMutationListener(() => {
      if (!this.isApplyingRemoteUpdate) {
        this.scheduleAutoSync();
      }
    });

    // Initialize BroadcastChannel for 0ms same-origin multi-tab instant synthesis
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('hss_instant_data_synthesis');
        this.broadcastChannel.onmessage = (event) => {
          if (!event?.data) return;
          const { type, report, deviceId } = event.data;
          if (deviceId === this.deviceId && (type === 'DATA_SYNTHESIS_APPLIED' || type === 'STORAGE_MUTATED')) {
            if (report) this.lastSynthesisReport = report;
            this.notify('synced');
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hss:cloud-sync-synthesized', { detail: { report, crossTab: true } }));
            }
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization note:', e);
      }
    }

    // Multi-tab storage event synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('hss_') && !this.isApplyingRemoteUpdate) {
          setTimeout(() => {
            this.notify(this.getStatus());
            window.dispatchEvent(new CustomEvent('hss:cloud-sync-synthesized', { detail: { crossTab: true } }));
          }, 15);
        }
      });

      // Background to foreground catch-up synthesis
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && !this.isApplyingRemoteUpdate) {
            this.scheduleCatchUpSync();
          }
        });
      }
      window.addEventListener('focus', () => {
        if (!this.isApplyingRemoteUpdate) {
          this.scheduleCatchUpSync();
        }
      });
      window.addEventListener('online', () => {
        console.log('[CloudSync] Network online restored. Flushing offline sync queue...');
        this.notify('syncing');
        this.flushPendingOfflineSync().catch(() => {});
        this.forceDeepSynthesis().catch(() => {});
      });
      window.addEventListener('offline', () => {
        console.log('[CloudSync] Network offline detected. Switching to offline safe persistence.');
        this.setSaveState('offline');
        this.notify('offline');
      });
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getSynthesisReport(): SynthesisReport | null {
    return this.lastSynthesisReport;
  }

  public detectDevicePlatform(): 'Android APK' | 'Web Browser' | 'PWA Mobile' | 'Mobile Browser' {
    if (typeof window === 'undefined') return 'Web Browser';
    const hasAndroidBridge = !!(window as any).AndroidBridge;
    const isWv = navigator.userAgent.includes('wv') || (navigator.userAgent.includes('Android') && navigator.userAgent.includes('Version/'));
    if (hasAndroidBridge || isWv) {
      return 'Android APK';
    }
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || (navigator as any).standalone) {
      return 'PWA Mobile';
    }
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      return 'Mobile Browser';
    }
    return 'Web Browser';
  }

  public getDeviceCustomName(): string {
    try {
      const stored = localStorage.getItem('hss_device_custom_name');
      if (stored) return stored;
    } catch {}
    const platform = this.detectDevicePlatform();
    if (platform === 'Android APK') return 'Android Mobile APK';
    if (platform === 'PWA Mobile') return 'Mobile PWA App';
    if (typeof navigator !== 'undefined') {
      if (navigator.userAgent.includes('Windows')) return 'Windows Workstation';
      if (navigator.userAgent.includes('Macintosh')) return 'Mac Desktop / Laptop';
      if (navigator.userAgent.includes('Linux')) return 'Linux Device';
      if (navigator.userAgent.includes('Android')) return 'Android Web Browser';
      if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) return 'iOS Safari Device';
    }
    return 'Web Browser Device';
  }

  public setDeviceCustomName(name: string) {
    if (!name || !name.trim()) return;
    try {
      localStorage.setItem('hss_device_custom_name', name.trim());
      this.scheduleAutoSync(true);
    } catch {}
  }

  private scheduleCatchUpSync() {
    const user = auth?.currentUser;
    const email = this.getActiveSyncEmail();
    if (!user && !email) return;

    if (database && email) {
      const emailKey = this.sanitizeEmailKey(email);
      get(ref(database, 'email_accounts/' + emailKey + '/lastSyncedAt')).then(snap => {
        if (snap.exists()) {
          const remoteTime = snap.val();
          if (remoteTime && remoteTime !== this.lastSyncedAt) {
            this.forceDeepSynthesis().catch(() => {});
          }
        }
      }).catch(() => {});
    }
  }

  public sanitizeEmailKey(email: string): string {
    return (email || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  public getStatus(): SyncStatus {
    if (this.quotaExhaustedUntil > Date.now()) {
      return 'quota-exceeded';
    }
    return this.currentStatus;
  }

  public getLastSyncedAt(): string | undefined {
    return this.lastSyncedAt;
  }

  public getActiveSyncEmail(): string | undefined {
    return this.activeSyncEmail || localStorage.getItem('hss_active_sync_email') || auth?.currentUser?.email || undefined;
  }

  public setActiveSyncEmail(email?: string) {
    if (email) {
      const clean = email.trim().toLowerCase();
      this.activeSyncEmail = clean;
      localStorage.setItem('hss_active_sync_email', clean);
    } else {
      this.activeSyncEmail = undefined;
      localStorage.removeItem('hss_active_sync_email');
    }
    this.notify(this.getStatus());
  }

  public getSaveState(): SaveState {
    return this.saveState;
  }

  public setSaveState(state: SaveState) {
    this.saveState = state;
    if (this.savedResetTimer) {
      clearTimeout(this.savedResetTimer);
      this.savedResetTimer = null;
    }
    if (state === 'saved') {
      this.savedResetTimer = setTimeout(() => {
        if (this.saveState === 'saved') {
          this.saveState = 'idle';
          this.notify(this.getStatus());
        }
      }, 2500);
    }
    this.notify(this.getStatus());

    if (typeof window !== 'undefined') {
      const dispatchStateEvent = () => {
        window.dispatchEvent(
          new CustomEvent('hss:cloud-save-state', {
            detail: { state: this.saveState, lastSyncedAt: this.lastSyncedAt }
          })
        );
      };
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(dispatchStateEvent);
      } else {
        setTimeout(dispatchStateEvent, 0);
      }
    }
  }

  public async flushPendingOfflineSync(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSaveState('offline');
      return false;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryAttempt = 0;
    const ok = await this.pushToCloud();
    if (ok) {
      try {
        localStorage.removeItem('hss_pending_offline_sync');
      } catch {}
    }
    return ok;
  }

  private scheduleOfflineRetry() {
    if (this.retryTimer) return;
    const delays = [2000, 5000, 10000, 20000];
    const delay = delays[Math.min(this.retryAttempt, delays.length - 1)];
    this.retryAttempt++;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const ok = await this.pushToCloud();
        if (ok) {
          try {
            localStorage.removeItem('hss_pending_offline_sync');
          } catch {}
          this.retryAttempt = 0;
        } else {
          this.scheduleOfflineRetry();
        }
      } else {
        this.scheduleOfflineRetry();
      }
    }, delay);
  }

  public addListener(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.getStatus(), this.lastSyncedAt, this.getActiveSyncEmail(), this.lastSynthesisReport, this.saveState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(status: SyncStatus, error?: any) {
    this.currentStatus = status;
    const userEmail = this.getActiveSyncEmail();
    this.listeners.forEach(fn => fn(this.getStatus(), this.lastSyncedAt, userEmail, this.lastSynthesisReport, this.saveState));
  }

  public gatherAllLocalData(): UserCloudBundle {
    const classes = StorageService.getClassesList();
    const activeClassId = StorageService.getActiveClassId();
    const classData: Record<string, ClassScopedData> = {};

    classes.forEach(c => {
      classData[c.id] = {
        students: StorageService.getStudents(c.id),
        attendance: StorageService.getAttendance(c.id),
        exams: StorageService.getExams(c.id),
        examMarksMap: StorageService.getExamMarksMap(c.id)
      };
    });

    const activeStudents = StorageService.getStudents(activeClassId);
    const activeAttendance = StorageService.getAttendance(activeClassId);
    const activeExams = StorageService.getExams(activeClassId);
    const activeMarks = StorageService.getExamMarksMap(activeClassId);

    return {
      version: '2.5.0',
      lastSyncedAt: new Date().toISOString(),
      deviceId: this.deviceId,
      schoolProfile: StorageService.getSchoolProfile(),
      teacherInfo: StorageService.getTeacherInfo(),
      classesCatalog: classes,
      activeClassId: activeClassId,
      classInfo: StorageService.getClassInfo(activeClassId),
      reminders: StorageService.getReminders(),
      settings: StorageService.getSettings(),
      teacherAccounts: StorageService.getTeacherAccounts(),
      schoolAdmins: StorageService.getSchoolAdmins(),
      timetables: StorageService.getTimetables(),
      classData,
      students: activeStudents,
      attendance: activeAttendance,
      exams: activeExams,
      examMarks: activeMarks
    };
  }

  // -------------------------------------------------------------
  // INTELLIGENT MULTI-DEVICE DATA SYNTHESIS ALGORITHMS
  // -------------------------------------------------------------

  public synthesizeClasses(local: ClassItem[] = [], remote: ClassItem[] = []): ClassItem[] {
    const map = new Map<string, ClassItem>();
    (remote || []).forEach(c => {
      if (c && c.id) map.set(c.id, { ...c });
    });
    (local || []).forEach(c => {
      if (c && c.id) {
        if (!map.has(c.id)) {
          map.set(c.id, { ...c });
        } else {
          const existing = map.get(c.id)!;
          map.set(c.id, {
            ...existing,
            ...c,
            id: c.id,
            className: c.className || existing.className,
            standard: c.standard || existing.standard,
            section: c.section || existing.section,
            stream: c.stream || existing.stream,
            academicYear: c.academicYear || existing.academicYear,
            classStrength: Math.max(c.classStrength || 0, existing.classStrength || 0)
          });
        }
      }
    });
    return Array.from(map.values());
  }

  public synthesizeStudentLists(local: Student[] = [], remote: Student[] = []): Student[] {
    const studentMap = new Map<string, Student>();
    const rollMap = new Map<number, string>(); // rollNo -> studentId

    const registerStudent = (st: Student) => {
      if (!st || !st.id) return;
      const rollNum = typeof st.rollNo === 'number' ? st.rollNo : parseInt(st.rollNo as any, 10) || 0;

      if (rollNum > 0 && rollMap.has(rollNum)) {
        const existingId = rollMap.get(rollNum)!;
        const existing = studentMap.get(existingId)!;
        studentMap.set(existingId, {
          ...existing,
          ...st,
          id: existingId,
          name: st.name || existing.name,
          rollNo: rollNum,
          admissionNo: st.admissionNo || existing.admissionNo,
          phone: st.phone || existing.phone,
          parentName: st.parentName || existing.parentName,
          parentPhone: st.parentPhone || existing.parentPhone,
          guardianPhone: st.guardianPhone || existing.guardianPhone,
          division: st.division || existing.division,
          gender: st.gender || existing.gender,
          dob: st.dob || existing.dob,
          address: st.address || existing.address,
          bloodGroup: st.bloodGroup || existing.bloodGroup,
          notes: st.notes || existing.notes,
          photoUrl: st.photoUrl || existing.photoUrl,
          avatar: st.avatar || existing.avatar,
          createdAt: existing.createdAt || st.createdAt
        });
        return;
      }

      if (studentMap.has(st.id)) {
        const existing = studentMap.get(st.id)!;
        studentMap.set(st.id, {
          ...existing,
          ...st,
          name: st.name || existing.name,
          rollNo: rollNum || existing.rollNo,
          admissionNo: st.admissionNo || existing.admissionNo,
          phone: st.phone || existing.phone,
          parentName: st.parentName || existing.parentName,
          parentPhone: st.parentPhone || existing.parentPhone,
          guardianPhone: st.guardianPhone || existing.guardianPhone,
          division: st.division || existing.division,
          gender: st.gender || existing.gender,
          dob: st.dob || existing.dob,
          address: st.address || existing.address,
          bloodGroup: st.bloodGroup || existing.bloodGroup,
          notes: st.notes || existing.notes,
          photoUrl: st.photoUrl || existing.photoUrl,
          avatar: st.avatar || existing.avatar,
          createdAt: existing.createdAt || st.createdAt
        });
      } else {
        studentMap.set(st.id, { ...st, rollNo: rollNum });
        if (rollNum > 0) rollMap.set(rollNum, st.id);
      }
    };

    (remote || []).forEach(registerStudent);
    (local || []).forEach(registerStudent);

    const result = Array.from(studentMap.values());
    result.sort((a, b) => a.rollNo - b.rollNo);
    return result;
  }

  public synthesizeAttendanceRecords(local: AttendanceRecord[] = [], remote: AttendanceRecord[] = []): AttendanceRecord[] {
    const attendanceMap = new Map<string, AttendanceRecord>();

    const mergeRecord = (rec: AttendanceRecord) => {
      if (!rec || !rec.date) return;
      const key = rec.date.trim();
      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, { ...rec });
      } else {
        const existing = attendanceMap.get(key)!;
        const presentSet = new Set<string>([
          ...(existing.presentStudentIds || []),
          ...(rec.presentStudentIds || [])
        ]);
        const absentSet = new Set<string>([
          ...(existing.absentStudentIds || []),
          ...(rec.absentStudentIds || [])
        ]);
        presentSet.forEach(id => absentSet.delete(id));

        attendanceMap.set(key, {
          ...existing,
          ...rec,
          id: existing.id || rec.id,
          date: key,
          presentStudentIds: Array.from(presentSet),
          absentStudentIds: Array.from(absentSet),
          notes: rec.notes || existing.notes,
          savedAt: rec.savedAt || existing.savedAt || new Date().toISOString()
        });
      }
    };

    (remote || []).forEach(mergeRecord);
    (local || []).forEach(mergeRecord);

    const result = Array.from(attendanceMap.values());
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }

  public synthesizeExamLists(local: Exam[] = [], remote: Exam[] = []): Exam[] {
    const examMap = new Map<string, Exam>();

    const mergeExam = (ex: Exam) => {
      if (!ex || !ex.id) return;
      if (!examMap.has(ex.id)) {
        examMap.set(ex.id, { ...ex });
      } else {
        const existing = examMap.get(ex.id)!;
        const subjectMap = new Map<string, any>();
        (existing.subjects || []).forEach(s => subjectMap.set(s.id || s.name, s));
        (ex.subjects || []).forEach(s => {
          const k = s.id || s.name;
          if (subjectMap.has(k)) {
            subjectMap.set(k, { ...subjectMap.get(k), ...s });
          } else {
            subjectMap.set(k, { ...s });
          }
        });

        examMap.set(ex.id, {
          ...existing,
          ...ex,
          id: ex.id,
          name: ex.name || existing.name,
          subjects: Array.from(subjectMap.values())
        });
      }
    };

    (remote || []).forEach(mergeExam);
    (local || []).forEach(mergeExam);

    return Array.from(examMap.values());
  }

  public synthesizeExamMarksMap(
    localMap: Record<string, ExamMarksRecord> = {},
    remoteMap: Record<string, ExamMarksRecord> = {}
  ): Record<string, ExamMarksRecord> {
    const result: Record<string, ExamMarksRecord> = {};
    const allExamIds = Array.from(new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})]));

    allExamIds.forEach(examId => {
      const localRec = localMap?.[examId];
      const remoteRec = remoteMap?.[examId];

      if (localRec && !remoteRec) {
        result[examId] = localRec;
      } else if (!localRec && remoteRec) {
        result[examId] = remoteRec;
      } else if (localRec && remoteRec) {
        const mergedMarks: Record<string, any> = {};
        const allStudentIds = Array.from(new Set([
          ...Object.keys(localRec.marks || {}),
          ...Object.keys(remoteRec.marks || {})
        ]));

        allStudentIds.forEach(studentId => {
          const localStMarks = localRec.marks?.[studentId];
          const remoteStMarks = remoteRec.marks?.[studentId];

          if (localStMarks && !remoteStMarks) {
            mergedMarks[studentId] = localStMarks;
          } else if (!localStMarks && remoteStMarks) {
            mergedMarks[studentId] = remoteStMarks;
          } else if (localStMarks && remoteStMarks) {
            const mergedSubjectMarks: Record<string, number | null> = {
              ...(localStMarks.marks || {}),
              ...(remoteStMarks.marks || {})
            };
            const mergedAbsent: Record<string, boolean> = {
              ...(localStMarks.isAbsent || {}),
              ...(remoteStMarks.isAbsent || {})
            };

            const total = Object.values(mergedSubjectMarks).reduce((acc: number, val) => {
              return acc + (typeof val === 'number' ? val : 0);
            }, 0);

            mergedMarks[studentId] = {
              ...localStMarks,
              ...remoteStMarks,
              studentId,
              marks: mergedSubjectMarks,
              isAbsent: mergedAbsent,
              totalObtained: total || localStMarks.totalObtained || remoteStMarks.totalObtained
            };
          }
        });

        result[examId] = {
          ...localRec,
          ...remoteRec,
          examId,
          marks: mergedMarks,
          updatedAt: new Date().toISOString()
        };
      }
    });

    return result;
  }

  public synthesizeTimetableSlots(local: TimetableSlot[] = [], remote: TimetableSlot[] = []): TimetableSlot[] {
    const slotMap = new Map<string, TimetableSlot>();
    (remote || []).forEach(s => {
      if (s && s.id) slotMap.set(s.id, { ...s });
    });
    (local || []).forEach(s => {
      if (s && s.id) {
        if (!slotMap.has(s.id)) {
          slotMap.set(s.id, { ...s });
        } else {
          slotMap.set(s.id, { ...slotMap.get(s.id)!, ...s, id: s.id });
        }
      }
    });
    return Array.from(slotMap.values());
  }

  public synthesizeRemindersList(local: Reminder[] = [], remote: Reminder[] = []): Reminder[] {
    const reminderMap = new Map<string, Reminder>();
    (remote || []).forEach(r => {
      if (r && r.id) reminderMap.set(r.id, { ...r });
    });
    (local || []).forEach(r => {
      if (r && r.id) {
        if (!reminderMap.has(r.id)) {
          reminderMap.set(r.id, { ...r });
        } else {
          const existing = reminderMap.get(r.id)!;
          reminderMap.set(r.id, {
            ...existing,
            ...r,
            id: r.id,
            isCompleted: existing.isCompleted || r.isCompleted
          });
        }
      }
    });
    const res = Array.from(reminderMap.values());
    res.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return res;
  }

  public synthesizeDataBundle(
    local: UserCloudBundle,
    remote: Partial<UserCloudBundle>,
    sourceDeviceId?: string
  ): { synthesized: UserCloudBundle; report: SynthesisReport } {
    const synthesizedClasses = this.synthesizeClasses(local.classesCatalog, remote.classesCatalog);

    // Synthesize classScopedData
    const synthesizedClassData: Record<string, ClassScopedData> = {};
    const allClassesIds = Array.from(new Set([
      ...synthesizedClasses.map(c => c.id),
      ...Object.keys(local.classData || {}),
      ...Object.keys(remote.classData || {})
    ]));

    let totalStudentsSynthesized = 0;
    let totalAttendanceSynthesized = 0;
    let totalExamsSynthesized = 0;
    let totalMarksSynthesized = 0;

    allClassesIds.forEach(cid => {
      const localScoped = local.classData?.[cid] || {
        students: cid === local.activeClassId ? (local.students || []) : [],
        attendance: cid === local.activeClassId ? (local.attendance || []) : [],
        exams: cid === local.activeClassId ? (local.exams || []) : [],
        examMarksMap: cid === local.activeClassId ? (local.examMarks || {}) : {}
      };

      const remoteScoped = remote.classData?.[cid] || {
        students: cid === remote.activeClassId ? (remote.students || []) : [],
        attendance: cid === remote.activeClassId ? (remote.attendance || []) : [],
        exams: cid === remote.activeClassId ? (remote.exams || []) : [],
        examMarksMap: cid === remote.activeClassId ? (remote.examMarks || {}) : {}
      };

      const synthStudents = this.synthesizeStudentLists(localScoped.students, remoteScoped.students);
      const synthAttendance = this.synthesizeAttendanceRecords(localScoped.attendance, remoteScoped.attendance);
      const synthExams = this.synthesizeExamLists(localScoped.exams, remoteScoped.exams);
      const synthMarks = this.synthesizeExamMarksMap(localScoped.examMarksMap, remoteScoped.examMarksMap);

      synthesizedClassData[cid] = {
        students: synthStudents,
        attendance: synthAttendance,
        exams: synthExams,
        examMarksMap: synthMarks
      };

      totalStudentsSynthesized += synthStudents.length;
      totalAttendanceSynthesized += synthAttendance.length;
      totalExamsSynthesized += synthExams.length;
      totalMarksSynthesized += Object.keys(synthMarks).length;
    });

    const synthesizedTimetables = this.synthesizeTimetableSlots(local.timetables, remote.timetables);
    const synthesizedReminders = this.synthesizeRemindersList(local.reminders, remote.reminders);

    // Synthesize teacher accounts & school admins
    const teacherAccountsMap = new Map<string, TeacherAccount>();
    (remote.teacherAccounts || []).forEach(t => t?.id && teacherAccountsMap.set(t.id, t));
    (local.teacherAccounts || []).forEach(t => t?.id && teacherAccountsMap.set(t.id, { ...teacherAccountsMap.get(t.id), ...t }));

    const schoolAdminsMap = new Map<string, SchoolAdminAccount>();
    (remote.schoolAdmins || []).forEach(a => a?.id && schoolAdminsMap.set(a.id, a));
    (local.schoolAdmins || []).forEach(a => a?.id && schoolAdminsMap.set(a.id, { ...schoolAdminsMap.get(a.id), ...a }));

    const activeCid = remote.activeClassId || local.activeClassId || synthesizedClasses[0]?.id || '';

    const synthesized: UserCloudBundle = {
      version: '2.5.0',
      lastSyncedAt: new Date().toISOString(),
      deviceId: this.deviceId,
      schoolProfile: { ...local.schoolProfile, ...(remote.schoolProfile || {}) },
      teacherInfo: { ...local.teacherInfo, ...(remote.teacherInfo || {}) },
      classesCatalog: synthesizedClasses,
      activeClassId: activeCid,
      classInfo: { ...local.classInfo, ...(remote.classInfo || {}) },
      reminders: synthesizedReminders,
      settings: { ...local.settings, ...(remote.settings || {}) },
      teacherAccounts: Array.from(teacherAccountsMap.values()),
      schoolAdmins: Array.from(schoolAdminsMap.values()),
      timetables: synthesizedTimetables,
      classData: synthesizedClassData,
      students: synthesizedClassData[activeCid]?.students || [],
      attendance: synthesizedClassData[activeCid]?.attendance || [],
      exams: synthesizedClassData[activeCid]?.exams || [],
      examMarks: synthesizedClassData[activeCid]?.examMarksMap || {}
    };

    const report: SynthesisReport = {
      studentsSynthesized: totalStudentsSynthesized,
      attendanceSynthesized: totalAttendanceSynthesized,
      examsSynthesized: totalExamsSynthesized,
      examMarksSynthesized: totalMarksSynthesized,
      classesSynthesized: synthesizedClasses.length,
      timetablesSynthesized: synthesizedTimetables.length,
      remindersSynthesized: synthesizedReminders.length,
      timestamp: new Date().toISOString(),
      sourceDeviceId: sourceDeviceId || remote.deviceId || 'cloud'
    };

    return { synthesized, report };
  }

  public applyCloudBundle(bundle: Partial<UserCloudBundle>, sourceDeviceId?: string): SynthesisReport {
    this.isApplyingRemoteUpdate = true;
    setStorageMutationSilenced(true);
    try {
      const local = this.gatherAllLocalData();
      const { synthesized, report } = this.synthesizeDataBundle(local, bundle, sourceDeviceId);

      if (synthesized.schoolProfile) {
        StorageService.saveSchoolProfile(synthesized.schoolProfile);
      }
      if (synthesized.teacherInfo) {
        StorageService.saveTeacherInfo(synthesized.teacherInfo);
      }
      if (synthesized.classesCatalog && Array.isArray(synthesized.classesCatalog) && synthesized.classesCatalog.length > 0) {
        StorageService.saveClassesList(synthesized.classesCatalog);
      }

      const session = StorageService.getAuthSession();
      const currentTeacher = session.currentTeacher;
      const targetClassId = synthesized.activeClassId || 
        StorageService.getActiveClassId(currentTeacher?.id || currentTeacher?.uid, currentTeacher?.email);
      if (targetClassId) {
        StorageService.setActiveClassId(targetClassId);
      }
      if (synthesized.classInfo) {
        StorageService.saveClassInfo(synthesized.classInfo, targetClassId);
      }
      if (synthesized.reminders) {
        StorageService.saveReminders(synthesized.reminders);
      }
      if (synthesized.settings) {
        StorageService.saveSettings(synthesized.settings);
      }
      if (synthesized.teacherAccounts && synthesized.teacherAccounts.length > 0) {
        StorageService.saveTeacherAccounts(synthesized.teacherAccounts);
      }
      if (synthesized.schoolAdmins && synthesized.schoolAdmins.length > 0) {
        StorageService.saveSchoolAdmins(synthesized.schoolAdmins);
      }
      if (synthesized.timetables) {
        StorageService.saveTimetables(synthesized.timetables);
      }

      if (synthesized.classData) {
        Object.entries(synthesized.classData).forEach(([classId, data]) => {
          if (data) {
            StorageService.saveStudents(data.students || [], classId);
            StorageService.saveAttendance(data.attendance || [], classId);
            StorageService.saveExams(data.exams || [], classId);
            StorageService.saveExamMarksMap(data.examMarksMap || {}, classId);
          }
        });

        // Ensure active class scoped data is also set to default active storage
        if (targetClassId && synthesized.classData[targetClassId]) {
          const activeScoped = synthesized.classData[targetClassId];
          StorageService.saveStudents(activeScoped.students || []);
          StorageService.saveAttendance(activeScoped.attendance || []);
          StorageService.saveExams(activeScoped.exams || []);
          StorageService.saveExamMarksMap(activeScoped.examMarksMap || {});
        }
      }

      if (bundle.lastSyncedAt) {
        this.lastSyncedAt = bundle.lastSyncedAt;
        localStorage.setItem('hss_last_cloud_sync', bundle.lastSyncedAt);
      }

      this.lastSynthesisReport = report;
      try {
        localStorage.setItem('hss_last_synthesis_report', JSON.stringify(report));
      } catch {}

      // Broadcast across open browser tabs / windows in 0ms
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'DATA_SYNTHESIS_APPLIED',
            report,
            deviceId: this.deviceId,
            timestamp: Date.now()
          });
        } catch {}
      }

      // Dispatch custom DOM event asynchronously to prevent React setState-in-render violations
      if (typeof window !== 'undefined') {
        const dispatchEvent = () => {
          window.dispatchEvent(new CustomEvent('hss:cloud-sync-synthesized', { detail: { report } }));
        };
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(dispatchEvent);
        } else {
          setTimeout(dispatchEvent, 0);
        }
      }

      const currentBundle = this.gatherAllLocalData();
      this.lastSavedPayloadHash = this.computeBundleHash(currentBundle);
      return report;
    } finally {
      setTimeout(() => {
        setStorageMutationSilenced(false);
        this.isApplyingRemoteUpdate = false;
      }, 100);
    }
  }

  private computeBundleHash(bundle: UserCloudBundle): string {
    return JSON.stringify({
      classes: bundle.classesCatalog,
      teacher: bundle.teacherInfo,
      school: bundle.schoolProfile,
      classData: bundle.classData,
      reminders: bundle.reminders,
      timetables: bundle.timetables
    });
  }

  public async pushToCloud(user?: FirebaseUser | null): Promise<boolean> {
    const currentUser = user || auth?.currentUser;
    let syncEmail = this.getActiveSyncEmail();

    if (!syncEmail) {
      const authSession = StorageService.getAuthSession();
      const candidate =
        authSession?.currentTeacher?.gmail ||
        authSession?.currentTeacher?.email ||
        authSession?.currentAdmin?.email ||
        currentUser?.email;
      if (candidate && candidate.includes('@')) {
        syncEmail = candidate.trim().toLowerCase();
        this.setActiveSyncEmail(syncEmail);
      }
    }

    if (!currentUser && !syncEmail) {
      this.setSaveState('offline');
      this.notify('offline');
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        localStorage.setItem('hss_pending_offline_sync', 'true');
      } catch {}
      this.setSaveState('offline');
      this.notify('offline');
      this.scheduleOfflineRetry();
      return false;
    }

    try {
      const bundle = this.gatherAllLocalData();
      const currentHash = this.computeBundleHash(bundle);

      if (currentHash === this.lastSavedPayloadHash && this.currentStatus === 'synced') {
        return true;
      }

      this.setSaveState('saving');
      this.notify('syncing');

      const promises: Promise<any>[] = [];
      const schoolCode = (bundle.schoolProfile.schoolCode || '').trim().toUpperCase();
      const activeSession = StorageService.getAuthSession();

      if (currentUser) {
        if (database) {
          const userRefPath = ref(database, 'users/' + currentUser.uid);
          promises.push(
            set(userRefPath, {
              userId: currentUser.uid,
              email: currentUser.email || syncEmail || '',
              displayName: currentUser.displayName || bundle.teacherInfo.teacherName || 'Teacher',
              photoURL: currentUser.photoURL || '',
              lastSyncedAt: bundle.lastSyncedAt,
              deviceId: this.deviceId,
              appData: bundle
            }).catch(e => console.warn('RTDB push users note:', e))
          );
        }

        if (firestore) {
          try {
            const userDocRef = fsDoc(firestore, 'users', currentUser.uid);
            promises.push(
              fsSetDoc(userDocRef, {
                userId: currentUser.uid,
                email: currentUser.email || syncEmail || '',
                displayName: currentUser.displayName || bundle.teacherInfo.teacherName || 'Teacher',
                lastSyncedAt: bundle.lastSyncedAt,
                deviceId: this.deviceId,
                schoolCode: schoolCode,
                role: activeSession.role || 'teacher',
                teacherAccount: activeSession.currentTeacher || null,
                adminAccount: activeSession.currentAdmin || null,
                appData: bundle
              }, { merge: true }).catch(e => console.warn('Firestore user doc sync note:', e))
            );
          } catch (fsErr) {
            console.warn('Firestore userDocRef note:', fsErr);
          }
        }
      }

      // Auto-sync current teacher profile to school directory in cloud
      const currentTeacherAcc = activeSession.currentTeacher || (bundle.teacherAccounts && bundle.teacherAccounts.length > 0 ? bundle.teacherAccounts[0] : null);
      if (schoolCode && currentTeacherAcc && currentTeacherAcc.name) {
        const cleanTId = currentTeacherAcc.uid || currentTeacherAcc.id || currentUser?.uid;
        const cleanTEmail = (currentTeacherAcc.email || currentTeacherAcc.gmail || currentUser?.email || '').trim().toLowerCase();
        if (cleanTId) {
          const teacherProfileRecord = {
            id: cleanTId,
            uid: cleanTId,
            name: currentTeacherAcc.name || bundle.teacherInfo.teacherName || 'Teacher',
            email: cleanTEmail,
            gmail: cleanTEmail,
            phone: currentTeacherAcc.phone || bundle.teacherInfo.phone || '',
            schoolName: bundle.schoolProfile.schoolName || currentTeacherAcc.schoolName || "St. Sebastian's Higher Secondary School",
            schoolCode: schoolCode,
            academicYear: currentTeacherAcc.academicYear || bundle.teacherInfo.academicYear || '2026-2027',
            subject: currentTeacherAcc.subject || currentTeacherAcc.primarySubject || bundle.teacherInfo.designation || 'General',
            primarySubject: currentTeacherAcc.primarySubject || currentTeacherAcc.subject || 'General',
            standard: currentTeacherAcc.standard || bundle.classInfo.standard || '',
            stream: currentTeacherAcc.stream || bundle.classInfo.stream || '',
            section: currentTeacherAcc.section || bundle.classInfo.section || '',
            assignedClass: currentTeacherAcc.assignedClass || bundle.classInfo.className || '',
            designation: currentTeacherAcc.designation || bundle.teacherInfo.designation || 'Class Teacher',
            status: 'active',
            createdAt: currentTeacherAcc.createdAt || new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            recentActivity: currentTeacherAcc.recentActivity || `Active in ${bundle.classInfo.className || 'Classroom'}`
          };

          if (database) {
            promises.push(set(ref(database, `schools/${schoolCode}/teachers/${cleanTId}`), teacherProfileRecord).catch(() => {}));
            promises.push(set(ref(database, `teachers/${cleanTId}`), teacherProfileRecord).catch(() => {}));
          }
          if (firestore) {
            try {
              const fsSchoolTeacherRef = fsDoc(firestore, `schools/${schoolCode}/teachers/${cleanTId}`);
              promises.push(fsSetDoc(fsSchoolTeacherRef, teacherProfileRecord, { merge: true }).catch(() => {}));
            } catch {}
          }
        }
      }

      // Fast parallel class synchronization to school roster
      if (schoolCode && bundle.classesCatalog && bundle.classesCatalog.length > 0) {
        for (const cls of bundle.classesCatalog) {
          const clsStudents = bundle.classData?.[cls.id]?.students || [];
          const enrichedCls = {
            ...cls,
            teacherId: cls.teacherId || currentUser?.uid,
            teacherUid: cls.teacherUid || cls.teacherId || currentUser?.uid,
            teacherName: cls.teacherName || bundle.teacherInfo.teacherName,
            schoolCode: schoolCode,
            students: clsStudents,
            classStrength: clsStudents.length,
            updatedAt: new Date().toISOString()
          };

          if (database) {
            const clsRef = ref(database, `schools/${schoolCode}/classes/${cls.id}`);
            promises.push(set(clsRef, enrichedCls).catch(() => {}));
          }

          if (firestore) {
            try {
              const classDocRef = fsDoc(firestore, 'schools', schoolCode, 'classes', cls.id);
              promises.push(fsSetDoc(classDocRef, enrichedCls, { merge: true }).catch(() => {}));
            } catch {}
          }
        }
      }

      // Sync school profile to Firestore
      if (schoolCode && firestore) {
        try {
          const schoolDocRef = fsDoc(firestore, 'schools', schoolCode, 'schoolProfile', 'info');
          promises.push(fsSetDoc(schoolDocRef, bundle.schoolProfile, { merge: true }).catch(() => {}));
        } catch {}
      }

      // Save all changes under the same Gmail in both Firestore and RTDB
      if (syncEmail) {
        const emailKey = this.sanitizeEmailKey(syncEmail);

        if (database) {
          const emailRefPath = ref(database, 'email_accounts/' + emailKey);
          promises.push(
            set(emailRefPath, {
              email: syncEmail,
              schoolCode: schoolCode,
              role: activeSession.role || 'teacher',
              teacherAccount: activeSession.currentTeacher || (bundle.teacherAccounts.find(t => t.email?.toLowerCase() === syncEmail.toLowerCase()) || null),
              adminAccount: activeSession.currentAdmin || (bundle.schoolAdmins?.find(a => a.email?.toLowerCase() === syncEmail.toLowerCase()) || null),
              lastSyncedAt: bundle.lastSyncedAt,
              deviceId: this.deviceId,
              updatedAt: new Date().toISOString(),
              appData: bundle
            }).catch(e => console.warn('RTDB email_accounts note:', e))
          );
        }

        if (firestore) {
          try {
            const emailDocRef = fsDoc(firestore, 'email_accounts', emailKey);
            promises.push(
              fsSetDoc(emailDocRef, {
                email: syncEmail,
                schoolCode: schoolCode,
                role: activeSession.role || 'teacher',
                teacherAccount: activeSession.currentTeacher || (bundle.teacherAccounts.find(t => t.email?.toLowerCase() === syncEmail.toLowerCase()) || null),
                adminAccount: activeSession.currentAdmin || (bundle.schoolAdmins?.find(a => a.email?.toLowerCase() === syncEmail.toLowerCase()) || null),
                lastSyncedAt: bundle.lastSyncedAt,
                deviceId: this.deviceId,
                updatedAt: new Date().toISOString(),
                appData: bundle
              }, { merge: true }).catch(e => console.warn('Firestore email_accounts note:', e))
            );

            // Also ensure user document in Firestore under emailKey so it is easily queryable
            const userEmailDocRef = fsDoc(firestore, 'users', emailKey);
            promises.push(
              fsSetDoc(userEmailDocRef, {
                userId: emailKey,
                email: syncEmail,
                displayName: bundle.teacherInfo.teacherName || 'Teacher',
                lastSyncedAt: bundle.lastSyncedAt,
                deviceId: this.deviceId,
                schoolCode: schoolCode,
                role: activeSession.role || 'teacher',
                teacherAccount: activeSession.currentTeacher || null,
                adminAccount: activeSession.currentAdmin || null,
                appData: bundle
              }, { merge: true }).catch(e => console.warn('Firestore userEmailDocRef note:', e))
            );
          } catch (fsErr) {
            console.warn('Firestore email_accounts push note:', fsErr);
          }
        }
      }

      // Update device presence heartbeat
      const devicePresencePayload = {
        deviceId: this.deviceId,
        name: this.getDeviceCustomName(),
        platform: this.detectDevicePlatform(),
        lastActiveAt: new Date().toISOString(),
        appVersion: '2.5.0',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      };

      if (database) {
        if (currentUser) {
          promises.push(
            set(ref(database, 'users/' + currentUser.uid + '/devices/' + this.deviceId), devicePresencePayload).catch(() => {})
          );
        }
        if (syncEmail) {
          const emailKey = this.sanitizeEmailKey(syncEmail);
          promises.push(
            set(ref(database, 'email_accounts/' + emailKey + '/devices/' + this.deviceId), devicePresencePayload).catch(() => {})
          );
        }
      }

      // Ultra-fast non-blocking execution: race network writes with 1000ms max timeout
      // Guarantees UI badge and spinner transition to 'saved' instantly (<300ms) without blocking on slow mobile data
      const timeoutPromise = new Promise(res => setTimeout(res, 1000));
      await Promise.race([Promise.allSettled(promises), timeoutPromise]);

      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'DATA_PUSHED',
            deviceId: this.deviceId,
            timestamp: Date.now()
          });
        } catch {}
      }

      try {
        localStorage.removeItem('hss_pending_offline_sync');
      } catch {}
      this.retryAttempt = 0;
      this.lastSavedPayloadHash = currentHash;
      this.lastSyncedAt = bundle.lastSyncedAt;
      localStorage.setItem('hss_last_cloud_sync', bundle.lastSyncedAt);
      this.setSaveState('saved');
      this.notify('synced');
      return true;
    } catch (err: any) {
      console.warn('Sync status notice:', err);
      try {
        localStorage.setItem('hss_pending_offline_sync', 'true');
      } catch {}
      this.setSaveState('offline');
      this.scheduleOfflineRetry();
      this.notify('error', err);
      return false;
    }
  }

  public async getConnectedDevices(): Promise<ConnectedDevice[]> {
    const devicesMap = new Map<string, ConnectedDevice>();

    // Current device always present
    const currentDevice: ConnectedDevice = {
      deviceId: this.deviceId,
      name: this.getDeviceCustomName(),
      platform: this.detectDevicePlatform(),
      isCurrentDevice: true,
      lastActiveAt: new Date().toISOString(),
      appVersion: '2.5.0',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };
    devicesMap.set(this.deviceId, currentDevice);

    const currentUser = auth?.currentUser;
    const syncEmail = this.getActiveSyncEmail();

    if (database) {
      const pathsToQuery: string[] = [];
      if (currentUser) pathsToQuery.push('users/' + currentUser.uid + '/devices');
      if (syncEmail) pathsToQuery.push('email_accounts/' + this.sanitizeEmailKey(syncEmail) + '/devices');

      for (const p of pathsToQuery) {
        try {
          const snap = await get(ref(database, p));
          if (snap.exists()) {
            const data = snap.val();
            if (data && typeof data === 'object') {
              Object.entries(data).forEach(([devId, devInfo]: [string, any]) => {
                if (devId && devInfo) {
                  const isCurrent = devId === this.deviceId;
                  const lastActive = devInfo.lastActiveAt || devInfo.updatedAt || new Date().toISOString();
                  const ageMs = Date.now() - new Date(lastActive).getTime();
                  if (ageMs < 48 * 3600 * 1000) {
                    devicesMap.set(devId, {
                      deviceId: devId,
                      name: isCurrent ? currentDevice.name : (devInfo.name || 'Connected Device'),
                      platform: devInfo.platform || 'Web Browser',
                      isCurrentDevice: isCurrent,
                      lastActiveAt: lastActive,
                      appVersion: devInfo.appVersion || '2.5.0',
                      userAgent: devInfo.userAgent || ''
                    });
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('Connected devices query note:', e);
        }
      }
    }

    return Array.from(devicesMap.values()).sort((a, b) => (b.isCurrentDevice ? 1 : 0) - (a.isCurrentDevice ? 1 : 0));
  }

  public async forceDeepSynthesis(): Promise<{ success: boolean; report: SynthesisReport | null }> {
    this.notify('syncing');
    try {
      const currentUser = auth?.currentUser;
      const syncEmail = this.getActiveSyncEmail();
      let remoteBundle: Partial<UserCloudBundle> | null = null;
      let sourceDev = '';

      if (currentUser) {
        const res = await this.fetchFromCloud(currentUser);
        if (res.found && res.data) {
          remoteBundle = res.data;
          sourceDev = res.data.deviceId || '';
        }
      }
      if (!remoteBundle && syncEmail) {
        const res = await this.fetchAccountByEmail(syncEmail);
        if (res.found && res.appData) {
          remoteBundle = res.appData;
          sourceDev = res.appData.deviceId || '';
        }
      }

      let report: SynthesisReport | null = null;
      if (remoteBundle) {
        report = this.applyCloudBundle(remoteBundle, sourceDev);
      } else {
        const local = this.gatherAllLocalData();
        const synthRes = this.synthesizeDataBundle(local, {}, this.deviceId);
        report = synthRes.report;
        this.lastSynthesisReport = report;
      }

      // Push synthesized bundle to cloud immediately
      await this.pushToCloud();
      this.notify('synced');
      return { success: true, report };
    } catch (err) {
      console.warn('forceDeepSynthesis note:', err);
      this.notify('error', err);
      return { success: false, report: null };
    }
  }

  public async fetchAccountByUid(
    uid: string
  ): Promise<{
    found: boolean;
    role?: 'teacher' | 'admin';
    teacherAccount?: TeacherAccount;
    adminAccount?: SchoolAdminAccount;
    appData?: UserCloudBundle;
    lastSyncedAt?: string;
  }> {
    if (!uid) return { found: false };

    if (firestore) {
      try {
        const userDocRef = fsDoc(firestore, 'users', uid);
        const snap = await fsGetDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data) {
            return {
              found: true,
              role: data.role || 'teacher',
              teacherAccount: data.teacherAccount || {
                id: uid,
                name: data.displayName || data.name || 'Teacher',
                email: data.email || '',
                phone: data.phone || '',
                schoolName: data.schoolName || '',
                schoolCode: data.schoolCode || '',
                subject: data.subject || '',
                designation: data.designation || 'Class Teacher',
                createdAt: data.createdAt || new Date().toISOString()
              },
              adminAccount: data.adminAccount,
              appData: data.appData,
              lastSyncedAt: data.lastSyncedAt
            };
          }
        }
      } catch (err) {
        console.warn('Firestore fetchAccountByUid error:', err);
      }
    }

    if (database) {
      try {
        const userRefPath = ref(database, 'users/' + uid);
        const snap = await get(userRefPath);
        if (snap.exists()) {
          const data = snap.val();
          if (data) {
            return {
              found: true,
              role: data.role || 'teacher',
              teacherAccount: data.teacherAccount || data.appData?.teacherAccounts?.find((t: any) => t.id === uid),
              adminAccount: data.adminAccount,
              appData: data.appData,
              lastSyncedAt: data.lastSyncedAt
            };
          }
        }
      } catch (err) {
        console.warn('RTDB fetchAccountByUid error:', err);
      }
    }

    return { found: false };
  }

  public async fetchAccountByEmail(
    email: string,
    schoolCode?: string
  ): Promise<{
    found: boolean;
    role?: 'teacher' | 'admin';
    teacherAccount?: TeacherAccount;
    adminAccount?: SchoolAdminAccount;
    appData?: UserCloudBundle;
    lastSyncedAt?: string;
  }> {
    if (!email || !email.trim()) return { found: false };
    const cleanEmail = email.trim().toLowerCase();

    if (firestore) {
      try {
        const emailKey = this.sanitizeEmailKey(cleanEmail);
        const emailDocRef = fsDoc(firestore, 'email_accounts', emailKey);
        const snap = await fsGetDoc(emailDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && (data.appData || data.teacherAccount || data.adminAccount)) {
            return {
              found: true,
              role: data.role || 'teacher',
              teacherAccount: data.teacherAccount,
              adminAccount: data.adminAccount,
              appData: data.appData as UserCloudBundle | undefined,
              lastSyncedAt: data.lastSyncedAt || data.updatedAt
            };
          }
        }

        const usersCol = fsCollection(firestore, 'users');
        const q = fsQuery(usersCol, fsWhere('email', '==', cleanEmail));
        const querySnap = await fsGetDocs(q);
        if (!querySnap.empty && querySnap.docs.length > 0) {
          const docData = querySnap.docs[0].data();
          if (docData) {
            return {
              found: true,
              role: docData.role || 'teacher',
              teacherAccount: docData.teacherAccount || {
                id: querySnap.docs[0].id,
                name: docData.displayName || docData.name || 'Teacher',
                email: cleanEmail,
                phone: docData.phone || '',
                schoolName: docData.schoolName || '',
                schoolCode: docData.schoolCode || '',
                subject: docData.subject || '',
                designation: docData.designation || 'Class Teacher',
                createdAt: docData.createdAt || new Date().toISOString()
              },
              adminAccount: docData.adminAccount,
              appData: docData.appData,
              lastSyncedAt: docData.lastSyncedAt
            };
          }
        }
      } catch (e) {
        console.warn('Firestore fetchAccountByEmail error:', e);
      }
    }

    try {
      this.notify('syncing');
      const emailKey = this.sanitizeEmailKey(cleanEmail);
      const emailRefPath = ref(database, 'email_accounts/' + emailKey);
      const snap = await get(emailRefPath);

      if (snap.exists()) {
        const data = snap.val();
        if (data) {
          const appData = data.appData as UserCloudBundle | undefined;
          this.notify('synced');
          return {
            found: true,
            role: data.role || 'teacher',
            teacherAccount: data.teacherAccount,
            adminAccount: data.adminAccount,
            appData,
            lastSyncedAt: data.lastSyncedAt
          };
        }
      }
      this.notify('synced');
      return { found: false };
    } catch (err) {
      console.warn('Error fetching account by email from RTDB:', err);
      this.notify('error', err);
      return { found: false };
    }
  }

  public async saveAccountToCloud(
    email: string,
    payload: {
      role: 'teacher' | 'admin';
      teacherAccount?: TeacherAccount;
      adminAccount?: SchoolAdminAccount;
      schoolCode?: string;
      appData?: UserCloudBundle;
    }
  ): Promise<boolean> {
    if (!email || !email.trim()) return false;
    const cleanEmail = email.trim().toLowerCase();

    try {
      this.notify('syncing');
      const emailKey = this.sanitizeEmailKey(cleanEmail);
      const emailRefPath = ref(database, 'email_accounts/' + emailKey);
      const bundle = payload.appData || this.gatherAllLocalData();
      const now = new Date().toISOString();

      if (database) {
        await set(emailRefPath, {
          email: cleanEmail,
          schoolCode: payload.schoolCode || bundle.schoolProfile.schoolCode || '',
          role: payload.role,
          teacherAccount: payload.teacherAccount || null,
          adminAccount: payload.adminAccount || null,
          lastSyncedAt: now,
          updatedAt: now,
          appData: bundle
        }).catch(() => {});
      }

      if (firestore) {
        try {
          const emailDocRef = fsDoc(firestore, 'email_accounts', emailKey);
          await fsSetDoc(emailDocRef, {
            email: cleanEmail,
            schoolCode: payload.schoolCode || bundle.schoolProfile.schoolCode || '',
            role: payload.role,
            teacherAccount: payload.teacherAccount || null,
            adminAccount: payload.adminAccount || null,
            lastSyncedAt: now,
            updatedAt: now,
            deviceId: this.deviceId,
            appData: bundle
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Firestore saveAccountToCloud note:', fsErr);
        }
      }

      this.setActiveSyncEmail(cleanEmail);
      this.lastSyncedAt = now;
      localStorage.setItem('hss_last_cloud_sync', now);
      this.notify('synced');
      return true;
    } catch (err) {
      console.warn('Error saving account to cloud:', err);
      this.notify('error', err);
      return false;
    }
  }

  public async fetchFromCloud(user: FirebaseUser): Promise<{ found: boolean; data?: UserCloudBundle }> {
    try {
      this.notify('syncing');
      // 1. Fetch from Firestore users/{uid}
      if (firestore) {
        try {
          const fsSnap = await fsGetDoc(fsDoc(firestore, 'users', user.uid)).catch(() => null);
          if (fsSnap && fsSnap.exists()) {
            const fsData = fsSnap.data();
            if (fsData && fsData.appData) {
              const cloudBundle = fsData.appData as UserCloudBundle;
              this.applyCloudBundle(cloudBundle);
              this.lastSyncedAt = fsData.lastSyncedAt || cloudBundle.lastSyncedAt;
              if (user.email) {
                this.setActiveSyncEmail(user.email);
              }
              this.notify('synced');
              return { found: true, data: cloudBundle };
            }
          }
        } catch {}
      }

      // 2. Fetch from email_accounts
      if (user.email) {
        const emailRes = await this.fetchAccountByEmail(user.email);
        if (emailRes.found && emailRes.appData) {
          this.applyCloudBundle(emailRes.appData);
          this.setActiveSyncEmail(user.email);
          this.lastSyncedAt = emailRes.lastSyncedAt;
          this.notify('synced');
          return { found: true, data: emailRes.appData };
        }
      }

      // 3. Fetch from RTDB users/{uid} (Fallback)
      if (database) {
        const userRefPath = ref(database, 'users/' + user.uid);
        const snap = await get(userRefPath).catch(() => null);
        if (snap && snap.exists()) {
          const remote = snap.val();
          if (remote && remote.appData) {
            const cloudBundle = remote.appData as UserCloudBundle;
            this.applyCloudBundle(cloudBundle);
            this.lastSyncedAt = remote.lastSyncedAt || cloudBundle.lastSyncedAt;
            if (user.email) {
              this.setActiveSyncEmail(user.email);
            }
            this.notify('synced');
            return { found: true, data: cloudBundle };
          }
        }
      }

      if (user.email) {
        this.setActiveSyncEmail(user.email);
      }
      this.notify('synced');
      return { found: false };
    } catch (err: any) {
      console.warn('Cloud sync fetch note:', err);
      this.notify('error', err);
      return { found: false };
    }
  }

  public async forceFetchFromCloud(user: FirebaseUser): Promise<{ found: boolean; data?: UserCloudBundle }> {
    this.lastSyncedAt = undefined;
    localStorage.removeItem('hss_last_cloud_sync');
    return this.fetchFromCloud(user);
  }

  public startRealtimeSync(user: FirebaseUser, onDataRefreshed?: () => void) {
    this.stopRealtimeSync();
    if (user.email) {
      this.setActiveSyncEmail(user.email);
    }

    const userRefPath = ref(database, 'users/' + user.uid);
    try {
      this.unsubscribeSnapshot = onValue(
        userRefPath,
        snapshot => {
          if (this.isApplyingRemoteUpdate) return;
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data && data.appData) {
              const updateDeviceId = data.deviceId || data.appData?.deviceId;
              const incomingTimestamp = data.lastSyncedAt || data.appData.lastSyncedAt;

              // Echo prevention: avoid re-processing updates generated by this device
              if (updateDeviceId && updateDeviceId === this.deviceId) {
                if (incomingTimestamp) this.lastSyncedAt = incomingTimestamp;
                return;
              }

              if (incomingTimestamp && incomingTimestamp !== this.lastSyncedAt) {
                this.applyCloudBundle(data.appData, updateDeviceId);
                this.lastSyncedAt = incomingTimestamp;
                this.notify('synced');
                if (onDataRefreshed) {
                  onDataRefreshed();
                }
              }
            }
          }
        },
        error => {
          console.warn('RTDB snapshot listener note:', error);
        }
      );
    } catch (e) {
      console.warn('Could not establish RTDB snapshot listener', e);
    }

    if (user.email) {
      this.startRealtimeEmailSync(user.email, onDataRefreshed);
    }
  }

  public startRealtimeEmailSync(email: string, onDataRefreshed?: () => void) {
    if (!email || !email.trim()) return;
    const cleanEmail = email.trim().toLowerCase();
    this.setActiveSyncEmail(cleanEmail);

    if (this.unsubscribeEmailSnapshot) {
      try {
        this.unsubscribeEmailSnapshot();
      } catch (e) {}
      this.unsubscribeEmailSnapshot = null;
    }

    const emailKey = this.sanitizeEmailKey(cleanEmail);
    const emailRefPath = ref(database, 'email_accounts/' + emailKey);
    try {
      this.unsubscribeEmailSnapshot = onValue(
        emailRefPath,
        snapshot => {
          if (this.isApplyingRemoteUpdate) return;
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data && data.appData) {
              const updateDeviceId = data.deviceId || data.appData?.deviceId;
              const incomingTimestamp = data.lastSyncedAt || data.appData.lastSyncedAt;

              // Echo prevention: avoid re-processing updates generated by this device
              if (updateDeviceId && updateDeviceId === this.deviceId) {
                if (incomingTimestamp) this.lastSyncedAt = incomingTimestamp;
                return;
              }

              if (incomingTimestamp && incomingTimestamp !== this.lastSyncedAt) {
                this.applyCloudBundle(data.appData, updateDeviceId);
                this.lastSyncedAt = incomingTimestamp;
                this.notify('synced');
                if (onDataRefreshed) {
                  onDataRefreshed();
                }
              }
            }
          }
        },
        error => {
          console.warn('RTDB email snapshot note:', error);
        }
      );
    } catch (e) {
      console.warn('Could not establish RTDB email snapshot listener', e);
    }

    // Attach dual real-time listener on Firestore for maximum multi-device reliability
    if (this.unsubscribeFirestoreEmailSnapshot) {
      try {
        this.unsubscribeFirestoreEmailSnapshot();
      } catch (e) {}
      this.unsubscribeFirestoreEmailSnapshot = null;
    }

    if (firestore) {
      try {
        const docRef = fsDoc(firestore, 'email_accounts', emailKey);
        this.unsubscribeFirestoreEmailSnapshot = fsOnSnapshot(
          docRef,
          (docSnap: any) => {
            if (this.isApplyingRemoteUpdate) return;
            if (docSnap && docSnap.exists()) {
              const data = docSnap.data();
              if (data && data.appData) {
                const updateDeviceId = data.deviceId || data.appData?.deviceId;
                const incomingTimestamp = data.lastSyncedAt || data.appData.lastSyncedAt;

                if (updateDeviceId && updateDeviceId === this.deviceId) {
                  if (incomingTimestamp) this.lastSyncedAt = incomingTimestamp;
                  return;
                }

                if (incomingTimestamp && incomingTimestamp !== this.lastSyncedAt) {
                  this.applyCloudBundle(data.appData, updateDeviceId);
                  this.lastSyncedAt = incomingTimestamp;
                  this.notify('synced');
                  if (onDataRefreshed) {
                    onDataRefreshed();
                  }
                }
              }
            }
          },
          (fsErr: any) => {
            console.warn('Firestore real-time email listener note:', fsErr);
          }
        );
      } catch (e) {
        console.warn('Could not establish Firestore email snapshot listener', e);
      }
    }
  }

  public stopRealtimeSync() {
    if (this.unsubscribeSnapshot) {
      try {
        this.unsubscribeSnapshot();
      } catch (e) {}
      this.unsubscribeSnapshot = null;
    }
    if (this.unsubscribeEmailSnapshot) {
      try {
        this.unsubscribeEmailSnapshot();
      } catch (e) {}
      this.unsubscribeEmailSnapshot = null;
    }
    if (this.unsubscribeFirestoreEmailSnapshot) {
      try {
        this.unsubscribeFirestoreEmailSnapshot();
      } catch (e) {}
      this.unsubscribeFirestoreEmailSnapshot = null;
    }
    this.stopRealtimeBroadcasts();
  }

  public startRealtimeBroadcasts(schoolCode: string, onBroadcastsUpdated?: () => void) {
    if (!schoolCode) return;
    const cleanCode = schoolCode.trim().toUpperCase();

    if (this.unsubscribeBroadcastsSnapshot) {
      try {
        this.unsubscribeBroadcastsSnapshot();
      } catch (e) {}
      this.unsubscribeBroadcastsSnapshot = null;
    }

    try {
      const broadcastsRefPath = ref(database, 'broadcasts');
      this.unsubscribeBroadcastsSnapshot = onValue(
        broadcastsRefPath,
        snapshot => {
          const remoteBroadcasts: PrincipalBroadcast[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(childSnap => {
              const b = childSnap.val() as PrincipalBroadcast;
              if (b && (!b.schoolCode || b.schoolCode.toUpperCase() === cleanCode)) {
                remoteBroadcasts.push(b);
              }
            });
          }

          remoteBroadcasts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const localBroadcasts = StorageService.getPrincipalBroadcasts();
          const localIds = new Set(localBroadcasts.map(b => b.id));
          let changed = false;

          remoteBroadcasts.forEach(rb => {
            if (!localIds.has(rb.id)) {
              StorageService.addPrincipalBroadcast(rb);
              changed = true;
            }
          });

          if (changed && onBroadcastsUpdated) {
            onBroadcastsUpdated();
          }
        },
        error => {
          console.warn('Error syncing real-time broadcasts:', error);
        }
      );
    } catch (e) {
      console.warn('Could not establish real-time broadcasts listener', e);
    }
  }

  public stopRealtimeBroadcasts() {
    if (this.unsubscribeBroadcastsSnapshot) {
      try {
        this.unsubscribeBroadcastsSnapshot();
      } catch (e) {}
      this.unsubscribeBroadcastsSnapshot = null;
    }
  }

  private unsubscribeSchoolTeachersSnapshot: (() => void) | null = null;
  private unsubscribeSchoolActivitiesSnapshot: (() => void) | null = null;

  public clearActiveSyncEmail() {
    this.setActiveSyncEmail(undefined);
    this.stopRealtimeSync();
    this.stopRealtimeBroadcasts();
    this.stopRealtimeSchoolSync();
  }

  public stopRealtimeSchoolSync() {
    if (this.unsubscribeSchoolTeachersSnapshot) {
      try {
        this.unsubscribeSchoolTeachersSnapshot();
      } catch (e) {}
      this.unsubscribeSchoolTeachersSnapshot = null;
    }
    if (this.unsubscribeSchoolActivitiesSnapshot) {
      try {
        this.unsubscribeSchoolActivitiesSnapshot();
      } catch (e) {}
      this.unsubscribeSchoolActivitiesSnapshot = null;
    }
  }

  public async saveTeacherToSchool(schoolCode: string, teacher: TeacherAccount): Promise<boolean> {
    if (!schoolCode || !teacher) return false;
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const cleanGmail = (teacher.gmail || teacher.email || '').trim().toLowerCase();
    const effectiveTeacherKey = (teacher.uid || teacher.id || '').trim();

    if (!effectiveTeacherKey) return false;

    // Check if permanently deleted by School Admin
    const isPermDeleted = await this.isTeacherPermanentlyDeletedForSchool(cleanCode, effectiveTeacherKey, cleanGmail);
    if (isPermDeleted) {
      console.log('Teacher is permanently deleted for this school; ignoring re-entry save');
      return false;
    }

    // Clear temporary deletion status from local storage
    StorageService.removeTemporarilyDeletedTeacherId(teacher.id, cleanGmail);
    if (teacher.uid) StorageService.removeTemporarilyDeletedTeacherId(teacher.uid);
    if (effectiveTeacherKey) StorageService.removeTemporarilyDeletedTeacherId(effectiveTeacherKey);

    const sanitizedTeacherRecord = {
      id: effectiveTeacherKey,
      uid: effectiveTeacherKey,
      name: teacher.name,
      gmail: cleanGmail,
      email: cleanGmail,
      status: 'active',
      academicYear: teacher.academicYear || '',
      dob: teacher.dob || '',
      phone: teacher.phone || '',
      schoolName: teacher.schoolName || "St. Sebastian's Higher Secondary School",
      schoolCode: cleanCode,
      subject: teacher.subject || teacher.primarySubject || teacher.designation || '',
      primarySubject: teacher.primarySubject || teacher.subject || '',
      standard: teacher.standard || '',
      stream: teacher.stream || '',
      section: teacher.section || '',
      assignedClass: teacher.assignedClass || '',
      designation: teacher.designation || 'Class Teacher',
      avatar: teacher.avatar || '👨‍🏫',
      photoUrl: teacher.photoUrl || '',
      createdAt: teacher.createdAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      recentActivity: teacher.recentActivity || `Active in ${teacher.assignedClass || 'Classroom'}`,
      studentCount: teacher.studentCount || 0,
      attendanceCount: teacher.attendanceCount || 0,
      examCount: teacher.examCount || 0
    };

    if (database) {
      try {
        // Clear temporary deletion flags in RTDB
        await remove(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${effectiveTeacherKey}`)).catch(() => {});
        if (teacher.id && teacher.id !== effectiveTeacherKey) {
          await remove(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${teacher.id}`)).catch(() => {});
        }

        // Clean up legacy deleted flags if any
        await remove(ref(database, `schools/${cleanCode}/deletedTeachers/${effectiveTeacherKey}`)).catch(() => {});
        if (teacher.id && teacher.id !== effectiveTeacherKey) {
          await remove(ref(database, `schools/${cleanCode}/deletedTeachers/${teacher.id}`)).catch(() => {});
        }

        // Remove duplicate records for same cleanGmail under different keys in schools/{schoolCode}/teachers
        if (cleanGmail) {
          const allSnap = await get(ref(database, `schools/${cleanCode}/teachers`)).catch(() => null);
          if (allSnap && allSnap.exists()) {
            allSnap.forEach(child => {
              if (child.key !== effectiveTeacherKey) {
                const val = child.val();
                if (val && ((val.email && val.email.toLowerCase() === cleanGmail) || (val.gmail && val.gmail.toLowerCase() === cleanGmail))) {
                  remove(ref(database, `schools/${cleanCode}/teachers/${child.key}`)).catch(() => {});
                }
              }
            });
          }
        }

        // 1. Write to dedicated teachers/ collection in Realtime Database
        const dedicatedTeacherRef = ref(database, `teachers/${effectiveTeacherKey}`);
        await update(dedicatedTeacherRef, sanitizedTeacherRecord);

        // 2. Write to schools/{schoolCode}/teachers/{effectiveTeacherKey} for active Admin Panel list
        const schoolTeacherRef = ref(database, `schools/${cleanCode}/teachers/${effectiveTeacherKey}`);
        await update(schoolTeacherRef, sanitizedTeacherRecord);
      } catch (err) {
        console.warn('Error saving teacher to RTDB:', err);
      }
    }

    if (firestore) {
      try {
        const tempDoc = fsDoc(firestore, `schools/${cleanCode}/temporarilyDeletedTeachers/${effectiveTeacherKey}`);
        await fsDeleteDoc(tempDoc).catch(() => {});

        const teacherDocRef = fsDoc(firestore, `schools/${cleanCode}/teachers/${effectiveTeacherKey}`);
        await fsSetDoc(teacherDocRef, sanitizedTeacherRecord, { merge: true });
        const userDocRef = fsDoc(firestore, `users/${effectiveTeacherKey}`);
        await fsSetDoc(userDocRef, { ...sanitizedTeacherRecord, role: 'teacher' }, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore saveTeacherToSchool warning:', fsErr);
      }
    }

    return true;
  }

  public async temporaryDeleteTeacherFromSchool(
    schoolCode: string,
    teacherId: string,
    teacherEmail?: string,
    teacherUid?: string
  ): Promise<boolean> {
    if (!schoolCode || !teacherId) return false;
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const cleanEmail = (teacherEmail || '').trim().toLowerCase();

    // Track temporary delete in local storage
    StorageService.addTemporarilyDeletedTeacherId(teacherId, cleanEmail);
    if (teacherUid) StorageService.addTemporarilyDeletedTeacherId(teacherUid);

    if (database) {
      try {
        // Retrieve existing teacher profile so we can store it in temporarilyDeletedTeachers for seamless re-entry
        let teacherProfile: any = null;
        const snap = await get(ref(database, `schools/${cleanCode}/teachers/${teacherId}`)).catch(() => null);
        if (snap && snap.exists()) {
          teacherProfile = snap.val();
        }
        if (!teacherProfile && teacherUid) {
          const snapUid = await get(ref(database, `schools/${cleanCode}/teachers/${teacherUid}`)).catch(() => null);
          if (snapUid && snapUid.exists()) {
            teacherProfile = snapUid.val();
          }
        }
        if (!teacherProfile && cleanEmail) {
          const allSnap = await get(ref(database, `schools/${cleanCode}/teachers`)).catch(() => null);
          if (allSnap && allSnap.exists()) {
            allSnap.forEach(child => {
              const val = child.val();
              if (val && ((val.email && val.email.toLowerCase() === cleanEmail) || (val.gmail && val.gmail.toLowerCase() === cleanEmail))) {
                teacherProfile = val;
              }
            });
          }
        }

        const effectiveUid = teacherProfile?.uid || teacherUid || teacherId;
        const recordToSave = teacherProfile ? {
          ...teacherProfile,
          id: effectiveUid,
          uid: effectiveUid,
          email: cleanEmail || teacherProfile.email || teacherProfile.gmail || '',
          gmail: cleanEmail || teacherProfile.gmail || teacherProfile.email || '',
          temporarilyDeleted: true,
          status: 'temporary_deleted',
          deletedAt: new Date().toISOString()
        } : {
          id: effectiveUid,
          uid: effectiveUid,
          email: cleanEmail,
          gmail: cleanEmail,
          temporarilyDeleted: true,
          status: 'temporary_deleted',
          deletedAt: new Date().toISOString()
        };

        // Store full profile in temporarilyDeletedTeachers in RTDB
        await set(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${effectiveUid}`), recordToSave);
        if (teacherId !== effectiveUid) {
          await set(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${teacherId}`), recordToSave).catch(() => {});
        }

        // Remove from active teachers in RTDB
        await remove(ref(database, `schools/${cleanCode}/teachers/${teacherId}`)).catch(() => {});
        if (effectiveUid !== teacherId) {
          await remove(ref(database, `schools/${cleanCode}/teachers/${effectiveUid}`)).catch(() => {});
        }
        if (cleanEmail) {
          const allSnap = await get(ref(database, `schools/${cleanCode}/teachers`)).catch(() => null);
          if (allSnap && allSnap.exists()) {
            allSnap.forEach(child => {
              const val = child.val();
              if (val && ((val.email && val.email.toLowerCase() === cleanEmail) || (val.gmail && val.gmail.toLowerCase() === cleanEmail))) {
                remove(ref(database, `schools/${cleanCode}/teachers/${child.key}`)).catch(() => {});
              }
            });
          }
        }
      } catch (err) {
        console.warn('Error temporarily deleting teacher in RTDB:', err);
      }
    }

    if (firestore) {
      try {
        const teacherDocRef = fsDoc(firestore, `schools/${cleanCode}/teachers/${teacherId}`);
        await fsDeleteDoc(teacherDocRef).catch(() => {});
        const tempDeletedDocRef = fsDoc(firestore, `schools/${cleanCode}/temporarilyDeletedTeachers/${teacherId}`);
        await fsSetDoc(tempDeletedDocRef, { temporarilyDeleted: true, deletedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } catch (fsErr) {
        console.warn('Firestore temporaryDeleteTeacherFromSchool warning:', fsErr);
      }
    }

    return true;
  }

  public async isTeacherPermanentlyDeletedForSchool(
    schoolCode: string,
    uid?: string,
    email?: string
  ): Promise<boolean> {
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanUid = (uid || '').trim();

    // Prevent pre-authorized admins from ever being permanently blocked from teacher access
    const PRE_AUTHORIZED_EMAILS = new Set([
      'gelwin72@gmail.com',
      'joicegeorge1910@gmail.com',
      'lincythomas1911@gmail.com'
    ]);
    if (cleanEmail && PRE_AUTHORIZED_EMAILS.has(cleanEmail)) {
      return false;
    }

    if (StorageService.isTeacherPermanentlyDeleted(cleanUid, cleanEmail)) {
      return true;
    }

    if (database) {
      try {
        if (cleanUid) {
          const snapUid = await get(ref(database, `schools/${cleanCode}/permanentlyDeletedTeachers/${cleanUid}`)).catch(() => null);
          if (snapUid && snapUid.exists() && (snapUid.val() === true || snapUid.val()?.permanentlyDeleted === true)) {
            StorageService.addPermanentlyDeletedTeacherId(cleanUid, cleanEmail);
            return true;
          }
        }
        if (cleanEmail) {
          const sanitizedEmail = this.sanitizeEmailKey(cleanEmail);
          const snapEmail = await get(ref(database, `schools/${cleanCode}/permanentlyDeletedTeacherEmails/${sanitizedEmail}`)).catch(() => null);
          if (snapEmail && snapEmail.exists() && (snapEmail.val() === true || snapEmail.val()?.permanentlyDeleted === true)) {
            StorageService.addPermanentlyDeletedTeacherId(cleanUid, cleanEmail);
            return true;
          }
        }
      } catch (e) {
        console.warn('RTDB perm delete check note:', e);
      }
    }

    if (firestore) {
      try {
        if (cleanUid) {
          const docRef = fsDoc(firestore, `schools/${cleanCode}/permanentlyDeletedTeachers/${cleanUid}`);
          const docSnap = await fsGetDoc(docRef).catch(() => null);
          if (docSnap && docSnap.exists() && docSnap.data()?.permanentlyDeleted === true) {
            StorageService.addPermanentlyDeletedTeacherId(cleanUid, cleanEmail);
            return true;
          }
        }
      } catch (e) {
        console.warn('Firestore perm delete check note:', e);
      }
    }

    return false;
  }

  public async isEmailAuthorizedAdmin(schoolCode: string, email: string): Promise<boolean> {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();

    const PRE_AUTHORIZED = new Set([
      'gelwin72@gmail.com',
      'joicegeorge1910@gmail.com'
    ]);
    if (PRE_AUTHORIZED.has(cleanEmail)) return true;

    if (database) {
      try {
        const adminSnap = await get(ref(database, `schools/${cleanCode}/schoolAdmins`)).catch(() => null);
        if (adminSnap && adminSnap.exists()) {
          let found = false;
          adminSnap.forEach(child => {
            const val = child.val();
            if (val && val.email && val.email.toLowerCase() === cleanEmail) {
              found = true;
            }
          });
          if (found) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  public async permanentDeleteTeacherFromSchool(
    schoolCode: string,
    teacherId: string,
    teacherEmail?: string,
    teacherUid?: string
  ): Promise<boolean> {
    if (!schoolCode || !teacherId) return false;
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const cleanEmail = (teacherEmail || '').trim().toLowerCase();
    const sanitizedEmail = cleanEmail ? this.sanitizeEmailKey(cleanEmail) : '';
    const effectiveUid = teacherUid || teacherId;

    // Track permanent delete in local storage for teacher membership
    StorageService.addPermanentlyDeletedTeacherId(teacherId, cleanEmail);
    if (teacherUid) StorageService.addPermanentlyDeletedTeacherId(teacherUid);

    if (database) {
      try {
        // Remove from active teachers in RTDB
        await remove(ref(database, `teachers/${teacherId}`)).catch(() => {});
        if (effectiveUid !== teacherId) {
          await remove(ref(database, `teachers/${effectiveUid}`)).catch(() => {});
        }

        await remove(ref(database, `schools/${cleanCode}/teachers/${teacherId}`)).catch(() => {});
        if (effectiveUid !== teacherId) {
          await remove(ref(database, `schools/${cleanCode}/teachers/${effectiveUid}`)).catch(() => {});
        }

        // Clean any matches by email in schools/{cleanCode}/teachers
        if (cleanEmail) {
          const allSnap = await get(ref(database, `schools/${cleanCode}/teachers`)).catch(() => null);
          if (allSnap && allSnap.exists()) {
            allSnap.forEach(child => {
              const val = child.val();
              if (val && ((val.email && val.email.toLowerCase() === cleanEmail) || (val.gmail && val.gmail.toLowerCase() === cleanEmail))) {
                remove(ref(database, `schools/${cleanCode}/teachers/${child.key}`)).catch(() => {});
              }
            });
          }
        }

        // Remove from temporarily deleted teachers
        await remove(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${teacherId}`)).catch(() => {});
        if (effectiveUid !== teacherId) {
          await remove(ref(database, `schools/${cleanCode}/temporarilyDeletedTeachers/${effectiveUid}`)).catch(() => {});
        }

        // Record permanent deletion
        const permRecord = { permanentlyDeleted: true, email: cleanEmail, deletedAt: new Date().toISOString() };
        await set(ref(database, `schools/${cleanCode}/permanentlyDeletedTeachers/${teacherId}`), permRecord);
        if (effectiveUid !== teacherId) {
          await set(ref(database, `schools/${cleanCode}/permanentlyDeletedTeachers/${effectiveUid}`), permRecord);
        }

        if (sanitizedEmail) {
          const deletedEmailRef = ref(database, `schools/${cleanCode}/permanentlyDeletedTeacherEmails/${sanitizedEmail}`);
          await set(deletedEmailRef, { permanentlyDeleted: true, uid: effectiveUid, deletedAt: new Date().toISOString() });
        }
      } catch (err) {
        console.warn('Error permanently deleting teacher from RTDB:', err);
      }
    }

    if (firestore) {
      try {
        const teacherDocRef = fsDoc(firestore, `schools/${cleanCode}/teachers/${teacherId}`);
        await fsDeleteDoc(teacherDocRef).catch(() => {});
        const permDeletedDocRef = fsDoc(firestore, `schools/${cleanCode}/permanentlyDeletedTeachers/${teacherId}`);
        await fsSetDoc(permDeletedDocRef, { permanentlyDeleted: true, deletedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } catch (fsErr) {
        console.warn('Firestore permanentDeleteTeacherFromSchool warning:', fsErr);
      }
    }

    // Teacher Membership and School Admin Authorization are completely separate.
    // We NEVER delete or modify the Firebase Auth account or School Admin record here.
    return true;
  }

  public async deleteTeacherFromSchool(
    schoolCode: string,
    teacherId: string,
    teacherEmail?: string,
    isPermanent: boolean = true,
    teacherUid?: string
  ): Promise<boolean> {
    if (isPermanent) {
      return this.permanentDeleteTeacherFromSchool(schoolCode, teacherId, teacherEmail, teacherUid);
    } else {
      return this.temporaryDeleteTeacherFromSchool(schoolCode, teacherId, teacherEmail, teacherUid);
    }
  }

  public async cleanupOldDeletedTeachers(schoolCode: string): Promise<void> {
    if (!schoolCode) return;
    const cleanCode = schoolCode.trim().toUpperCase();

    try {
      let permDeletedIds: string[] = [];
      if (database) {
        const permSnap = await get(ref(database, `schools/${cleanCode}/permanentlyDeletedTeachers`)).catch(() => null);
        if (permSnap && permSnap.exists()) {
          const val = permSnap.val();
          if (typeof val === 'object' && val !== null) {
            permDeletedIds = Object.keys(val);
          }
        }
        const delSnap = await get(ref(database, `schools/${cleanCode}/deletedTeachers`)).catch(() => null);
        if (delSnap && delSnap.exists()) {
          const val = delSnap.val();
          if (typeof val === 'object' && val !== null) {
            permDeletedIds = Array.from(new Set([...permDeletedIds, ...Object.keys(val)]));
          }
        }
      }

      const activeTeachers = await this.fetchSchoolTeachers(cleanCode);
      for (const t of activeTeachers) {
        if (!t) continue;
        const tId = t.id || t.uid || '';
        const tEmail = (t.email || t.gmail || '').trim().toLowerCase();

        if (
          permDeletedIds.includes(tId) ||
          (tEmail && permDeletedIds.includes(tEmail)) ||
          (t as any).status === 'deleted' ||
          (t as any).status === 'permanently_deleted'
        ) {
          if (database && tId) {
            await remove(ref(database, `schools/${cleanCode}/teachers/${tId}`)).catch(() => {});
            await remove(ref(database, `teachers/${tId}`)).catch(() => {});
          }
          if (firestore && tId) {
            await fsDeleteDoc(fsDoc(firestore, `schools/${cleanCode}/teachers/${tId}`)).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('Cleanup old deleted teachers note:', e);
    }
  }

  public async saveClassToSchool(schoolCode: string, classItem: ClassItem, students?: Student[]): Promise<boolean> {
    if (!schoolCode || !classItem || !classItem.id) return false;
    const cleanCode = schoolCode.trim().toUpperCase();

    if (database) {
      try {
        const classRefPath = ref(database, `schools/${cleanCode}/classes/${classItem.id}`);
        await set(classRefPath, { ...classItem, schoolCode: cleanCode });
        if (students && students.length > 0) {
          const studsRefPath = ref(database, `schools/${cleanCode}/classes/${classItem.id}/students`);
          await set(studsRefPath, students);
        }
      } catch (e) {
        console.warn('RTDB saveClassToSchool warning:', e);
      }
    }

    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/classes/${classItem.id}`);
        await fsSetDoc(docRef, { ...classItem, schoolCode: cleanCode }, { merge: true });
        if (students && students.length > 0) {
          for (const s of students) {
            const sRef = fsDoc(firestore, `schools/${cleanCode}/classes/${classItem.id}/students/${s.id}`);
            await fsSetDoc(sRef, { ...s, classId: classItem.id, schoolCode: cleanCode }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('Firestore saveClassToSchool warning:', e);
      }
    }

    return true;
  }

  public async syncAllTeacherClassesToSchool(schoolCode: string, teacherId?: string, teacherEmail?: string): Promise<void> {
    if (!schoolCode) return;
    const cleanCode = schoolCode.trim().toUpperCase();
    const localClasses = StorageService.getClassesList();
    const cleanEmail = (teacherEmail || '').trim().toLowerCase();

    for (const cls of localClasses) {
      if (!cls || !cls.id) continue;
      const isOwner = (
        (teacherId && (cls.createdByTeacherId === teacherId || cls.teacherId === teacherId || cls.teacherUid === teacherId)) ||
        (cleanEmail && cls.createdByTeacherEmail && cls.createdByTeacherEmail.trim().toLowerCase() === cleanEmail) ||
        cls.isTeacherCreated
      );

      if (isOwner) {
        const enrichedClass: ClassItem = {
          ...cls,
          schoolCode: cleanCode,
          isTeacherCreated: true,
          createdByTeacherId: cls.createdByTeacherId || cls.teacherId || teacherId || '',
          teacherId: cls.teacherId || cls.createdByTeacherId || teacherId || '',
          teacherUid: cls.teacherUid || teacherId || cls.createdByTeacherId || cls.teacherId || '',
          createdByTeacherEmail: cls.createdByTeacherEmail || cleanEmail || ''
        };
        const studs = StorageService.getStudents(cls.id);
        await this.saveClassToSchool(cleanCode, enrichedClass, studs).catch(() => {});
      }
    }
  }

  public async deleteClassFromSchool(schoolCode: string, classId: string): Promise<boolean> {
    if (!schoolCode || !classId) return false;
    const cleanCode = schoolCode.trim().toUpperCase();

    if (database) {
      try {
        const classRefPath = ref(database, `schools/${cleanCode}/classes/${classId}`);
        await remove(classRefPath);
      } catch (e) {}
    }

    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/classes/${classId}`);
        await fsDeleteDoc(docRef);
      } catch (e) {}
    }

    return true;
  }

  public listenToSchoolClasses(
    schoolCode: string,
    onClassesUpdated: (classes: ClassItem[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubFs: (() => void) | null = null;
    if (firestore) {
      try {
        const colRef = fsCollection(firestore, `schools/${cleanCode}/classes`);
        unsubFs = fsOnSnapshot(colRef, (snapshot) => {
          const list: ClassItem[] = [];
          snapshot.forEach((d: any) => {
            const val = d.data();
            if (val) {
              const classId = val.id || d.id;
              list.push({ ...val, id: classId });
              
              // Extract and restore students if they are embedded in the class record
              if (val.students && Array.isArray(val.students) && val.students.length > 0) {
                StorageService.saveStudents(val.students, classId);
              }
            }
          });
          StorageService.saveClassesList(list);
          onClassesUpdated(list);
        }, err => console.warn('Firestore listenToSchoolClasses warning:', err));
      } catch (e) {
        console.warn('Firestore listenToSchoolClasses setup error:', e);
      }
    }

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const classesRefPath = ref(database, `schools/${cleanCode}/classes`);
        unsubRtdb = onValue(classesRefPath, snapshot => {
          const list: ClassItem[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(child => {
              const c = child.val();
              if (c) {
                list.push(c);
                // Extract and restore students if they are embedded
                if (c.students && Array.isArray(c.students) && c.students.length > 0) {
                  StorageService.saveStudents(c.students, c.id);
                }
              }
            });
          }
          StorageService.saveClassesList(list);
          onClassesUpdated(list);
        });
      } catch (e) {}
    }

    return () => {
      if (unsubFs) unsubFs();
      if (unsubRtdb) unsubRtdb();
    };
  }

  /**
   * Fetches complete cloud data across RTDB and Firestore in parallel.
   * Restores all classroom data, teacher profiles, school configuration, and student rosters.
   */
  public async fetchCompleteUserCloudData(
    uid?: string,
    email?: string,
    schoolCode?: string
  ): Promise<{
    found: boolean;
    bundle?: UserCloudBundle;
    teacherAccount?: TeacherAccount;
    adminAccount?: SchoolAdminAccount;
    role?: 'teacher' | 'admin';
  }> {
    const cleanUid = (uid || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanSchool = (schoolCode || '').trim().toUpperCase();

    if (!cleanUid && !cleanEmail) {
      return { found: false };
    }

    let foundBundle: UserCloudBundle | null = null;
    let foundTeacher: TeacherAccount | null = null;
    let foundAdmin: SchoolAdminAccount | null = null;
    let foundRole: 'teacher' | 'admin' = 'teacher';

    const lookups: Promise<any>[] = [];

    // RTDB users/{uid}
    if (database && cleanUid) {
      lookups.push(
        get(ref(database, 'users/' + cleanUid))
          .then(snap => {
            if (snap.exists()) {
              const val = snap.val();
              if (val?.appData && !foundBundle) {
                foundBundle = val.appData as UserCloudBundle;
              }
              if (val?.teacherAccount && !foundTeacher) {
                foundTeacher = val.teacherAccount;
              }
            }
          })
          .catch(() => null)
      );
    }

    // RTDB email_accounts/{emailKey}
    if (database && cleanEmail) {
      const emailKey = this.sanitizeEmailKey(cleanEmail);
      lookups.push(
        get(ref(database, 'email_accounts/' + emailKey))
          .then(snap => {
            if (snap.exists()) {
              const val = snap.val();
              if (val?.appData && !foundBundle) {
                foundBundle = val.appData as UserCloudBundle;
              }
              if (val?.teacherAccount && !foundTeacher) {
                foundTeacher = val.teacherAccount;
              }
              if (val?.adminAccount && !foundAdmin) {
                foundAdmin = val.adminAccount;
              }
              if (val?.role) {
                foundRole = val.role;
              }
            }
          })
          .catch(() => null)
      );
    }

    // Firestore users/{uid}
    if (firestore && cleanUid) {
      lookups.push(
        fsGetDoc(fsDoc(firestore, 'users', cleanUid))
          .then(snap => {
            if (snap.exists()) {
              const val = snap.data();
              if (val?.appData && !foundBundle) {
                foundBundle = val.appData as UserCloudBundle;
              }
              if (val?.teacherAccount && !foundTeacher) {
                foundTeacher = val.teacherAccount;
              }
              if (val?.adminAccount && !foundAdmin) {
                foundAdmin = val.adminAccount;
              }
              if (val?.role) {
                foundRole = val.role;
              }
            }
          })
          .catch(() => null)
      );
    }

    // Firestore query users by email
    if (firestore && cleanEmail && !cleanUid) {
      lookups.push(
        fsGetDocs(fsQuery(fsCollection(firestore, 'users'), fsWhere('email', '==', cleanEmail)))
          .then(querySnap => {
            if (!querySnap.empty) {
              const docData = querySnap.docs[0].data();
              if (docData?.appData && !foundBundle) {
                foundBundle = docData.appData as UserCloudBundle;
              }
              if (docData?.teacherAccount && !foundTeacher) {
                foundTeacher = docData.teacherAccount;
              }
              if (docData?.role) {
                foundRole = docData.role;
              }
            }
          })
          .catch(() => null)
      );
    }

    // RTDB teacher lookup in teachers/ and schools/{cleanSchool}/teachers
    if (database) {
      if (cleanSchool) {
        lookups.push(
          get(ref(database, `schools/${cleanSchool}/teachers`))
            .then(snap => {
              if (snap.exists()) {
                snap.forEach(child => {
                  const val = child.val() as TeacherAccount;
                  const tEmail = (val?.email || val?.gmail || '').trim().toLowerCase();
                  const tUid = val?.uid || val?.id || child.key;
                  if ((cleanEmail && tEmail === cleanEmail) || (cleanUid && tUid === cleanUid)) {
                    if (!foundTeacher) foundTeacher = val;
                  }
                });
              }
            })
            .catch(() => null)
        );
      }
      lookups.push(
        get(ref(database, 'teachers'))
          .then(snap => {
            if (snap.exists()) {
              snap.forEach(child => {
                const val = child.val() as TeacherAccount;
                const tEmail = (val?.email || val?.gmail || '').trim().toLowerCase();
                const tUid = val?.uid || val?.id || child.key;
                if ((cleanEmail && tEmail === cleanEmail) || (cleanUid && tUid === cleanUid)) {
                  if (!foundTeacher) foundTeacher = val;
                }
              });
            }
          })
          .catch(() => null)
      );
    }

    await Promise.allSettled(lookups);

    if (foundBundle) {
      this.applyCloudBundle(foundBundle);

      if (!foundTeacher && foundBundle.teacherAccounts && foundBundle.teacherAccounts.length > 0) {
        foundTeacher = foundBundle.teacherAccounts.find(t =>
          (cleanEmail && (t.email?.toLowerCase() === cleanEmail || t.gmail?.toLowerCase() === cleanEmail)) ||
          (cleanUid && (t.id === cleanUid || t.uid === cleanUid))
        ) || foundBundle.teacherAccounts[0];
      }

      if (!foundTeacher && foundBundle.teacherInfo) {
        foundTeacher = {
          id: cleanUid || `teach-${Date.now()}`,
          uid: cleanUid || undefined,
          name: foundBundle.teacherInfo.teacherName || 'Teacher',
          email: cleanEmail || foundBundle.teacherInfo.email || '',
          gmail: cleanEmail || foundBundle.teacherInfo.email || '',
          phone: foundBundle.teacherInfo.phone || '',
          schoolName: foundBundle.schoolProfile.schoolName || "St. Sebastian's Higher Secondary School",
          schoolCode: cleanSchool || foundBundle.schoolProfile.schoolCode || 'SSHSS@111213',
          subject: foundBundle.teacherInfo.designation || 'General',
          designation: foundBundle.teacherInfo.designation || 'Class Teacher',
          status: 'active',
          academicYear: foundBundle.teacherInfo.academicYear || '2026-2027',
          createdAt: new Date().toISOString()
        };
      }

      return {
        found: true,
        bundle: foundBundle,
        teacherAccount: foundTeacher || undefined,
        adminAccount: foundAdmin || undefined,
        role: foundRole
      };
    }

    if (foundTeacher) {
      return {
        found: true,
        teacherAccount: foundTeacher,
        role: 'teacher'
      };
    }

    return { found: false };
  }

  /**
   * Restores a teacher's classroom permanently associated with their Firebase UID / user account.
   * Guarantees:
   * 1. Restores the exact same classroom the teacher originally created.
   * 2. Prevents creating duplicate or dummy copies of the classroom.
   * 3. Completely restores associated students, attendance, exams, and marks.
   * 4. Permanently selects and displays the restored classroom as active.
   */
  public async restoreTeacherClassroom(
    teacherUid: string,
    teacherEmail?: string,
    schoolCode?: string
  ): Promise<{
    success: boolean;
    activeClassId?: string;
    classItem?: ClassItem;
    classes: ClassItem[];
  }> {
    const cleanUid = (teacherUid || '').trim();
    const cleanEmail = (teacherEmail || '').trim().toLowerCase();
    const cleanSchool = (schoolCode || '').trim().toUpperCase();

    if (!cleanUid && !cleanEmail) {
      const localClasses = StorageService.getClassesList();
      const activeId = StorageService.getActiveClassId();
      const activeItem = localClasses.find(c => c.id === activeId);
      return { success: false, activeClassId: activeId, classItem: activeItem, classes: localClasses };
    }

    try {
      // 1. Fetch complete cloud data (parallel lookup across RTDB & Firestore)
      const cloudRes = await this.fetchCompleteUserCloudData(cleanUid, cleanEmail, cleanSchool);
      const foundBundle = cloudRes.bundle || null;

      // 2. Query school classes from RTDB & Firestore concurrently
      const retrievedClasses: ClassItem[] = [];
      const retrievedStudentsMap: Record<string, Student[]> = {};

      // Seed with classes from foundBundle
      if (foundBundle?.classesCatalog && Array.isArray(foundBundle.classesCatalog)) {
        foundBundle.classesCatalog.forEach(c => {
          if (c && c.id) {
            retrievedClasses.push(c);
            const studs = foundBundle?.classData?.[c.id]?.students;
            if (studs && Array.isArray(studs) && studs.length > 0) {
              retrievedStudentsMap[c.id] = studs;
            }
          }
        });
      }

      const schoolLookups: Promise<any>[] = [];

      // RTDB school classes query
      if (database && cleanSchool) {
        schoolLookups.push(
          get(ref(database, `schools/${cleanSchool}/classes`))
            .then(schoolSnap => {
              if (schoolSnap.exists()) {
                schoolSnap.forEach(child => {
                  const val = child.val();
                  if (val && val.id) {
                    const cUid = val.teacherUid || val.teacherId || val.createdByTeacherId || '';
                    const cEmail = (val.createdByTeacherEmail || '').trim().toLowerCase();
                    const isMatch = (cleanUid && cUid === cleanUid) || (cleanEmail && cEmail === cleanEmail);
                    if (isMatch) {
                      if (!retrievedClasses.some(c => c.id === val.id)) {
                        retrievedClasses.push(val as ClassItem);
                      }
                      if (val.students && Array.isArray(val.students)) {
                        retrievedStudentsMap[val.id] = val.students;
                      }
                    }
                  }
                });
              }
            })
            .catch(e => console.warn('RTDB school classes query note:', e))
        );
      }

      // Firestore school classes query
      if (firestore && cleanSchool) {
        schoolLookups.push(
          fsGetDocs(fsCollection(firestore, `schools/${cleanSchool}/classes`))
            .then(fsDocs => {
              fsDocs.forEach((d: any) => {
                const val = d.data();
                if (val && (val.id || d.id)) {
                  const id = val.id || d.id;
                  const cUid = val.teacherUid || val.teacherId || val.createdByTeacherId || '';
                  const cEmail = (val.createdByTeacherEmail || '').trim().toLowerCase();
                  const isMatch = (cleanUid && cUid === cleanUid) || (cleanEmail && cEmail === cleanEmail);
                  if (isMatch && !retrievedClasses.some(c => c.id === id)) {
                    retrievedClasses.push({ ...val, id });
                  }
                  if (val.students && Array.isArray(val.students)) {
                    retrievedStudentsMap[id] = val.students;
                  }
                }
              });
            })
            .catch(e => console.warn('Firestore school classes query note:', e))
        );
      }

      // Teacher signups metadata query in RTDB
      let signupClassMeta: { className?: string; standard?: string; stream?: string; section?: string; academicYear?: string } | null = null;
      if (database && cleanUid) {
        schoolLookups.push(
          get(ref(database, 'teacherSignups/' + cleanUid))
            .then(signupSnap => {
              if (signupSnap.exists()) {
                const val = signupSnap.val();
                if (val) {
                  signupClassMeta = {
                    className: val.assignedClass || val.className,
                    standard: val.standard,
                    stream: val.stream,
                    section: val.section,
                    academicYear: val.academicYear
                  };
                }
              }
            })
            .catch(() => null)
        );
      }

      await Promise.allSettled(schoolLookups);

      // 3. Merge retrieved cloud classes into local classes with deduplication
      const localClasses = StorageService.getClassesList();
      const allClassMap = new Map<string, ClassItem>();

      // Load existing local classes first
      localClasses.forEach(c => {
        if (c && c.id) allClassMap.set(c.id, c);
      });

      // Merge retrieved classes
      retrievedClasses.forEach(rc => {
        if (!rc || !rc.id) return;
        if (!allClassMap.has(rc.id)) {
          allClassMap.set(rc.id, rc);
        } else {
          const existing = allClassMap.get(rc.id)!;
          allClassMap.set(rc.id, {
            ...existing,
            ...rc,
            id: rc.id,
            teacherUid: rc.teacherUid || existing.teacherUid || cleanUid,
            teacherId: rc.teacherId || existing.teacherId || cleanUid,
            createdAt: existing.createdAt || rc.createdAt
          });
        }
      });

      // Restore students if cloud had them and local has none
      Object.entries(retrievedStudentsMap).forEach(([cid, studs]) => {
        const localStuds = StorageService.getStudents(cid);
        if (localStuds.length === 0 && studs.length > 0) {
          StorageService.saveStudents(studs, cid);
          const c = allClassMap.get(cid);
          if (c) {
            c.classStrength = studs.length;
          }
        }
      });

      // Partition classes into this teacher's classes and others
      const mergedList = Array.from(allClassMap.values());
      const teacherClassesList: ClassItem[] = [];
      const otherClassesList: ClassItem[] = [];

      mergedList.forEach(c => {
        const cUid = c.teacherUid || c.teacherId || c.createdByTeacherId || '';
        const cEmail = (c.createdByTeacherEmail || '').trim().toLowerCase();
        const isTeacherOwner = (
          (cleanUid && cUid === cleanUid) ||
          (cleanEmail && cEmail === cleanEmail) ||
          Boolean(foundBundle?.classesCatalog?.some(bc => bc.id === c.id)) ||
          (mergedList.length === 1 && !cUid && !cEmail)
        );

        if (isTeacherOwner) {
          c.teacherUid = cleanUid || c.teacherUid;
          c.teacherId = cleanUid || c.teacherId;
          c.createdByTeacherEmail = cleanEmail || c.createdByTeacherEmail;
          teacherClassesList.push(c);
        } else {
          otherClassesList.push(c);
        }
      });

      // Deduplicate teacherClassesList by normalized standard + section + stream
      const dedupedTeacherClasses: ClassItem[] = [];
      const seenTeacherClassKeys = new Set<string>();

      // Sort by creation date ascending (original class first)
      teacherClassesList.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      for (const tc of teacherClassesList) {
        const key = `${(tc.standard || '').trim().toLowerCase()}::${(tc.section || '').trim().toLowerCase()}::${(tc.stream || '').trim().toLowerCase()}`;
        if (!seenTeacherClassKeys.has(key)) {
          seenTeacherClassKeys.add(key);
          dedupedTeacherClasses.push(tc);
        } else {
          // If a duplicate copy existed, preserve students/data
          const canonical = dedupedTeacherClasses.find(c =>
            `${(c.standard || '').trim().toLowerCase()}::${(c.section || '').trim().toLowerCase()}::${(c.stream || '').trim().toLowerCase()}` === key
          );
          if (canonical) {
            const canonicalStuds = StorageService.getStudents(canonical.id);
            const dupStuds = StorageService.getStudents(tc.id);
            if (canonicalStuds.length === 0 && dupStuds.length > 0) {
              StorageService.saveStudents(dupStuds, canonical.id);
              canonical.classStrength = dupStuds.length;
            }
          }
        }
      }

      // If no teacher classes found yet, but signup metadata existed, create and associate the original classroom
      if (dedupedTeacherClasses.length === 0 && signupClassMeta && signupClassMeta.standard && signupClassMeta.section) {
        const fallbackClassId = `class-${cleanUid.substring(0, 8) || Date.now()}`;
        const newClass: ClassItem = {
          id: fallbackClassId,
          className: signupClassMeta.className || `${signupClassMeta.standard} ${signupClassMeta.stream || ''} ${signupClassMeta.section}`.trim(),
          standard: signupClassMeta.standard,
          stream: signupClassMeta.stream || '',
          section: signupClassMeta.section,
          academicYear: signupClassMeta.academicYear || '2026-2027',
          classStrength: 0,
          teacherId: cleanUid,
          teacherUid: cleanUid,
          teacherName: '',
          schoolCode: cleanSchool,
          isTeacherCreated: true,
          createdByTeacherId: cleanUid,
          createdByTeacherEmail: cleanEmail,
          createdAt: new Date().toISOString()
        };
        dedupedTeacherClasses.push(newClass);
        StorageService.addNewClass(newClass, []);
        this.saveClassToSchool(cleanSchool, newClass, []).catch(() => {});
      }

      // If still empty but other classes exist and only 1 exists, adopt it
      if (dedupedTeacherClasses.length === 0 && otherClassesList.length === 1) {
        const singleClass = otherClassesList.shift()!;
        singleClass.teacherUid = cleanUid;
        singleClass.teacherId = cleanUid;
        singleClass.createdByTeacherEmail = cleanEmail;
        dedupedTeacherClasses.push(singleClass);
      }

      // Combine back with other classes
      const finalAllClasses = [...otherClassesList, ...dedupedTeacherClasses];
      StorageService.saveClassesList(finalAllClasses);

      // Select the primary classroom for this teacher
      const primaryClass = dedupedTeacherClasses[0];
      if (primaryClass) {
        StorageService.setActiveClassId(primaryClass.id);
        StorageService.saveClassInfo({
          id: primaryClass.id,
          standard: primaryClass.standard,
          stream: primaryClass.stream,
          section: primaryClass.section,
          className: primaryClass.className,
          academicYear: primaryClass.academicYear,
          classStrength: primaryClass.classStrength
        }, primaryClass.id);

        return {
          success: true,
          activeClassId: primaryClass.id,
          classItem: primaryClass,
          classes: dedupedTeacherClasses
        };
      }

      return {
        success: false,
        activeClassId: StorageService.getActiveClassId(cleanUid, cleanEmail),
        classes: dedupedTeacherClasses
      };
    } catch (err) {
      console.warn('restoreTeacherClassroom error:', err);
      const localClasses = StorageService.getClassesList();
      return { success: false, classes: localClasses };
    }
  }

  /**
   * Saves entered Gmail addresses in Firebase Realtime Database under 'gmail/${safeKey}'.
   * NEVER saves passwords.
   */
  public async recordGmailEntry(
    gmail: string,
    metadata: {
      role?: 'teacher' | 'admin' | string;
      name?: string;
      schoolCode?: string;
      loginMethod?: 'email' | 'google' | string;
    } = {}
  ): Promise<void> {
    if (!gmail || !database) return;
    try {
      const cleanEmail = gmail.trim().toLowerCase();
      if (!cleanEmail.includes('@')) return;
      const safeKey = this.sanitizeEmailKey(cleanEmail);
      const gmailRef = ref(database, `gmail/${safeKey}`);
      const now = new Date().toISOString();
      await update(gmailRef, {
        gmail: cleanEmail,
        role: metadata.role || 'teacher',
        name: metadata.name || '',
        schoolCode: metadata.schoolCode || '',
        loginMethod: metadata.loginMethod || 'email',
        lastEntryAt: now,
        updatedAt: now
      });
    } catch (e) {
      console.warn('recordGmailEntry note:', e);
    }
  }

  /**
   * Compatibility alias that records entered Gmail under 'gmail'.
   * Deliberately discards any password parameter - passwords are NEVER stored in the database.
   */
  public async storeCredentials(gmail: string, _password?: string, role: string = 'teacher'): Promise<void> {
    await this.recordGmailEntry(gmail, { role });
  }

  public async recordTeacherActivity(
    schoolCode: string,
    activity: {
      teacherId: string;
      teacherName: string;
      subject?: string;
      assignedClass?: string;
      activityType: TeacherActivityItem['activityType'];
      description: string;
    }
  ): Promise<void> {
    if (!schoolCode) return;
    const cleanCode = schoolCode.trim().toUpperCase();
    const actId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const activityItem: TeacherActivityItem = {
      id: actId,
      schoolCode: cleanCode,
      teacherId: activity.teacherId,
      teacherName: activity.teacherName,
      subject: activity.subject,
      assignedClass: activity.assignedClass,
      activityType: activity.activityType,
      description: activity.description,
      timestamp: now
    };

    try {
      const actRefPath = ref(database, `schools/${cleanCode}/activities/${actId}`);
      await set(actRefPath, activityItem);

      if (activity.teacherId) {
        const teacherRefPath = ref(database, `schools/${cleanCode}/teachers/${activity.teacherId}`);
        await update(teacherRefPath, {
          lastActiveAt: now,
          recentActivity: activity.description
        });
      }
    } catch (e) {
      console.warn('Error logging real-time teacher activity to RTDB:', e);
    }
  }

  public listenToSchoolTeachers(
    schoolCode: string,
    onTeachersUpdated: (teachers: TeacherAccount[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    if (this.unsubscribeSchoolTeachersSnapshot) {
      try {
        this.unsubscribeSchoolTeachersSnapshot();
      } catch (e) {}
      this.unsubscribeSchoolTeachersSnapshot = null;
    }

    try {
      const teachersRefPath = ref(database, `schools/${cleanCode}/teachers`);
      this.unsubscribeSchoolTeachersSnapshot = onValue(
        teachersRefPath,
        async snapshot => {
          const map = new Map<string, TeacherAccount>();

          const addTeacher = (t: any) => {
            if (
              t &&
              t.status !== 'deleted' &&
              t.status !== 'permanently_deleted' &&
              t.status !== 'temporary_deleted' &&
              !t.temporarilyDeleted &&
              !t.permanentlyDeleted
            ) {
              const key = t.uid || t.id || t.email || t.gmail;
              if (!key) return;

              // Ensure temporary and permanent deletion flags in local storage are cleared for active cloud teachers
              StorageService.removeTemporarilyDeletedTeacherId(t.id, t.email || t.gmail);
              StorageService.removePermanentlyDeletedTeacherId(t.id, t.email || t.gmail);
              if (t.uid) {
                StorageService.removeTemporarilyDeletedTeacherId(t.uid);
                StorageService.removePermanentlyDeletedTeacherId(t.uid);
              }

              map.set(key, {
                ...t,
                id: key,
                uid: key,
                email: t.email || t.gmail || '',
                gmail: t.gmail || t.email || '',
                schoolCode: cleanCode,
                status: 'active'
              });
            }
          };

          if (snapshot.exists()) {
            snapshot.forEach(childSnap => {
              addTeacher(childSnap.val());
            });
          }

          // Fallback query to root teachers/ in RTDB for matching schoolCode
          try {
            const rootTeachersSnap = await get(ref(database, 'teachers')).catch(() => null);
            if (rootTeachersSnap && rootTeachersSnap.exists()) {
              rootTeachersSnap.forEach(child => {
                const val = child.val();
                if (val && val.schoolCode && val.schoolCode.trim().toUpperCase() === cleanCode) {
                  addTeacher(val);
                }
              });
            }
          } catch (e) {}

          // Fallback query to Firestore schools/schoolCode/teachers
          if (firestore) {
            try {
              const fsDocs = await fsGetDocs(fsCollection(firestore, `schools/${cleanCode}/teachers`)).catch(() => null);
              if (fsDocs && !fsDocs.empty) {
                fsDocs.forEach((d: any) => {
                  const val = d.data();
                  if (val) addTeacher({ ...val, id: val.id || d.id });
                });
              }
            } catch (e) {}
          }

          const remoteTeachers = Array.from(map.values());
          const localTeachers = StorageService.getTeacherAccounts();
          const otherSchoolTeachers = localTeachers.filter(lt => (lt.schoolCode || '').trim().toUpperCase() !== cleanCode);
          const updatedLocalTeachers = [...otherSchoolTeachers, ...remoteTeachers];
          StorageService.saveTeacherAccounts(updatedLocalTeachers);

          onTeachersUpdated(remoteTeachers);
        },
        error => {
          console.warn('Error listening to school teachers:', error);
        }
      );
    } catch (e) {
      console.warn('Could not establish real-time school teachers listener:', e);
    }

    let unsubFs: (() => void) | null = null;
    if (firestore) {
      try {
        const fsColRef = fsCollection(firestore, `schools/${cleanCode}/teachers`);
        unsubFs = fsOnSnapshot(fsColRef, (snapshot: any) => {
          if (snapshot && !snapshot.empty) {
            const fsTeachersList: TeacherAccount[] = [];
            snapshot.forEach((d: any) => {
              const val = d.data();
              if (val && !val.temporarilyDeleted && !val.permanentlyDeleted && val.status !== 'deleted' && val.status !== 'temporary_deleted') {
                const idKey = val.uid || val.id || d.id;
                StorageService.removeTemporarilyDeletedTeacherId(idKey, val.email || val.gmail);
                StorageService.removePermanentlyDeletedTeacherId(idKey, val.email || val.gmail);
                fsTeachersList.push({
                  ...val,
                  id: idKey,
                  uid: idKey,
                  email: val.email || val.gmail || '',
                  gmail: val.gmail || val.email || '',
                  schoolCode: cleanCode,
                  status: 'active'
                });
              }
            });
            if (fsTeachersList.length > 0) {
              onTeachersUpdated(fsTeachersList);
            }
          }
        }, (fsErr: any) => {
          console.warn('Firestore real-time teachers listener note:', fsErr);
        });
      } catch (e) {}
    }

    return () => {
      if (this.unsubscribeSchoolTeachersSnapshot) {
        this.unsubscribeSchoolTeachersSnapshot();
        this.unsubscribeSchoolTeachersSnapshot = null;
      }
      if (unsubFs) {
        unsubFs();
      }
    };
  }

  public async clearSchoolActivities(schoolCode: string): Promise<boolean> {
    if (!schoolCode) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    try {
      const activitiesRefPath = ref(database, `schools/${cleanCode}/activities`);
      await remove(activitiesRefPath);
      return true;
    } catch (e) {
      console.error('Error clearing school activities:', e);
      return false;
    }
  }

  public listenToSchoolActivities(
    schoolCode: string,
    onActivitiesUpdated: (activities: TeacherActivityItem[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    if (this.unsubscribeSchoolActivitiesSnapshot) {
      try {
        this.unsubscribeSchoolActivitiesSnapshot();
      } catch (e) {}
      this.unsubscribeSchoolActivitiesSnapshot = null;
    }

    try {
      const activitiesRefPath = ref(database, `schools/${cleanCode}/activities`);
      this.unsubscribeSchoolActivitiesSnapshot = onValue(
        activitiesRefPath,
        snapshot => {
          const list: TeacherActivityItem[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(childSnap => {
              const act = childSnap.val() as TeacherActivityItem;
              if (act) list.push(act);
            });
          }

          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onActivitiesUpdated(list.slice(0, 30));
        },
        error => {
          console.warn('Error listening to school activities:', error);
        }
      );
    } catch (e) {
      console.warn('Could not establish real-time school activities listener:', e);
    }

    return () => {
      if (this.unsubscribeSchoolActivitiesSnapshot) {
        this.unsubscribeSchoolActivitiesSnapshot();
        this.unsubscribeSchoolActivitiesSnapshot = null;
      }
    };
  }

  // ------------------ SCHOOL BROADCASTS ------------------
  public async saveBroadcastToSchool(schoolCode: string, broadcast: PrincipalBroadcast): Promise<boolean> {
    if (!schoolCode || !broadcast || !broadcast.id) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await set(ref(database, `schools/${cleanCode}/broadcasts/${broadcast.id}`), broadcast);
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/broadcasts/${broadcast.id}`);
        await fsSetDoc(docRef, broadcast, { merge: true });
      } catch (e) {}
    }
    return true;
  }

  public async deleteBroadcastFromSchool(schoolCode: string, broadcastId: string): Promise<boolean> {
    if (!schoolCode || !broadcastId) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await remove(ref(database, `schools/${cleanCode}/broadcasts/${broadcastId}`));
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/broadcasts/${broadcastId}`);
        await fsDeleteDoc(docRef);
      } catch (e) {}
    }
    return true;
  }

  public listenToSchoolBroadcasts(
    schoolCode: string,
    onBroadcastsUpdated: (broadcasts: PrincipalBroadcast[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const bRef = ref(database, `schools/${cleanCode}/broadcasts`);
        unsubRtdb = onValue(bRef, snapshot => {
          const list: PrincipalBroadcast[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(child => {
              const b = child.val();
              if (b) list.push(b);
            });
          }
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          StorageService.savePrincipalBroadcasts(list);
          onBroadcastsUpdated(list);
        });
      } catch (e) {}
    }
    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  // ------------------ SCHOOL TIMETABLES ------------------
  public async saveTimetableSlotToSchool(schoolCode: string, slot: TimetableSlot): Promise<boolean> {
    if (!schoolCode || !slot || !slot.id) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await set(ref(database, `schools/${cleanCode}/timetables/${slot.id}`), slot);
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/timetables/${slot.id}`);
        await fsSetDoc(docRef, slot, { merge: true });
      } catch (e) {}
    }
    return true;
  }

  public async saveTimetablesToSchool(schoolCode: string, slots: TimetableSlot[]): Promise<boolean> {
    if (!schoolCode) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        const timetablesMap: Record<string, TimetableSlot> = {};
        slots.forEach(s => {
          if (s.id) timetablesMap[s.id] = s;
        });
        await set(ref(database, `schools/${cleanCode}/timetables`), timetablesMap);
      } catch (e) {}
    }
    return true;
  }

  public async deleteTimetableSlotFromSchool(schoolCode: string, slotId: string): Promise<boolean> {
    if (!schoolCode || !slotId) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await remove(ref(database, `schools/${cleanCode}/timetables/${slotId}`));
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/timetables/${slotId}`);
        await fsDeleteDoc(docRef);
      } catch (e) {}
    }
    return true;
  }

  public listenToSchoolTimetables(
    schoolCode: string,
    onTimetablesUpdated: (slots: TimetableSlot[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const tRef = ref(database, `schools/${cleanCode}/timetables`);
        unsubRtdb = onValue(tRef, snapshot => {
          const list: TimetableSlot[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(child => {
              const s = child.val();
              if (s) list.push(s);
            });
          }
          StorageService.saveTimetables(list);
          onTimetablesUpdated(list);
        });
      } catch (e) {}
    }
    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  // ------------------ SCHOOL STUDENTS ------------------
  public async saveStudentToSchool(schoolCode: string, student: Student): Promise<boolean> {
    if (!schoolCode || !student || !student.id) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await set(ref(database, `schools/${cleanCode}/students/${student.id}`), student);
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/students/${student.id}`);
        await fsSetDoc(docRef, student, { merge: true });
      } catch (e) {}
    }
    return true;
  }

  public async deleteStudentFromSchool(schoolCode: string, studentId: string): Promise<boolean> {
    if (!schoolCode || !studentId) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await remove(ref(database, `schools/${cleanCode}/students/${studentId}`));
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/students/${studentId}`);
        await fsDeleteDoc(docRef);
      } catch (e) {}
    }
    return true;
  }

  public listenToSchoolStudents(
    schoolCode: string,
    onStudentsUpdated: (students: Student[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const sRef = ref(database, `schools/${cleanCode}/students`);
        unsubRtdb = onValue(sRef, snapshot => {
          const list: Student[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(child => {
              const st = child.val();
              if (st) list.push(st);
            });
          }
          StorageService.saveStudents(list);
          onStudentsUpdated(list);
        });
      } catch (e) {}
    }
    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  // ------------------ SCHOOL PROFILE ------------------
  public async saveSchoolProfileToSchool(schoolCode: string, profile: SchoolProfile): Promise<boolean> {
    if (!schoolCode || !profile) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await set(ref(database, `schools/${cleanCode}/schoolProfile`), profile);
      } catch (e) {}
    }
    if (firestore) {
      try {
        const docRef = fsDoc(firestore, `schools/${cleanCode}/schoolProfile/info`);
        await fsSetDoc(docRef, profile, { merge: true });
      } catch (e) {}
    }
    return true;
  }

  public listenToSchoolProfile(
    schoolCode: string,
    onProfileUpdated: (profile: SchoolProfile) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const pRef = ref(database, `schools/${cleanCode}/schoolProfile`);
        unsubRtdb = onValue(pRef, snapshot => {
          if (snapshot.exists()) {
            const prof = snapshot.val() as SchoolProfile;
            if (prof && prof.schoolName) {
              StorageService.saveSchoolProfile(prof);
              onProfileUpdated(prof);
            }
          }
        });
      } catch (e) {}
    }
    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  // ------------------ AUDIT LOGS ------------------
  public async saveAuditLogToSchool(schoolCode: string, logItem: AuditLogItem): Promise<boolean> {
    if (!schoolCode || !logItem || !logItem.id) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await set(ref(database, `schools/${cleanCode}/auditLogs/${logItem.id}`), logItem);
      } catch (e) {}
    }
    return true;
  }

  public async clearAuditLogsFromSchool(schoolCode: string): Promise<boolean> {
    if (!schoolCode) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    if (database) {
      try {
        await remove(ref(database, `schools/${cleanCode}/auditLogs`));
      } catch (e) {}
    }
    return true;
  }

  public listenToSchoolAuditLogs(
    schoolCode: string,
    onAuditLogsUpdated: (logs: AuditLogItem[]) => void
  ): () => void {
    if (!schoolCode) return () => {};
    const cleanCode = schoolCode.trim().toUpperCase();

    let unsubRtdb: (() => void) | null = null;
    if (database) {
      try {
        const aRef = ref(database, `schools/${cleanCode}/auditLogs`);
        unsubRtdb = onValue(aRef, snapshot => {
          const list: AuditLogItem[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(child => {
              const item = child.val();
              if (item) list.push(item);
            });
          }
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          StorageService.saveAuditLogs(list);
          onAuditLogsUpdated(list);
        });
      } catch (e) {}
    }
    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  public async fetchSchoolTeachers(schoolCode: string): Promise<TeacherAccount[]> {
    if (!schoolCode) return [];
    const cleanCode = schoolCode.trim().toUpperCase();

    try {
      const teachersRefPath = ref(database, `schools/${cleanCode}/teachers`);
      const snap = await get(teachersRefPath);
      const list: TeacherAccount[] = [];
      if (snap.exists()) {
        snap.forEach(childSnap => {
          const t = childSnap.val() as TeacherAccount;
          if (t) list.push(t);
        });
      }
      return list;
    } catch (e) {
      console.warn('Error fetching school teachers from RTDB:', e);
      return [];
    }
  }

  public async fetchTeacherCredential(
    gmail: string,
    schoolCode?: string
  ): Promise<{
    found: boolean;
    valid: boolean;
    reason?: 'status_inactive' | 'school_mismatch' | 'not_found';
    teacher?: TeacherAccount;
  }> {
    if (!gmail || !gmail.trim()) return { found: false, valid: false, reason: 'not_found' };
    const cleanGmail = gmail.trim().toLowerCase();
    const cleanSchoolCode = schoolCode ? schoolCode.trim().toUpperCase() : '';

    // Fast local accounts check first (0ms)
    try {
      const localTeachers = StorageService.getTeacherAccounts();
      const localMatch = localTeachers.find(t => 
        (t.email && t.email.toLowerCase() === cleanGmail) || 
        (t.gmail && t.gmail.toLowerCase() === cleanGmail)
      );
      if (localMatch) {
        if (localMatch.status && localMatch.status !== 'active') {
          return { found: true, valid: false, reason: 'status_inactive', teacher: localMatch };
        }
        if (cleanSchoolCode && localMatch.schoolCode && localMatch.schoolCode.toUpperCase() !== cleanSchoolCode) {
          return { found: true, valid: false, reason: 'school_mismatch', teacher: localMatch };
        }
        return { found: true, valid: true, teacher: localMatch };
      }
    } catch (e) {}

    let matchedTeacher: TeacherAccount | null = null;
    const queries: Promise<any>[] = [];

    if (database) {
      const emailKey = this.sanitizeEmailKey(cleanGmail);
      // Check email_accounts/{emailKey}
      queries.push(
        get(ref(database, 'email_accounts/' + emailKey))
          .then(snap => {
            if (snap.exists()) {
              const val = snap.val();
              if (val?.teacherAccount && !matchedTeacher) {
                matchedTeacher = val.teacherAccount;
              }
            }
          })
          .catch(() => null)
      );

      // Check teachers collection
      queries.push(
        get(ref(database, 'teachers'))
          .then(snap => {
            if (snap.exists()) {
              snap.forEach(child => {
                const val = child.val() as TeacherAccount;
                const tEmail = (val.gmail || val.email || '').trim().toLowerCase();
                if (tEmail === cleanGmail && !matchedTeacher) {
                  matchedTeacher = val;
                }
              });
            }
          })
          .catch(() => null)
      );

      // Check schools/{cleanSchoolCode}/teachers
      if (cleanSchoolCode) {
        queries.push(
          get(ref(database, `schools/${cleanSchoolCode}/teachers`))
            .then(schoolSnap => {
              if (schoolSnap.exists()) {
                schoolSnap.forEach(child => {
                  const val = child.val() as TeacherAccount;
                  const tEmail = (val.gmail || val.email || '').trim().toLowerCase();
                  if (tEmail === cleanGmail && !matchedTeacher) {
                    matchedTeacher = val;
                  }
                });
              }
            })
            .catch(() => null)
        );
      }
    }

    if (firestore) {
      queries.push(
        fsGetDocs(fsQuery(fsCollection(firestore, 'users'), fsWhere('email', '==', cleanGmail)))
          .then(querySnap => {
            if (!querySnap.empty && !matchedTeacher) {
              const docData = querySnap.docs[0].data();
              if (docData?.teacherAccount) {
                matchedTeacher = docData.teacherAccount;
              }
            }
          })
          .catch(() => null)
      );
    }

    await Promise.allSettled(queries);

    if (matchedTeacher) {
      const t = matchedTeacher as TeacherAccount;
      if (t.status && t.status !== 'active') {
        return { found: true, valid: false, reason: 'status_inactive', teacher: t };
      }
      if (cleanSchoolCode && t.schoolCode && t.schoolCode.toUpperCase() !== cleanSchoolCode) {
        return { found: true, valid: false, reason: 'school_mismatch', teacher: t };
      }
      return { found: true, valid: true, teacher: t };
    }

    return { found: false, valid: false, reason: 'not_found' };
  }

  public async logUnauthorizedAttempt(email: string, schoolCode: string, reason: string) {
    try {
      const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const attemptRefPath = ref(database, `unauthorizedAttempts/${attemptId}`);
      await set(attemptRefPath, {
        attemptedEmail: email || 'unknown',
        enteredSchoolCode: schoolCode || 'unknown',
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Error logging unauthorized attempt:', e);
    }
  }

  public async verifyAndSyncSchoolAdmin(
    uid: string,
    email: string,
    schoolCode: string,
    designation?: string
  ): Promise<{
    authorized: boolean;
    reason?: string;
    adminRecord?: {
      id: string;
      email: string;
      schoolCode: string;
      role: string;
      status: string;
      adminName: string;
      schoolName: string;
      designation?: string;
      createdAt: string;
    };
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanSchoolCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const nowIso = new Date().toISOString();

    if (!cleanEmail || !cleanSchoolCode) {
      return {
        authorized: false,
        reason: 'Access Denied\n\nThis Gmail account is not authorized to access this School Admin Panel.'
      };
    }

    // Pre-authorized Gmail accounts for SSHSS@111213
    const PRE_AUTHORIZED_EMAILS = new Set([
      'gelwin72@gmail.com',
      'joicegeorge1910@gmail.com',
      'lincythomas1911@gmail.com'
    ]);

    const isPreAuthorized = PRE_AUTHORIZED_EMAILS.has(cleanEmail);

    // Fast path: Immediately grant access for pre-authorized admins under SSHSS@111213
    if (isPreAuthorized && cleanSchoolCode === 'SSHSS@111213') {
      const adminNameDetermined = designation || (
        cleanEmail.includes('gelwin') ? 'Gelwin' :
        cleanEmail.includes('joice') ? 'Joice George' :
        cleanEmail.includes('lincy') ? 'Lincy Thomas' : 'School Administrator'
      );

      const adminData = {
        id: uid || `admin-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        uid: uid || `admin-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        schoolCode: cleanSchoolCode,
        role: 'schoolAdmin',
        status: 'active',
        adminName: adminNameDetermined,
        schoolName: "St. Sebastian's Higher Secondary School",
        designation: designation || 'Head of School',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      // Non-blocking background sync to RTDB & Firestore
      if (database && uid) {
        try {
          const updates: Record<string, any> = {};
          updates[`schoolAdmins/${uid}`] = adminData;
          updates[`schools/${cleanSchoolCode}/schoolAdmins/${uid}`] = adminData;
          updates[`schools/${cleanSchoolCode}/adminProfile`] = adminData;
          update(ref(database), updates).catch(e => console.warn('RTDB admin sync bg note:', e));
        } catch (e) {}
      }

      if (firestore && uid) {
        try {
          const docRef = fsDoc(firestore, `schoolAdmins/${uid}`);
          fsSetDoc(docRef, adminData, { merge: true }).catch(e => console.warn('Firestore admin sync bg note:', e));
          const schoolAdminRef = fsDoc(firestore, `schools/${cleanSchoolCode}/schoolAdmins/${uid}`);
          fsSetDoc(schoolAdminRef, adminData, { merge: true }).catch(e => console.warn('Firestore school admin sync bg note:', e));
        } catch (e) {}
      }

      return {
        authorized: true,
        adminRecord: {
          id: adminData.id,
          email: cleanEmail,
          schoolCode: cleanSchoolCode,
          role: 'schoolAdmin',
          status: 'active',
          adminName: adminData.adminName,
          schoolName: adminData.schoolName,
          designation: adminData.designation,
          createdAt: adminData.createdAt
        }
      };
    }

    let matchedRecord: any = null;

    // For non-pre-authorized emails, query with tight timeout
    if (database && uid) {
      try {
        const rootAdminRef = ref(database, `schoolAdmins/${uid}`);
        const snap = await Promise.race([
          get(rootAdminRef),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))
        ]).catch(() => null);

        if (snap && snap.exists()) {
          matchedRecord = snap.val();
        }
      } catch (e) {}

      if (!matchedRecord) {
        try {
          const schoolAdminRef = ref(database, `schools/${cleanSchoolCode}/schoolAdmins/${uid}`);
          const snap = await Promise.race([
            get(schoolAdminRef),
            new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))
          ]).catch(() => null);

          if (snap && snap.exists()) {
            matchedRecord = snap.val();
          }
        } catch (e) {}
      }
    }

    if (!matchedRecord && firestore && uid) {
      try {
        const docRef = fsDoc(firestore, `schoolAdmins/${uid}`);
        const docSnap = await Promise.race([
          fsGetDoc(docRef),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))
        ]).catch(() => null);

        if (docSnap && docSnap.exists()) {
          matchedRecord = docSnap.data();
        }
      } catch (e) {}
    }

    if (!matchedRecord && !isPreAuthorized) {
      return {
        authorized: false,
        reason: 'Access Denied\n\nThis Gmail account is not authorized to access this School Admin Panel.'
      };
    }

    // Verify properties if record was found
    const targetCode = String(matchedRecord?.schoolCode || cleanSchoolCode).trim().toUpperCase();
    const targetRole = String(matchedRecord?.role || 'schoolAdmin').trim();
    const targetStatus = String(matchedRecord?.status || 'active').trim().toLowerCase();

    const isSchoolCodeMatch = targetCode === cleanSchoolCode;
    const isRoleValid = targetRole.toLowerCase() === 'schooladmin' || targetRole.toLowerCase() === 'admin' || targetRole.toUpperCase() === 'SCHOOL_ADMIN';
    const isActive = targetStatus === 'active' || targetStatus === 'true';

    if (!isSchoolCodeMatch || !isRoleValid || !isActive) {
      return {
        authorized: false,
        reason: 'Access Denied\n\nThis Gmail account is not authorized to access this School Admin Panel.'
      };
    }

    // Create / Sync authorized admin profile across RTDB & Firestore (non-blocking)
    const adminData = {
      id: uid,
      uid: uid,
      email: cleanEmail,
      schoolCode: cleanSchoolCode,
      role: 'schoolAdmin',
      status: 'active',
      adminName: designation || matchedRecord?.adminName || 'School Administrator',
      schoolName: matchedRecord?.schoolName || "St. Sebastian's Higher Secondary School",
      designation: designation || matchedRecord?.designation || 'Head of School',
      createdAt: matchedRecord?.createdAt || nowIso,
      updatedAt: nowIso
    };

    if (database && uid) {
      try {
        const updates: Record<string, any> = {};
        updates[`schoolAdmins/${uid}`] = adminData;
        updates[`schools/${cleanSchoolCode}/schoolAdmins/${uid}`] = adminData;
        updates[`schools/${cleanSchoolCode}/adminProfile`] = adminData;
        update(ref(database), updates).catch(e => console.warn('Error syncing schoolAdmin to RTDB:', e));
      } catch (e) {
        console.warn('Error syncing schoolAdmin to RTDB:', e);
      }
    }

    if (firestore && uid) {
      try {
        const docRef = fsDoc(firestore, `schoolAdmins/${uid}`);
        fsSetDoc(docRef, adminData, { merge: true }).catch(() => {});

        const schoolAdminRef = fsDoc(firestore, `schools/${cleanSchoolCode}/schoolAdmins/${uid}`);
        fsSetDoc(schoolAdminRef, adminData, { merge: true }).catch(() => {});
      } catch (e) {
        console.warn('Error syncing schoolAdmin to Firestore:', e);
      }
    }

    return {
      authorized: true,
      adminRecord: {
        id: uid,
        email: cleanEmail,
        schoolCode: cleanSchoolCode,
        role: 'schoolAdmin',
        status: 'active',
        adminName: adminData.adminName,
        schoolName: adminData.schoolName,
        designation: adminData.designation,
        createdAt: adminData.createdAt
      }
    };
  }

  public async recordLoginActivity(
    schoolCode: string,
    payload: {
      email: string;
      accessMethod: 'Teacher Sign-Up' | 'Teacher Login' | 'School Admin Panel';
      role: 'teacher' | 'admin';
      success: boolean;
      details?: string;
    }
  ): Promise<void> {
    const cleanCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
    const actId = `login-act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const activityItem = {
      id: actId,
      schoolCode: cleanCode,
      email: payload.email,
      accessMethod: payload.accessMethod,
      role: payload.role,
      success: payload.success,
      details: payload.details || `${payload.email} accessed via ${payload.accessMethod}`,
      timestamp: now,
      activityType: 'login_access'
    };

    try {
      const actRefPath = ref(database, `schools/${cleanCode}/loginActivities/${actId}`);
      await set(actRefPath, activityItem);

      const generalActRefPath = ref(database, `schools/${cleanCode}/activities/${actId}`);
      await set(generalActRefPath, {
        id: actId,
        schoolCode: cleanCode,
        teacherId: payload.email,
        teacherName: payload.email,
        activityType: 'login',
        description: `[${payload.accessMethod}] ${payload.email} ${payload.success ? 'logged in successfully' : 'login failed'}`,
        timestamp: now
      });
    } catch (e) {
      console.warn('Error recording login activity to RTDB:', e);
    }
  }

  public scheduleAutoSync(immediate: boolean = false) {
    const syncEmail = this.getActiveSyncEmail();
    if (!auth?.currentUser && !syncEmail) return;
    if (this.isApplyingRemoteUpdate) return;
    if (this.quotaExhaustedUntil > Date.now()) return;

    // Immediately reflect saving state so user has instantaneous feedback
    this.setSaveState('saving');

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    // 150ms ultra-fast auto-save window for instantaneous response
    const delay = immediate ? 10 : 150;
    this.debounceTimer = setTimeout(() => {
      this.pushToCloud();
    }, delay);
  }
}

export const CloudSync = new CloudSyncManager();

registerStorageMutationListener(() => {
  CloudSync.scheduleAutoSync();
});
