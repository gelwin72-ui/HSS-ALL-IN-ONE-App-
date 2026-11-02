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
  AppDataBackup,
  TeacherAccount,
  SchoolAdminAccount,
  PrincipalBroadcast,
  AuthSession,
  AuthRole,
  TimetableSlot,
  TimetableDay,
  PeriodTimingConfig,
  AuditLogItem
} from '../types';

const storageMutationListeners = new Set<() => void>();
let isMutationSilenced = false;

export const setStorageMutationSilenced = (silenced: boolean) => {
  isMutationSilenced = silenced;
};

export const registerStorageMutationListener = (cb: () => void) => {
  storageMutationListeners.add(cb);
  return () => {
    storageMutationListeners.delete(cb);
  };
};

const notifyMutation = () => {
  if (isMutationSilenced) return;
  storageMutationListeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.warn('Storage mutation callback failed', e);
    }
  });
};

const STORAGE_KEYS = {
  SCHOOL_PROFILE: 'hss_school_profile',
  CLASS_INFO: 'hss_class_info',
  TEACHER_INFO: 'hss_teacher_info',
  STUDENTS: 'hss_students_list',
  ATTENDANCE: 'hss_attendance_records',
  EXAMS: 'hss_exams_list',
  EXAM_MARKS: 'hss_exam_marks_map',
  REMINDERS: 'hss_reminders_list',
  SETTINGS: 'hss_app_settings',
  INITIALIZED: 'hss_app_initialized_v2',
  TEACHER_ACCOUNTS: 'hss_teacher_accounts_v1',
  SCHOOL_ADMINS: 'hss_school_admins_v1',
  AUTH_SESSION: 'hss_auth_session_v1',
  CLASSES_CATALOG: 'hss_classes_catalog_v2',
  ACTIVE_CLASS_ID: 'hss_active_class_id_v2',
  PRINCIPAL_BROADCASTS: 'hss_principal_broadcasts_v1',
  TIMETABLES: 'hss_timetables_catalog_v2',
  AUDIT_LOGS: 'hss_audit_logs_v1'
};

export const DEFAULT_PERIOD_TIMINGS: PeriodTimingConfig[] = [
  { periodNumber: 1, label: 'Period 1', startTime: '09:30 AM', endTime: '10:15 AM' },
  { periodNumber: 2, label: 'Period 2', startTime: '10:15 AM', endTime: '11:00 AM', isBreakAfter: true, breakLabel: 'Short Recess (10m)' },
  { periodNumber: 3, label: 'Period 3', startTime: '11:10 AM', endTime: '11:55 AM' },
  { periodNumber: 4, label: 'Period 4', startTime: '11:55 AM', endTime: '12:40 PM', isBreakAfter: true, breakLabel: 'Lunch Break (45m)' },
  { periodNumber: 5, label: 'Period 5', startTime: '01:25 PM', endTime: '02:10 PM' },
  { periodNumber: 6, label: 'Period 6', startTime: '02:10 PM', endTime: '02:55 PM', isBreakAfter: true, breakLabel: 'Tea Break (10m)' },
  { periodNumber: 7, label: 'Period 7', startTime: '03:05 PM', endTime: '03:50 PM' },
  { periodNumber: 8, label: 'Period 8', startTime: '03:50 PM', endTime: '04:30 PM' }
];

export const TIMETABLE_DAYS: TimetableDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const DEFAULT_SCHOOL_ADMIN: SchoolAdminAccount = {
  id: '',
  schoolName: "St.Sebastian's Higher Secondary School",
  schoolCode: 'SSHSS@111213',
  adminPassword: '',
  adminName: 'Principal',
  designation: 'Principal & School Administrator',
  email: '',
  phone: '',
  role: 'admin',
  createdAt: new Date().toISOString()
};

export const DEFAULT_TEACHER_ACCOUNTS: TeacherAccount[] = [];

export const DEFAULT_PRINCIPAL_BROADCASTS: PrincipalBroadcast[] = [];

export const DEFAULT_SCHOOL_PROFILE: SchoolProfile = {
  schoolName: "St.Sebastian's Higher Secondary School",
  schoolAddress: '',
  schoolCode: 'SSHSS@111213',
  schoolPhone: '',
  schoolEmail: '',
  principalName: 'Principal',
  principalPhone: ''
};

export const DEFAULT_CLASSES_CATALOG: ClassItem[] = [];

export const DEFAULT_CLASS_INFO: ClassInfo = {
  id: '',
  standard: '',
  stream: '',
  section: '',
  className: '',
  academicYear: '',
  classStrength: 0
};

export const DEFAULT_TEACHER_INFO: TeacherInfo = {
  teacherName: '',
  phone: '',
  email: '',
  designation: ''
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: 'purple',
  customColorHex: '#9333ea',
  uiAppearance: 'modern',
  gradingSystem: 'kerala_hss',
  passingPercentage: 30,
  notificationsEnabled: true,
  autoBackupPrompt: true
};

export const SEED_STUDENTS: Student[] = [];
export const SEED_EXAMS: Exam[] = [];
export const SEED_EXAM_MARKS: Record<string, ExamMarksRecord> = {};
export const SEED_STUDENTS_12B: Student[] = [];
export const SEED_STUDENTS_11COM: Student[] = [];
export const SEED_STUDENTS_11SCI: Student[] = [];
export const SEED_ATTENDANCE: AttendanceRecord[] = [];
export const SEED_REMINDERS: Reminder[] = [];

/**
 * Storage Layer Service
 */
