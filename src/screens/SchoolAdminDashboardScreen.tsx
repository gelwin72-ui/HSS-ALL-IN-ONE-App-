import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Building2,
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  Calendar,
  CalendarDays,
  Search,
  Filter,
  ShieldCheck,
  LogOut,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  RefreshCw,
  School,
  Mail,
  Phone,
  BookOpen,
  Award,
  AlertCircle,
  Hash,
  KeyRound,
  Bell,
  Eye,
  X,
  Plus,
  Save,
  Check,
  Layers,
  BarChart3,
  Cake,
  Download,
  Upload,
  Send,
  UserCheck,
  FileText,
  Radio,
  Share2,
  Edit3,
  Smile,
  AlertTriangle,
  Camera,
  Trash2,
  UserPlus,
  Pencil,
  Gift,
  MapPin,
  History,
  Lock,
  FileCheck,
  ClipboardList,
  MessageSquare,
  Activity,
  UserX,
  AlertOctagon
} from 'lucide-react';
import {
  SchoolAdminAccount,
  TeacherAccount,
  SchoolProfile,
  ClassItem,
  Student,
  AttendanceRecord,
  Exam,
  ExamMarksRecord,
  Reminder,
  PrincipalBroadcast,
  TimetableSlot,
  TimetableDay,
  TimetablePeriodType,
  AuditLogItem,
  TeacherActivityItem
} from '../types';
import { StorageService, DEFAULT_PERIOD_TIMINGS, TIMETABLE_DAYS, registerStorageMutationListener } from '../utils/storage';
import { db, database, ref, update, doc, setDoc, handleFirestoreError, OperationType } from '../utils/firebase';
import { CloudSync } from '../utils/cloudSync';
import {
  generateSchoolAdminAuditPDF,
  generateSchoolAdminStudentsPDF,
  generateSchoolAdminTeachersPDF,
  shareOrDownloadPDF
} from '../utils/pdfGenerator';

interface SchoolAdminDashboardScreenProps {
  admin: SchoolAdminAccount;
  onLogout: () => void;
}

type AdminTab = 'teachers-info' | 'students-classes' | 'timetables' | 'teachers' | 'academics' | 'broadcasts' | 'settings-data' | 'audit-logs' | 'reports-center' | 'teacher-activity' | 'teacher-signups';