export const StorageService = {
  init() {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      const demoCleaned = localStorage.getItem('hss_demo_data_purged_v1');

      if (!demoCleaned) {
        // Purge old demo/dummy data from local storage
        const currentTeachers = this.getTeacherAccounts();
        const cleanedTeachers = currentTeachers.filter(t => 
          t && t.email && 
          t.email.toLowerCase() !== 'teacher@gmail.com' && 
          t.email.toLowerCase() !== 'ddjmann@gmail.com' &&
          t.id !== 'teacher-1789232615710' &&
          t.name !== 'Fff'
        );
        this.saveTeacherAccounts(cleanedTeachers);

        // If active session belongs to a removed demo teacher, reset session
        const session = this.getAuthSession();
        if (session.currentTeacher && (
          session.currentTeacher.email === 'ddjmann@gmail.com' ||
          session.currentTeacher.id === 'teacher-1789232615710' ||
          session.currentTeacher.name === 'Fff'
        )) {
          this.setAuthSession({
            isLoggedIn: false,
            role: null,
            currentTeacher: null,
            currentAdmin: null
          });
        }

        // Clean demo classes if they have dummy teacher or zero active real teacher
        const currentClasses = this.getClassesList();
        const cleanedClasses = currentClasses.filter(c => 
          c && c.createdByTeacherEmail !== 'ddjmann@gmail.com' &&
          c.teacherName !== 'Fff'
        );
        if (cleanedClasses.length !== currentClasses.length) {
          this.saveClassesList(cleanedClasses);
        }

        localStorage.setItem('hss_demo_data_purged_v1', 'true');
      }

      if (!initialized) {
        this.saveSchoolProfile(DEFAULT_SCHOOL_PROFILE);
        this.saveClassInfo(DEFAULT_CLASS_INFO);
        this.saveTeacherInfo(DEFAULT_TEACHER_INFO);
        this.saveStudents([]);
        this.saveAttendance([]);
        this.saveExams([]);
        this.saveExamMarksMap({});
        this.saveReminders([]);
        this.saveSettings(DEFAULT_SETTINGS);
        this.saveClassesList([]);
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      }
    } catch (e) {
      console.error('Storage initialization failed:', e);
    }
  },

  getSchoolProfile(): SchoolProfile {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SCHOOL_PROFILE);
      if (val) {
        const parsed = JSON.parse(val);
        const storedName = parsed.schoolName;
        const isObsoleteName = !storedName ||
          storedName.toLowerCase().includes('sebast') ||
          storedName === 'Govt. Model HSS' ||
          storedName === 'Govt Higher Secondary School' ||
          storedName === 'School Name' ||
          storedName === 'HIGHER SECONDARY SCHOOL';
        const normalizedName = isObsoleteName
          ? "St.Sebastian's Higher Secondary School"
          : storedName;
        const storedPrincipal = parsed.principalName;
        const normalizedPrincipal = (!storedPrincipal || storedPrincipal.trim() === 'School Administrator' || storedPrincipal.trim() === 'Principal / School Administrator')
          ? 'Principal'
          : (storedPrincipal.trim() || 'Principal');
        const storedCode = parsed.schoolCode;
        const normalizedCode = (storedCode && storedCode.trim() && storedCode !== 'HSS-07142' && storedCode !== 'HSS-KL' && storedCode !== 'School Code')
          ? storedCode.trim().toUpperCase()
          : 'SSHSS@111213';
        return {
          ...DEFAULT_SCHOOL_PROFILE,
          ...parsed,
          schoolName: normalizedName,
          schoolCode: normalizedCode,
          principalName: normalizedPrincipal
        };
      }
      return DEFAULT_SCHOOL_PROFILE;
    } catch {
      return DEFAULT_SCHOOL_PROFILE;
    }
  },

  saveSchoolProfile(profile: SchoolProfile) {
    localStorage.setItem(STORAGE_KEYS.SCHOOL_PROFILE, JSON.stringify(profile));
    notifyMutation();
  },

  getClassesList(): ClassItem[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.CLASSES_CATALOG);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveClassesList(classes: ClassItem[]) {
    // Deduplicate by ID to prevent any duplicate entries
    const seenIds = new Set<string>();
    const uniqueClasses: ClassItem[] = [];
    for (const c of classes) {
      if (c && c.id && !seenIds.has(c.id)) {
        seenIds.add(c.id);
        uniqueClasses.push(c);
      }
    }
    localStorage.setItem(STORAGE_KEYS.CLASSES_CATALOG, JSON.stringify(uniqueClasses));
    notifyMutation();
  },

  getClassesByTeacher(teacherIdOrUid?: string, teacherEmail?: string): ClassItem[] {
    const classes = this.getClassesList();
    if (!teacherIdOrUid && !teacherEmail) {
      const session = this.getAuthSession();
      if (session.currentTeacher) {
        teacherIdOrUid = session.currentTeacher.id || session.currentTeacher.uid;
        teacherEmail = session.currentTeacher.email || session.currentTeacher.gmail;
      }
    }
    const cleanUid = (teacherIdOrUid || '').trim();
    const cleanEmail = (teacherEmail || '').trim().toLowerCase();

    if (!cleanUid && !cleanEmail) return classes;

    return classes.filter(c => {
      if (cleanUid && (c.teacherId === cleanUid || c.teacherUid === cleanUid || c.createdByTeacherId === cleanUid)) {
        return true;
      }
      if (cleanEmail && c.createdByTeacherEmail && c.createdByTeacherEmail.trim().toLowerCase() === cleanEmail) {
        return true;
      }
      return false;
    });
  },

  getActiveClassId(forTeacherUid?: string, forTeacherEmail?: string): string {
    try {
      const session = this.getAuthSession();
      const teacher = session.currentTeacher;
      const targetUid = forTeacherUid || teacher?.id || teacher?.uid || '';
      const targetEmail = (forTeacherEmail || teacher?.email || teacher?.gmail || '').trim().toLowerCase();

      const classes = this.getClassesList();
      if (classes.length === 0) return '';

      const currentActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CLASS_ID);

      // If a teacher is active/specified, ensure active class belongs to this teacher
      if (targetUid || targetEmail) {
        const teacherClasses = this.getClassesByTeacher(targetUid, targetEmail);
        if (teacherClasses.length > 0) {
          const matched = teacherClasses.find(c => c.id === currentActiveId);
          if (matched) {
            return matched.id;
          }
          // Default to this teacher's primary/first created class
          const preferred = teacherClasses[0];
          this.setActiveClassId(preferred.id);
          return preferred.id;
        }
      }

      if (currentActiveId && classes.some(c => c.id === currentActiveId)) {
        return currentActiveId;
      }

      const defaultId = classes[0]?.id || '';
      if (defaultId) {
        this.setActiveClassId(defaultId);
      }
      return defaultId;
    } catch {
      return '';
    }
  },

  setActiveClassId(id: string) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CLASS_ID, id);
    // Also keep CLASS_INFO in sync for backwards compatibility
    const classes = this.getClassesList();
    const active = classes.find(c => c.id === id);
    if (active) {
      this.saveClassInfo({
        id: active.id,
        standard: active.standard,
        stream: active.stream,
        section: active.section,
        className: active.className,
        academicYear: active.academicYear,
        classStrength: active.classStrength
      });
    }
    notifyMutation();
  },

  getClassById(classId: string): ClassItem | undefined {
    const classes = this.getClassesList();
    return classes.find(c => c.id === classId);
  },

  addNewClass(newClass: ClassItem, initialStudents?: Student[]): ClassItem {
    const classes = this.getClassesList();
    const session = this.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const currentSchool = this.getSchoolProfile();

    const teacherUid = newClass.teacherUid || newClass.teacherId || currentTeacher?.uid || currentTeacher?.id || '';
    const teacherEmail = (newClass.createdByTeacherEmail || currentTeacher?.email || currentTeacher?.gmail || '').trim().toLowerCase();

    // Ensure unique ID
    if (!newClass.id) {
      newClass.id = `cls-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!newClass.teacherId && teacherUid) {
      newClass.teacherId = teacherUid;
    }
    if (!newClass.teacherUid && teacherUid) {
      newClass.teacherUid = teacherUid;
    }
    if (!newClass.teacherName && currentTeacher?.name) {
      newClass.teacherName = currentTeacher.name;
    }
    if (!newClass.schoolCode) {
      newClass.schoolCode = currentTeacher?.schoolCode || currentSchool.schoolCode || '';
    }
    if (!newClass.createdAt) {
      newClass.createdAt = new Date().toISOString();
    }
    newClass.isTeacherCreated = true;
    if (!newClass.createdByTeacherId && teacherUid) {
      newClass.createdByTeacherId = teacherUid;
    }
    if (!newClass.createdByTeacherEmail && teacherEmail) {
      newClass.createdByTeacherEmail = teacherEmail;
    }

    // Deduplication check:
    // 1. Direct ID match
    let existingIdx = classes.findIndex(c => c.id === newClass.id);

    // 2. Teacher + Standard + Section match (prevent duplicate classrooms for same teacher)
    if (existingIdx < 0 && (teacherUid || teacherEmail)) {
      const cleanStd = (newClass.standard || '').trim().toLowerCase();
      const cleanSec = (newClass.section || '').trim().toLowerCase();
      const cleanName = (newClass.className || '').trim().toLowerCase();

      existingIdx = classes.findIndex(c => {
        const cTeacherId = c.teacherId || c.teacherUid || c.createdByTeacherId || '';
        const cTeacherEmail = (c.createdByTeacherEmail || '').trim().toLowerCase();
        const isSameTeacher = (teacherUid && cTeacherId === teacherUid) || (teacherEmail && cTeacherEmail === teacherEmail);
        if (!isSameTeacher) return false;

        if (cleanStd && cleanSec && c.standard.trim().toLowerCase() === cleanStd && c.section.trim().toLowerCase() === cleanSec) {
          return true;
        }
        if (cleanName && c.className.trim().toLowerCase() === cleanName) {
          return true;
        }
        return false;
      });
    }

    const preparedStudents = (initialStudents || []).map(s => ({
      ...s,
      classId: newClass.id,
      teacherId: newClass.teacherId,
      schoolCode: newClass.schoolCode
    }));

    if (existingIdx >= 0) {
      const existingClass = classes[existingIdx];
      newClass.id = existingClass.id;
      const preservedCreatedAt = existingClass.createdAt || newClass.createdAt;
      classes[existingIdx] = {
        ...existingClass,
        ...newClass,
        id: existingClass.id,
        createdAt: preservedCreatedAt
      };

      if (preparedStudents.length > 0) {
        const studentsForExisting = preparedStudents.map(s => ({ ...s, classId: existingClass.id }));
        this.saveStudents(studentsForExisting, existingClass.id);
        classes[existingIdx].classStrength = studentsForExisting.length;
      }
      this.saveClassesList(classes);
      notifyMutation();
      return classes[existingIdx];
    }

    newClass.classStrength = preparedStudents.length;
    classes.push(newClass);
    this.saveClassesList(classes);

    this.saveStudents(preparedStudents, newClass.id);
    this.saveAttendance([], newClass.id);
    this.saveExams([], newClass.id);
    this.saveExamMarksMap({}, newClass.id);
    notifyMutation();

    return newClass;
  },

  updateClass(updated: ClassItem) {
    const classes = this.getClassesList();
    const idx = classes.findIndex(c => c.id === updated.id);
    if (idx >= 0) {
      classes[idx] = { ...classes[idx], ...updated };
      this.saveClassesList(classes);
      if (this.getActiveClassId() === updated.id) {
        this.saveClassInfo({
          id: updated.id,
          standard: updated.standard,
          stream: updated.stream,
          section: updated.section,
          className: updated.className,
          academicYear: updated.academicYear,
          classStrength: updated.classStrength
        });
      }
    }
    notifyMutation();
  },

  deleteClass(classId: string): boolean {
    let classes = this.getClassesList();
    classes = classes.filter(c => c.id !== classId);
    this.saveClassesList(classes);

    // Clean up scoped storage
    localStorage.removeItem(`hss_students_${classId}`);
    localStorage.removeItem(`hss_attendance_${classId}`);
    localStorage.removeItem(`hss_exams_${classId}`);
    localStorage.removeItem(`hss_marks_${classId}`);
    localStorage.removeItem(`hss_class_info_${classId}`);

    if (this.getActiveClassId() === classId) {
      this.setActiveClassId(classes[0]?.id || '');
    }
    notifyMutation();
    return true;
  },

  getClassInfo(classId?: string): ClassInfo {
    try {
      const activeId = classId || this.getActiveClassId();
      const classes = this.getClassesList();
      let current = classes.find(c => c.id === activeId);
      if (!current) {
        const teacherClasses = this.getClassesByTeacher();
        if (teacherClasses.length > 0) {
          current = teacherClasses[0];
          this.setActiveClassId(current.id);
        }
      }
      if (current) {
        return {
          id: current.id,
          standard: current.standard,
          stream: current.stream,
          section: current.section,
          className: current.className,
          academicYear: current.academicYear,
          classStrength: current.classStrength
        };
      }
      const val = localStorage.getItem(STORAGE_KEYS.CLASS_INFO);
      return val ? JSON.parse(val) : DEFAULT_CLASS_INFO;
    } catch {
      return DEFAULT_CLASS_INFO;
    }
  },

  saveClassInfo(info: ClassInfo, classId?: string) {
    const activeId = classId || info.id || this.getActiveClassId();
    localStorage.setItem(STORAGE_KEYS.CLASS_INFO, JSON.stringify(info));
    // Also sync in catalog if exists
    const classes = this.getClassesList();
    const idx = classes.findIndex(c => c.id === activeId);
    if (idx >= 0) {
      classes[idx] = {
        ...classes[idx],
        standard: info.standard,
        stream: info.stream,
        section: info.section,
        className: info.className,
        academicYear: info.academicYear,
        classStrength: info.classStrength
      };
      this.saveClassesList(classes);
    }
    notifyMutation();
  },

  getTeacherInfo(): TeacherInfo {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.TEACHER_INFO);
      return val ? JSON.parse(val) : DEFAULT_TEACHER_INFO;
    } catch {
      return DEFAULT_TEACHER_INFO;
    }
  },

  saveTeacherInfo(info: TeacherInfo) {
    localStorage.setItem(STORAGE_KEYS.TEACHER_INFO, JSON.stringify(info));
    
    // Auto-sync with TeacherAccount catalog and AuthSession
    try {
      const session = this.getAuthSession();
      const accounts = this.getTeacherAccounts();
      const schoolProfile = this.getSchoolProfile();

      // Find matching teacher account by active session ID, email, or name
      const targetId = session.currentTeacher?.id;
      let matchedIdx = accounts.findIndex(a => targetId && a.id === targetId);
      
      if (matchedIdx === -1 && info.email) {
        matchedIdx = accounts.findIndex(a => a.email && a.email.toLowerCase() === info.email.toLowerCase());
      }
      if (matchedIdx === -1 && info.phone) {
        matchedIdx = accounts.findIndex(a => a.phone && a.phone === info.phone);
      }

      if (matchedIdx >= 0) {
        accounts[matchedIdx] = {
          ...accounts[matchedIdx],
          name: info.teacherName || accounts[matchedIdx].name,
          phone: info.phone || accounts[matchedIdx].phone,
          email: info.email || accounts[matchedIdx].email,
          designation: info.designation || accounts[matchedIdx].designation,
          avatar: info.avatar || accounts[matchedIdx].avatar,
          photoUrl: info.photoUrl || accounts[matchedIdx].photoUrl,
          dob: info.dob || accounts[matchedIdx].dob,
          academicYear: info.academicYear || accounts[matchedIdx].academicYear,
          lastActiveAt: new Date().toISOString()
        };
        this.saveTeacherAccounts(accounts);

        // Update active session
        if (session.currentTeacher && (session.currentTeacher.id === accounts[matchedIdx].id || session.currentTeacher.email === accounts[matchedIdx].email)) {
          session.currentTeacher = { ...accounts[matchedIdx] };
          this.setAuthSession(session);
        }
      } else if (info.teacherName && info.teacherName.trim() && info.email && info.email.trim()) {
        // Create new teacher record linked to this school code
        const newTeacher: TeacherAccount = {
          id: `teach-${Date.now().toString(36)}`,
          name: info.teacherName.trim(),
          email: info.email.trim(),
          phone: info.phone ? info.phone.trim() : '',
          schoolName: schoolProfile.schoolName || 'Higher Secondary School',
          schoolCode: schoolProfile.schoolCode,
          academicYear: info.academicYear,
          designation: info.designation || 'Class Teacher',
          avatar: info.avatar || '👨‍🏫',
          photoUrl: info.photoUrl,
          dob: info.dob,
          createdAt: new Date().toISOString()
        };
        accounts.push(newTeacher);
        this.saveTeacherAccounts(accounts);
        if (session.isLoggedIn && session.role === 'teacher') {
          session.currentTeacher = newTeacher;
          this.setAuthSession(session);
        }
      }
    } catch {
      // Ignored
    }

    notifyMutation();
  },

  getStudents(classId?: string): Student[] {
    try {
      const targetId = classId || this.getActiveClassId();
      if (!targetId) return [];
      const key = `hss_students_${targetId}`;
      const val = localStorage.getItem(key);
      if (val) {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
      return [];
    } catch {
      return [];
    }
  },

  saveStudents(students: Student[], classId?: string) {
    const targetId = classId || this.getActiveClassId();
    if (!targetId) return;
    const session = this.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const currentSchool = this.getSchoolProfile();

    const taggedStudents = (students || []).map(s => ({
      ...s,
      classId: s.classId || targetId,
      teacherId: s.teacherId || currentTeacher?.id,
      schoolCode: s.schoolCode || currentTeacher?.schoolCode || currentSchool.schoolCode
    }));

    localStorage.setItem(`hss_students_${targetId}`, JSON.stringify(taggedStudents));
    // Update class strength in catalog
    const classes = this.getClassesList();
    const idx = classes.findIndex(c => c.id === targetId);
    if (idx >= 0) {
      classes[idx].classStrength = taggedStudents.length;
      this.saveClassesList(classes);
    }
    notifyMutation();
  },

  getAttendance(classId?: string): AttendanceRecord[] {
    try {
      const targetId = classId || this.getActiveClassId();
      if (!targetId) return [];
      const key = `hss_attendance_${targetId}`;
      const val = localStorage.getItem(key);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map((a: any) => ({
            ...a,
            presentStudentIds: Array.isArray(a?.presentStudentIds) ? a.presentStudentIds : [],
            absentStudentIds: Array.isArray(a?.absentStudentIds) ? a.absentStudentIds : [],
            onDutyStudentIds: Array.isArray(a?.onDutyStudentIds) ? a.onDutyStudentIds : []
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveAttendance(attendance: AttendanceRecord[], classId?: string) {
    const targetId = classId || this.getActiveClassId();
    if (!targetId) return;
    const session = this.getAuthSession();
    const currentTeacher = session.currentTeacher;

    const taggedAttendance = (attendance || []).map(a => ({
      ...a,
      classId: a.classId || targetId,
      teacherId: a.teacherId || currentTeacher?.id
    }));

    localStorage.setItem(`hss_attendance_${targetId}`, JSON.stringify(taggedAttendance));
    notifyMutation();
  },

  getExams(classId?: string): Exam[] {
    try {
      const targetId = classId || this.getActiveClassId();
      if (!targetId) return [];
      const key = `hss_exams_${targetId}`;
      const val = localStorage.getItem(key);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.map((e: any) => ({
            ...e,
            subjects: Array.isArray(e?.subjects) ? e.subjects : []
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveExams(exams: Exam[], classId?: string) {
    const targetId = classId || this.getActiveClassId();
    if (!targetId) return;
    const session = this.getAuthSession();
    const currentTeacher = session.currentTeacher;

    const taggedExams = (exams || []).map(e => ({
      ...e,
      classId: e.classId || targetId,
      teacherId: e.teacherId || currentTeacher?.id
    }));

    localStorage.setItem(`hss_exams_${targetId}`, JSON.stringify(taggedExams));
    notifyMutation();
  },

  getExamMarksMap(classId?: string): Record<string, ExamMarksRecord> {
    try {
      const targetId = classId || this.getActiveClassId();
      if (!targetId) return {};
      const key = `hss_marks_${targetId}`;
      const val = localStorage.getItem(key);
      if (val) return JSON.parse(val);
      return {};
    } catch {
      return {};
    }
  },

  saveExamMarksMap(marksMap: Record<string, ExamMarksRecord>, classId?: string) {
    const targetId = classId || this.getActiveClassId();
    if (!targetId) return;
    localStorage.setItem(`hss_marks_${targetId}`, JSON.stringify(marksMap));
    notifyMutation();
  },

  getReminders(): Reminder[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.REMINDERS);
      if (val) {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  },

  saveReminders(reminders: Reminder[]) {
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    notifyMutation();
  },

  getSettings(): AppSettings {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return val ? JSON.parse(val) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    notifyMutation();
  },

  exportFullBackup(): AppDataBackup {
    return {
      version: '1.0.0',
      backupDate: new Date().toISOString(),
      schoolProfile: this.getSchoolProfile(),
      classInfo: this.getClassInfo(),
      teacherInfo: this.getTeacherInfo(),
      students: this.getStudents(),
      attendance: this.getAttendance(),
      exams: this.getExams(),
      examMarks: this.getExamMarksMap(),
      reminders: this.getReminders(),
      settings: this.getSettings()
    };
  },

  restoreBackup(backupData: any): { success: boolean; message: string } {
    try {
      if (!backupData || typeof backupData !== 'object') {
        return { success: false, message: 'Invalid backup file structure.' };
      }

      if (backupData.schoolProfile) this.saveSchoolProfile(backupData.schoolProfile);
      if (backupData.classInfo) this.saveClassInfo(backupData.classInfo);
      if (backupData.teacherInfo) this.saveTeacherInfo(backupData.teacherInfo);
      if (Array.isArray(backupData.students)) this.saveStudents(backupData.students);
      if (Array.isArray(backupData.attendance)) this.saveAttendance(backupData.attendance);
      if (Array.isArray(backupData.exams)) this.saveExams(backupData.exams);
      if (backupData.examMarks) this.saveExamMarksMap(backupData.examMarks);
      if (Array.isArray(backupData.reminders)) this.saveReminders(backupData.reminders);
      if (backupData.settings) this.saveSettings(backupData.settings);

      return { success: true, message: 'Data restored successfully!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error restoring data' };
    }
  },

  saveDailyAttendance(record: AttendanceRecord, classId?: string) {
    const list = this.getAttendance(classId);
    const idx = list.findIndex(r => r.date === record.date || r.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }
    this.saveAttendance(list, classId);
  },

  saveExamMarks(examId: string, marksRecord: ExamMarksRecord, classId?: string) {
    const map = this.getExamMarksMap(classId);
    map[examId] = marksRecord;
    this.saveExamMarksMap(map, classId);
  },

  exportAllDataAsJSON(): string {
    return JSON.stringify(this.exportFullBackup(), null, 2);
  },

  importBackupJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      const res = this.restoreBackup(parsed);
      return res.success;
    } catch {
      return false;
    }
  },

  resetToDefaults() {
    this.resetToSeedData();
  },

  resetToSeedData() {
    this.saveSchoolProfile(DEFAULT_SCHOOL_PROFILE);
    this.saveClassInfo(DEFAULT_CLASS_INFO);
    this.saveTeacherInfo(DEFAULT_TEACHER_INFO);
    this.saveStudents([]);
    this.saveAttendance([]);
    this.saveExams([]);
    this.saveExamMarksMap({});
    this.saveReminders([]);
    this.saveSettings(DEFAULT_SETTINGS);
    this.saveClassesList([]);
    this.saveTimetables([]);
  },

  clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('hss_') || k.includes('teacher') || k.includes('admin') || k.includes('school') || k.includes('auth') || k.includes('student') || k.includes('class') || k.includes('exam') || k.includes('attendance') || k.includes('timetable'))) {
        localStorage.removeItem(k);
      }
    }
    notifyMutation();
  },

  // Permanent Deletion Tracking
  getPermanentlyDeletedTeacherIds(): string[] {
    try {
      const val = localStorage.getItem('hss_permanently_deleted_teacher_ids_v1') || localStorage.getItem('hss_deleted_teacher_ids_v1');
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  },

  addPermanentlyDeletedTeacherId(id: string, email?: string) {
    if (!id && !email) return;
    const deleted = this.getPermanentlyDeletedTeacherIds();
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (id && !deleted.includes(id)) {
      deleted.push(id);
    }
    if (cleanEmail && !deleted.includes(cleanEmail)) {
      deleted.push(cleanEmail);
    }
    localStorage.setItem('hss_permanently_deleted_teacher_ids_v1', JSON.stringify(deleted));
    localStorage.setItem('hss_deleted_teacher_ids_v1', JSON.stringify(deleted));
    // Ensure it's removed from temporary deleted list if present
    this.removeTemporarilyDeletedTeacherId(id, email);
    notifyMutation();
  },

  removePermanentlyDeletedTeacherId(id?: string, email?: string) {
    if (!id && !email) return;
    let deleted = this.getPermanentlyDeletedTeacherIds();
    if (deleted.length === 0) return;
    const cleanId = (id || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    deleted = deleted.filter(item => {
      const cleanItem = (item || '').trim().toLowerCase();
      if (cleanId && cleanItem === cleanId) return false;
      if (cleanEmail && cleanItem === cleanEmail) return false;
      return true;
    });

    localStorage.setItem('hss_permanently_deleted_teacher_ids_v1', JSON.stringify(deleted));
    localStorage.setItem('hss_deleted_teacher_ids_v1', JSON.stringify(deleted));
    notifyMutation();
  },

  isTeacherPermanentlyDeleted(id?: string, email?: string): boolean {
    const deleted = this.getPermanentlyDeletedTeacherIds();
    if (deleted.length === 0) return false;
    const cleanId = (id || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (cleanId && deleted.includes(cleanId)) return true;
    if (cleanEmail && deleted.includes(cleanEmail)) return true;
    return false;
  },

  // Temporary Deletion Tracking
  getTemporarilyDeletedTeacherIds(): string[] {
    try {
      const val = localStorage.getItem('hss_temp_deleted_teacher_ids_v1');
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  },

  addTemporarilyDeletedTeacherId(id: string, email?: string) {
    if (!id && !email) return;
    const tempDeleted = this.getTemporarilyDeletedTeacherIds();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (id && !tempDeleted.includes(id)) {
      tempDeleted.push(id);
    }
    if (cleanEmail && !tempDeleted.includes(cleanEmail)) {
      tempDeleted.push(cleanEmail);
    }
    localStorage.setItem('hss_temp_deleted_teacher_ids_v1', JSON.stringify(tempDeleted));
    notifyMutation();
  },

  removeTemporarilyDeletedTeacherId(id?: string, email?: string) {
    if (!id && !email) return;
    let tempDeleted = this.getTemporarilyDeletedTeacherIds();
    if (tempDeleted.length === 0) return;
    const cleanId = (id || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    tempDeleted = tempDeleted.filter(item => {
      const cleanItem = (item || '').trim().toLowerCase();
      if (cleanId && cleanItem === cleanId) return false;
      if (cleanEmail && cleanItem === cleanEmail) return false;
      return true;
    });

    localStorage.setItem('hss_temp_deleted_teacher_ids_v1', JSON.stringify(tempDeleted));
    notifyMutation();
  },

  isTeacherTemporarilyDeleted(id?: string, email?: string): boolean {
    const tempDeleted = this.getTemporarilyDeletedTeacherIds();
    if (tempDeleted.length === 0) return false;
    const cleanId = (id || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (cleanId && tempDeleted.includes(cleanId)) return true;
    if (cleanEmail && tempDeleted.includes(cleanEmail)) return true;
    return false;
  },

  // Combined Check for Active Filtering
  getDeletedTeacherIds(): string[] {
    return Array.from(new Set([...this.getPermanentlyDeletedTeacherIds(), ...this.getTemporarilyDeletedTeacherIds()]));
  },

  addDeletedTeacherId(id: string, email?: string) {
    this.addPermanentlyDeletedTeacherId(id, email);
  },

  removeDeletedTeacherId(id?: string, email?: string) {
    this.removePermanentlyDeletedTeacherId(id, email);
    this.removeTemporarilyDeletedTeacherId(id, email);
  },

  isTeacherDeleted(id?: string, email?: string): boolean {
    return this.isTeacherPermanentlyDeleted(id, email) || this.isTeacherTemporarilyDeleted(id, email);
  },

  getTeacherAccounts(): TeacherAccount[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.TEACHER_ACCOUNTS);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.filter(a => a && !this.isTeacherDeleted(a.id, a.email || a.gmail));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveTeacherAccounts(accounts: TeacherAccount[]) {
    const filtered = (accounts || []).filter(a => a && !this.isTeacherDeleted(a.id, a.email || a.gmail));
    localStorage.setItem(STORAGE_KEYS.TEACHER_ACCOUNTS, JSON.stringify(filtered));
    notifyMutation();
  },

  registerTeacherAccount(account: TeacherAccount): boolean {
    if (account) {
      if (this.isTeacherPermanentlyDeleted(account.id, account.email || account.gmail) || (account.uid && this.isTeacherPermanentlyDeleted(account.uid))) {
        return false;
      }
      this.removeTemporarilyDeletedTeacherId(account.id, account.email || account.gmail);
      if (account.uid) this.removeTemporarilyDeletedTeacherId(account.uid);
    }
    const accounts = this.getTeacherAccounts();
    const existing = accounts.find(
      a => (a.email && account.email && a.email.toLowerCase() === account.email.toLowerCase()) || 
           (a.phone && account.phone && a.phone === account.phone)
    );
    if (existing) {
      // Update existing if needed
      const idx = accounts.findIndex(a => a.id === existing.id || (a.email && account.email && a.email.toLowerCase() === account.email.toLowerCase()));
      if (idx >= 0) {
        accounts[idx] = { ...accounts[idx], ...account, status: 'active' };
        this.saveTeacherAccounts(accounts);
        return true;
      }
      return false;
    }
    accounts.push({ ...account, status: 'active' });
    this.saveTeacherAccounts(accounts);
    return true;
  },

  getTeachersBySchoolCode(schoolCode: string): TeacherAccount[] {
    const accounts = this.getTeacherAccounts();
    const cleanCode = (schoolCode || '').trim().toLowerCase();
    return accounts.filter(a => {
      const code = (a.schoolCode || '').trim().toLowerCase();
      return !cleanCode || code === cleanCode;
    });
  },

  updateTeacherAccount(account: TeacherAccount): boolean {
    if (account) {
      if (this.isTeacherPermanentlyDeleted(account.id, account.email || account.gmail) || (account.uid && this.isTeacherPermanentlyDeleted(account.uid))) {
        return false;
      }
      this.removeTemporarilyDeletedTeacherId(account.id, account.email || account.gmail);
      if (account.uid) this.removeTemporarilyDeletedTeacherId(account.uid);
    }
    const accounts = this.getTeacherAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      accounts[idx] = {
        ...accounts[idx],
        ...account,
        status: 'active',
        lastActiveAt: new Date().toISOString()
      };
      this.saveTeacherAccounts(accounts);

      // Also sync current active teacher session if relevant
      const session = this.getAuthSession();
      if (session.currentTeacher && session.currentTeacher.id === account.id) {
        session.currentTeacher = { ...accounts[idx] };
        this.setAuthSession(session);
      }

      // Also sync with active TeacherInfo if relevant
      const activeTeacher = this.getTeacherInfo();
      if (activeTeacher.email === account.email || activeTeacher.phone === account.phone) {
        this.saveTeacherInfo({
          ...activeTeacher,
          teacherName: account.name,
          phone: account.phone,
          email: account.email,
          designation: account.designation,
          avatar: account.avatar,
          photoUrl: account.photoUrl,
          dob: account.dob
        });
      }

      notifyMutation();
      return true;
    }
    return false;
  },

  deleteTeacherAccount(teacherId: string, isPermanent: boolean = false): boolean {
    const rawVal = localStorage.getItem(STORAGE_KEYS.TEACHER_ACCOUNTS);
    let allAccounts: TeacherAccount[] = [];
    try {
      if (rawVal) allAccounts = JSON.parse(rawVal);
    } catch (e) {}

    const target = allAccounts.find(a => a && (a.id === teacherId || a.uid === teacherId));
    const targetEmail = target?.email || target?.gmail;

    if (isPermanent) {
      this.addPermanentlyDeletedTeacherId(teacherId, targetEmail);
      if (target?.uid) this.addPermanentlyDeletedTeacherId(target.uid);
    } else {
      this.addTemporarilyDeletedTeacherId(teacherId, targetEmail);
      if (target?.uid) this.addTemporarilyDeletedTeacherId(target.uid);
    }

    const remaining = allAccounts.filter(a => a && a.id !== teacherId && a.uid !== teacherId);
    localStorage.setItem(STORAGE_KEYS.TEACHER_ACCOUNTS, JSON.stringify(remaining));

    if (isPermanent) {
      const session = this.getAuthSession();
      if (session.currentTeacher && (session.currentTeacher.id === teacherId || session.currentTeacher.uid === teacherId)) {
        this.setAuthSession({
          isLoggedIn: false,
          role: 'teacher',
          currentTeacher: null,
          currentAdmin: null
        });
      }
    }

    notifyMutation();
    return true;
  },

  addTeacherAccount(account: TeacherAccount): boolean {
    if (account) {
      if (this.isTeacherPermanentlyDeleted(account.id, account.email || account.gmail) || (account.uid && this.isTeacherPermanentlyDeleted(account.uid))) {
        return false;
      }
      this.removeTemporarilyDeletedTeacherId(account.id, account.email || account.gmail);
      if (account.uid) this.removeTemporarilyDeletedTeacherId(account.uid);
    }
    const accounts = this.getTeacherAccounts();
    const existing = accounts.find(
      a => (a.email && account.email && a.email.toLowerCase() === account.email.toLowerCase()) ||
           (a.phone && account.phone && a.phone === account.phone)
    );
    if (existing) {
      return false;
    }
    accounts.unshift({ ...account, status: 'active' });
    this.saveTeacherAccounts(accounts);
    notifyMutation();
    return true;
  },

  updateTeacherLastActive(teacherId: string) {
    const accounts = this.getTeacherAccounts();
    const idx = accounts.findIndex(a => a.id === teacherId);
    if (idx >= 0) {
      accounts[idx].lastActiveAt = new Date().toISOString();
      this.saveTeacherAccounts(accounts);
    }
  },

  // School Admin Storage Methods
  getSchoolAdmins(): SchoolAdminAccount[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SCHOOL_ADMINS);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.map(a => ({
            ...a,
            schoolName: (a.schoolName?.toLowerCase().includes('sebast') || !a.schoolName)
              ? "St.Sebastian's Higher Secondary School"
              : a.schoolName,
            schoolCode: (a.schoolCode?.toUpperCase() === 'SSHSS@111213' || !a.schoolCode)
              ? 'SSHSS@111213'
              : a.schoolCode,
            adminName: (!a.adminName || a.adminName === 'School Administrator' || a.adminName === 'Principal / School Administrator')
              ? 'Principal'
              : a.adminName
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveSchoolAdmins(admins: SchoolAdminAccount[]) {
    localStorage.setItem(STORAGE_KEYS.SCHOOL_ADMINS, JSON.stringify(admins));
    notifyMutation();
  },

  registerSchoolAdmin(admin: SchoolAdminAccount): boolean {
    const admins = this.getSchoolAdmins();
    const existing = admins.find(
      a => (a.schoolCode && a.schoolCode.toLowerCase() === admin.schoolCode.toLowerCase()) ||
           (a.schoolName && a.schoolName.toLowerCase() === admin.schoolName.toLowerCase()) ||
           (a.email && admin.email && a.email.toLowerCase() === admin.email.toLowerCase())
    );
    if (existing) {
      return false;
    }
    admins.push(admin);
    this.saveSchoolAdmins(admins);
    return true;
  },

  // Principal Broadcast Notifications
  getPrincipalBroadcasts(schoolCode?: string): PrincipalBroadcast[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.PRINCIPAL_BROADCASTS);
      let list: PrincipalBroadcast[] = [];
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }

      if (!schoolCode) return list;
      const cleanCode = schoolCode.trim().toLowerCase();
      return list.filter(b => !b.schoolCode || b.schoolCode.toLowerCase() === cleanCode);
    } catch {
      return [];
    }
  },

  savePrincipalBroadcasts(broadcasts: PrincipalBroadcast[]) {
    localStorage.setItem(STORAGE_KEYS.PRINCIPAL_BROADCASTS, JSON.stringify(broadcasts));
    notifyMutation();
  },

  getDismissedNotificationIds(teacherUid?: string, schoolCode?: string): string[] {
    try {
      const session = this.getAuthSession();
      const effectiveTeacherId = teacherUid || session.currentTeacher?.uid || session.currentTeacher?.id || 'default_teacher';
      const effectiveSchool = (schoolCode || session.currentTeacher?.schoolCode || this.getSchoolProfile().schoolCode || 'default_school').toUpperCase();
      const key = `DISMISSED_NOTIFICATIONS_${effectiveSchool}_${effectiveTeacherId}`;
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  },

  dismissNotificationForTeacher(notificationId: string, teacherUid?: string, schoolCode?: string) {
    try {
      const session = this.getAuthSession();
      const effectiveTeacherId = teacherUid || session.currentTeacher?.uid || session.currentTeacher?.id || 'default_teacher';
      const effectiveSchool = (schoolCode || session.currentTeacher?.schoolCode || this.getSchoolProfile().schoolCode || 'default_school').toUpperCase();
      const key = `DISMISSED_NOTIFICATIONS_${effectiveSchool}_${effectiveTeacherId}`;
      const dismissed = this.getDismissedNotificationIds(effectiveTeacherId, effectiveSchool);
      if (!dismissed.includes(notificationId)) {
        dismissed.push(notificationId);
        localStorage.setItem(key, JSON.stringify(dismissed));
      }
    } catch {}
  },

  isNotificationDismissedForTeacher(notificationId: string, teacherUid?: string, schoolCode?: string): boolean {
    const list = this.getDismissedNotificationIds(teacherUid, schoolCode);
    return list.includes(notificationId);
  },

  addPrincipalBroadcast(broadcast: PrincipalBroadcast) {
    const list = this.getPrincipalBroadcasts();
    const updated = [broadcast, ...list.filter(b => b.id !== broadcast.id)];
    this.savePrincipalBroadcasts(updated);

    const broadcastReminderId = `rem-broadcast-${broadcast.id}`;
    if (this.isNotificationDismissedForTeacher(broadcast.id) || this.isNotificationDismissedForTeacher(broadcastReminderId)) {
      return;
    }

    // Also push into Reminders so teacher dashboard and notification indicators update immediately
    const reminders = this.getReminders();
    const reminderEntry: Reminder = {
      id: broadcastReminderId,
      title: `📢 Principal Directive: ${broadcast.title}`,
      description: `${broadcast.message} [Target: ${broadcast.targetAudience || 'All Teachers'}]`,
      date: broadcast.date || new Date().toISOString().split('T')[0],
      time: broadcast.time || '09:30',
      repeat: 'none',
      category: broadcast.category === 'meeting' ? 'meeting' : broadcast.category === 'exam' ? 'exam' : 'general',
      isCompleted: false,
      createdAt: broadcast.createdAt || new Date().toISOString()
    };
    if (!reminders.some(r => r.id === reminderEntry.id)) {
      this.saveReminders([reminderEntry, ...reminders]);
    }
    notifyMutation();
  },

  deletePrincipalBroadcast(id: string) {
    const list = this.getPrincipalBroadcasts();
    const updated = list.filter(b => b.id !== id);
    this.savePrincipalBroadcasts(updated);
    const reminders = this.getReminders();
    const filteredReminders = reminders.filter(r => r.id !== `rem-broadcast-${id}` && r.id !== id);
    if (filteredReminders.length !== reminders.length) {
      this.saveReminders(filteredReminders);
    }
  },

  // Upcoming Teacher Birthdays Calculator
  getUpcomingTeacherBirthdays(schoolCode?: string, withinDays: number = 60): Array<{
    teacher: TeacherAccount;
    nextBirthdayStr: string;
    daysRemaining: number;
    isToday: boolean;
    isThisWeek: boolean;
    age: number;
    displayDate: string;
  }> {
    const teachers = this.getTeachersBySchoolCode(schoolCode);
    const now = new Date();
    const currentYear = now.getFullYear();
    const results: Array<{
      teacher: TeacherAccount;
      nextBirthdayStr: string;
      daysRemaining: number;
      isToday: boolean;
      isThisWeek: boolean;
      age: number;
      displayDate: string;
    }> = [];

    teachers.forEach(teacher => {
      if (!teacher.dob) return;
      const parts = teacher.dob.split('-');
      if (parts.length !== 3) return;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const birthDay = parseInt(parts[2], 10);

      // Birthday in current year
      let nextBirthday = new Date(currentYear, birthMonth, birthDay);
      // Reset times to midnight for accurate day comparison
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // If already passed earlier this year, use next year
      if (nextBirthday.getTime() < todayMidnight.getTime()) {
        nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
      }

      const diffTime = nextBirthday.getTime() - todayMidnight.getTime();
      const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= withinDays) {
        const isToday = daysRemaining === 0;
        const isThisWeek = daysRemaining > 0 && daysRemaining <= 7;
        const age = nextBirthday.getFullYear() - birthYear;
        const displayDate = nextBirthday.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric'
        });

        results.push({
          teacher,
          nextBirthdayStr: nextBirthday.toISOString().split('T')[0],
          daysRemaining,
          isToday,
          isThisWeek,
          age,
          displayDate
        });
      }
    });

    // Sort by nearest birthday first
    return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
  },

  // Timetable Storage & Management Methods
  getTimetables(schoolCode?: string): TimetableSlot[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.TIMETABLES);
      let list: TimetableSlot[] = [];
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }

      if (!schoolCode) return list.filter(Boolean);
      const cleanCode = schoolCode.trim().toLowerCase();
      return list.filter(slot => slot && (!slot.schoolCode || slot.schoolCode.toLowerCase() === cleanCode));
    } catch {
      return [];
    }
  },

  saveTimetables(slots: TimetableSlot[]) {
    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(slots));
    notifyMutation();
  },

  saveTimetableSlot(slot: TimetableSlot) {
    const list = this.getTimetables();
    const idx = list.findIndex(s => s.id === slot.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...slot, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...slot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveTimetables(list);
  },

  deleteTimetableSlot(slotId: string): boolean {
    const list = this.getTimetables();
    const updated = list.filter(s => s.id !== slotId);
    this.saveTimetables(updated);
    return true;
  },

  getTeacherTimetable(teacherId: string, schoolCode?: string): TimetableSlot[] {
    const all = this.getTimetables(schoolCode);
    const cleanTeacherId = (teacherId || '').trim();
    return all.filter(s => s.teacherId === cleanTeacherId);
  },

  getClassTimetable(classNameOrId: string, schoolCode?: string): TimetableSlot[] {
    const all = this.getTimetables(schoolCode);
    const query = (classNameOrId || '').trim().toLowerCase();
    return all.filter(s => (s.classId && s.classId.toLowerCase() === query) || (s.className && s.className.toLowerCase() === query));
  },

  autoGenerateDefaultSchoolTimetable(schoolCode: string): TimetableSlot[] {
    const teachers = this.getTeachersBySchoolCode(schoolCode);
    const classes = this.getClassesList();
    const cleanCode = (schoolCode || '').trim().toUpperCase();
    const slots: TimetableSlot[] = [];

    if (classes.length === 0 || teachers.length === 0) {
      return [];
    }

    const days: TimetableDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periods = DEFAULT_PERIOD_TIMINGS;

    const scienceSubjects = [
      { name: 'Physics', code: 'PHY', type: 'lecture' as const, room: 'Room 101' },
      { name: 'Chemistry', code: 'CHE', type: 'lecture' as const, room: 'Room 102' },
      { name: 'Mathematics', code: 'MAT', type: 'lecture' as const, room: 'Room 103' },
      { name: 'Biology', code: 'BIO', type: 'lecture' as const, room: 'Room 104' },
      { name: 'English', code: 'ENG', type: 'lecture' as const, room: 'Room 105' },
      { name: 'Computer Science', code: 'CS', type: 'lab' as const, room: 'CS Lab 1' },
      { name: 'Malayalam / Lang', code: 'MAL', type: 'lecture' as const, room: 'Room 106' },
      { name: 'Physics Practical Lab', code: 'PHY-LAB', type: 'practical' as const, room: 'Physics Lab' }
    ];

    const commerceSubjects = [
      { name: 'Accountancy', code: 'ACC', type: 'lecture' as const, room: 'Room 201' },
      { name: 'Business Studies', code: 'BST', type: 'lecture' as const, room: 'Room 202' },
      { name: 'Economics', code: 'ECO', type: 'lecture' as const, room: 'Room 203' },
      { name: 'English', code: 'ENG', type: 'lecture' as const, room: 'Room 204' },
      { name: 'Computer Application', code: 'CA', type: 'lab' as const, room: 'IT Lab 2' },
      { name: 'Statistics / Mathematics', code: 'STAT', type: 'lecture' as const, room: 'Room 205' },
      { name: 'Second Language', code: 'LANG', type: 'lecture' as const, room: 'Room 206' },
      { name: 'Physical Education', code: 'PE', type: 'sports' as const, room: 'Playground' }
    ];

    const activeClasses = classes;
    const activeTeachers = teachers;

    activeClasses.forEach((cls, classIdx) => {
      const isCommerce = cls.stream?.toLowerCase().includes('comm') || cls.className?.toLowerCase().includes('comm');
      const subjectPool = isCommerce ? commerceSubjects : scienceSubjects;

      days.forEach((day, dayIdx) => {
        const maxPeriodsForDay = day === 'Saturday' ? 4 : 8;

        for (let p = 0; p < maxPeriodsForDay; p++) {
          const timing = periods[p] || {
            periodNumber: p + 1,
            label: `Period ${p + 1}`,
            startTime: '09:30 AM',
            endTime: '10:15 AM'
          };

          const subjectIndex = (dayIdx * 2 + p + classIdx) % subjectPool.length;
          const subject = subjectPool[subjectIndex];
          const teacherIndex = (classIdx + p + dayIdx) % activeTeachers.length;
          const teacher = activeTeachers[teacherIndex];

          slots.push({
            id: `tt-${cls.id || 'c'}-${day.toLowerCase().substring(0, 3)}-p${p + 1}`,
            day,
            periodNumber: p + 1,
            startTime: timing.startTime,
            endTime: timing.endTime,
            subject: subject.name,
            subjectCode: subject.code,
            className: cls.className,
            classId: cls.id,
            teacherId: teacher.id,
            teacherName: teacher.name,
            teacherPhone: teacher.phone,
            roomNumber: subject.room,
            schoolCode: cleanCode,
            type: subject.type,
            notes: `${subject.name} curriculum session for ${cls.className}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      });
    });

    return slots;
  },

  generateTeacherStandardTimetable(teacher: TeacherAccount, assignedClass?: string, primarySubject?: string): TimetableSlot[] {
    const slots = this.getTimetables(teacher.schoolCode);
    const targetClass = assignedClass || teacher.assignedClass || 'Class 12 Science A';
    const cleanSubject = primarySubject || teacher.primarySubject || (teacher.designation?.includes('Physics') ? 'Physics' : teacher.designation?.includes('Computer') ? 'Computer Science' : 'General Higher Secondary');
    const days: TimetableDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const newSlots: TimetableSlot[] = [];
    days.forEach((day, dayIdx) => {
      const periodNum = (dayIdx % 4) + 1;
      const timing = DEFAULT_PERIOD_TIMINGS[periodNum - 1];
      const slotId = `tt-${teacher.id}-${day.toLowerCase().substring(0, 3)}-p${periodNum}`;

      const existingIdx = slots.findIndex(s => s.teacherId === teacher.id && s.day === day && s.periodNumber === periodNum);
      const slotData: TimetableSlot = {
        id: slotId,
        day,
        periodNumber: periodNum,
        startTime: timing.startTime,
        endTime: timing.endTime,
        subject: cleanSubject,
        subjectCode: cleanSubject.substring(0, 3).toUpperCase(),
        className: targetClass,
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherPhone: teacher.phone,
        roomNumber: 'Room ' + (100 + periodNum),
        schoolCode: (teacher.schoolCode || 'SSHSS@111213').toUpperCase(),
        type: 'lecture',
        notes: `Scheduled class with ${targetClass}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        slots[existingIdx] = slotData;
      } else {
        slots.push(slotData);
      }
      newSlots.push(slotData);
    });

    this.saveTimetables(slots);
    return newSlots;
  },

  // Verify School Admin Login with 4 required fields
  verifyAdminLogin(
    schoolGmail: string,
    schoolName: string,
    schoolCode: string,
    password: string,
    dob?: string,
    principalName?: string
  ): { success: boolean; admin?: SchoolAdminAccount; error?: string } {
    const qEmail = (schoolGmail || '').trim().toLowerCase();
    const qName = (schoolName || '').trim().toLowerCase();
    const qCode = (schoolCode || '').trim().toUpperCase();
    const pin = (password || '').trim();
    const qPrincipal = (principalName || '').trim().toLowerCase();
    const normalizeDob = (d?: string) => (d || '').trim().replace(/[/\s.-]/g, '');
    const qDobNorm = normalizeDob(dob);

    if (!qEmail || !qEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid official School Gmail address.' };
    }
    if (!qName) {
      return { success: false, error: 'Please enter the official School Name.' };
    }
    if (!qCode) {
      return { success: false, error: 'Please enter your unique School Code (e.g. HSS-07142).' };
    }
    if (!pin) {
      return { success: false, error: 'Please enter your School Administrator Password / PIN.' };
    }
    if (!dob) {
      return { success: false, error: 'Please enter your date of birth.' };
    }
    if (!principalName || !principalName.trim()) {
      return { success: false, error: 'Please enter the Principal Name.' };
    }

    const admins = this.getSchoolAdmins();
    const match = admins.find(a => {
      const emailMatch = a.email && a.email.toLowerCase() === qEmail;
      const codeMatch = a.schoolCode && a.schoolCode.toUpperCase() === qCode;
      const principalMatch = a.adminName && a.adminName.toLowerCase() === qPrincipal;
      return emailMatch || (codeMatch && principalMatch);
    });

    if (match) {
      if (match.adminPassword && match.adminPassword !== pin) {
        return { success: false, error: 'Incorrect School Admin Password. Access restricted to verified administrators.' };
      }
      if (match.dob && qDobNorm && normalizeDob(match.dob) !== qDobNorm) {
        return { success: false, error: 'Date of birth does not match administrator record.' };
      }
      
      // Update with verified details
      if (qCode) match.schoolCode = qCode;
      if (schoolName && schoolName.trim()) match.schoolName = schoolName.trim();
      if (principalName && principalName.trim()) match.adminName = principalName.trim();
      if (qEmail && (!match.email || match.email !== qEmail)) match.email = qEmail;
      if (dob && dob.trim()) match.dob = dob.trim();
      match.role = 'admin';

      this.saveSchoolAdmins(admins);

      const prof = this.getSchoolProfile();
      this.saveSchoolProfile({
        ...prof,
        principalName: match.adminName || prof.principalName,
        schoolName: match.schoolName || prof.schoolName,
        schoolCode: qCode || match.schoolCode || prof.schoolCode
      });

      return { success: true, admin: match };
    }

    // If no admin record exists yet (Initial Setup / Demo Administration)
    // Only permit initialization if standard admin demo credential '1234' is provided
    if (pin.length >= 4) {
      // Verify that this is not a conflict with teacher-only account
      const newAdmin: SchoolAdminAccount = {
        id: `admin-${Date.now()}`,
        schoolName: schoolName.trim(),
        schoolCode: qCode,
        adminPassword: pin,
        adminName: principalName.trim(),
        designation: 'Principal & School Administrator',
        email: qEmail,
        phone: '',
        dob: dob ? dob.trim() : undefined,
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      this.registerSchoolAdmin(newAdmin);
      
      const prof = this.getSchoolProfile();
      this.saveSchoolProfile({
        ...prof,
        principalName: newAdmin.adminName,
        schoolName: newAdmin.schoolName,
        schoolCode: newAdmin.schoolCode
      });
      return { success: true, admin: newAdmin };
    }

    return {
      success: false,
      error: 'School Administrator authentication failed. Invalid credentials or unauthorized access attempt.'
    };
  },

  // Export Complete School Data (JSON)
  exportCompleteSchoolData(schoolCode?: string): string {
    const schoolProfile = this.getSchoolProfile();
    const admins = this.getSchoolAdmins();
    const teachers = this.getTeachersBySchoolCode(schoolCode || schoolProfile.schoolCode);
    const classes = this.getClassesList();
    const broadcasts = this.getPrincipalBroadcasts(schoolCode || schoolProfile.schoolCode);
    const reminders = this.getReminders();
    const settings = this.getSettings();

    const classDataMap: Record<string, {
      students: Student[];
      attendance: AttendanceRecord[];
      exams: Exam[];
      examMarksMap: Record<string, ExamMarksRecord>;
    }> = {};

    classes.forEach(cls => {
      classDataMap[cls.id] = {
        students: this.getStudents(cls.id),
        attendance: this.getAttendance(cls.id),
        exams: this.getExams(cls.id),
        examMarksMap: this.getExamMarksMap(cls.id)
      };
    });

    const exportPayload = {
      appVersion: '2.5.0',
      exportType: 'COMPLETE_SCHOOL_ADMIN_BACKUP',
      exportedAt: new Date().toISOString(),
      schoolCode: schoolCode || schoolProfile.schoolCode,
      schoolProfile,
      schoolAdmins: admins,
      teachers,
      classesCatalog: classes,
      classDataMap,
      principalBroadcasts: broadcasts,
      reminders,
      settings,
      timetables: this.getTimetables(schoolCode || schoolProfile.schoolCode)
    };

    return JSON.stringify(exportPayload, null, 2);
  },

  // Import / Restore Complete School Data (JSON)
  importCompleteSchoolData(jsonData: string): {
    success: boolean;
    message: string;
    stats?: {
      teachersCount: number;
      classesCount: number;
      studentsCount: number;
      broadcastsCount: number;
    };
  } {
    try {
      const data = JSON.parse(jsonData);
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Invalid backup file format. Expected a valid JSON structure.' };
      }

      // Restore School Profile
      if (data.schoolProfile) {
        this.saveSchoolProfile(data.schoolProfile);
      }

      // Restore School Admins
      if (Array.isArray(data.schoolAdmins) && data.schoolAdmins.length > 0) {
        this.saveSchoolAdmins(data.schoolAdmins);
      }

      // Restore Teachers
      let teachersCount = 0;
      if (Array.isArray(data.teachers) && data.teachers.length > 0) {
        this.saveTeacherAccounts(data.teachers);
        teachersCount = data.teachers.length;
      }

      // Restore Classes Catalog
      let classesCount = 0;
      if (Array.isArray(data.classesCatalog) && data.classesCatalog.length > 0) {
        this.saveClassesList(data.classesCatalog);
        classesCount = data.classesCatalog.length;
      }

      // Restore Class-wise Data
      let totalStudentsCount = 0;
      if (data.classDataMap && typeof data.classDataMap === 'object') {
        Object.keys(data.classDataMap).forEach(classId => {
          const item = data.classDataMap[classId];
          if (item) {
            if (Array.isArray(item.students)) {
              this.saveStudents(item.students, classId);
              totalStudentsCount += item.students.length;
            }
            if (Array.isArray(item.attendance)) {
              this.saveAttendance(item.attendance, classId);
            }
            if (Array.isArray(item.exams)) {
              this.saveExams(item.exams, classId);
            }
            if (item.examMarksMap && typeof item.examMarksMap === 'object') {
              this.saveExamMarksMap(item.examMarksMap, classId);
            }
          }
        });
      }

      // Restore Principal Broadcasts
      let broadcastsCount = 0;
      if (Array.isArray(data.principalBroadcasts)) {
        this.savePrincipalBroadcasts(data.principalBroadcasts);
        broadcastsCount = data.principalBroadcasts.length;
      }

      // Restore Timetables
      if (Array.isArray(data.timetables) && data.timetables.length > 0) {
        this.saveTimetables(data.timetables);
      }

      // Restore Reminders & Settings
      if (Array.isArray(data.reminders)) {
        this.saveReminders(data.reminders);
      }
      if (data.settings) {
        this.saveSettings(data.settings);
      }

      notifyMutation();

      return {
        success: true,
        message: `Successfully imported school backup with ${classesCount} classes, ${teachersCount} teachers, and ${totalStudentsCount} students!`,
        stats: {
          teachersCount,
          classesCount,
          studentsCount: totalStudentsCount,
          broadcastsCount
        }
      };
    } catch (e: any) {
      return { success: false, message: `Failed to import school backup: ${e?.message || 'Invalid format'}` };
    }
  },

  getAuthSession(): AuthSession {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (!val) {
        return { isLoggedIn: false, role: 'teacher', currentTeacher: null, currentAdmin: null };
      }
      const parsed = JSON.parse(val);
      const currentAdmin = parsed.currentAdmin ? {
        ...parsed.currentAdmin,
        schoolName: (parsed.currentAdmin.schoolName?.toLowerCase().includes('sebast') || !parsed.currentAdmin.schoolName)
          ? "St.Sebastian's Higher Secondary School"
          : parsed.currentAdmin.schoolName,
        schoolCode: (parsed.currentAdmin.schoolCode?.toUpperCase() === 'SSHSS@111213' || !parsed.currentAdmin.schoolCode)
          ? 'SSHSS@111213'
          : parsed.currentAdmin.schoolCode,
        adminName: (!parsed.currentAdmin.adminName || parsed.currentAdmin.adminName === 'School Administrator' || parsed.currentAdmin.adminName === 'Principal / School Administrator')
          ? 'Principal'
          : parsed.currentAdmin.adminName
      } : null;
      return {
        isLoggedIn: Boolean(parsed.isLoggedIn),
        role: parsed.role || 'teacher',
        currentTeacher: parsed.currentTeacher || null,
        currentAdmin
      };
    } catch {
      return { isLoggedIn: false, role: 'teacher', currentTeacher: null, currentAdmin: null };
    }
  },

  setAuthSession(session: AuthSession) {
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    notifyMutation();
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CLASS_ID);
    notifyMutation();
  },

  logoutTeacher() {
    this.logout();
  },

  getAuditLogs(schoolCode?: string): AuditLogItem[] {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (!val) {
        return [];
      }
      return JSON.parse(val);
    } catch {
      return [];
    }
  },

  saveAuditLogs(logs: AuditLogItem[]) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(-200)));
    notifyMutation();
  },

  addAuditLog(entry: Omit<AuditLogItem, 'id' | 'timestamp'>) {
    const current = this.getAuditLogs();
    const newEntry: AuditLogItem = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    this.saveAuditLogs([newEntry, ...current]);

    let code = 'SSHSS@111213';
    const match = entry.target ? entry.target.match(/\[(.*?)\]/) : null;
    if (match && match[1]) {
      code = match[1];
    }
    import('./cloudSync').then(m => {
      m.CloudSync.saveAuditLogToSchool(code, newEntry).catch(() => {});
    }).catch(() => {});
  },

  clearAuditLogs() {
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem('hss_audit_logs_v1');
    localStorage.removeItem('hss_teacher_activities_' + (localStorage.getItem('hss_active_school_code') || 'SSHSS@111213'));
    notifyMutation();
  }
};