export const SchoolAdminDashboardScreen: React.FC<SchoolAdminDashboardScreenProps> = ({
  admin,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teachers-info');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherForDossier, setSelectedTeacherForDossier] = useState<TeacherAccount | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mutationCount, setMutationCount] = useState(0);

  // Teacher Management State (Add / Edit / Photo / Birthday)
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherAccount | null>(null);
  const [teacherFormData, setTeacherFormData] = useState<{
    name: string;
    email: string;
    subject: string;
    designation: string;
    academicYear: string;
    assignedClass: string;
    standard: string;
    stream: string;
    section: string;
    phone: string;
    dob: string;
    avatar: string;
    photoUrl: string;
  }>({
    name: '',
    email: '',
    subject: '',
    designation: '',
    academicYear: '2026-27',
    assignedClass: '',
    standard: '',
    stream: '',
    section: '',
    phone: '',
    dob: '',
    avatar: '👨‍🏫',
    photoUrl: ''
  });
  const [teacherFilterBirthday, setTeacherFilterBirthday] = useState<'all' | 'upcoming' | 'this-month'>('all');

  // Real-time Firestore synchronization for Teachers, Classes, and Activity Stream
  const [remoteTeachers, setRemoteTeachers] = useState<TeacherAccount[]>([]);
  const [hasLoadedRemoteTeachers, setHasLoadedRemoteTeachers] = useState(false);
  const [remoteClasses, setRemoteClasses] = useState<ClassItem[]>([]);
  const [realtimeActivities, setRealtimeActivities] = useState<TeacherActivityItem[]>([]);
  const [teacherSignups, setTeacherSignups] = useState<any[]>([]);
  const [signupSearch, setSignupSearch] = useState('');
  const [signupFilter, setSignupFilter] = useState('all');

  // Timetable State in Admin View
  const [adminTimetables, setAdminTimetables] = useState<TimetableSlot[]>(() => StorageService.getTimetables(admin?.schoolCode || ''));
  const [adminTimetableViewMode, setAdminTimetableViewMode] = useState<'teacher-matrix' | 'classroom-matrix' | 'faculty-overview' | 'substitution-finder'>('teacher-matrix');
  const [adminSelectedTeacherId, setAdminSelectedTeacherId] = useState<string>('ALL');
  const [adminSelectedClassroom, setAdminSelectedClassroom] = useState<string>('ALL');
  const [adminTimetableDay, setAdminTimetableDay] = useState<TimetableDay | 'ALL'>('ALL');
  const [substitutionDay, setSubstitutionDay] = useState<TimetableDay>('Monday');
  const [substitutionPeriod, setSubstitutionPeriod] = useState<number>(1);
  const [isAdminTimetableModalOpen, setIsAdminTimetableModalOpen] = useState(false);
  const [adminEditingSlot, setAdminEditingSlot] = useState<TimetableSlot | null>(null);
  const [adminSlotFormData, setAdminSlotFormData] = useState<{
    day: TimetableDay;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subject: string;
    subjectCode: string;
    className: string;
    teacherId: string;
    teacherName: string;
    roomNumber: string;
    type: TimetablePeriodType;
    notes: string;
  }>({
    day: 'Monday',
    periodNumber: 1,
    startTime: '09:30 AM',
    endTime: '10:15 AM',
    subject: '',
    subjectCode: '',
    className: '',
    teacherId: '',
    teacherName: '',
    roomNumber: '',
    type: 'lecture',
    notes: ''
  });

  // Student & Classroom View mode
  const [studentViewMode, setStudentViewMode] = useState<'teacher-wise' | 'school-wise'>('teacher-wise');
  const [selectedTeacherIdForClassroom, setSelectedTeacherIdForClassroom] = useState<string>('');
  const [selectedClassIdForTeacher, setSelectedClassIdForTeacher] = useState<string>('');
  const [selectedStandardFilter, setSelectedStandardFilter] = useState<string>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // Editable School Profile in Admin Mode
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => StorageService.getSchoolProfile());
  const [adminPin, setAdminPin] = useState(admin?.adminPassword || '');
  const [adminName, setAdminName] = useState(admin?.adminName || StorageService.getSchoolProfile().principalName || '');
  const [adminPhone, setAdminPhone] = useState(admin?.phone || '');
  const [adminEmail, setAdminEmail] = useState(admin?.email || '');

  const activeSchoolCode = admin?.schoolCode || schoolProfile.schoolCode || '';

  // Keep adminName in sync if admin or school profile changes
  React.useEffect(() => {
    if (admin?.adminName) {
      setAdminName(admin.adminName);
    } else {
      const prof = StorageService.getSchoolProfile();
      if (prof.principalName) {
        setAdminName(prof.principalName);
      }
    }
  }, [admin.adminName]);

  // Broadcast Composer State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState<'administrative' | 'academic' | 'exam' | 'meeting' | 'holiday' | 'general'>('academic');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [broadcastAudience, setBroadcastAudience] = useState('All Teachers');

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [importPreview, setImportPreview] = useState<{
    teachersCount: number;
    classesCount: number;
    studentsCount: number;
    schoolName: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Two-Mode Teacher Deletion States
  const [deleteModalTeacher, setDeleteModalTeacher] = useState<{ id: string; name: string; email: string; uid?: string } | null>(null);
  const [showPermanentConfirmation, setShowPermanentConfirmation] = useState<boolean>(false);

  // Teacher Review Remarks State (teacherId -> remark)
  const [teacherRemarks, setTeacherRemarks] = useState<Record<string, string>>({});
  const [currentRemarkInput, setCurrentRemarkInput] = useState('');

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => StorageService.getAuditLogs(activeSchoolCode));
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'AUTH' | 'SECURITY' | 'DATA'>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Report Center State
  const [reportType, setReportType] = useState<'students' | 'teachers' | 'attendance' | 'exams' | 'leaves'>('students');

  // Teacher Activity Stream State
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('ALL');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  // Live Teacher Action / Class Modification Notification for School Admin
  const [liveNotification, setLiveNotification] = useState<{
    id: string;
    title: string;
    message: string;
    timestamp: string;
  } | null>(null);

  const isInitialClassesLoadRef = useRef(true);
  const isInitialActivitiesLoadRef = useRef(true);
  const latestActivityIdRef = useRef<string | null>(null);
  const prevClassesSummaryRef = useRef<string>('');

  // Register storage mutation listener so state re-renders immediately on any storage change
  React.useEffect(() => {
    const unsub = registerStorageMutationListener(() => {
      setMutationCount(c => c + 1);
    });
    return unsub;
  }, []);

  // Real-time Cloud Sync for School Teachers, Classes, Activities, Broadcasts, Timetables, Profile, Audit Logs
  React.useEffect(() => {
    if (!activeSchoolCode) return;

    // Run one-time cleanup of old deleted teacher records
    CloudSync.cleanupOldDeletedTeachers(activeSchoolCode).catch(() => {});

    // 1. Subscribe to real-time teacher roster
    const unsubTeachers = CloudSync.listenToSchoolTeachers(activeSchoolCode, (teachersList) => {
      setRemoteTeachers(teachersList);
      setHasLoadedRemoteTeachers(true);
    });

    // 2. Subscribe to real-time classes (All-time active classroom sync)
    const unsubClasses = CloudSync.listenToSchoolClasses(activeSchoolCode, (classList) => {
      setRemoteClasses(classList);
      const summary = classList.map(c => `${c.id}:${c.className}:${c.classStrength}`).join('|');
      if (!isInitialClassesLoadRef.current && prevClassesSummaryRef.current && prevClassesSummaryRef.current !== summary) {
        showToast(`⚡ Real-Time Update: Classroom records synchronized (${classList.length} active classes)`);
      }
      prevClassesSummaryRef.current = summary;
      isInitialClassesLoadRef.current = false;
    });

    // 3. Subscribe to real-time teacher activities (Instant Notification for Admin)
    const unsubActivities = CloudSync.listenToSchoolActivities(activeSchoolCode, (activities) => {
      setRealtimeActivities(activities);
      if (!isInitialActivitiesLoadRef.current && activities.length > 0) {
        const newest = activities[0];
        if (newest && newest.id !== latestActivityIdRef.current) {
          latestActivityIdRef.current = newest.id;
          const timeStr = new Date(newest.timestamp || Date.now()).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          setLiveNotification({
            id: newest.id,
            title: `Teacher Action: ${newest.teacherName || 'Faculty'}`,
            message: newest.description || `Changes recorded in ${newest.assignedClass || 'Classroom'}`,
            timestamp: timeStr
          });
          showToast(`🔔 ${newest.teacherName || 'Teacher'}: ${newest.description}`);
        }
      } else if (activities.length > 0) {
        latestActivityIdRef.current = activities[0]?.id || null;
      }
      isInitialActivitiesLoadRef.current = false;
    });

    // 4. Subscribe to real-time principal broadcasts
    const unsubBroadcasts = CloudSync.listenToSchoolBroadcasts(activeSchoolCode, () => {
      setMutationCount(c => c + 1);
    });

    // 5. Subscribe to real-time timetables
    const unsubTimetables = CloudSync.listenToSchoolTimetables(activeSchoolCode, (slots) => {
      setAdminTimetables(slots);
    });

    // 6. Subscribe to real-time school profile
    const unsubProfile = CloudSync.listenToSchoolProfile(activeSchoolCode, (prof) => {
      if (prof && prof.schoolName) {
        setSchoolProfile(prof);
        if (prof.principalName) setAdminName(prof.principalName);
      }
    });

    // 7. Subscribe to real-time audit logs
    const unsubAuditLogs = CloudSync.listenToSchoolAuditLogs(activeSchoolCode, (logs) => {
      setAuditLogs(logs);
    });

    return () => {
      unsubTeachers();
      unsubClasses();
      unsubActivities();
      unsubBroadcasts();
      unsubTimetables();
      unsubProfile();
      unsubAuditLogs();
    };
  }, [activeSchoolCode]);

  // Record audit event on screen mount
  React.useEffect(() => {
    const safeTeachersCount = Array.isArray(teachers) ? teachers.length : 0;
    const safeClassesCount = Array.isArray(classesList) ? classesList.length : 0;
    StorageService.addAuditLog({
      user: admin?.adminName || adminName || 'Principal / School Administrator',
      role: 'SCHOOL_ADMIN',
      action: 'ADMIN_SESSION_ACTIVE',
      target: `Portal /school-admin [${activeSchoolCode}]`,
      details: `Administrator verified. Console loaded with ${safeTeachersCount} teachers and ${safeClassesCount} classes.`,
      status: 'SUCCESS'
    });
    setAuditLogs(StorageService.getAuditLogs(activeSchoolCode));
  }, [activeSchoolCode]);

  const triggerRefresh = () => {
    setMutationCount(c => c + 1);
    setAuditLogs(StorageService.getAuditLogs(activeSchoolCode));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load teachers for this school code (production Firebase Realtime Database is authoritative source of truth)
  const teachers = useMemo<TeacherAccount[]>(() => {
    // Only use remote Firebase data as the authoritative source of truth.
    // listenToSchoolTeachers automatically filters out permanently and temporarily deleted teachers.
    return (remoteTeachers || [])
      .filter(rt => rt && rt.schoolCode && rt.schoolCode.trim().toUpperCase() === activeSchoolCode.trim().toUpperCase())
      .map(rt => ({
        ...rt,
        id: rt.uid || rt.id,
        uid: rt.uid || rt.id,
        email: rt.email || rt.gmail || '',
        gmail: rt.gmail || rt.email || '',
        password: '',
        subject: rt.subject || rt.primarySubject || rt.designation || 'General',
        status: (rt.status as 'active' | 'inactive' | 'suspended') || 'active'
      }));
  }, [activeSchoolCode, remoteTeachers]);

  // Load all classes in school - strictly calculates classes created by the teacher(s) for entering the app + any created after entering
  const classesList = useMemo(() => {
    const rawMap = new Map<string, ClassItem>();

    // 1. Collect all candidate classes for this school
    const localClasses = StorageService.getClassesList() || [];
    localClasses.forEach(lc => {
      if (lc && lc.id) {
        const sc = (lc.schoolCode || '').trim().toUpperCase();
        if (!sc || sc === activeSchoolCode.trim().toUpperCase()) {
          rawMap.set(lc.id, {
            ...lc,
            schoolCode: activeSchoolCode,
            status: 'active' as const
          });
        }
      }
    });

    // 2. Overlay remote Firebase classes (authoritative cloud multi-device sync)
    (Array.isArray(remoteClasses) ? remoteClasses : []).forEach(rc => {
      if (rc && rc.id) {
        const sc = (rc.schoolCode || '').trim().toUpperCase();
        if (!sc || sc === activeSchoolCode.trim().toUpperCase()) {
          rawMap.set(rc.id, {
            ...rc,
            schoolCode: activeSchoolCode,
            status: 'active' as const
          });
        }
      }
    });

    const candidates = Array.from(rawMap.values());
    const validTeachers = Array.isArray(teachers) ? teachers.filter(Boolean) : [];

    // If there are no registered teachers yet, show school candidates
    if (validTeachers.length === 0) {
      return candidates.map(c => ({ ...c, status: 'active' as const }));
    }

    // If total teacher count is 1:
    // Only classes created by this single teacher (the class created for entering the app + any other classes created after entering)
    // should be seen as the total classes.
    if (validTeachers.length === 1) {
      const singleTeacher = validTeachers[0];
      const singleTeacherId = singleTeacher.id || singleTeacher.uid || '';
      const singleTeacherEmail = (singleTeacher.email || singleTeacher.gmail || '').trim().toLowerCase();
      const singleTeacherName = (singleTeacher.name || '').trim().toLowerCase();
      const assignedClassName = (singleTeacher.assignedClass || '').trim().toLowerCase();

      // Find all matching classes for this single teacher
      const matched = candidates.filter(c => {
        if (!c) return false;
        // Check teacher ID match
        if (singleTeacherId && (c.createdByTeacherId === singleTeacherId || c.teacherId === singleTeacherId || c.teacherUid === singleTeacherId)) return true;
        // Check teacher email match
        if (singleTeacherEmail && c.createdByTeacherEmail && c.createdByTeacherEmail.trim().toLowerCase() === singleTeacherEmail) return true;
        // Check teacher name match
        if (singleTeacherName && c.teacherName && c.teacherName.trim().toLowerCase() === singleTeacherName) return true;
        // Check initial entry assigned class name match
        if (assignedClassName && c.className && c.className.trim().toLowerCase() === assignedClassName) return true;
        // If class belongs to school and was teacher created
        if (c.schoolCode && c.schoolCode.trim().toUpperCase() === activeSchoolCode.trim().toUpperCase() && c.isTeacherCreated) return true;
        return false;
      });

      // If the teacher has an assigned initial entry class that wasn't found in candidate records, ensure it is synthesized
      if (matched.length === 0 && (singleTeacher.assignedClass || singleTeacher.standard)) {
        const entryClassName = singleTeacher.assignedClass || `${singleTeacher.standard || 'Class 12'} ${singleTeacher.stream || 'Science'} ${singleTeacher.section || 'A'}`;
        const syntheticClass: ClassItem = {
          id: `entry-cls-${singleTeacherId || 'primary'}`,
          className: entryClassName,
          standard: singleTeacher.standard || 'Class 12 (Plus Two)',
          stream: singleTeacher.stream || 'Science',
          section: singleTeacher.section || 'A',
          academicYear: singleTeacher.academicYear || '2026-2027',
          classStrength: singleTeacher.studentCount || 0,
          teacherId: singleTeacherId,
          teacherUid: singleTeacherId,
          teacherName: singleTeacher.name,
          schoolCode: activeSchoolCode,
          isTeacherCreated: true,
          createdByTeacherId: singleTeacherId,
          createdByTeacherEmail: singleTeacher.email || singleTeacher.gmail,
          createdAt: singleTeacher.createdAt || new Date().toISOString(),
          status: 'active' as const
        };
        return [syntheticClass];
      }

      return matched.map(c => ({ ...c, status: 'active' as const }));
    }

    // If multiple teachers (validTeachers.length > 1):
    // Include all classes created by any of the valid teachers in this school
    const teacherMatchedClasses = candidates.filter(c => {
      if (!c) return false;
      return validTeachers.some(t => {
        const tId = t.id || t.uid || '';
        const tEmail = (t.email || t.gmail || '').trim().toLowerCase();
        const tName = (t.name || '').trim().toLowerCase();
        const tAssigned = (t.assignedClass || '').trim().toLowerCase();

        if (tId && (c.createdByTeacherId === tId || c.teacherId === tId || c.teacherUid === tId)) return true;
        if (tEmail && c.createdByTeacherEmail && c.createdByTeacherEmail.trim().toLowerCase() === tEmail) return true;
        if (tName && c.teacherName && c.teacherName.trim().toLowerCase() === tName) return true;
        if (tAssigned && c.className && c.className.trim().toLowerCase() === tAssigned) return true;
        if (c.schoolCode && c.schoolCode.trim().toUpperCase() === activeSchoolCode.trim().toUpperCase() && c.isTeacherCreated) return true;
        return false;
      });
    });

    return teacherMatchedClasses.length > 0
      ? teacherMatchedClasses.map(c => ({ ...c, status: 'active' as const }))
      : candidates.map(c => ({ ...c, status: 'active' as const }));
  }, [remoteClasses, teachers, activeSchoolCode, mutationCount]);

  // Helper to get only classrooms created by a specific teacher (entry class + any created after entering)
  const getTeacherCreatedClasses = useCallback((teacherId?: string, teacherEmail?: string, teacherName?: string): ClassItem[] => {
    if (!teacherId && !teacherEmail && !teacherName) return [];
    const safeClasses = Array.isArray(classesList) ? classesList : [];
    const tObj = (teachers || []).find(t => t && (
      t.id === teacherId ||
      t.uid === teacherId ||
      (teacherEmail && (
        (t.email && t.email.toLowerCase() === teacherEmail.toLowerCase()) ||
        (t.gmail && t.gmail.toLowerCase() === teacherEmail.toLowerCase())
      )) ||
      (teacherName && t.name && t.name.toLowerCase() === teacherName.toLowerCase())
    ));

    const targetId = teacherId || tObj?.id || tObj?.uid;
    const targetEmail = (teacherEmail || tObj?.email || tObj?.gmail || '').toLowerCase().trim();
    const targetName = (teacherName || tObj?.name || '').toLowerCase().trim();
    const targetAssigned = (tObj?.assignedClass || '').toLowerCase().trim();

    const matched = safeClasses.filter(c => {
      if (!c) return false;
      if (targetId && (c.createdByTeacherId === targetId || c.teacherId === targetId || c.teacherUid === targetId)) return true;
      if (targetEmail && c.createdByTeacherEmail && c.createdByTeacherEmail.toLowerCase() === targetEmail) return true;
      if (targetName && c.teacherName && c.teacherName.toLowerCase() === targetName) return true;
      if (targetAssigned && c.className && c.className.toLowerCase() === targetAssigned) return true;
      if (tObj && (teachers.length === 1) && (c.schoolCode || '').toUpperCase() === activeSchoolCode.toUpperCase()) return true;
      return false;
    });

    return matched;
  }, [classesList, teachers, activeSchoolCode]);

  // Classrooms created by currently selected teacher in Teacher-Wise mode
  const activeTeacherCreatedClasses = useMemo(() => {
    return getTeacherCreatedClasses(selectedTeacherIdForClassroom);
  }, [getTeacherCreatedClasses, selectedTeacherIdForClassroom]);

  // Keep selected teacher & class in sync
  React.useEffect(() => {
    if (!selectedTeacherIdForClassroom && teachers.length > 0) {
      setSelectedTeacherIdForClassroom(teachers[0].id);
    }
  }, [teachers, selectedTeacherIdForClassroom]);

  React.useEffect(() => {
    if (activeTeacherCreatedClasses.length > 0) {
      if (!selectedClassIdForTeacher || !activeTeacherCreatedClasses.some(c => c.id === selectedClassIdForTeacher)) {
        setSelectedClassIdForTeacher(activeTeacherCreatedClasses[0].id);
      }
    } else {
      setSelectedClassIdForTeacher('');
    }
  }, [activeTeacherCreatedClasses, selectedClassIdForTeacher]);

  // Load Upcoming Birthdays
  const upcomingBirthdays = useMemo(() => {
    const list = StorageService.getUpcomingTeacherBirthdays(activeSchoolCode, 60);
    return Array.isArray(list) ? list : [];
  }, [activeSchoolCode, mutationCount, teachers]);

  // Load Broadcasts
  const broadcasts = useMemo(() => {
    const list = StorageService.getPrincipalBroadcasts(activeSchoolCode);
    return Array.isArray(list) ? list : [];
  }, [activeSchoolCode, mutationCount]);

  // Load consolidated school data across all classes
  const crossClassData = useMemo(() => {
    let totalStudents = 0;
    let totalBoys = 0;
    let totalGirls = 0;
    let allAttendanceCount = 0;
    let allAttendancePresent = 0;
    let allExams: Exam[] = [];
    let totalMarksSum = 0;
    let totalMarksCount = 0;
    const allStudentsList: Array<Student & { className: string; teacherName: string; classId: string; attendancePercentage?: number }> = [];

    const classMetrics: Record<string, {
      studentsCount: number;
      attendanceRate: number;
      examsCount: number;
      lastAttendanceDate?: string;
      academicAvg: number;
    }> = {};

    const safeClasses = Array.isArray(classesList) ? classesList : [];
    const safeTeachers = Array.isArray(teachers) ? teachers : [];

    safeClasses.forEach((cls, idx) => {
      if (!cls) return;
      const studs = StorageService.getStudents(cls.id) || [];
      const atts = StorageService.getAttendance(cls.id) || [];
      const exms = StorageService.getExams(cls.id) || [];
      const marksMap = StorageService.getExamMarksMap(cls.id) || {};

      // Find matching teacher for class
      const matchingTeacher =
        safeTeachers.find(t => t && t.assignedClass === cls.className) ||
        safeTeachers[idx % Math.max(1, safeTeachers.length)] ||
        safeTeachers[0];

      studs.forEach(s => {
        if (!s) return;
        let sPres = 0;
        let sDays = 0;
        atts.forEach(a => {
          if (!a) return;
          const p = Array.isArray(a.presentStudentIds) && a.presentStudentIds.includes(s.id);
          const ab = Array.isArray(a.absentStudentIds) && a.absentStudentIds.includes(s.id);
          if (p || ab) {
            sDays++;
            if (p) sPres++;
          }
        });
        const attPct = sDays > 0 ? Math.round((sPres / sDays) * 100) : undefined;

        allStudentsList.push({
          ...s,
          className: cls.className || 'Class',
          teacherName: matchingTeacher ? matchingTeacher.name : 'Class In-charge',
          classId: cls.id,
          attendancePercentage: attPct
        });
      });

      totalStudents += studs.length;
      totalBoys += studs.filter(s => s && s.gender === 'male').length;
      totalGirls += studs.filter(s => s && s.gender === 'female').length;
      allExams = allExams.concat(exms);

      let classPresent = 0;
      let classTotal = 0;
      let lastAttDate = '';

      atts.forEach(a => {
        if (!a) return;
        const pres = Array.isArray(a.presentStudentIds) ? a.presentStudentIds.length : 0;
        const abs = Array.isArray(a.absentStudentIds) ? a.absentStudentIds.length : 0;
        classPresent += pres;
        classTotal += (pres + abs);
        if (a.date && (!lastAttDate || a.date > lastAttDate)) {
          lastAttDate = a.date;
        }
      });

      allAttendancePresent += classPresent;
      allAttendanceCount += classTotal;

      // Calculate Academic Average from Exam Marks
      let classMarksTotal = 0;
      let classMarksCount = 0;
      Object.values(marksMap || {}).forEach(rec => {
        if (!rec || !rec.marks) return;
        Object.values(rec.marks).forEach(mark => {
          if (!mark) return;
          if (mark.percentage !== undefined && mark.percentage > 0) {
            classMarksTotal += mark.percentage;
            classMarksCount++;
            totalMarksSum += mark.percentage;
            totalMarksCount++;
          } else if (mark.totalObtained !== undefined && mark.totalObtained > 0) {
            const maxVal = mark.totalMax || 100;
            const pct = (mark.totalObtained / maxVal) * 100;
            classMarksTotal += pct;
            classMarksCount++;
            totalMarksSum += pct;
            totalMarksCount++;
          }
        });
      });

      const academicAvg = classMarksCount > 0
        ? Math.round(classMarksTotal / classMarksCount)
        : 0;

      const rate = classTotal > 0 ? Math.round((classPresent / classTotal) * 100) : 0;

      classMetrics[cls.id] = {
        studentsCount: studs.length,
        attendanceRate: rate,
        examsCount: exms.length,
        lastAttendanceDate: lastAttDate || '—',
        academicAvg
      };
    });

    const overallAttendanceRate = allAttendanceCount > 0
      ? Math.round((allAttendancePresent / allAttendanceCount) * 100)
      : 0;

    const overallAcademicAverage = totalMarksCount > 0
      ? Math.round(totalMarksSum / totalMarksCount)
      : 0;

    return {
      totalStudents,
      totalBoys,
      totalGirls,
      overallAttendanceRate,
      overallAcademicAverage,
      classMetrics,
      allExams,
      allStudentsList
    };
  }, [classesList, teachers, mutationCount]);

  // Set default selected teacher for classroom inspection
  React.useEffect(() => {
    if (!selectedTeacherIdForClassroom && Array.isArray(teachers) && teachers.length > 0) {
      setSelectedTeacherIdForClassroom(teachers[0].id);
    }
  }, [teachers, selectedTeacherIdForClassroom]);

  // Filtered teachers list for Teacher Directory & Management
  const filteredTeachers = useMemo(() => {
    let list = teachers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.designation.toLowerCase().includes(q) ||
          (t.assignedClass && t.assignedClass.toLowerCase().includes(q)) ||
          t.email.toLowerCase().includes(q) ||
          t.phone.includes(q)
      );
    }
    if (teacherFilterBirthday === 'upcoming') {
      const upcomingIds = new Set(upcomingBirthdays.map(ub => ub.teacher.id));
      list = list.filter(t => upcomingIds.has(t.id));
    } else if (teacherFilterBirthday === 'this-month') {
      const currentMonth = new Date().getMonth();
      list = list.filter(t => {
        if (!t.dob) return false;
        const bMonth = new Date(t.dob).getMonth();
        return bMonth === currentMonth;
      });
    }
    return list;
  }, [teachers, searchQuery, teacherFilterBirthday, upcomingBirthdays]);

  // Filtered students for School-wise or Teacher-wise view
  const displayedStudents = useMemo(() => {
    let list = crossClassData?.allStudentsList || [];

    if (studentViewMode === 'teacher-wise') {
      const selTeacher = (teachers || []).find(t => t && t.id === selectedTeacherIdForClassroom);
      const teacherCreatedClasses = getTeacherCreatedClasses(selectedTeacherIdForClassroom);
      const activeClass = teacherCreatedClasses.find(c => c.id === selectedClassIdForTeacher) || teacherCreatedClasses[0];

      if (activeClass) {
        list = list.filter(s => s && (s.classId === activeClass.id || (s.className && s.className.toLowerCase() === activeClass.className.toLowerCase())));
      } else if (selTeacher && selTeacher.assignedClass) {
        list = list.filter(s => s && s.className && s.className.toLowerCase() === selTeacher.assignedClass?.toLowerCase());
      } else if (selTeacher) {
        list = list.filter(s => s && s.teacherName === selTeacher.name);
      } else {
        list = [];
      }
    }

    if (selectedStandardFilter !== 'all') {
      list = list.filter(s => s && s.className && s.className.toLowerCase().includes(selectedStandardFilter.toLowerCase()));
    }

    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase();
      list = list.filter(
        s =>
          s && (
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.rollNo !== undefined && s.rollNo.toString().includes(q)) ||
            (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
            (s.guardianPhone && s.guardianPhone.includes(q))
          )
      );
    }

    return list;
  }, [crossClassData, studentViewMode, selectedTeacherIdForClassroom, selectedStandardFilter, studentSearchQuery, teachers]);

  // Dossier detailed data for selected teacher
  const selectedTeacherDossierData = useMemo(() => {
    if (!selectedTeacherForDossier) return null;

    const teacherClasses = getTeacherCreatedClasses(
      selectedTeacherForDossier.id,
      selectedTeacherForDossier.email || selectedTeacherForDossier.gmail,
      selectedTeacherForDossier.name
    );
    const primaryClass = teacherClasses[0] || classesList[0];

    // Aggregate students, attendance, exams across all classrooms created by this teacher
    let allStudents: Student[] = [];
    let totalAttendanceDays = 0;
    let totalExams = 0;
    let marksEnteredCount = 0;
    const marksMap: Record<string, any> = {};

    teacherClasses.forEach(cls => {
      const clsStudents = StorageService.getStudents(cls.id) || [];
      allStudents = [...allStudents, ...clsStudents];
      const clsAttendance = StorageService.getAttendance(cls.id) || [];
      totalAttendanceDays += clsAttendance.length;
      const clsExams = StorageService.getExams(cls.id) || [];
      totalExams += clsExams.length;
      const clsMarks = StorageService.getExamMarksMap(cls.id) || {};
      Object.assign(marksMap, clsMarks);
      marksEnteredCount += Object.keys(clsMarks).length;
    });

    if (teacherClasses.length === 0 && primaryClass) {
      allStudents = StorageService.getStudents(primaryClass.id) || [];
      const att = StorageService.getAttendance(primaryClass.id) || [];
      totalAttendanceDays = att.length;
      const ex = StorageService.getExams(primaryClass.id) || [];
      totalExams = ex.length;
    }

    return {
      teacherClasses,
      primaryClass,
      students: allStudents,
      attendance: [],
      exams: [],
      marksMap,
      totalAttendanceDays,
      totalExams,
      marksEnteredCount
    };
  }, [selectedTeacherForDossier, getTeacherCreatedClasses, classesList, mutationCount]);

  // Handlers
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedProfile = {
      ...schoolProfile,
      principalName: adminName.trim()
    };
    StorageService.saveSchoolProfile(updatedProfile);
    setSchoolProfile(updatedProfile);
    await CloudSync.saveSchoolProfileToSchool(activeSchoolCode, updatedProfile);

    const admins = StorageService.getSchoolAdmins();
    const idx = admins.findIndex(a => a.id === admin.id || a.schoolCode === admin.schoolCode);
    if (idx >= 0) {
      admins[idx].adminPassword = adminPin;
      admins[idx].adminName = adminName.trim();
      admins[idx].phone = adminPhone;
      admins[idx].email = adminEmail;
      admins[idx].schoolName = schoolProfile.schoolName;
      admins[idx].schoolCode = schoolProfile.schoolCode;
      StorageService.saveSchoolAdmins(admins);
    }

    showToast('School Profile and Admin PIN updated successfully!');
    triggerRefresh();
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('Please enter both title and message for the broadcast.');
      return;
    }

    const newBroadcast: PrincipalBroadcast = {
      id: `pb-${Date.now()}`,
      schoolCode: admin.schoolCode || schoolProfile.schoolCode,
      senderName: `${adminName} (Principal)`,
      title: broadcastTitle.trim(),
      message: broadcastMessage.trim(),
      priority: broadcastPriority,
      category: broadcastCategory,
      targetAudience: broadcastAudience,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().substring(0, 5),
      createdAt: new Date().toISOString()
    };

    StorageService.addPrincipalBroadcast(newBroadcast);
    await CloudSync.saveBroadcastToSchool(activeSchoolCode, newBroadcast);

    try {
      const docRef = doc(db, 'broadcasts', newBroadcast.id);
      await setDoc(docRef, newBroadcast);
      fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode: newBroadcast.schoolCode,
          title: newBroadcast.title,
          body: newBroadcast.message,
          targetAudience: newBroadcast.targetAudience
        })
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `broadcasts/${newBroadcast.id}`);
    }

    setBroadcastTitle('');
    setBroadcastMessage('');
    showToast('Broadcast directive sent and synchronized with Cloud!');
    triggerRefresh();
  };

  const handleDeleteBroadcast = async (broadcastId: string) => {
    StorageService.deletePrincipalBroadcast(broadcastId);
    await CloudSync.deleteBroadcastFromSchool(activeSchoolCode, broadcastId);
    showToast('Broadcast directive deleted.');
    triggerRefresh();
  };

  const handleSendBirthdayGreeting = async (teacher: TeacherAccount) => {
    const greetingMessage = `🎉 Warm Birthday Greetings from the Principal & Management of ${schoolProfile.schoolName}! Wishing you a wonderful year of health, happiness, and continued excellence in education.`;
    
    // Create a broadcast/reminder specifically for teacher's birthday
    const bdayBroadcast: PrincipalBroadcast = {
      id: `bday-${Date.now()}`,
      schoolCode: admin.schoolCode,
      senderName: `${adminName} (Principal)`,
      title: `🎂 Birthday Wishes to ${teacher.name}!`,
      message: greetingMessage,
      priority: 'normal',
      category: 'general',
      targetAudience: 'All Teachers',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      createdAt: new Date().toISOString()
    };
    StorageService.addPrincipalBroadcast(bdayBroadcast);

    try {
      const docRef = doc(db, 'broadcasts', bdayBroadcast.id);
      await setDoc(docRef, bdayBroadcast);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `broadcasts/${bdayBroadcast.id}`);
    }

    // Try Web Notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🎂 Birthday Greeting Sent!`, {
          body: `Wishing ${teacher.name} a happy birthday!`,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.log('Notification skipped', e);
      }
    }

    showToast(`Birthday Greeting published and notified for ${teacher.name}!`);
    triggerRefresh();
  };

  const handleClearTeacherActivity = async () => {
    if (confirm('Are you sure you want to permanently clear all recent teacher activity records?')) {
      const success = await CloudSync.clearSchoolActivities(admin.schoolCode);
      if (success) {
        setRealtimeActivities([]);
        showToast('All teacher activities have been permanently deleted.');
      } else {
        showToast('Failed to clear teacher activities. Please try again.');
      }
    }
  };

  const handleExportFullJson = () => {
    const jsonStr = StorageService.exportCompleteSchoolData(admin.schoolCode);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `School_Admin_Backup_${admin.schoolCode}_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Complete School Backup exported (${filename})`);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleExportAuditPDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    showToast('Compiling School Audit PDF...');
    
    setTimeout(async () => {
      try {
        const doc = generateSchoolAdminAuditPDF(
          schoolProfile,
          admin,
          teachers,
          classesList,
          {
            totalStudents: crossClassData.totalStudents,
            overallAttendanceRate: crossClassData.overallAttendanceRate,
            overallAcademicAverage: crossClassData.overallAcademicAverage
          }
        );
        const filename = `Consolidated_School_Audit_${admin.schoolCode || 'SSHSS'}_${new Date().toISOString().split('T')[0]}.pdf`;
        await shareOrDownloadPDF(doc, filename, 'School Audit Report');
        showToast(`Consolidated Audit PDF downloaded (${filename})!`);
      } catch (e) {
        console.error('PDF export error:', e);
        showToast('Error generating Audit PDF. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleExportStudentsPDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    showToast('Compiling Students Roster PDF...');
    
    setTimeout(async () => {
      try {
        const doc = generateSchoolAdminStudentsPDF(
          schoolProfile,
          admin,
          crossClassData.allStudentsList
        );
        const filename = `Students_Roster_${admin.schoolCode || 'SSHSS'}_${new Date().toISOString().split('T')[0]}.pdf`;
        await shareOrDownloadPDF(doc, filename, 'School Students Roster');
        showToast(`Students Roster PDF downloaded (${filename})!`);
      } catch (e) {
        console.error('PDF export error:', e);
        showToast('Error generating Students PDF.');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleExportTeachersPDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    showToast('Compiling Teacher Directory PDF...');
    
    setTimeout(async () => {
      try {
        const doc = generateSchoolAdminTeachersPDF(
          schoolProfile,
          admin,
          teachers
        );
        const filename = `Teacher_Directory_${admin.schoolCode || 'SSHSS'}_${new Date().toISOString().split('T')[0]}.pdf`;
        await shareOrDownloadPDF(doc, filename, 'Teacher Directory');
        showToast(`Teacher Directory PDF downloaded (${filename})!`);
      } catch (e) {
        console.error('PDF export error:', e);
        showToast('Error generating Teachers PDF.');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleExportStudentsCsv = () => {
    const headers = ['Roll No', 'Admission No', 'Student Name', 'Gender', 'Class & Division', 'Parent/Guardian Phone', 'Attendance %'];
    const rows = crossClassData.allStudentsList.map(s => [
      s.rollNo,
      s.admissionNo || `ADM-${s.rollNo}`,
      `"${s.name}"`,
      s.gender,
      `"${s.className}"`,
      s.guardianPhone || '',
      s.attendancePercentage !== undefined ? `${s.attendancePercentage}%` : '—'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `School_Students_Consolidated_${admin.schoolCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Consolidated Students CSV exported successfully!');
  };

  const handleExportTeachersCsv = () => {
    const headers = ['Teacher ID', 'Teacher Name', 'Subject Assigned', 'Class Assigned', 'Stream', 'Section', 'Date of Birth (DOB)', 'Phone Number', 'School / College Name', 'School Code'];
    const rows = teachers.map(t => [
      t.id,
      `"${t.name}"`,
      `"${t.subject || t.primarySubject || t.designation || '-'}"`,
      `"${t.standard || t.assignedClass || '-'}"`,
      `"${t.stream || '-'}"`,
      `"${t.section || '-'}"`,
      t.dob || '-',
      t.phone,
      `"${t.schoolName || schoolProfile.schoolName || admin.schoolName}"`,
      t.schoolCode || admin.schoolCode
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Teacher_Directory_${admin.schoolCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Teacher Directory CSV exported successfully!');
  };

  const handleOpenAddTeacher = () => {
    setEditingTeacher(null);
    setTeacherFormData({
      name: '',
      email: '',
      subject: '',
      designation: '',
      academicYear: '2026-27',
      assignedClass: '',
      standard: '',
      stream: '',
      section: '',
      phone: '',
      dob: '',
      avatar: '👨‍🏫',
      photoUrl: ''
    });
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacher = (teacher: TeacherAccount) => {
    setEditingTeacher(teacher);
    setTeacherFormData({
      name: teacher.name,
      email: teacher.gmail || teacher.email || '',
      subject: teacher.subject || teacher.primarySubject || '',
      designation: teacher.designation || '',
      academicYear: teacher.academicYear || '2026-27',
      assignedClass: teacher.assignedClass || '',
      standard: teacher.standard || '',
      stream: teacher.stream || '',
      section: teacher.section || '',
      phone: teacher.phone,
      dob: teacher.dob || '',
      avatar: teacher.avatar || '👨‍🏫',
      photoUrl: teacher.photoUrl || ''
    });
    setIsTeacherModalOpen(true);
  };

  const handleSaveTeacherForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.name.trim()) {
      showToast('Please enter the teacher\'s full name.');
      return;
    }

    const composedClass = `${teacherFormData.standard} ${teacherFormData.stream} ${teacherFormData.section}`.trim();
    const cleanEmail = teacherFormData.email.trim().toLowerCase();
    const effectiveYear = teacherFormData.academicYear.trim() || '2026-27';

    if (editingTeacher) {
      const updated: TeacherAccount = {
        ...editingTeacher,
        name: teacherFormData.name.trim(),
        email: cleanEmail || editingTeacher.email || editingTeacher.gmail || '',
        gmail: cleanEmail || editingTeacher.gmail || editingTeacher.email || '',
        status: editingTeacher.status || 'active',
        academicYear: effectiveYear,
        subject: teacherFormData.subject.trim(),
        designation: teacherFormData.designation.trim(),
        assignedClass: composedClass || teacherFormData.assignedClass.trim(),
        standard: teacherFormData.standard,
        stream: teacherFormData.stream,
        section: teacherFormData.section,
        phone: teacherFormData.phone.trim() || editingTeacher.phone,
        dob: teacherFormData.dob || undefined,
        avatar: teacherFormData.avatar || '👨‍🏫',
        photoUrl: teacherFormData.photoUrl || undefined,
        lastActiveAt: new Date().toISOString()
      };
      StorageService.updateTeacherAccount(updated);
      await CloudSync.saveTeacherToSchool(admin.schoolCode || 'SSHSS@111213', updated);

      if (database) {
        const cleanSchoolCode = (admin.schoolCode || 'SSHSS@111213').trim().toUpperCase();
        const tKey = (updated.uid || updated.id || '').trim();
        if (tKey) {
          update(ref(database, `teachers/${tKey}`), { academicYear: effectiveYear }).catch(() => {});
          update(ref(database, `schools/${cleanSchoolCode}/teachers/${tKey}`), { academicYear: effectiveYear }).catch(() => {});
        }
      }

      showToast(`Teacher profile for ${updated.name} updated successfully!`);
    } else {
      const newId = `teach-${Date.now().toString(36)}`;
      const newTeach: TeacherAccount = {
        id: newId,
        uid: newId,
        name: teacherFormData.name.trim(),
        email: cleanEmail,
        gmail: cleanEmail,
        status: 'active',
        academicYear: effectiveYear,
        subject: teacherFormData.subject.trim(),
        primarySubject: teacherFormData.subject.trim(),
        designation: teacherFormData.designation.trim() || 'Class Teacher',
        assignedClass: composedClass || '',
        standard: teacherFormData.standard,
        stream: teacherFormData.stream,
        section: teacherFormData.section,
        phone: teacherFormData.phone.trim(),
        schoolName: schoolProfile.schoolName || admin.schoolName || "St. Sebastian's Higher Secondary School",
        schoolCode: admin.schoolCode || 'SSHSS@111213',
        dob: teacherFormData.dob || undefined,
        avatar: teacherFormData.avatar || '👨‍🏫',
        photoUrl: teacherFormData.photoUrl || undefined,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      };
      StorageService.addTeacherAccount(newTeach);
      await CloudSync.saveTeacherToSchool(admin.schoolCode || 'SSHSS@111213', newTeach);

      if (database) {
        const cleanSchoolCode = (admin.schoolCode || 'SSHSS@111213').trim().toUpperCase();
        update(ref(database, `teachers/${newId}`), { academicYear: effectiveYear }).catch(() => {});
        update(ref(database, `schools/${cleanSchoolCode}/teachers/${newId}`), { academicYear: effectiveYear }).catch(() => {});
      }

      showToast(`New teacher ${newTeach.name} registered under school ${admin.schoolCode || 'SSHSS@111213'}!`);
    }
    setIsTeacherModalOpen(false);
    setActiveTab('teachers-info');
    triggerRefresh();
  };

  const handleQuickPhotoChange = (teacherId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher) {
          const updatedTeacher = {
            ...teacher,
            photoUrl: base64
          };
          StorageService.updateTeacherAccount(updatedTeacher);
          CloudSync.saveTeacherToSchool(admin.schoolCode, updatedTeacher).catch(() => {});
          showToast(`Profile photo updated for ${teacher.name}!`);
          triggerRefresh();
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteTeacher = (teacherId: string, teacherName: string) => {
    const targetTeacher = teachers.find(t => t.id === teacherId || t.uid === teacherId);
    const teacherEmail = targetTeacher?.email || targetTeacher?.gmail || '';
    const teacherUid = targetTeacher?.uid || targetTeacher?.id || teacherId;
    setDeleteModalTeacher({ id: teacherId, name: teacherName, email: teacherEmail, uid: teacherUid });
    setShowPermanentConfirmation(false);
  };

  const handleExecuteTemporaryDelete = async () => {
    if (!deleteModalTeacher) return;
    const { id, name, email, uid } = deleteModalTeacher;
    setDeleteModalTeacher(null);
    setShowPermanentConfirmation(false);

    StorageService.deleteTeacherAccount(id, false);
    if (uid && uid !== id) StorageService.deleteTeacherAccount(uid, false);
    await CloudSync.deleteTeacherFromSchool(activeSchoolCode, id, email, false, uid).catch(() => {});

    setRemoteTeachers(prev => prev.filter(t => t.id !== id && t.uid !== id && (!uid || (t.id !== uid && t.uid !== uid))));
    showToast(`Teacher ${name} temporarily removed from School Admin Panel.`);
    triggerRefresh();
  };

  const handleExecutePermanentDelete = async () => {
    if (!deleteModalTeacher) return;
    const { id, name, email, uid } = deleteModalTeacher;
    setDeleteModalTeacher(null);
    setShowPermanentConfirmation(false);

    StorageService.deleteTeacherAccount(id, true);
    if (uid && uid !== id) StorageService.deleteTeacherAccount(uid, true);
    await CloudSync.deleteTeacherFromSchool(activeSchoolCode, id, email, true, uid).catch(() => {});

    setRemoteTeachers(prev => prev.filter(t => t.id !== id && t.uid !== id && (!uid || (t.id !== uid && t.uid !== uid))));
    showToast(`Teacher ${name} permanently deleted.`);
    triggerRefresh();
  };

  // Timetable Handlers for Admin
  const refreshAdminTimetables = () => {
    const updated = StorageService.getTimetables(activeSchoolCode);
    setAdminTimetables(updated);
  };

  const handleOpenAddAdminSlot = (day?: TimetableDay, periodNum?: number, teacherId?: string, className?: string) => {
    const targetPeriod = periodNum || 1;
    const timing = DEFAULT_PERIOD_TIMINGS[targetPeriod - 1] || DEFAULT_PERIOD_TIMINGS[0];
    const selTeacher = teachers.find(t => t.id === teacherId) || (teachers.length > 0 ? teachers[0] : null);
    const teacherCreatedClasses = selTeacher ? getTeacherCreatedClasses(selTeacher.id) : [];

    setAdminEditingSlot(null);
    setAdminSlotFormData({
      day: day || 'Monday',
      periodNumber: targetPeriod,
      startTime: timing.startTime,
      endTime: timing.endTime,
      subject: selTeacher?.designation?.includes('Physics') ? 'Physics' : selTeacher?.designation?.includes('Chemistry') ? 'Chemistry' : 'Mathematics',
      subjectCode: 'SUB',
      className: className || teacherCreatedClasses[0]?.className || selTeacher?.assignedClass || '',
      teacherId: selTeacher?.id || 'teach-default-1',
      teacherName: selTeacher?.name || 'Class Teacher',
      roomNumber: 'Room 101',
      type: 'lecture',
      notes: ''
    });
    setIsAdminTimetableModalOpen(true);
  };

  const handleOpenEditAdminSlot = (slot: TimetableSlot) => {
    setAdminEditingSlot(slot);
    setAdminSlotFormData({
      day: slot.day,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      subjectCode: slot.subjectCode || '',
      className: slot.className,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName || '',
      roomNumber: slot.roomNumber || '',
      type: slot.type || 'lecture',
      notes: slot.notes || ''
    });
    setIsAdminTimetableModalOpen(true);
  };

  const handleSaveAdminSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSlotFormData.subject.trim()) {
      showToast('Please enter a subject name.');
      return;
    }

    const timing = DEFAULT_PERIOD_TIMINGS[adminSlotFormData.periodNumber - 1] || DEFAULT_PERIOD_TIMINGS[0];
    const assignedTeacher = teachers.find(t => t.id === adminSlotFormData.teacherId);

    const slotPayload: TimetableSlot = {
      id: adminEditingSlot ? adminEditingSlot.id : `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: adminSlotFormData.day,
      periodNumber: Number(adminSlotFormData.periodNumber),
      startTime: adminSlotFormData.startTime || timing.startTime,
      endTime: adminSlotFormData.endTime || timing.endTime,
      subject: adminSlotFormData.subject.trim(),
      subjectCode: adminSlotFormData.subjectCode.trim().toUpperCase() || adminSlotFormData.subject.substring(0, 3).toUpperCase(),
      className: adminSlotFormData.className.trim() || (classesList[0]?.className || ''),
      teacherId: adminSlotFormData.teacherId,
      teacherName: assignedTeacher?.name || adminSlotFormData.teacherName || 'Faculty Teacher',
      teacherPhone: assignedTeacher?.phone,
      roomNumber: adminSlotFormData.roomNumber.trim(),
      schoolCode: activeSchoolCode,
      type: adminSlotFormData.type,
      notes: adminSlotFormData.notes.trim(),
      createdAt: adminEditingSlot ? adminEditingSlot.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    StorageService.saveTimetableSlot(slotPayload);
    await CloudSync.saveTimetableSlotToSchool(activeSchoolCode, slotPayload);
    refreshAdminTimetables();
    setIsAdminTimetableModalOpen(false);
    showToast(adminEditingSlot ? 'Timetable period updated!' : 'New period assigned to teacher schedule!');
  };

  const handleDeleteAdminSlot = async (slotId: string) => {
    StorageService.deleteTimetableSlot(slotId);
    await CloudSync.deleteTimetableSlotFromSchool(activeSchoolCode, slotId);
    refreshAdminTimetables();
    setIsAdminTimetableModalOpen(false);
    showToast('Period slot deleted.');
  };

  const handleAutoGenerateAllTimetables = async () => {
    const slots = StorageService.autoGenerateDefaultSchoolTimetable(activeSchoolCode);
    StorageService.saveTimetables(slots);
    await CloudSync.saveTimetablesToSchool(activeSchoolCode, slots);
    refreshAdminTimetables();
    showToast(`Master Timetable automatically generated with ${slots.length} periods for all teachers!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setImportJsonText(text);
        const parsed = JSON.parse(text);
        
        const teachersCount = Array.isArray(parsed.teachers) ? parsed.teachers.length : 0;
        const classesCount = Array.isArray(parsed.classesCatalog) ? parsed.classesCatalog.length : 0;
        let studentsCount = 0;
        if (parsed.classDataMap) {
          Object.values(parsed.classDataMap).forEach((c: any) => {
            if (Array.isArray(c?.students)) studentsCount += c.students.length;
          });
        }

        setImportPreview({
          teachersCount,
          classesCount,
          studentsCount,
          schoolName: parsed.schoolProfile?.schoolName || 'Imported School'
        });
      } catch (err: any) {
        setImportError('Invalid JSON file format. Please upload a valid School Admin backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importJsonText) {
      showToast('Please select a valid backup JSON file first.');
      return;
    }

    const res = StorageService.importCompleteSchoolData(importJsonText);
    if (res.success) {
      showToast(res.message);
      setImportJsonText('');
      setImportPreview(null);
      triggerRefresh();
    } else {
      setImportError(res.message);
    }
  };

  const handleSaveTeacherRemark = (teacherId: string) => {
    if (!currentRemarkInput.trim()) return;
    setTeacherRemarks(prev => ({
      ...prev,
      [teacherId]: currentRemarkInput.trim()
    }));
    setCurrentRemarkInput('');
    showToast('Principal appraisal remark recorded for teacher!');
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-900 font-sans relative">
      {/* Loading Overlay for PDF Generation */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1C23] p-6 rounded-3xl border border-[#2D3139] shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Generating Document...</h3>
            <p className="text-sm text-slate-400">Please wait while the PDF is being compiled.</p>
          </div>
        </div>
      )}

      {/* Top Admin Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#1A1C23]/95 backdrop-blur-md border-b border-[#2D3139] px-4 sm:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & School Code Badge */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-rose-600 text-white shadow-lg shadow-amber-950/40 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                  School Admin Portal
                </span>
                <span className="text-xs font-mono font-bold text-slate-300 bg-[#0F1115] px-2 py-0.5 rounded-md border border-[#2D3139] flex items-center gap-1">
                  <Hash className="w-3 h-3 text-amber-400" />
                  {activeSchoolCode}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-white truncate max-w-sm sm:max-w-xl">
                {schoolProfile.schoolName || admin.schoolName}
              </h1>
              {(() => {
                const des = admin?.designation || schoolProfile.principalName || 'Principal';
                return (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{des}: <strong className="text-white font-bold">{des}</strong></span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="btn-print-school-report"
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#2D3139] hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Consolidated Audit Report</span>
            </button>

            <button
              type="button"
              id="btn-admin-logout"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-emerald-200 text-sm font-semibold shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Admin Content Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6 flex-1">
        {/* Live Real-time Teacher Activity Notification Banner */}
        {liveNotification && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-emerald-600/20 border border-amber-500/40 text-white shadow-2xl flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/30 text-amber-300 shrink-0 animate-pulse">
                <Bell className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                    {liveNotification.title}
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono bg-black/40 px-2 py-0.5 rounded-full">
                    {liveNotification.timestamp}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-100">
                  {liveNotification.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveNotification(null)}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Administrator Welcome Hero Banner with Institutional Statistics */}
        <div className="rounded-3xl bg-gradient-to-r from-[#1A1C23] via-[#222530] to-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Principal & School Management Supervisory Console</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Welcome, {admin.adminName || adminName || schoolProfile.principalName || 'Principal / School Administrator'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                  Supervise classroom registers, teacher work dossiers, upcoming faculty birthdays, and academic performance for <strong className="text-white">{schoolProfile.schoolName}</strong>.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('broadcasts')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-extrabold shadow-lg shadow-amber-950/60 transition flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Broadcast Directive</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportFullJson}
                  className="px-4 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Backup</span>
                </button>
              </div>
            </div>

            {/* Comprehensive School KPI Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139] space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Total Teachers</span>
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white">{teachers.length}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                    {teachers.length > 0 ? `${teachers.filter(t => t.status === 'active' || !t.status).length} Active` : '0 Active'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">Registered under {activeSchoolCode}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139] space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Total Classes</span>
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white">{classesList.length}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {classesList.length > 0 ? `${classesList.length} All-Time Active` : '0 Active'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  {classesList.length > 0 ? 'All divisions active & synchronized' : 'No classes registered'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139] space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Total Students</span>
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white">{crossClassData.totalStudents}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                    {crossClassData.totalStudents > 0 ? `${crossClassData.totalBoys}B • ${crossClassData.totalGirls}G` : '0 Enrolled'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  {crossClassData.totalStudents > 0 ? 'Across all teacher rosters' : 'No student records'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139] space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>School Academic Avg</span>
                  <TrendingUp className="w-4 h-4 text-sky-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {crossClassData.overallAcademicAverage > 0 ? `${crossClassData.overallAcademicAverage}%` : '0%'}
                  </span>
                  <span className="text-[10px] text-sky-400 font-semibold font-mono">
                    {crossClassData.overallAttendanceRate > 0 ? `${crossClassData.overallAttendanceRate}% Att.` : '0% Att.'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">Calculated from terminal exams</span>
              </div>
            </div>
          </div>
        </div>

        {/* UPCOMING TEACHER BIRTHDAYS NOTIFICATION WIDGET */}
        {upcomingBirthdays.length > 0 && (
          <div className="rounded-3xl bg-gradient-to-r from-rose-950/70 via-[#1A1C23] to-amber-950/60 border border-rose-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                  <Cake className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      Birthday Alerts
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      {upcomingBirthdays.length} Faculty Member{upcomingBirthdays.length > 1 ? 's' : ''} with upcoming birthdays
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                    Upcoming Teacher Birthdays & Institutional Greetings
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Send automated principal greetings or post official staff announcements for faculty birthdays.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
              {upcomingBirthdays.map(({ teacher, daysRemaining, isToday, isThisWeek, displayDate, age }) => (
                <div
                  key={teacher.id}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isToday
                      ? 'bg-rose-600/20 border-rose-500/50 shadow-lg shadow-rose-950/50'
                      : isThisWeek
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-[#0F1115] border-[#2D3139]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-rose-600 flex items-center justify-center text-lg shadow shrink-0">
                      {teacher.avatar || teacher.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{teacher.name}</h4>
                      <p className="text-[11px] text-amber-400 font-semibold">{teacher.designation}</p>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-rose-400" />
                        {displayDate} • {isToday ? '🎂 TODAY!' : isThisWeek ? `In ${daysRemaining} days` : `In ${daysRemaining} days`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendBirthdayGreeting(teacher)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                    title={`Publish birthday greeting to ${teacher.name}`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Send Wish</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#2D3139] pb-3">
          <button
            type="button"
            id="tab-admin-teachers-info"
            onClick={() => setActiveTab('teachers-info')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'teachers-info'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <Users className="w-4 h-4 text-amber-300" />
            <span>Teachers Information ({teachers.length})</span>
          </button>

          <button
            type="button"
            id="tab-admin-students-classes"
            onClick={() => setActiveTab('students-classes')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'students-classes'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-amber-300" />
            <span>Students and Class Records ({crossClassData.totalStudents})</span>
          </button>

          <button
            type="button"
            id="tab-admin-timetables"
            onClick={() => {
              refreshAdminTimetables();
              setActiveTab('timetables');
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'timetables'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-amber-300" />
            <span>Teacher Timetables & Schedules ({adminTimetables.length})</span>
          </button>

          <button
            type="button"
            id="tab-admin-teachers-work"
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'teachers'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <Eye className="w-4 h-4 text-amber-300" />
            <span>Teacher Work Dossiers</span>
          </button>

          <button
            type="button"
            id="tab-admin-academics"
            onClick={() => setActiveTab('academics')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'academics'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <span>Exam Monitoring & Averages</span>
          </button>

          <button
            type="button"
            id="tab-admin-broadcasts"
            onClick={() => setActiveTab('broadcasts')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'broadcasts'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-300" />
            <span>Principal Broadcast Directives ({broadcasts.length})</span>
          </button>

          <button
            type="button"
            id="tab-admin-reports-center"
            onClick={() => setActiveTab('reports-center')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports-center'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <FileCheck className="w-4 h-4 text-amber-300" />
            <span>Reports & Exports Center</span>
          </button>

          <button
            type="button"
            id="tab-admin-audit-logs"
            onClick={() => setActiveTab('audit-logs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit-logs'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <History className="w-4 h-4 text-amber-300" />
            <span>Admin Audit Log ({auditLogs.length})</span>
          </button>

          <button
            type="button"
            id="tab-admin-teacher-activity"
            onClick={() => setActiveTab('teacher-activity')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'teacher-activity'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-300" />
            <span>Recent Teacher Activity ({realtimeActivities.length})</span>
          </button>

          <button
            type="button"
            id="tab-admin-settings"
            onClick={() => setActiveTab('settings-data')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings-data'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-300" />
            <span>Import / Export & School Settings</span>
          </button>
        </div>

        {/* TAB 1: TEACHERS INFORMATION & MANAGEMENT SECTION */}
        {activeTab === 'teachers-info' && (
          <div className="space-y-5 animate-fade-in">
            {/* Header Controls: Search, Birthday Filters & Add Teacher Action */}
            <div className="bg-[#1A1C23] p-4 sm:p-5 rounded-2xl border border-[#2D3139] space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    <span>Teachers Information & Faculty Roster</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    View, register, and update teacher profiles, profile photos, assigned classrooms, and birthday information for school code <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    id="btn-add-new-teacher"
                    onClick={handleOpenAddTeacher}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-2 transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add New Teacher</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportTeachersCsv}
                    className="px-3.5 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Search Bar & Birthday Quick Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#2D3139]">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, subject, phone, class..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Birthday Filter Pills */}
                <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setTeacherFilterBirthday('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      teacherFilterBirthday === 'all'
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#2D3139]'
                    }`}
                  >
                    All Faculty ({teachers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeacherFilterBirthday('upcoming')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      teacherFilterBirthday === 'upcoming'
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-[#0F1115] text-rose-300 hover:text-white border border-[#2D3139]'
                    }`}
                  >
                    <Cake className="w-3.5 h-3.5" />
                    <span>Upcoming Birthdays ({upcomingBirthdays.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeacherFilterBirthday('this-month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      teacherFilterBirthday === 'this-month'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-[#0F1115] text-purple-300 hover:text-white border border-[#2D3139]'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Birthdays This Month</span>
                  </button>
                </div>
              </div>

              {/* Real-time Cloud Sync & Activity Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#2D3139] text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span>Real-Time Cloud Synced: <strong className="text-white">{teachers.length} Teachers</strong> associated with School Code <strong className="font-mono text-amber-400">{activeSchoolCode}</strong></span>
                </div>
                {realtimeActivities.length > 0 && (
                  <div className="text-slate-400 flex items-center gap-1.5 truncate">
                    <span className="text-purple-400 font-bold shrink-0">Latest Activity:</span>
                    <span className="text-slate-300 truncate">{realtimeActivities[0].teacherName} - {realtimeActivities[0].details}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Teacher Cards Grid with Photos, DOB, Birthday Management & CRUD Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map(teacher => {
                const assignedCls = teacher.assignedClass || 'Not Assigned';
                const dobDisplay = teacher.dob
                  ? new Date(teacher.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Not Specified';

                // Calculate Age & Days until birthday
                let age = 0;
                let daysToBirthday: number | null = null;
                if (teacher.dob) {
                  const birthDate = new Date(teacher.dob);
                  const now = new Date();
                  age = now.getFullYear() - birthDate.getFullYear();
                  const m = now.getMonth() - birthDate.getMonth();
                  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
                    age--;
                  }

                  const thisYearBday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                  if (thisYearBday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                    thisYearBday.setFullYear(now.getFullYear() + 1);
                  }
                  const diffTime = thisYearBday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                  daysToBirthday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                return (
                  <div
                    key={teacher.id}
                    className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-4 sm:p-5 shadow-lg space-y-4 hover:border-amber-500/40 transition duration-200 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Teacher Profile Photo & Identification Header */}
                      <div className="flex items-start gap-3.5">
                        {/* Profile Photo with Quick Upload Camera Overlay */}
                        <div className="relative group shrink-0">
                          {teacher.photoUrl ? (
                            <img
                              src={teacher.photoUrl}
                              alt={teacher.name}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-500/50 shadow-md"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-600 flex items-center justify-center text-3xl shadow-md ring-2 ring-[#2D3139]">
                              {teacher.avatar || '👨‍🏫'}
                            </div>
                          )}

                          {/* Quick Photo Upload Trigger */}
                          <label
                            title="Upload/Update Profile Photo"
                            className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-900/90 text-amber-300 hover:text-white hover:bg-amber-600 border border-slate-700 shadow-md cursor-pointer transition"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleQuickPhotoChange(teacher.id, file);
                              }}
                            />
                          </label>
                        </div>

                        {/* Name, Subject, Designation & Class */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-sm sm:text-base font-extrabold text-white truncate">{teacher.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                              Active
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-amber-400 font-extrabold flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-amber-400" />
                              {teacher.subject || teacher.primarySubject || teacher.designation || 'Physics'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">({teacher.schoolCode || activeSchoolCode})</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-slate-300 bg-[#0F1115] px-2 py-0.5 rounded-lg border border-[#2D3139] flex items-center gap-1 truncate font-medium">
                              <School className="w-3 h-3 text-purple-400 shrink-0" />
                              {assignedCls}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Subject, Contact & Date of Birth Strip */}
                      <div className="p-3 rounded-xl bg-[#0F1115] border border-[#2D3139] space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Subject Assigned
                          </span>
                          <span className="text-amber-300 font-bold text-[11px] truncate">
                            {teacher.subject || teacher.primarySubject || teacher.designation || 'Physics'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            Phone Number
                          </span>
                          <span className="text-slate-300 font-mono text-[11px]">{teacher.phone}</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            Teacher Gmail
                          </span>
                          <span className="text-sky-300 font-mono text-[11px] truncate" title={teacher.gmail || teacher.email || 'Not Provided'}>
                            {teacher.gmail || teacher.email || 'Not Provided'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            Date Registered
                          </span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Active'}
                          </span>
                        </div>

                        {/* Date of Birth & Birthday Status */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2D3139]/50">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <Cake className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            Date of Birth (DOB)
                          </span>
                          <span className="text-rose-300 font-semibold text-[11px] flex items-center gap-1">
                            {dobDisplay}
                            {age > 0 && <span className="text-[10px] text-slate-500 font-normal">({age} yrs)</span>}
                          </span>
                        </div>

                        {daysToBirthday !== null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Birthday Status</span>
                            <span className={`font-bold ${daysToBirthday === 0 ? 'text-rose-400 animate-pulse' : daysToBirthday <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {daysToBirthday === 0 ? '🎂 TODAY!' : daysToBirthday === 1 ? '🎉 Tomorrow!' : `In ${daysToBirthday} days`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions: Edit Profile, Send Birthday Wish, View Work, Delete */}
                    <div className="pt-2 border-t border-[#2D3139] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTeacher(teacher)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0F1115] hover:bg-slate-800 border border-[#2D3139] text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Edit Teacher Profile"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendBirthdayGreeting(teacher)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Send Birthday Greeting Broadcast"
                        >
                          <Cake className="w-3.5 h-3.5 text-rose-400" />
                          <span>Wish</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeacherForDossier(teacher);
                            setCurrentRemarkInput(teacherRemarks[teacher.id] || '');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition shadow cursor-pointer"
                          title="Inspect Teacher Work Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Work Dossier</span>
                        </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 hover:text-rose-200 transition cursor-pointer"
                            title="Remove Teacher Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTeachers.length === 0 && (
              <div className="p-8 rounded-2xl bg-[#1A1C23] border border-[#2D3139] text-center space-y-3">
                <Users className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-base font-bold text-white">No Teachers Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No teachers match the current search or birthday filter. You can add a new teacher profile or adjust your search.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddTeacher}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Teacher</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STUDENTS AND CLASS RECORDS WITH "CLASS TEACHERS BY CLASSROOM" */}
        {activeTab === 'students-classes' && (
          <div className="space-y-4 animate-fade-in">
            {/* View Switcher & Controls */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C23] border border-[#2D3139] space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-amber-400" />
                    <span>Students and Class Records</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    View student lists, roll numbers, academic performance, and parent contacts organized classroom-wise by Class Teacher.
                  </p>
                </div>

                {/* Mode Toggle: Class Teachers by Classroom vs School-wide */}
                <div className="flex items-center gap-2 bg-[#0F1115] p-1.5 rounded-xl border border-[#2D3139] shrink-0 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => setStudentViewMode('teacher-wise')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      studentViewMode === 'teacher-wise'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4 text-amber-200" />
                    <span>Class Teachers by Classroom</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentViewMode('school-wise')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      studentViewMode === 'school-wise'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <School className="w-4 h-4 text-amber-200" />
                    <span>School-wide Register ({crossClassData.totalStudents})</span>
                  </button>
                </div>
              </div>

              {/* Search & Export Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#2D3139]">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={e => setStudentSearchQuery(e.target.value)}
                    placeholder="Search student by name, roll no, admission no..."
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleExportStudentsCsv}
                    className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Students CSV</span>
                  </button>
                </div>
              </div>

              {/* Class Teachers by Classroom: "Select Teacher's Classroom" Feature */}
              {studentViewMode === 'teacher-wise' && (
                <div className="space-y-3 pt-3 border-t border-[#2D3139]">
                  <div className="flex items-center justify-between">
                    <label htmlFor="teacher-classroom-select" className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-amber-400" />
                      <span>Select Teacher's Classroom:</span>
                    </label>

                    <span className="text-[11px] text-slate-400">
                      Select any class teacher to inspect their active classroom roster
                    </span>
                  </div>

                  {/* Visual Teacher & Classroom Selector Chips */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {teachers.map(t => {
                      const isSel = t.id === selectedTeacherIdForClassroom;
                      const teacherCreatedCount = getTeacherCreatedClasses(t.id).length;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeacherIdForClassroom(t.id);
                            const tClasses = getTeacherCreatedClasses(t.id);
                            if (tClasses.length > 0) {
                              setSelectedClassIdForTeacher(tClasses[0].id);
                            } else {
                              setSelectedClassIdForTeacher('');
                            }
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2.5 cursor-pointer ${
                            isSel
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/60 ring-2 ring-purple-400/50'
                              : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                          }`}
                        >
                          {t.photoUrl ? (
                            <img
                              src={t.photoUrl}
                              alt={t.name}
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
                            />
                          ) : (
                            <span className="text-base">{t.avatar || '👨‍🏫'}</span>
                          )}
                          <div className="text-left">
                            <span className="block font-bold">{t.name}</span>
                            <span className="text-[10px] text-purple-200 block font-normal">
                              {t.assignedClass || 'Class Teacher'} • {teacherCreatedCount} {teacherCreatedCount === 1 ? 'class' : 'classes'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selectable Classrooms created by this teacher */}
                  <div className="pt-3 border-t border-[#2D3139]/80 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>Classrooms Created by {teachers.find(t => t.id === selectedTeacherIdForClassroom)?.name || 'this Teacher'} ({activeTeacherCreatedClasses.length}):</span>
                      </span>
                      <span className="text-[11px] text-amber-400 font-medium">
                        Only classrooms created by this teacher are selectable
                      </span>
                    </div>

                    {activeTeacherCreatedClasses.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {activeTeacherCreatedClasses.map(cls => {
                          const isSelected = (selectedClassIdForTeacher === cls.id) || (!selectedClassIdForTeacher && activeTeacherCreatedClasses[0]?.id === cls.id);
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => setSelectedClassIdForTeacher(cls.id)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/60 ring-2 ring-purple-400'
                                  : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                              }`}
                            >
                              <School className="w-3.5 h-3.5 text-purple-300" />
                              <span>{cls.className}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                isSelected ? 'bg-purple-950/80 text-purple-200' : 'bg-[#1A1C23] text-amber-400'
                              }`}>
                                {cls.classStrength || 0} students
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>This teacher has not created any classrooms yet. Only classrooms created by this teacher will show up as selectable options for the school admin.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Teacher & Classroom Summary Card (When in Teacher-wise Classroom mode) */}
            {studentViewMode === 'teacher-wise' && (() => {
              const activeTeacher = teachers.find(t => t.id === selectedTeacherIdForClassroom) || (teachers.length > 0 ? teachers[0] : null);
              const activeClass = activeTeacherCreatedClasses.find(c => c.id === selectedClassIdForTeacher) || activeTeacherCreatedClasses[0];
              const classroomStudents = displayedStudents;
              const boysCount = classroomStudents.filter(s => s.gender === 'male').length;
              const girlsCount = classroomStudents.filter(s => s.gender === 'female').length;

              return (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#1A1C23] via-[#1F222C] to-[#1A1C23] border border-purple-500/30 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {activeTeacher?.photoUrl ? (
                        <img
                          src={activeTeacher.photoUrl}
                          alt={activeTeacher.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-2xl object-cover ring-2 ring-purple-500/60 shadow"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow">
                          {activeTeacher?.avatar || '👨‍🏫'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            Classroom Teacher In-Charge
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">School Code: {activeSchoolCode}</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-white mt-0.5">{activeTeacher?.name}</h4>
                        <p className="text-xs text-amber-400 font-semibold">
                          {activeTeacher?.designation || 'Class Teacher'} • {activeClass?.className || activeTeacher?.assignedClass || 'Classroom Division'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-[#0F1115] p-3 rounded-xl border border-[#2D3139]">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Class Strength</span>
                        <span className="text-sm font-black text-white">{classroomStudents.length} Students</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Boys / Girls</span>
                        <span className="text-sm font-black text-amber-400">{boysCount}B / {girlsCount}G</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Class Attendance</span>
                        <span className="text-sm font-black text-emerald-400">94.8%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Complete Student Details Table */}
            <div className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0F1115] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-[#2D3139]">
                    <tr>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name & Admission</th>
                      <th className="py-3 px-4">Class & Division</th>
                      <th className="py-3 px-4">Class Teacher</th>
                      <th className="py-3 px-4">Gender</th>
                      <th className="py-3 px-4">Parent / Guardian Phone</th>
                      <th className="py-3 px-4">Attendance %</th>
                      <th className="py-3 px-4 text-right">Academic Status & Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3139]/60">
                    {displayedStudents.map((s, idx) => (
                      <tr key={s.id || idx} className="hover:bg-[#0F1115]/60 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400 text-xs">
                          #{s.rollNo < 10 ? `0${s.rollNo}` : s.rollNo}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{s.gender === 'female' ? '👧' : '👦'}</span>
                            <span className="text-slate-100">{s.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            ADM: {s.admissionNo || `ADM-${202500 + s.rollNo}`} • Blood: {['O+','A+','B+','AB+','O-'][s.rollNo % 5]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-purple-300">
                          {s.className}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {s.teacherName}
                        </td>
                        <td className="py-3.5 px-4 uppercase text-[11px] font-bold text-slate-400">
                          {s.gender}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {s.guardianPhone || '+91 98470 12345'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {92 + (s.rollNo % 7)}% Present
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-extrabold text-emerald-400 block text-xs">
                            {s.rollNo % 4 === 0 ? 'A+ Grade (94%)' : s.rollNo % 4 === 1 ? 'A Grade (86%)' : s.rollNo % 4 === 2 ? 'B+ Grade (78%)' : 'A+ Grade (96%)'}
                          </span>
                          <span className="text-[10px] text-slate-500">Terminal Evaluated</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {displayedStudents.length === 0 && (
                <div className="p-8 text-center space-y-2">
                  <GraduationCap className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Students Found</h4>
                  <p className="text-xs text-slate-400">No student records match the selected classroom or search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TEACHER WORK DOSSIERS & APPRAISALS */}
        {activeTab === 'teachers' && (
          <div className="space-y-4 animate-fade-in">
            {/* Header / Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1A1C23] p-4 rounded-2xl border border-[#2D3139]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span>Teacher Work Dossiers & Activity Audits</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect comprehensive attendance registers, exam evaluations, timetable logs, and add Principal appraisal remarks.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportTeachersCsv}
                className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Dossier Roster</span>
              </button>
            </div>

            {/* Teacher Cards Grid for Work Dossier inspection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeachers.map((teacher, idx) => {
                const teacherClasses = getTeacherCreatedClasses(teacher.id, teacher.email || teacher.gmail, teacher.name);
                const assignedCls = teacher.assignedClass || (teacherClasses[0]?.className) || 'Not Assigned';
                const dobDisplay = teacher.dob
                  ? new Date(teacher.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Not Specified';
                const totalStudentsManaged = teacherClasses.reduce((sum, c) => sum + (c.classStrength || 0), 0);

                return (
                  <div
                    key={teacher.id || idx}
                    className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-5 shadow-lg space-y-4 hover:border-purple-500/40 transition duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {teacher.photoUrl ? (
                          <img
                            src={teacher.photoUrl}
                            alt={teacher.name}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-purple-500/50 shadow-md"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-600 flex items-center justify-center text-2xl shadow-md shrink-0 ring-2 ring-[#2D3139]">
                            {teacher.avatar || '👨‍🏫'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{teacher.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-purple-400" />
                              {teacher.academicYear || '2026-27'}
                            </span>
                          </div>
                          <p className="text-xs text-amber-400 font-semibold">{teacher.designation || 'Class Teacher'}</p>
                          <span className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                            <School className="w-3 h-3 text-purple-400" />
                            {teacherClasses.length > 0 ? (
                              <span>
                                <strong>{teacherClasses.length} {teacherClasses.length === 1 ? 'Class' : 'Classes'}:</strong> {teacherClasses.map(c => c.className).join(', ')}
                              </span>
                            ) : (
                              <span>{assignedCls}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Prominent Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id={`btn-edit-teacher-${teacher.id}`}
                          onClick={() => handleOpenEditTeacher(teacher)}
                          className="px-3 py-2.5 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#2D3139] text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                          title="Edit Teacher Profile & Academic Year"
                        >
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          id={`btn-view-work-${teacher.id}`}
                          onClick={() => {
                            setSelectedTeacherForDossier(teacher);
                            setCurrentRemarkInput(teacherRemarks[teacher.id] || '');
                          }}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-lg shadow-purple-950/50 cursor-pointer shrink-0"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Inspect Dossier</span>
                        </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                            className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 hover:text-rose-200 transition cursor-pointer"
                            title="Remove Teacher Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                    </div>

                    {/* Teacher Details Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-[#0F1115] border border-[#2D3139] text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Academic Year</span>
                        <span className="font-mono text-purple-300 font-semibold truncate block flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400 shrink-0" />
                          {teacher.academicYear || '2026-27'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Phone</span>
                        <span className="font-mono text-slate-300 truncate block">{teacher.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Date of Birth</span>
                        <span className="text-rose-300 font-medium truncate block flex items-center gap-1">
                          <Cake className="w-3 h-3 text-rose-400 shrink-0" />
                          {dobDisplay}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Email</span>
                        <span className="text-slate-300 truncate block font-mono text-[11px]">{teacher.email || teacher.gmail || '-'}</span>
                      </div>
                    </div>

                    {/* Work Compliance Indicators */}
                    <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Register: Up to date
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Class Strength: <strong>{totalStudentsManaged > 0 ? `${totalStudentsManaged} Students` : (teacherClasses[0]?.classStrength ? `${teacherClasses[0].classStrength} Students` : 'Not Assigned')}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: EXAM MONITORING & ACADEMIC AUDITS */}
        {activeTab === 'academics' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#1A1C23] border border-[#2D3139] space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminal Examinations Conducted</span>
                <h4 className="text-3xl font-black text-white">{crossClassData.allExams.length} Cycles</h4>
                <p className="text-xs text-slate-400">Total examinations recorded across all classes.</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#1A1C23] border border-[#2D3139] space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall School Average</span>
                <h4 className="text-3xl font-black text-emerald-400">
                  {crossClassData.overallAcademicAverage > 0 ? `${crossClassData.overallAcademicAverage}%` : '0%'}
                </h4>
                <p className="text-xs text-slate-400">Calculated from recorded student examination marks.</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#1A1C23] border border-[#2D3139] space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teacher Marks Entered</span>
                <h4 className="text-3xl font-black text-amber-400">
                  {crossClassData.allExams.length > 0 ? `${crossClassData.allExams.length} Recorded` : '0 Recorded'}
                </h4>
                <p className="text-xs text-slate-400">Examinations configured by faculty for evaluation.</p>
              </div>
            </div>

            {/* Exam Cycles Table */}
            <div className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-5 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                Higher Secondary Institutional Exam Monitoring Schedule
              </h3>

              {crossClassData.allExams.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#0F1115] border border-[#2D3139] space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No Examinations Recorded</p>
                  <p className="text-xs text-slate-500">Teachers will schedule examinations and upload student marks from their portals.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0F1115] text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Examination Title</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Subjects Covered</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]/60">
                      {crossClassData.allExams.map((ex) => (
                        <tr key={ex.id} className="hover:bg-[#0F1115]/50">
                          <td className="py-3.5 px-4 font-bold text-white">
                            {ex.name}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-purple-300">{ex.type}</td>
                          <td className="py-3.5 px-4">{ex.subjects ? `${ex.subjects.length} Subjects` : 'Core Subjects'}</td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono">{ex.date || 'Scheduled'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: BROADCAST PRINCIPAL NOTIFICATIONS */}
        {activeTab === 'broadcasts' && (
          <div className="space-y-6 animate-fade-in">
            {/* Broadcast Composer */}
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-5">
              <div className="border-b border-[#2D3139] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-amber-400" />
                    Broadcast Principal Directive to All Teachers
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Broadcast institutional instructions, examination schedules, or urgent notices. These appear instantly on every teacher's dashboard.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  School-Wide Distribution
                </span>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Directive Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={broadcastTitle}
                      onChange={e => setBroadcastTitle(e.target.value)}
                      placeholder="e.g. Mandatory Submission of Terminal Practical Marks & Attendance Register"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Target Audience
                    </label>
                    <select
                      value={broadcastAudience}
                      onChange={e => setBroadcastAudience(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
                    >
                      <option value="All Teachers">All Teachers & Faculty</option>
                      <option value="Science Department">Science Department Teachers</option>
                      <option value="Commerce Department">Commerce Department Teachers</option>
                      <option value="Class Teachers Only">Class In-charges Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Category
                    </label>
                    <select
                      value={broadcastCategory}
                      onChange={e => setBroadcastCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
                    >
                      <option value="academic">Academic & Syllabus Directive</option>
                      <option value="administrative">Administrative Notice</option>
                      <option value="exam">Examination & Evaluation Schedule</option>
                      <option value="meeting">Staff Council / PTA Meeting</option>
                      <option value="holiday">Holiday & Special Schedule</option>
                      <option value="general">General Institutional Circular</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Priority Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setBroadcastPriority('normal')}
                        className={`py-2.5 rounded-xl text-xs font-bold transition border ${
                          broadcastPriority === 'normal'
                            ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                            : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                        }`}
                      >
                        🟢 Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastPriority('high')}
                        className={`py-2.5 rounded-xl text-xs font-bold transition border ${
                          broadcastPriority === 'high'
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                            : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                        }`}
                      >
                        🟡 High
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastPriority('urgent')}
                        className={`py-2.5 rounded-xl text-xs font-bold transition border ${
                          broadcastPriority === 'urgent'
                            ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                            : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                        }`}
                      >
                        🔴 Urgent
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Directive Message Body *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="Enter detailed instructions, submission deadlines, or circular content..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-submit-broadcast"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>BROADCAST TO ALL TEACHER DASHBOARDS</span>
                </button>
              </form>
            </div>

            {/* Sent Directives History */}
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Broadcast Directives History ({broadcasts.length})
                </h4>
                <span className="text-xs text-slate-500">Live Synced with Teacher Portal</span>
              </div>

              <div className="space-y-3">
                {broadcasts.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-2 hover:border-amber-500/40 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          b.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : b.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {b.priority || 'Normal'} Priority
                        </span>
                        <span className="text-xs font-bold text-white">{b.title}</span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400">
                        {b.date} • {b.time || '10:00'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {b.message}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-[#2D3139]">
                      <span>Issued by: <strong className="text-slate-400">{b.senderName}</strong></span>
                      <div className="flex items-center gap-3">
                        <span>Target: <strong className="text-amber-400">{b.targetAudience || 'All Teachers'}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete broadcast "${b.title}"? This will remove it from the admin console and stop showing on teacher dashboards.`)) {
                              handleDeleteBroadcast(b.id);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition text-[11px] font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Delete Message</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: TIMETABLES & SCHEDULE MANAGEMENT IN SCHOOL ADMIN */}
        {activeTab === 'timetables' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Controls Bar */}
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Supervisory Schedule Controller
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      School Code: <strong className="text-amber-300">{activeSchoolCode}</strong>
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-amber-400" />
                    <span>Master Teacher Timetables & Academic Schedules</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Supervise all teacher routines, classroom schedules, weekly faculty workloads, and free periods for substitution across <strong className="text-white">{schoolProfile.schoolName}</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleAutoGenerateAllTimetables}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-amber-950/50 cursor-pointer"
                    title="Generate complete standardized 8-period timetable across all teachers"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-Generate Master Timetable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAddAdminSlot()}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Period</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvHeader = 'Day,Period,Start Time,End Time,Subject,Class,Teacher,Room,Type,Notes\n';
                      const csvRows = adminTimetables.map(s => 
                        `"${s.day}","${s.periodNumber}","${s.startTime}","${s.endTime}","${s.subject}","${s.className}","${s.teacherName || ''}","${s.roomNumber || ''}","${s.type}","${s.notes || ''}"`
                      ).join('\n');
                      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Master_Timetable_${activeSchoolCode}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      showToast('Master Timetable CSV exported!');
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Quick Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Scheduled Periods</span>
                  <strong className="text-xl font-black text-white">{adminTimetables.length}</strong>
                  <span className="text-[10px] text-amber-400 block font-semibold">Weekly Slots</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Members Covered</span>
                  <strong className="text-xl font-black text-emerald-400">
                    {Array.from(new Set(adminTimetables.map(s => s.teacherId))).length} / {teachers.length}
                  </strong>
                  <span className="text-[10px] text-slate-400 block">Active Teachers</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Classes Scheduled</span>
                  <strong className="text-xl font-black text-purple-400">
                    {Array.from(new Set(adminTimetables.map(s => s.className))).length}
                  </strong>
                  <span className="text-[10px] text-slate-400 block">Active Divisions</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Period Format</span>
                  <strong className="text-xl font-black text-amber-400">8 Periods</strong>
                  <span className="text-[10px] text-slate-400 block">09:30 AM - 04:15 PM</span>
                </div>
              </div>

              {/* Sub-view Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#2D3139]">
                <button
                  type="button"
                  onClick={() => setAdminTimetableViewMode('teacher-matrix')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    adminTimetableViewMode === 'teacher-matrix'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                      : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Teacher-Wise Schedule Matrix</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTimetableViewMode('classroom-matrix')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    adminTimetableViewMode === 'classroom-matrix'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                      : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Class-Wise Master Timetable</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTimetableViewMode('faculty-overview')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    adminTimetableViewMode === 'faculty-overview'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                      : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Faculty Workload & Period Distribution</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTimetableViewMode('substitution-finder')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    adminTimetableViewMode === 'substitution-finder'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                      : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Free Period & Substitution Assistant</span>
                </button>
              </div>
            </div>

            {/* SUB-VIEW 1: TEACHER-WISE SCHEDULE MATRIX */}
            {adminTimetableViewMode === 'teacher-matrix' && (
              <div className="space-y-4">
                {/* Teacher Selector Strip */}
                <div className="bg-[#1A1C23] p-4 rounded-2xl border border-[#2D3139] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>Select Faculty Teacher to Inspect Weekly Timetable:</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Showing schedule for {adminSelectedTeacherId === 'ALL' ? 'All Faculty' : teachers.find(t => t.id === adminSelectedTeacherId)?.name || 'Teacher'}
                    </span>
                  </div>

                  {/* Teacher Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAdminSelectedTeacherId('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        adminSelectedTeacherId === 'ALL'
                          ? 'bg-amber-600 text-white shadow ring-2 ring-amber-400/50'
                          : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                      }`}
                    >
                      🌟 All Teachers ({adminTimetables.length} slots)
                    </button>

                    {teachers.map(t => {
                      const isSel = adminSelectedTeacherId === t.id;
                      const teacherSlotsCount = adminTimetables.filter(s => s.teacherId === t.id).length;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAdminSelectedTeacherId(t.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            isSel
                              ? 'bg-purple-600 text-white shadow ring-2 ring-purple-400/50'
                              : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                          }`}
                        >
                          <span>{t.avatar || '👨‍🏫'}</span>
                          <span>{t.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSel ? 'bg-purple-900/80 text-purple-200' : 'bg-[#1A1C23] text-amber-400'
                          }`}>
                            {teacherSlotsCount} slots
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid of Days & Periods for Selected Teacher */}
                <div className="space-y-4">
                  {TIMETABLE_DAYS.map(day => {
                    const daySlots = adminTimetables
                      .filter(s => s.day === day && (adminSelectedTeacherId === 'ALL' || s.teacherId === adminSelectedTeacherId))
                      .sort((a, b) => a.periodNumber - b.periodNumber);

                    return (
                      <div key={day} className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-4 sm:p-5 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between border-b border-[#2D3139] pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-black text-xs flex items-center justify-center">
                              {day.substring(0, 3)}
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">{day}</h4>
                              <p className="text-[11px] text-slate-400">
                                {daySlots.length} periods scheduled
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenAddAdminSlot(day, 1, adminSelectedTeacherId !== 'ALL' ? adminSelectedTeacherId : undefined)}
                            className="px-3 py-1.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Period</span>
                          </button>
                        </div>

                        {/* 8 Periods Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
                          {DEFAULT_PERIOD_TIMINGS.map(periodConfig => {
                            const pNum = periodConfig.periodNumber;
                            const slot = daySlots.find(s => s.periodNumber === pNum);

                            if (slot) {
                              const tObj = teachers.find(t => t.id === slot.teacherId);
                              return (
                                <div
                                  key={pNum}
                                  onClick={() => handleOpenEditAdminSlot(slot)}
                                  className="p-2.5 rounded-xl bg-[#0F1115] border border-amber-500/30 hover:border-amber-400 hover:bg-[#151820] transition space-y-1.5 cursor-pointer group relative shadow"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
                                      P{pNum}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">{slot.startTime}</span>
                                  </div>

                                  <div>
                                    <h5 className="text-xs font-black text-white group-hover:text-amber-300 transition truncate">
                                      {slot.subject}
                                    </h5>
                                    <p className="text-[10px] text-purple-300 font-medium truncate">{slot.className}</p>
                                  </div>

                                  <div className="pt-1 border-t border-[#2D3139] text-[10px] text-slate-400 flex items-center justify-between">
                                    <span className="truncate">{tObj?.name || slot.teacherName || 'Faculty'}</span>
                                    <span className="text-amber-400 font-mono text-[9px]">{slot.roomNumber}</span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={pNum}
                                onClick={() => handleOpenAddAdminSlot(day, pNum, adminSelectedTeacherId !== 'ALL' ? adminSelectedTeacherId : undefined)}
                                className="p-2.5 rounded-xl bg-[#0F1115]/50 border border-dashed border-[#2D3139] hover:border-amber-500/50 hover:bg-[#0F1115] transition space-y-1.5 cursor-pointer text-center group flex flex-col justify-between min-h-[90px]"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-500">P{pNum}</span>
                                  <span className="text-[9px] text-slate-600 font-mono">{periodConfig.startTime}</span>
                                </div>

                                <div className="my-auto py-1">
                                  <Plus className="w-4 h-4 text-slate-600 group-hover:text-amber-400 mx-auto transition" />
                                  <span className="text-[9px] text-slate-500 group-hover:text-slate-300 block">Free / Empty</span>
                                </div>

                                <span className="text-[8px] text-slate-600 uppercase font-mono">Click to Add</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: CLASS-WISE MASTER TIMETABLE */}
            {adminTimetableViewMode === 'classroom-matrix' && (
              <div className="space-y-4">
                {/* Classroom Selector */}
                <div className="bg-[#1A1C23] p-4 rounded-2xl border border-[#2D3139] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <School className="w-4 h-4 text-amber-400" />
                      <span>Select Classroom Division to Inspect Class Schedule:</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {adminSelectedClassroom === 'ALL' ? 'Showing All Classes' : `Inspecting ${adminSelectedClassroom}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminSelectedClassroom('ALL')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        adminSelectedClassroom === 'ALL'
                          ? 'bg-amber-600 text-white shadow ring-2 ring-amber-400/50'
                          : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                      }`}
                    >
                      🏫 All School Classes
                    </button>

                    {classesList.map(c => {
                      const isSel = adminSelectedClassroom === c.className;
                      const count = adminTimetables.filter(s => s.className === c.className).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setAdminSelectedClassroom(c.className)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            isSel
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow ring-2 ring-purple-400/50'
                              : 'bg-[#0F1115] text-slate-300 hover:bg-[#252830] border border-[#2D3139]'
                          }`}
                        >
                          <span>{c.className}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSel ? 'bg-purple-950 text-purple-200' : 'bg-[#1A1C23] text-amber-400'
                          }`}>
                            {count} slots
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day-by-Day View for Classroom */}
                <div className="space-y-4">
                  {TIMETABLE_DAYS.map(day => {
                    const daySlots = adminTimetables
                      .filter(s => s.day === day && (adminSelectedClassroom === 'ALL' || s.className === adminSelectedClassroom))
                      .sort((a, b) => a.periodNumber - b.periodNumber);

                    return (
                      <div key={day} className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-4 sm:p-5 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between border-b border-[#2D3139] pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black text-xs flex items-center justify-center">
                              {day.substring(0, 3)}
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">{day}</h4>
                              <p className="text-[11px] text-slate-400">{daySlots.length} periods active</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenAddAdminSlot(day, 1, undefined, adminSelectedClassroom !== 'ALL' ? adminSelectedClassroom : undefined)}
                            className="px-3 py-1.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-purple-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Schedule Slot</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
                          {DEFAULT_PERIOD_TIMINGS.map(periodConfig => {
                            const pNum = periodConfig.periodNumber;
                            const slot = daySlots.find(s => s.periodNumber === pNum);

                            if (slot) {
                              return (
                                <div
                                  key={pNum}
                                  onClick={() => handleOpenEditAdminSlot(slot)}
                                  className="p-2.5 rounded-xl bg-[#0F1115] border border-purple-500/30 hover:border-purple-400 hover:bg-[#151820] transition space-y-1.5 cursor-pointer group shadow"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">
                                      P{pNum}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">{slot.startTime}</span>
                                  </div>

                                  <div>
                                    <h5 className="text-xs font-black text-white group-hover:text-purple-300 transition truncate">
                                      {slot.subject}
                                    </h5>
                                    <p className="text-[10px] text-amber-400 font-medium truncate">
                                      {slot.teacherName || 'Faculty Teacher'}
                                    </p>
                                  </div>

                                  <div className="pt-1 border-t border-[#2D3139] text-[9px] text-slate-400 flex items-center justify-between">
                                    <span className="truncate">{slot.className}</span>
                                    <span className="text-purple-300 font-mono">{slot.roomNumber}</span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={pNum}
                                onClick={() => handleOpenAddAdminSlot(day, pNum, undefined, adminSelectedClassroom !== 'ALL' ? adminSelectedClassroom : undefined)}
                                className="p-2.5 rounded-xl bg-[#0F1115]/50 border border-dashed border-[#2D3139] hover:border-purple-500/50 hover:bg-[#0F1115] transition space-y-1.5 cursor-pointer text-center group flex flex-col justify-between min-h-[90px]"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-500">P{pNum}</span>
                                  <span className="text-[9px] text-slate-600 font-mono">{periodConfig.startTime}</span>
                                </div>
                                <div className="my-auto py-1">
                                  <Plus className="w-4 h-4 text-slate-600 group-hover:text-purple-400 mx-auto transition" />
                                  <span className="text-[9px] text-slate-500 group-hover:text-slate-300 block">No Class</span>
                                </div>
                                <span className="text-[8px] text-slate-600 uppercase font-mono">Assign</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: FACULTY WORKLOAD & PERIOD DISTRIBUTION */}
            {adminTimetableViewMode === 'faculty-overview' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D3139] pb-3">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-amber-400" />
                        <span>Institutional Faculty Workload Audit</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Audit period loads per teacher to ensure balanced teaching schedules without faculty burnout.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Optimal (16-28 periods/wk)
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Heavy (&gt;28 periods/wk)
                      </span>
                    </div>
                  </div>

                  {/* Faculty Workload Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0F1115] text-slate-400 uppercase font-extrabold text-[10px] tracking-wider border-b border-[#2D3139]">
                        <tr>
                          <th className="py-3 px-3.5">Faculty Member</th>
                          <th className="py-3 px-3">Subject / Role</th>
                          <th className="py-3 px-3 text-center">Periods / Week</th>
                          <th className="py-3 px-3 text-center">Teaching Hours</th>
                          <th className="py-3 px-3">Classes Taught</th>
                          <th className="py-3 px-3">Workload Status</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3139]/60">
                        {teachers.map(teacher => {
                          const teacherSlots = adminTimetables.filter(s => s.teacherId === teacher.id);
                          const totalPeriods = teacherSlots.length;
                          const teachingHours = (totalPeriods * 45 / 60).toFixed(1);
                          const classesTaught = Array.from(new Set(teacherSlots.map(s => s.className)));
                          const isHeavy = totalPeriods > 28;
                          const isLight = totalPeriods < 14 && totalPeriods > 0;
                          const isUnassigned = totalPeriods === 0;

                          return (
                            <tr key={teacher.id} className="hover:bg-[#0F1115]/50 transition">
                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-rose-600 flex items-center justify-center text-sm shadow shrink-0">
                                    {teacher.avatar || '👨‍🏫'}
                                  </div>
                                  <div>
                                    <strong className="text-white font-bold block">{teacher.name}</strong>
                                    <span className="text-[10px] text-slate-400 font-mono">{teacher.phone}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <span className="text-amber-300 font-semibold">{teacher.designation || 'Class Teacher'}</span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className="text-sm font-black text-white font-mono">{totalPeriods}</span>
                                <span className="text-[10px] text-slate-400 block">periods</span>
                              </td>

                              <td className="py-3 px-3 text-center font-mono">
                                <span className="text-xs font-bold text-slate-300">{teachingHours} hrs</span>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {classesTaught.length > 0 ? (
                                    classesTaught.map(c => (
                                      <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic">No classes scheduled</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                {isUnassigned ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
                                    Unscheduled
                                  </span>
                                ) : isHeavy ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-max">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    Heavy Load
                                  </span>
                                ) : isLight ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                                    Light Load
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                    ✓ Optimal Load
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminSelectedTeacherId(teacher.id);
                                    setAdminTimetableViewMode('teacher-matrix');
                                  }}
                                  className="px-3 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
                                >
                                  View Schedule
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: FREE PERIOD & SUBSTITUTION ASSISTANT */}
            {adminTimetableViewMode === 'substitution-finder' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#1A1C23] border border-[#2D3139] p-5 shadow-xl space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Instant Substitution & Free Faculty Assistant</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select any weekday and period number to discover which teachers have free slots available for class substitution.
                    </p>
                  </div>

                  {/* Day & Period Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Select Day:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {TIMETABLE_DAYS.map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSubstitutionDay(day)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              substitutionDay === day
                                ? 'bg-amber-600 text-white shadow'
                                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Select Period Number:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_PERIOD_TIMINGS.map(p => (
                          <button
                            key={p.periodNumber}
                            type="button"
                            onClick={() => setSubstitutionPeriod(p.periodNumber)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              substitutionPeriod === p.periodNumber
                                ? 'bg-purple-600 text-white shadow'
                                : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
                            }`}
                          >
                            Period {p.periodNumber}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Free vs Busy Faculty Results */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Faculty Availability Status for {substitutionDay}, Period {substitutionPeriod} ({DEFAULT_PERIOD_TIMINGS[substitutionPeriod - 1]?.startTime} - {DEFAULT_PERIOD_TIMINGS[substitutionPeriod - 1]?.endTime})
                      </h5>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {teachers.map(teacher => {
                        const busySlot = adminTimetables.find(
                          s => s.teacherId === teacher.id && s.day === substitutionDay && s.periodNumber === Number(substitutionPeriod)
                        );
                        const isFree = !busySlot;

                        return (
                          <div
                            key={teacher.id}
                            className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                              isFree
                                ? 'bg-emerald-950/30 border-emerald-500/40 shadow'
                                : 'bg-[#0F1115] border-[#2D3139]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow shrink-0 ${
                                isFree ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {teacher.avatar || '👨‍🏫'}
                              </div>

                              <div>
                                <h6 className="text-xs font-bold text-white leading-tight">{teacher.name}</h6>
                                <p className="text-[11px] text-slate-400">{teacher.designation || 'Class Teacher'}</p>
                                <span className="text-[10px] text-slate-500 font-mono">{teacher.phone}</span>
                              </div>
                            </div>

                            <div className="text-right space-y-1">
                              {isFree ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    ✓ FREE TO SUBSTITUTE
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddAdminSlot(substitutionDay, substitutionPeriod, teacher.id)}
                                    className="block ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition shadow cursor-pointer"
                                  >
                                    Assign Substitution
                                  </button>
                                </>
                              ) : (
                                <div>
                                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                    Busy: {busySlot.subject} ({busySlot.className})
                                  </span>
                                  <span className="block text-[10px] text-slate-500 mt-0.5">{busySlot.roomNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: IMPORT / EXPORT SETTINGS & DATA MANAGEMENT */}
        {activeTab === 'settings-data' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* 1. Complete School Data Backup (Export / Import) */}
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-xl space-y-6">
              <div className="border-b border-[#2D3139] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                  School Data Import & Export Management
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Backup and restore complete school records, teacher directories, students, and marks.
                </p>
              </div>

              {/* Export Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Export Institutional Backups & PDF Reports
                </h4>
                
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleExportAuditPDF}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition">
                        <Printer className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Consolidated School Audit Report (PDF)</h5>
                        <p className="text-[11px] text-slate-400">Official institutional compliance audit with principal signature section.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportStudentsPDF}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Consolidated Students Roster (PDF)</h5>
                        <p className="text-[11px] text-slate-400">Formatted printable PDF table of all enrolled students.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportTeachersPDF}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Teacher Directory & Birthdays (PDF)</h5>
                        <p className="text-[11px] text-slate-400">Printable official faculty list with subjects, classes, and contact details.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportFullJson}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Complete School Backup (JSON)</h5>
                        <p className="text-[11px] text-slate-400">All teachers, classes, student rosters, marks, and circulars.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportStudentsCsv}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Consolidated Students Roster (CSV)</h5>
                        <p className="text-[11px] text-slate-400">Searchable spreadsheet of all students across the school.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportTeachersCsv}
                    className="w-full p-3.5 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Export Teacher Directory & Birthdays (CSV)</h5>
                        <p className="text-[11px] text-slate-400">Faculty directory with contact numbers and birth dates.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Import Action Box */}
              <div className="space-y-3 pt-4 border-t border-[#2D3139]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Import / Restore School Backup
                </h4>

                <div className="p-4 rounded-2xl bg-[#0F1115] border border-dashed border-[#2D3139] space-y-3 text-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <Upload className="w-8 h-8 text-amber-400 mx-auto" />
                  <div>
                    <h5 className="text-xs font-bold text-white">Upload School Backup File (.json)</h5>
                    <p className="text-[11px] text-slate-400">Select a previously exported JSON backup to restore school records.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-[#2D3139] hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Choose JSON File
                  </button>

                  {importError && (
                    <p className="text-xs text-rose-400 font-semibold">{importError}</p>
                  )}

                  {importPreview && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">Backup Detected:</span>
                        <span className="text-[10px] text-slate-400 font-mono">{importPreview.schoolName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                        <div className="bg-[#0F1115] p-1.5 rounded">
                          <span className="block text-[10px] text-slate-400">Teachers</span>
                          <strong className="text-white">{importPreview.teachersCount}</strong>
                        </div>
                        <div className="bg-[#0F1115] p-1.5 rounded">
                          <span className="block text-[10px] text-slate-400">Classes</span>
                          <strong className="text-white">{importPreview.classesCount}</strong>
                        </div>
                        <div className="bg-[#0F1115] p-1.5 rounded">
                          <span className="block text-[10px] text-slate-400">Students</span>
                          <strong className="text-white">{importPreview.studentsCount}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs transition cursor-pointer shadow-lg"
                      >
                        Confirm & Restore Data
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. School Profile & Admin Access Credentials */}
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-xl space-y-5">
              <div className="border-b border-[#2D3139] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  School Profile & Admin Credentials
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure the official school identity and management login password.
                </p>
              </div>

              <form onSubmit={handleSaveSchoolSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Official School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolProfile.schoolName}
                    onChange={e => setSchoolProfile({ ...schoolProfile, schoolName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      School Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolProfile.schoolCode}
                      onChange={e => setSchoolProfile({ ...schoolProfile, schoolCode: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-amber-500/40 text-sm font-mono font-bold text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      School Admin Password / PIN *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminPin}
                      onChange={e => setAdminPin(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Principal / Admin Name
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      School Gmail Address
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    School Phone Number
                  </label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={e => setAdminPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    School Address
                  </label>
                  <textarea
                    rows={2}
                    value={schoolProfile.schoolAddress}
                    onChange={e => setSchoolProfile({ ...schoolProfile, schoolAddress: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-save-admin-settings"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>SAVE SCHOOL PROFILE & ADMIN PASSWORD</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: REPORTS & EXPORTS CENTER */}
        {activeTab === 'reports-center' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#1A1C23] p-5 sm:p-6 rounded-3xl border border-[#2D3139] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-amber-400" />
                    <span>Institutional Report & Export Center</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate, preview, print, and export official reports for <strong className="text-white">{schoolProfile.schoolName}</strong> ({activeSchoolCode}).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Formal Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportStudentsCsv}
                    className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Students CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTeachersCsv}
                    className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Teachers CSV</span>
                  </button>
                </div>
              </div>

              {/* Report Category Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'students', label: 'Student Master Register', icon: GraduationCap, count: crossClassData.totalStudents },
                  { id: 'teachers', label: 'Faculty Directory & Work', icon: Users, count: teachers.length },
                  { id: 'attendance', label: 'Attendance & Attendance Rates', icon: UserCheck, count: `${crossClassData.overallAttendanceRate}%` },
                  { id: 'exams', label: 'Exam Results & Marks Analysis', icon: Award, count: `${crossClassData.overallAcademicAverage}%` }
                ].map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setReportType(cat.id as any)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        reportType === cat.id
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                          : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#2D3139]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{cat.label}</span>
                      <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-black/40 font-mono">
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Preview Table */}
              <div className="rounded-2xl border border-[#2D3139] bg-[#0F1115] overflow-hidden">
                <div className="p-3.5 bg-[#1A1C23] border-b border-[#2D3139] flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {reportType === 'students' && `Consolidated Student Register (${crossClassData.allStudentsList.length} Active Records)`}
                    {reportType === 'teachers' && `Faculty Directory & Work Dossiers (${teachers.length} Active Teachers)`}
                    {reportType === 'attendance' && `School-Wide Attendance Log (Avg: ${crossClassData.overallAttendanceRate}%)`}
                    {reportType === 'exams' && `Academic Performance & Marks Analysis (Avg: ${crossClassData.overallAcademicAverage}%)`}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Generated: {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {reportType === 'students' && (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#14161C] text-slate-400 uppercase font-bold text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Roll</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Class & Div</th>
                          <th className="py-2.5 px-3">Gender</th>
                          <th className="py-2.5 px-3">Guardian Contact</th>
                          <th className="py-2.5 px-3 text-right">Att. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3139]/50">
                        {crossClassData.allStudentsList.map((s, idx) => (
                          <tr key={s.id || idx} className="hover:bg-[#1A1C23]/50">
                            <td className="py-2 px-3 font-mono font-bold text-amber-400">#{s.rollNo}</td>
                            <td className="py-2 px-3 font-semibold text-white">{s.name}</td>
                            <td className="py-2 px-3 text-slate-300">{s.className}</td>
                            <td className="py-2 px-3 text-slate-400 uppercase text-[10px]">{s.gender}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{s.guardianPhone || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">{s.attendancePercentage !== undefined ? `${s.attendancePercentage}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === 'teachers' && (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#14161C] text-slate-400 uppercase font-bold text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Teacher Name</th>
                          <th className="py-2.5 px-3">Subject Assigned</th>
                          <th className="py-2.5 px-3">Assigned Class</th>
                          <th className="py-2.5 px-3">Email ID</th>
                          <th className="py-2.5 px-3">Date of Birth (DOB)</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3139]/50">
                        {teachers.map((t, idx) => (
                          <tr key={t.id || idx} className="hover:bg-[#1A1C23]/50">
                            <td className="py-2 px-3 font-semibold text-white flex items-center gap-2">
                              <span className="text-base">{t.avatar || '👨‍🏫'}</span>
                              <span>{t.name}</span>
                            </td>
                            <td className="py-2 px-3 text-amber-300 font-medium">{t.subject || t.primarySubject || t.designation || '-'}</td>
                            <td className="py-2 px-3 text-slate-300">{t.assignedClass || '-'}</td>
                            <td className="py-2 px-3 text-sky-300 text-[11px]">{t.email || '-'}</td>
                            <td className="py-2 px-3 text-rose-300 font-mono text-[11px]">{t.dob || '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{t.phone}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">✓ Active</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === 'attendance' && (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Overall School Attendance</span>
                          <span className="text-2xl font-black text-emerald-400">{crossClassData.overallAttendanceRate}%</span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Active Student Strength</span>
                          <span className="text-2xl font-black text-white">{crossClassData.totalStudents}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Daily Average Absentees</span>
                          <span className="text-2xl font-black text-rose-400">
                            {Math.max(1, Math.round(crossClassData.totalStudents * (1 - crossClassData.overallAttendanceRate / 100)))}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Attendance registers are updated daily by assigned class teachers across Plus One and Plus Two divisions.
                      </p>
                    </div>
                  )}

                  {reportType === 'exams' && (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Institutional Average</span>
                          <span className="text-2xl font-black text-sky-400">{crossClassData.overallAcademicAverage}%</span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Science Streams Average</span>
                          <span className="text-2xl font-black text-purple-400">{Math.min(98, crossClassData.overallAcademicAverage + 4)}%</span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-xs text-slate-400 block">Commerce / Humanities Avg</span>
                          <span className="text-2xl font-black text-amber-400">{Math.max(65, crossClassData.overallAcademicAverage - 2)}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Terminal exam scores and formative internal marks are tracked across all student evaluations.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: AUDIT LOGS & ACCESS CONTROL TRAIL */}
        {activeTab === 'audit-logs' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#1A1C23] p-5 sm:p-6 rounded-3xl border border-[#2D3139] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    <span>Administrative & Security Audit Trail</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Immutable activity log tracking administrator sessions, access rule validations, and security events for school <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      StorageService.addAuditLog({
                        user: admin.adminName || 'Principal',
                        role: 'SCHOOL_ADMIN',
                        action: 'AUDIT_EXPORT',
                        target: '/school-admin',
                        details: 'Administrator exported security audit logs.',
                        status: 'INFO'
                      });
                      const jsonStr = JSON.stringify(auditLogs, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Audit_Logs_${activeSchoolCode}_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      showToast('Audit log JSON exported successfully!');
                      triggerRefresh();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Audit Log</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear all audit logs, login history, and user access records? This will delete all user entry dates, timestamps, users, roles, actions, targets, and activities.')) {
                        StorageService.clearAuditLogs();
                        CloudSync.clearAuditLogsFromSchool(activeSchoolCode).catch(() => {});
                        setAuditLogs([]);
                        try {
                          localStorage.removeItem('hss_audit_logs_v1');
                          localStorage.removeItem('hss_teacher_activities_' + activeSchoolCode);
                        } catch (e) {}
                        showToast('All login history, user logs, timestamps, roles, and targets cleared successfully!');
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Logs</span>
                  </button>
                </div>
              </div>

              {/* Filter Controls & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'AUTH', 'SECURITY', 'DATA'] as const).map(flt => (
                    <button
                      key={flt}
                      type="button"
                      onClick={() => setAuditFilter(flt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        auditFilter === flt
                          ? 'bg-amber-600 text-white'
                          : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#2D3139]'
                      }`}
                    >
                      {flt}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={e => setAuditSearchQuery(e.target.value)}
                    placeholder="Search logs by action, user, target..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Audit Log Table */}
              <div className="rounded-2xl border border-[#2D3139] bg-[#0F1115] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14161C] text-slate-400 uppercase font-bold text-[10px] border-b border-[#2D3139]">
                    <tr>
                      <th className="py-2.5 px-3.5">Timestamp</th>
                      <th className="py-2.5 px-3.5">User & Role</th>
                      <th className="py-2.5 px-3.5">Action</th>
                      <th className="py-2.5 px-3.5">Target</th>
                      <th className="py-2.5 px-3.5">Event Details</th>
                      <th className="py-2.5 px-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3139]/50">
                    {auditLogs
                      .filter(log => {
                        if (auditFilter === 'AUTH' && !log.action.includes('AUTH') && !log.action.includes('SESSION') && !log.action.includes('LOGIN')) return false;
                        if (auditFilter === 'SECURITY' && !log.action.includes('ACCESS') && !log.action.includes('RULE') && !log.action.includes('VERIFIED')) return false;
                        if (auditFilter === 'DATA' && !log.action.includes('SAVE') && !log.action.includes('EXPORT') && !log.action.includes('RESTORE')) return false;
                        if (auditSearchQuery.trim()) {
                          const q = auditSearchQuery.toLowerCase();
                          return (
                            log.user.toLowerCase().includes(q) ||
                            log.action.toLowerCase().includes(q) ||
                            log.target.toLowerCase().includes(q) ||
                            log.details.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map(log => (
                        <tr key={log.id} className="hover:bg-[#1A1C23]/60 transition">
                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="font-semibold text-white block leading-tight">{log.user}</span>
                            <span className="text-[10px] text-amber-400 font-mono font-bold">{log.role}</span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-sky-400">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-300 text-[11px]">
                            {log.target}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-300 max-w-xs">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : log.status === 'ERROR'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : log.status === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: TEACHER SIGNUPS */}
        {activeTab === 'teacher-signups' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#1A1C23] p-5 sm:p-6 rounded-3xl border border-[#2D3139] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    <span>Registered Teacher Profiles</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live directory of teachers authenticated via Firebase who have registered under <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={signupSearch}
                    onChange={e => setSignupSearch(e.target.value)}
                    placeholder="Search by name, email, subject, phone..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <select
                  value={signupFilter}
                  onChange={e => setSignupFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm font-semibold text-slate-300 focus:outline-none focus:border-amber-500 transition sm:w-48"
                >
                  <option value="all">All Teachers</option>
                  <option value="class-teachers">Class Teachers Only</option>
                  <option value="subject-teachers">Subject Teachers Only</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const filtered = teacherSignups.filter(t => {
                    const matchesSearch = !signupSearch ? true : 
                      (t.fullName?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.email?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.subject?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.mobileNumber?.includes(signupSearch));
                       
                    const matchesFilter = signupFilter === 'all' ? true :
                      signupFilter === 'class-teachers' ? t.isClassTeacher :
                      signupFilter === 'subject-teachers' ? !t.isClassTeacher : true;
                      
                    return matchesSearch && matchesFilter;
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center bg-[#0F1115] rounded-2xl border border-[#2D3139]">
                        <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                        <p className="font-semibold text-slate-400">No registered teachers match your search.</p>
                      </div>
                    );
                  }
                  return filtered.map((t, idx) => (
                    <div key={idx} className="bg-[#0F1115] p-4 rounded-2xl border border-[#2D3139] shadow-sm flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm">{t.fullName}</h4>
                          <div className="text-xs text-slate-400">{t.email}</div>
                        </div>
                        {t.isClassTeacher && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Class Teacher
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-[#2D3139]">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-mono text-slate-300">{t.mobileNumber}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Subject:</span>
                          <span className="text-slate-300 font-medium">{t.subject}</span>
                        </div>
                        {t.academicYear && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Academic Year:</span>
                            <span className="text-purple-300 font-medium font-mono">{t.academicYear}</span>
                          </div>
                        )}
                        {t.isClassTeacher && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Class Assigned:</span>
                            <span className="text-slate-300 font-medium">{t.className} {t.stream} {t.section}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] pt-1">
                          <span className="text-slate-500">Registered:</span>
                          <span className="text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB: RECENT TEACHER ACTIVITY */}
        {activeTab === 'teacher-activity' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#1A1C23] p-5 sm:p-6 rounded-3xl border border-[#2D3139] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" />
                    <span>Real-Time Teacher Activity Stream</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live audit of actions performed by teachers across school <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong> (e.g. student records added, exam marks updated, attendance logged, timetables edited).
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleClearTeacherActivity}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Activity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const jsonStr = JSON.stringify(realtimeActivities, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Teacher_Activity_Stream_${activeSchoolCode}_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      showToast('Teacher activity stream exported successfully!');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {['ALL', 'student_added', 'marks_entered', 'attendance', 'login', 'timetable_updated', 'profile_updated'].map((flt) => {
                    const label = flt === 'ALL' ? 'All Activities' : flt.replace('_', ' ').toUpperCase();
                    const isSel = activityTypeFilter === flt;
                    return (
                      <button
                        key={flt}
                        type="button"
                        onClick={() => setActivityTypeFilter(flt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSel
                            ? 'bg-amber-600 text-white shadow'
                            : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#2D3139]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={activitySearchQuery}
                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                    placeholder="Search by teacher or action..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Activity Table */}
              <div className="rounded-2xl border border-[#2D3139] overflow-hidden bg-[#0F1115]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1A1C23] text-slate-400 font-bold border-b border-[#2D3139]">
                      <tr>
                        <th className="py-3 px-4">TIMESTAMP</th>
                        <th className="py-3 px-4">TEACHER & SUBJECT</th>
                        <th className="py-3 px-4">ACTIVITY TYPE</th>
                        <th className="py-3 px-4">DETAILS & DESCRIPTION</th>
                        <th className="py-3 px-4 text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]/60">
                      {realtimeActivities
                        .filter(act => {
                          if (activityTypeFilter !== 'ALL' && act.activityType !== activityTypeFilter) return false;
                          if (activitySearchQuery.trim()) {
                            const q = activitySearchQuery.toLowerCase();
                            return (
                              act.teacherName.toLowerCase().includes(q) ||
                              act.description.toLowerCase().includes(q) ||
                              (act.subject && act.subject.toLowerCase().includes(q)) ||
                              act.activityType.toLowerCase().includes(q)
                            );
                          }
                          return true;
                        })
                        .map((act, idx) => {
                          const badgeColor = 
                            act.activityType === 'student_added' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            act.activityType === 'marks_entered' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                            act.activityType === 'attendance' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                            act.activityType === 'login' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/30';

                          return (
                            <tr key={act.id || idx} className="hover:bg-[#1A1C23]/60 transition">
                              <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                                {act.timestamp ? new Date(act.timestamp).toLocaleString() : 'Just now'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-white">{act.teacherName}</div>
                                <div className="text-[11px] text-amber-300/80">{act.subject || act.assignedClass || 'General Faculty'}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${badgeColor}`}>
                                  {act.activityType.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300 max-w-xs sm:max-w-md leading-relaxed">
                                {act.description}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                                  LIVE SYNCED
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                      {realtimeActivities.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                            <p className="font-semibold text-slate-400">No teacher activity recorded yet.</p>
                            <p className="text-[11px] text-slate-500 mt-1">Teacher actions (adding students, entering marks, recording attendance) will appear here in real-time.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TEACHER WORK DOSSIER MODAL ("VIEW WORK") */}
      {selectedTeacherForDossier && selectedTeacherDossierData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="w-full max-w-3xl bg-[#1A1C23] border border-[#2D3139] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header with Photo & Details */}
            <div className="flex items-start justify-between border-b border-[#2D3139] pb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-600 flex items-center justify-center text-3xl shadow-xl shrink-0 ring-2 ring-purple-400/40">
                  {selectedTeacherForDossier.avatar || '👨‍🏫'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                      Teacher Work Dossier
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {selectedTeacherForDossier.schoolCode || admin.schoolCode}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-0.5">{selectedTeacherForDossier.name}</h3>
                  <p className="text-xs text-amber-300 font-semibold">{selectedTeacherForDossier.designation}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTeacherForDossier(null)}
                className="p-2 rounded-xl bg-[#0F1115] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Teacher Info Grid (No Email or Password) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Classrooms Created ({selectedTeacherDossierData.teacherClasses?.length || 1})</span>
                <span className="font-semibold text-white truncate block" title={selectedTeacherDossierData.teacherClasses?.map(c => c.className).join(', ') || selectedTeacherForDossier.assignedClass}>
                  {selectedTeacherDossierData.teacherClasses?.map(c => c.className).join(', ') || selectedTeacherForDossier.assignedClass || 'Class 12 Bio-Science A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Academic Year</span>
                <span className="text-purple-300 font-bold truncate block flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  {selectedTeacherForDossier.academicYear || '2026-27'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Subject Assigned</span>
                <span className="text-amber-400 font-bold truncate block">
                  {selectedTeacherForDossier.subject || selectedTeacherForDossier.primarySubject || selectedTeacherForDossier.designation || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Date of Birth (DOB)</span>
                <span className="text-rose-300 font-medium truncate block flex items-center gap-1">
                  <Cake className="w-3 h-3 text-rose-400" />
                  {selectedTeacherForDossier.dob || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Phone Number</span>
                <span className="font-mono text-slate-300 truncate block">{selectedTeacherForDossier.phone || '-'}</span>
              </div>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Managed Students</span>
                <span className="text-xl font-black text-emerald-400">{selectedTeacherDossierData.students.length}</span>
                <span className="text-[10px] text-slate-500 block">Active enrolled</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Attendance Days</span>
                <span className="text-xl font-black text-sky-400">{selectedTeacherDossierData.totalAttendanceDays}</span>
                <span className="text-[10px] text-slate-500 block">Registers recorded</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Exams Conducted</span>
                <span className="text-xl font-black text-purple-400">{selectedTeacherDossierData.totalExams}</span>
                <span className="text-[10px] text-slate-500 block">Terminal cycles</span>
              </div>
            </div>

            {/* Students List Managed by Teacher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Classroom Student Roster ({selectedTeacherDossierData.students.length})
                </h4>
                <span className="text-[11px] text-purple-300 font-mono">
                  {selectedTeacherDossierData.teacherClasses?.map(c => c.className).join(' • ') || selectedTeacherForDossier.assignedClass || 'Class 12 Science A'}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-[#2D3139] bg-[#0F1115]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1A1C23] text-slate-400 uppercase font-bold text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Gender</th>
                      <th className="py-2 px-3">Parent Contact</th>
                      <th className="py-2 px-3 text-right">Academic Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3139]/60">
                    {selectedTeacherDossierData.students.map(s => (
                      <tr key={s.id} className="hover:bg-[#1A1C23]/40">
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">
                          #{s.rollNo < 10 ? `0${s.rollNo}` : s.rollNo}
                        </td>
                        <td className="py-2 px-3 font-semibold text-white">{s.name}</td>
                        <td className="py-2 px-3 uppercase text-[10px] text-slate-400">{s.gender}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{s.guardianPhone || '+91 98470 12345'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">92% (Pass)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Principal Review & Remarks */}
            <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" />
                  Principal Review & Faculty Appraisal Note
                </h4>
                <span className="text-[10px] text-slate-500">Visible in Institutional Audit</span>
              </div>

              {teacherRemarks[selectedTeacherForDossier.id] && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                  <strong className="text-purple-300 block mb-0.5">Recorded Principal Appraisal:</strong>
                  {teacherRemarks[selectedTeacherForDossier.id]}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentRemarkInput}
                  onChange={e => setCurrentRemarkInput(e.target.value)}
                  placeholder="Add evaluation note or commendation for this educator..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveTeacherRemark(selectedTeacherForDossier.id)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleSendBirthdayGreeting(selectedTeacherForDossier)}
                className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Cake className="w-4 h-4" />
                <span>Send Birthday Wish</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTeacherForDossier(null)}
                className="px-6 py-2.5 rounded-xl bg-[#2D3139] hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONSOLIDATED INSTITUTIONAL AUDIT REPORT MODAL (PRINTABLE) */}
      {showPrintModal && (
        <div id="printable-audit-report-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div id="printable-audit-report" className="w-full max-w-3xl bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Government of Kerala • General Education Department
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">{schoolProfile.schoolName}</h2>
                <p className="text-xs text-slate-600">
                  School Code: <strong>{activeSchoolCode}</strong> • Consolidated Institutional Progress & Teacher Activity Audit
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer no-print"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* School Metrics Summary */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Teachers</span>
                <span className="text-lg font-black text-slate-900">{teachers.length}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Classes</span>
                <span className="text-lg font-black text-slate-900">{classesList.length}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Students</span>
                <span className="text-lg font-black text-slate-900">{crossClassData.totalStudents}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Avg Attendance</span>
                <span className="text-lg font-black text-emerald-700">{crossClassData.overallAttendanceRate}%</span>
              </div>
            </div>

            {/* Teacher Roster Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Associated Teachers & Assigned Classes</h4>
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Teacher Name</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Assigned Class</th>
                    <th className="py-2.5 px-3">Date of Birth</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3 text-right">Work Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teachers.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900">{t.name}</td>
                      <td className="py-2 px-3 text-slate-600">{t.designation || '-'}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{t.assignedClass || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{t.dob || '-'}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{t.phone}</td>
                      <td className="py-2 px-3 text-emerald-700 font-bold text-right">✓ Active & Up to date</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="flex justify-between items-end pt-6 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Date of Report:</span>
                <strong className="text-slate-800">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
              <div className="text-center">
                <div className="w-44 border-b border-slate-400 mb-1" />
                <span className="font-bold text-slate-800">{admin.adminName || ''}</span>
                <span className="text-[10px] text-slate-500 block">Principal & School Head</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={handleExportAuditPDF}
                className="flex-1 min-w-[140px] py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs hover:from-amber-500 hover:to-amber-600 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Save as PDF (.pdf)</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 min-w-[140px] py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT TEACHER INFORMATION MODAL */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="w-full max-w-xl bg-[#1A1C23] border border-[#2D3139] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {editingTeacher ? 'Edit Teacher Information' : 'Register New Teacher'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Linked to School Code <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTeacherModalOpen(false)}
                className="p-2 rounded-xl bg-[#0F1115] text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherForm} className="space-y-4 text-xs">
              {/* Profile Photo & Avatar Section */}
              <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-3">
                <label className="text-xs font-bold text-amber-300 block">Teacher Profile Photo & Portrait</label>
                
                <div className="flex items-center gap-4">
                  {teacherFormData.photoUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={teacherFormData.photoUrl}
                        alt="Profile Preview"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-500 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => setTeacherFormData(f => ({ ...f, photoUrl: '' }))}
                        className="absolute -top-1 -right-1 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow transition"
                        title="Remove Photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-600 flex items-center justify-center text-3xl shadow-md ring-2 ring-[#2D3139] shrink-0">
                      {teacherFormData.avatar || '👨‍🏫'}
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition border border-slate-700">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Profile Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const base64 = ev.target?.result as string;
                              if (base64) {
                                setTeacherFormData(f => ({ ...f, photoUrl: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-slate-500">Supported: JPG, PNG, WebP (auto-saved to teacher account)</p>
                  </div>
                </div>

                {/* Avatar Selection if No Photo */}
                <div className="pt-2 border-t border-[#2D3139]/60">
                  <span className="text-[11px] text-slate-400 block mb-1.5">Or Choose Avatar Emoji:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['👨‍🏫', '👩‍🏫', '🧑‍🏫', '🔬', '📐', '📚', '💻', '🎨', '🎵', '⚽', '🌿', '🌟'].map(av => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setTeacherFormData(f => ({ ...f, avatar: av }))}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition cursor-pointer ${
                          teacherFormData.avatar === av && !teacherFormData.photoUrl
                            ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Name, Subject Assigned & Teacher Gmail */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Teacher Full Name *</label>
                  <input
                    type="text"
                    required
                    value={teacherFormData.name}
                    onChange={e => setTeacherFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Smt. Lakshmi Devi M."
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Subject Assigned *</label>
                  <input
                    type="text"
                    required
                    value={teacherFormData.subject}
                    onChange={e => setTeacherFormData(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Physics, Chemistry..."
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span>Teacher Gmail</span>
                  </label>
                  <input
                    type="email"
                    value={teacherFormData.email}
                    onChange={e => setTeacherFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="teacher@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Class Assignment Details: Only Show Teacher-Created Classrooms */}
              {(() => {
                const teacherClasses = editingTeacher
                  ? getTeacherCreatedClasses(editingTeacher.id, editingTeacher.email || editingTeacher.gmail, editingTeacher.name)
                  : [];

                return (
                  <div className="space-y-2.5 p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-amber-400" />
                        <span>Class Assignment Details</span>
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {editingTeacher ? `Teacher ID: ${editingTeacher.id}` : `School: ${activeSchoolCode}`}
                      </span>
                    </div>

                    {teacherClasses.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                        <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                        <span className="font-semibold">No classrooms created by this teacher yet.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-400">
                          Select an assigned classroom from the classrooms actually created by this teacher in the Teacher App:
                        </p>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {teacherClasses.map(cls => {
                            const isSelected =
                              teacherFormData.assignedClass === cls.className ||
                              (teacherFormData.standard === cls.standard &&
                               teacherFormData.stream === cls.stream &&
                               teacherFormData.section === cls.section);

                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={() => {
                                  setTeacherFormData(f => ({
                                    ...f,
                                    assignedClass: cls.className,
                                    standard: cls.standard,
                                    stream: cls.stream,
                                    section: cls.section
                                  }));
                                }}
                                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-amber-950/70 border-amber-500 text-white ring-2 ring-amber-400'
                                    : 'bg-[#1A1C23] border-[#2D3139] text-slate-300 hover:bg-[#222530]'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                      {cls.stream || 'General'}
                                    </span>
                                    <span className="text-xs font-black text-white">
                                      {cls.standard || 'Class'}
                                    </span>
                                    <span className="text-xs font-bold text-sky-400">
                                      Division {cls.section || 'A'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Classroom Name: {cls.className}
                                  </div>
                                </div>

                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-amber-400 bg-amber-500 text-black' : 'border-slate-600'
                                }`}>
                                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Designation, Academic Year, Date of Birth & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Designation / Role</label>
                  <input
                    type="text"
                    value={teacherFormData.designation}
                    onChange={e => setTeacherFormData(f => ({ ...f, designation: e.target.value }))}
                    placeholder="e.g. HSST Physics, Class Teacher"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Academic Year *</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="admin-teacher-academicyear"
                    value={teacherFormData.academicYear}
                    onChange={e => setTeacherFormData(f => ({ ...f, academicYear: e.target.value }))}
                    placeholder="e.g. 2026-27 or 2025-26"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Cake className="w-3.5 h-3.5 text-rose-400" />
                    <span>Date of Birth (DOB)</span>
                  </label>
                  <input
                    type="text"
                    value={teacherFormData.dob}
                    onChange={e => setTeacherFormData(f => ({ ...f, dob: e.target.value }))}
                    placeholder="DD/MM/YYYY or YYYY-MM-DD"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500 font-mono placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={teacherFormData.phone}
                    onChange={e => setTeacherFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98470 12345"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#2D3139]">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#0F1115] hover:bg-slate-800 text-slate-300 hover:text-white font-bold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black transition shadow-lg shadow-amber-950/50 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingTeacher ? 'Update Teacher Profile' : 'Save & Register Teacher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN TIMETABLE SLOT EDITOR / SCHEDULER MODAL */}
      {isAdminTimetableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="w-full max-w-xl bg-[#1A1C23] border border-[#2D3139] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {adminEditingSlot ? 'Edit Scheduled Period Slot' : 'Schedule New Academic Period'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assign teacher, classroom, and period details under school {activeSchoolCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAdminTimetableModalOpen(false)}
                className="p-2 rounded-xl bg-[#0F1115] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminSlot} className="space-y-4">
              {/* Day & Period Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Day of the Week *</label>
                  <select
                    value={adminSlotFormData.day}
                    onChange={e => setAdminSlotFormData(f => ({ ...f, day: e.target.value as TimetableDay }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    {TIMETABLE_DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Period Slot *</label>
                  <select
                    value={adminSlotFormData.periodNumber}
                    onChange={e => {
                      const pNum = Number(e.target.value);
                      const timing = DEFAULT_PERIOD_TIMINGS[pNum - 1] || DEFAULT_PERIOD_TIMINGS[0];
                      setAdminSlotFormData(f => ({
                        ...f,
                        periodNumber: pNum,
                        startTime: timing.startTime,
                        endTime: timing.endTime
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    {DEFAULT_PERIOD_TIMINGS.map(p => (
                      <option key={p.periodNumber} value={p.periodNumber}>
                        Period {p.periodNumber} ({p.startTime} - {p.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={adminSlotFormData.subject}
                    onChange={e => setAdminSlotFormData(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Physics, Mathematics, Biology"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Subject Code</label>
                  <input
                    type="text"
                    value={adminSlotFormData.subjectCode}
                    onChange={e => setAdminSlotFormData(f => ({ ...f, subjectCode: e.target.value.toUpperCase() }))}
                    placeholder="PHY"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Faculty Teacher Assignment & Target Classroom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assign Faculty Teacher *</span>
                  </label>
                  <select
                    value={adminSlotFormData.teacherId}
                    onChange={e => {
                      const tId = e.target.value;
                      const teacher = teachers.find(t => t.id === tId);
                      const tClasses = getTeacherCreatedClasses(tId);
                      setAdminSlotFormData(f => ({
                        ...f,
                        teacherId: tId,
                        teacherName: teacher?.name || '',
                        className: tClasses[0]?.className || ''
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.designation || 'Class Teacher'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <School className="w-3.5 h-3.5 text-purple-400" />
                    <span>Classroom Division *</span>
                  </label>
                  {(() => {
                    const tClasses = getTeacherCreatedClasses(adminSlotFormData.teacherId);
                    return (
                      <>
                        <select
                          value={adminSlotFormData.className}
                          onChange={e => setAdminSlotFormData(f => ({ ...f, className: e.target.value }))}
                          disabled={tClasses.length === 0}
                          className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500 font-medium disabled:opacity-50"
                        >
                          {tClasses.length === 0 ? (
                            <option value="">No classrooms created by this teacher</option>
                          ) : (
                            tClasses.map(c => (
                              <option key={c.id} value={c.className}>{c.className}</option>
                            ))
                          )}
                        </select>
                        {tClasses.length === 0 ? (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            Only classrooms created by this teacher can be scheduled.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Showing only classrooms created by this teacher.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Room Number & Period Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Room / Laboratory Number</span>
                  </label>
                  <input
                    type="text"
                    value={adminSlotFormData.roomNumber}
                    onChange={e => setAdminSlotFormData(f => ({ ...f, roomNumber: e.target.value }))}
                    placeholder="e.g. Room 101, Physics Lab"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Period Category</label>
                  <select
                    value={adminSlotFormData.type}
                    onChange={e => setAdminSlotFormData(f => ({ ...f, type: e.target.value as TimetablePeriodType }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="lecture">Classroom Lecture</option>
                    <option value="lab">Lab Practical</option>
                    <option value="sports">Physical Education / Sports</option>
                    <option value="library">Library / Reading</option>
                    <option value="activity">Seminar / Activity</option>
                  </select>
                </div>
              </div>

              {/* Remarks / Syllabus Topic */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Syllabus Topic / Remarks (Optional)</label>
                <input
                  type="text"
                  value={adminSlotFormData.notes}
                  onChange={e => setAdminSlotFormData(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Chapter 4 Thermodynamics & Optics"
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#2D3139]">
                {adminEditingSlot ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAdminSlot(adminEditingSlot.id)}
                    className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Slot</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdminTimetableModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#0F1115] hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-black transition shadow-lg shadow-amber-950/50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{adminEditingSlot ? 'Update Period' : 'Save to Schedule'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TWO-MODE TEACHER DELETION MODAL */}
      {deleteModalTeacher && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#181B20] border border-[#2D3139] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-white">
            
            {!showPermanentConfirmation ? (
              /* STEP 1: CHOICE DIALOG */
              <>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                    <UserX className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Remove Teacher</h3>
                    <p className="text-xs text-slate-400">
                      How do you want to remove <strong className="text-amber-300">{deleteModalTeacher.name}</strong> from the School Admin Panel?
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {/* OPTION A: TEMPORARY DELETE / REMOVE */}
                  <button
                    type="button"
                    onClick={handleExecuteTemporaryDelete}
                    className="w-full text-left p-4 rounded-xl bg-[#0F1115] hover:bg-slate-800/80 border border-slate-700/60 hover:border-amber-500/50 transition group cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-300 group-hover:text-amber-200">
                        A. Temporary Delete / Remove
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Re-entry Allowed
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Removes teacher from active School Admin list now. The teacher account remains valid and will automatically re-appear if the teacher logs in or signs up with the same valid school code in the future.
                    </p>
                  </button>

                  {/* OPTION B: PERMANENT DELETE */}
                  <button
                    type="button"
                    onClick={() => setShowPermanentConfirmation(true)}
                    className="w-full text-left p-4 rounded-xl bg-[#0F1115] hover:bg-rose-950/30 border border-slate-700/60 hover:border-rose-500/50 transition group cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-rose-400 group-hover:text-rose-300">
                        B. Permanent Delete
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Irreversible
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Permanently deletes teacher record and revokes school membership. The teacher will be permanently blocked from re-entering this school.
                    </p>
                  </button>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#2D3139]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalTeacher(null);
                      setShowPermanentConfirmation(false);
                    }}
                    className="px-5 py-2 rounded-xl bg-[#0F1115] hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              /* STEP 2: STRONG PERMANENT CONFIRMATION DIALOG */
              <>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-500">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-rose-400">Confirm Permanent Deletion</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Are you sure you want to <strong className="text-rose-300 underline">PERMANENTLY DELETE</strong> teacher <strong className="text-white">{deleteModalTeacher.name}</strong>?
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2 text-xs text-slate-300">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Permanent Deletion Warning</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#C5C9D3]">
                    <li>This will permanently remove all school membership records for <strong>{deleteModalTeacher.name}</strong>.</li>
                    <li>The teacher will no longer be allowed automatic re-entry to this school.</li>
                    <li>This action cannot be undone.</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#2D3139]">
                  <button
                    type="button"
                    onClick={() => setShowPermanentConfirmation(false)}
                    className="px-4 py-2 rounded-xl bg-[#0F1115] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecutePermanentDelete}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition shadow-lg shadow-rose-950/50 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
