import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
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
  TeacherAccount,
  SchoolAdminAccount,
  AuthRole
} from './types';
import { StorageService, DEFAULT_SCHOOL_ADMIN } from './utils/storage';
import { SplashScreen } from './components/SplashScreen';
import { Header } from './components/Header';
import { BottomNav, ScreenTab } from './components/BottomNav';
import { Toast, ToastType } from './components/Toast';
import { SearchModal } from './components/SearchModal';
import { ReminderModal } from './components/ReminderModal';
import { AddClassModal } from './components/AddClassModal';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { InstallPromptBanner } from './components/InstallPromptBanner';

import { auth, onAuthStateChanged, signOut } from './utils/firebase';
import { CloudSync } from './utils/cloudSync';
import { ThemeManager } from './utils/themeHelper';
import { requestAndSaveFCMToken, removeFCMToken } from './utils/fcm';
import { setOneSignalUser, logoutOneSignalUser } from './utils/onesignal';

// Screens
import { AuthScreen } from './screens/AuthScreen';
import { SchoolAdminDashboardScreen } from './screens/SchoolAdminDashboardScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { SchoolProfileScreen } from './screens/SchoolProfileScreen';
import { StudentManagementScreen } from './screens/StudentManagementScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { TimetableScreen } from './screens/TimetableScreen';
import { ExamsScreen } from './screens/ExamsScreen';
import { ExamProgressScreen } from './screens/ExamProgressScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);

  // Authentication State
  const authSession = StorageService.getAuthSession();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authSession.isLoggedIn);
  const [authRole, setAuthRole] = useState<AuthRole>(authSession.role || 'teacher');
  const [currentAdmin, setCurrentAdmin] = useState<SchoolAdminAccount | null>(authSession.currentAdmin || null);

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<ScreenTab>('dashboard');

  // URL Routing State for /school-admin and other deep links
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Multi-Class Catalog & Active Class State
  const [classesList, setClassesList] = useState<ClassItem[]>(StorageService.getClassesList());
  const [activeClassId, setActiveClassId] = useState<string>(StorageService.getActiveClassId());

  // Core App State persisted in localStorage (scoped to active class)
  const [school, setSchool] = useState<SchoolProfile>(StorageService.getSchoolProfile());
  const [classInfo, setClassInfo] = useState<ClassInfo>(StorageService.getClassInfo(activeClassId));
  const [teacher, setTeacher] = useState<TeacherInfo>(StorageService.getTeacherInfo());
  const [students, setStudents] = useState<Student[]>(StorageService.getStudents(activeClassId));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(StorageService.getAttendance(activeClassId));
  const [exams, setExams] = useState<Exam[]>(StorageService.getExams(activeClassId));
  const [examMarksMap, setExamMarksMap] = useState<Record<string, ExamMarksRecord>>(
    StorageService.getExamMarksMap(activeClassId)
  );
  const [reminders, setReminders] = useState<Reminder[]>(StorageService.getReminders());

  // Global Modals State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [addClassInitialTab, setAddClassInitialTab] = useState<'create' | 'manage'>('create');

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  // Reload all data from storage (used after switching class, restore/reset or auth)
  const refreshAllState = (specificClassId?: string) => {
    const cid = specificClassId || StorageService.getActiveClassId();
    setActiveClassId(cid);
    setClassesList(StorageService.getClassesList());
    setSchool(StorageService.getSchoolProfile());
    setClassInfo(StorageService.getClassInfo(cid));
    setTeacher(StorageService.getTeacherInfo());
    setStudents(StorageService.getStudents(cid));
    setAttendance(StorageService.getAttendance(cid));
    setExams(StorageService.getExams(cid));
    setExamMarksMap(StorageService.getExamMarksMap(cid));
    setReminders(StorageService.getReminders());
  };

  // Initialize Theme and listen to Auth & Email state for automatic seamless cross-device cloud sync
  useEffect(() => {
    ThemeManager.initTheme();

    // Check if there is an active sync email in localStorage or current teacher/admin session
    const currentSession = StorageService.getAuthSession();
    const activeEmail =
      CloudSync.getActiveSyncEmail() ||
      currentSession.currentTeacher?.email ||
      currentSession.currentAdmin?.email;

    if (activeEmail) {
      CloudSync.setActiveSyncEmail(activeEmail);
      CloudSync.startRealtimeEmailSync(activeEmail, () => {
        refreshAllState();
        showToast('Data synchronized across your devices!', 'info');
      });
    }

    let unsubscribeAuth = () => {};
    if (auth) {
      try {
        unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            const currentSession = StorageService.getAuthSession();
            if (currentSession.isLoggedIn && currentSession.role === 'teacher') {
              const schoolProfile = StorageService.getSchoolProfile();
              await CloudSync.restoreTeacherClassroom(firebaseUser.uid, firebaseUser.email || undefined, schoolProfile.schoolCode);
            } else {
              // Pull latest cloud state
              await CloudSync.fetchFromCloud(firebaseUser);
            }
            const activeTeacher = StorageService.getAuthSession().currentTeacher;
            const activeClass = StorageService.getActiveClassId(activeTeacher?.id || activeTeacher?.uid || firebaseUser.uid, activeTeacher?.email || firebaseUser.email || undefined);
            refreshAllState(activeClass);
            const schoolProfile = StorageService.getSchoolProfile();
            requestAndSaveFCMToken(firebaseUser.uid, schoolProfile.schoolCode).catch(() => {});
            // Start listening to real-time changes across devices
            CloudSync.startRealtimeSync(firebaseUser, () => {
              const teacher = StorageService.getAuthSession().currentTeacher;
              const liveClass = StorageService.getActiveClassId(teacher?.id || teacher?.uid, teacher?.email);
              refreshAllState(liveClass);
              showToast('Data synced in real-time with Google Account!', 'info');
            });
          }
        });
      } catch (authErr) {
        console.warn('Firebase onAuthStateChanged subscription note:', authErr);
      }
    }
    return () => {
      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
      CloudSync.stopRealtimeSync();
    };
  }, []);

  // Start real-time broadcasts listener when logged in
  useEffect(() => {
    if (isAuthenticated) {
      const schoolProfile = StorageService.getSchoolProfile();
      const schoolCode = schoolProfile.schoolCode;
      if (schoolCode) {
        CloudSync.startRealtimeBroadcasts(schoolCode, () => {
          setReminders(StorageService.getReminders());
          showToast('New circular announcements received from School Admin!', 'info');
        });
      }
    } else {
      CloudSync.stopRealtimeBroadcasts();
    }
    return () => {
      CloudSync.stopRealtimeBroadcasts();
    };
  }, [isAuthenticated]);

  // Switch Active Class Handler
  const handleSwitchClass = (classId: string) => {
    StorageService.setActiveClassId(classId);
    refreshAllState(classId);
    const target = StorageService.getClassesList().find(c => c.id === classId);
    showToast(`Switched active class to ${target?.className || 'selected class'}!`, 'success');
  };

  // Teacher Login / Signup Success Handler
  const handleTeacherLoginSuccess = (account: TeacherAccount) => {
    const uid = account.id || account.uid || auth?.currentUser?.uid || 'user';
    const email = account.email || account.gmail || '';
    const targetClassId = account.teacherClassId || StorageService.getActiveClassId(uid, email);
    if (targetClassId) {
      StorageService.setActiveClassId(targetClassId);
    }
    refreshAllState(targetClassId);

    if (account.email) {
      CloudSync.setActiveSyncEmail(account.email);
      CloudSync.startRealtimeEmailSync(account.email, () => {
        const activeClass = StorageService.getActiveClassId(uid, email);
        refreshAllState(activeClass);
        showToast('Multi-device sync updated across devices.', 'info');
      });
    }
    setAuthRole('teacher');
    setCurrentAdmin(null);
    setIsAuthenticated(true);
    const schoolCode = account.schoolCode || StorageService.getSchoolProfile().schoolCode;
    requestAndSaveFCMToken(uid, schoolCode).catch(() => {});
    setOneSignalUser({
      userId: uid,
      email: account.email || account.gmail,
      name: account.name,
      role: 'teacher',
      schoolCode: schoolCode,
      schoolName: account.schoolName,
      academicYear: account.academicYear,
      assignedClass: account.assignedClass,
      subject: account.subject || account.primarySubject
    }).catch(() => {});
    CloudSync.syncAllTeacherClassesToSchool(schoolCode, uid, account.email || account.gmail).catch(() => {});
    showToast(`Welcome, ${account.name}! Multi-device sync active.`, 'success');
  };

  // School Admin Login Success Handler
  const handleAdminLoginSuccess = (admin: SchoolAdminAccount) => {
    if (admin.email) {
      CloudSync.setActiveSyncEmail(admin.email);
      CloudSync.startRealtimeEmailSync(admin.email, () => {
        refreshAllState();
        showToast('Multi-device sync updated across devices.', 'info');
      });
    }
    setCurrentAdmin(admin);
    setAuthRole('admin');
    setIsAuthenticated(true);
    const uid = admin.id || auth?.currentUser?.uid || 'admin';
    const schoolCode = admin.schoolCode || StorageService.getSchoolProfile().schoolCode;
    requestAndSaveFCMToken(uid, schoolCode).catch(() => {});
    setOneSignalUser({
      userId: uid,
      email: admin.email,
      name: admin.adminName || 'Principal',
      role: 'school_admin',
      schoolCode: schoolCode,
      schoolName: admin.schoolName
    }).catch(() => {});
    showToast(`Welcome to School Admin Portal, ${admin.adminName || 'Principal'}! Multi-device sync active.`, 'success');
  };

  // Teacher Logout / Switch Account Handler
  const handleTeacherLogout = async () => {
    const currentUser = auth?.currentUser;
    const schoolProfile = StorageService.getSchoolProfile();
    if (currentUser) {
      removeFCMToken(currentUser.uid, schoolProfile.schoolCode).catch(() => {});
    }
    logoutOneSignalUser().catch(() => {});
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signout error', e);
    }
    CloudSync.clearActiveSyncEmail();
    StorageService.logout();
    setIsAuthenticated(false);
    setAuthRole('teacher');
    setCurrentAdmin(null);
    showToast('Signed out of teacher portal.', 'info');
  };

  // School Admin Logout Handler
  const handleAdminLogout = () => {
    const currentUser = auth?.currentUser;
    const schoolProfile = StorageService.getSchoolProfile();
    if (currentUser) {
      removeFCMToken(currentUser.uid, schoolProfile.schoolCode).catch(() => {});
    }
    logoutOneSignalUser().catch(() => {});
    CloudSync.clearActiveSyncEmail();
    StorageService.logout();
    setIsAuthenticated(false);
    setAuthRole('teacher');
    setCurrentAdmin(null);
    showToast('Signed out of School Admin Dashboard.', 'info');
  };

  // 1. School Profile Handler
  const handleSaveProfile = (
    newSchool: SchoolProfile,
    newClass: ClassInfo,
    newTeacher: TeacherInfo
  ) => {
    StorageService.saveSchoolProfile(newSchool);
    StorageService.saveClassInfo(newClass, activeClassId);
    StorageService.saveTeacherInfo(newTeacher);
    setSchool(newSchool);
    setClassInfo(newClass);
    setTeacher(newTeacher);
    setClassesList(StorageService.getClassesList());

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || newSchool.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    const updatedClassItem: ClassItem = {
      id: activeClassId,
      className: newClass.className,
      standard: newClass.standard,
      stream: newClass.stream,
      section: newClass.section,
      academicYear: newClass.academicYear,
      classStrength: existingCls?.classStrength || students.length || newClass.classStrength || 0,
      teacherId: currentTeacher?.id || existingCls?.teacherId || '',
      teacherUid: currentTeacher?.id || existingCls?.teacherUid || '',
      teacherName: currentTeacher?.name || newTeacher.teacherName || '',
      schoolCode: schoolCode,
      isTeacherCreated: true,
      createdByTeacherId: currentTeacher?.id || existingCls?.createdByTeacherId || '',
      createdByTeacherEmail: currentTeacher?.email || currentTeacher?.gmail || existingCls?.createdByTeacherEmail || '',
      createdAt: existingCls?.createdAt || new Date().toISOString()
    };

    CloudSync.saveClassToSchool(schoolCode, updatedClassItem, students).catch(() => {});
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || newTeacher.teacherName || 'Teacher',
      subject: currentTeacher?.subject || newTeacher.designation,
      assignedClass: newClass.className,
      activityType: 'profile_updated',
      description: `Updated Class "${newClass.className}" details (${newClass.standard} ${newClass.stream} ${newClass.section}).`
    }).catch(() => {});

    showToast('School & Class Profile updated successfully!', 'success');
  };

  // 2. Student CRUD Handlers (Scoped to Active Class)
  const handleSaveStudent = (newStudent: Student) => {
    const existing = students.find(s => s.rollNo === newStudent.rollNo);
    if (existing) {
      return { error: `Roll number ${newStudent.rollNo} already belongs to ${existing.name}` };
    }
    const updated = [...students, newStudent];
    StorageService.saveStudents(updated, activeClassId);
    setStudents(updated);
    setClassesList(StorageService.getClassesList());

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    if (existingCls) {
      const updatedCls: ClassItem = {
        ...existingCls,
        classStrength: updated.length,
        schoolCode
      };
      CloudSync.saveClassToSchool(schoolCode, updatedCls, updated).catch(() => {});
    }
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: existingCls?.className || classInfo.className,
      activityType: 'student_added',
      description: `Enrolled student "${newStudent.name}" (Roll #${newStudent.rollNo}) in class.`
    }).catch(() => {});

    showToast(`Student "${newStudent.name}" enrolled!`, 'success');
    return true;
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const existing = students.find(
      s => s.rollNo === updatedStudent.rollNo && s.id !== updatedStudent.id
    );
    if (existing) {
      return { error: `Roll number ${updatedStudent.rollNo} is already used by ${existing.name}` };
    }
    const updated = students.map(s => (s.id === updatedStudent.id ? updatedStudent : s));
    StorageService.saveStudents(updated, activeClassId);
    setStudents(updated);

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    if (existingCls) {
      const updatedCls: ClassItem = {
        ...existingCls,
        classStrength: updated.length,
        schoolCode
      };
      CloudSync.saveClassToSchool(schoolCode, updatedCls, updated).catch(() => {});
    }
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: existingCls?.className || classInfo.className,
      activityType: 'profile_updated',
      description: `Updated details for student "${updatedStudent.name}" (Roll #${updatedStudent.rollNo}).`
    }).catch(() => {});

    showToast(`Student "${updatedStudent.name}" updated!`, 'success');
    return true;
  };

  const handleDeleteStudent = (studentId: string) => {
    const target = students.find(s => s.id === studentId);
    const updated = students.filter(s => s.id !== studentId);
    StorageService.saveStudents(updated, activeClassId);
    setStudents(updated);
    setClassesList(StorageService.getClassesList());

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    if (existingCls) {
      const updatedCls: ClassItem = {
        ...existingCls,
        classStrength: updated.length,
        schoolCode
      };
      CloudSync.saveClassToSchool(schoolCode, updatedCls, updated).catch(() => {});
    }
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: existingCls?.className || classInfo.className,
      activityType: 'profile_updated',
      description: `Removed student record "${target?.name || ''}".`
    }).catch(() => {});

    showToast(`Removed student ${target?.name || ''}`, 'info');
  };

  const handleBulkDeleteStudents = (ids: string[]) => {
    const updated = students.filter(s => !ids.includes(s.id));
    StorageService.saveStudents(updated, activeClassId);
    setStudents(updated);
    setClassesList(StorageService.getClassesList());

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    if (existingCls) {
      const updatedCls: ClassItem = {
        ...existingCls,
        classStrength: updated.length,
        schoolCode
      };
      CloudSync.saveClassToSchool(schoolCode, updatedCls, updated).catch(() => {});
    }
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: existingCls?.className || classInfo.className,
      activityType: 'profile_updated',
      description: `Deleted ${ids.length} student records from class.`
    }).catch(() => {});

    showToast(`Deleted ${ids.length} students.`, 'info');
  };

  const handleImportStudents = (
    newStudentList: Omit<Student, 'id' | 'createdAt'>[],
    replaceAll: boolean
  ) => {
    const fullList: Student[] = newStudentList.map((item, idx) => ({
      ...item,
      id: `st-import-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString()
    }));

    const finalStudents = replaceAll ? fullList : [...students, ...fullList];
    StorageService.saveStudents(finalStudents, activeClassId);
    setStudents(finalStudents);
    setClassesList(StorageService.getClassesList());

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const classes = StorageService.getClassesList();
    const existingCls = classes.find(c => c.id === activeClassId);
    if (existingCls) {
      const updatedCls: ClassItem = {
        ...existingCls,
        classStrength: finalStudents.length,
        schoolCode
      };
      CloudSync.saveClassToSchool(schoolCode, updatedCls, finalStudents).catch(() => {});
    }
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: existingCls?.className || classInfo.className,
      activityType: 'student_added',
      description: `Imported ${fullList.length} students into class roster.`
    }).catch(() => {});

    showToast(`Successfully imported ${fullList.length} students!`, 'success');
  };

  // 3. New Class and Students Handler (Multi-Class Creator)
  const handleSaveClassAndStudents = (
    newClassInfo: ClassInfo,
    newStudents: Student[],
    isAdditionalClass: boolean = true
  ) => {
    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';

    if (isAdditionalClass) {
      const newClassId = `cls-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const classItem: ClassItem = {
        id: newClassId,
        className: newClassInfo.className,
        standard: newClassInfo.standard,
        stream: newClassInfo.stream,
        section: newClassInfo.section,
        academicYear: newClassInfo.academicYear,
        classStrength: newStudents.length,
        teacherId: currentTeacher?.id || '',
        teacherUid: currentTeacher?.id || '',
        teacherName: currentTeacher?.name || '',
        schoolCode: schoolCode,
        isTeacherCreated: true,
        createdByTeacherId: currentTeacher?.id || '',
        createdByTeacherEmail: currentTeacher?.email || currentTeacher?.gmail || '',
        createdAt: new Date().toISOString()
      };

      StorageService.addNewClass(classItem, newStudents);
      CloudSync.saveClassToSchool(schoolCode, classItem, newStudents).catch(() => {});
      CloudSync.recordTeacherActivity(schoolCode, {
        teacherId: currentTeacher?.id || 'teacher',
        teacherName: currentTeacher?.name || 'Teacher',
        subject: currentTeacher?.subject,
        assignedClass: classItem.className,
        activityType: 'student_added',
        description: `Created new Class "${classItem.className}" with ${newStudents.length} students.`
      }).catch(() => {});

      refreshAllState(newClassId);
      showToast(`Created & switched to new class: ${classItem.className} (${newStudents.length} students)!`, 'success');
    } else {
      StorageService.saveClassInfo(newClassInfo, activeClassId);
      StorageService.saveStudents(newStudents, activeClassId);
      const classes = StorageService.getClassesList();
      const existingCls = classes.find(c => c.id === activeClassId);
      const updatedClassItem: ClassItem = {
        id: activeClassId,
        className: newClassInfo.className,
        standard: newClassInfo.standard,
        stream: newClassInfo.stream,
        section: newClassInfo.section,
        academicYear: newClassInfo.academicYear,
        classStrength: newStudents.length,
        teacherId: currentTeacher?.id || existingCls?.teacherId || '',
        teacherUid: currentTeacher?.id || existingCls?.teacherUid || '',
        teacherName: currentTeacher?.name || existingCls?.teacherName || '',
        schoolCode: schoolCode,
        isTeacherCreated: true,
        createdByTeacherId: currentTeacher?.id || existingCls?.createdByTeacherId || '',
        createdByTeacherEmail: currentTeacher?.email || currentTeacher?.gmail || existingCls?.createdByTeacherEmail || '',
        createdAt: existingCls?.createdAt || new Date().toISOString()
      };

      CloudSync.saveClassToSchool(schoolCode, updatedClassItem, newStudents).catch(() => {});
      CloudSync.recordTeacherActivity(schoolCode, {
        teacherId: currentTeacher?.id || 'teacher',
        teacherName: currentTeacher?.name || 'Teacher',
        subject: currentTeacher?.subject,
        assignedClass: newClassInfo.className,
        activityType: 'profile_updated',
        description: `Updated Class "${newClassInfo.className}" roster and details (${newStudents.length} students).`
      }).catch(() => {});

      refreshAllState(activeClassId);
      showToast(`Class "${newClassInfo.className}" updated!`, 'success');
    }
  };

  // Delete Class Handler
  const handleDeleteClass = (classId: string) => {
    const list = StorageService.getClassesList();
    if (list.length <= 1) {
      showToast('Cannot delete the only class in the directory. At least one class is required.', 'warning');
      return;
    }
    const targetClass = list.find(c => c.id === classId);
    const targetName = targetClass?.className || 'Class';
    const wasActive = StorageService.getActiveClassId() === classId;

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';

    StorageService.deleteClass(classId);
    CloudSync.deleteClassFromSchool(schoolCode, classId).catch(() => {});
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: targetName,
      activityType: 'profile_updated',
      description: `Removed Class "${targetName}" from school catalog.`
    }).catch(() => {});

    const updatedList = StorageService.getClassesList();
    const newActive = StorageService.getActiveClassId();
    refreshAllState(newActive);
    showToast(`Class "${targetName}" deleted from directory.${wasActive ? ' Switched to active class: ' + updatedList[0]?.className : ''}`, 'info');
  };

  // 4. Attendance Handlers (Scoped to Active Class)
  const handleSaveAttendance = (record: AttendanceRecord) => {
    StorageService.saveDailyAttendance(record, activeClassId);
    setAttendance(StorageService.getAttendance(activeClassId));

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: classInfo.className,
      activityType: 'attendance',
      description: `Marked attendance for ${record.date} (${record.presentStudentIds?.length || 0} Present, ${record.absentStudentIds?.length || 0} Absent).`
    }).catch(() => {});

    showToast(`Attendance for ${record.date} saved!`, 'success');
  };

  const handleDeleteAttendance = (recordId: string) => {
    const updated = attendance.filter(a => a.id !== recordId);
    StorageService.saveAttendance(updated, activeClassId);
    setAttendance(updated);
    showToast('Attendance record deleted.', 'info');
  };

  // 5. Exam & Mark Handlers (Scoped to Active Class)
  const handleSaveExam = (exam: Exam) => {
    const existingIndex = exams.findIndex(e => e.id === exam.id);
    let updated: Exam[];
    if (existingIndex >= 0) {
      updated = [...exams];
      updated[existingIndex] = exam;
    } else {
      updated = [...exams, exam];
    }
    StorageService.saveExams(updated, activeClassId);
    setExams(updated);

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const totalMaxMarks = exam.subjects?.reduce((sum, s) => sum + (s.maxMarks || 0), 0) || 0;
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: classInfo.className,
      activityType: 'marks_entered',
      description: `Saved examination schedule/details for "${exam.name}" (Max: ${totalMaxMarks}).`
    }).catch(() => {});

    showToast(`Exam "${exam.name}" saved!`, 'success');
  };

  const handleDeleteExam = (examId: string) => {
    const updated = exams.filter(e => e.id !== examId);
    StorageService.saveExams(updated, activeClassId);
    setExams(updated);
    showToast('Exam deleted.', 'info');
  };

  const handleSaveMarksRecord = (examId: string, marksRecord: ExamMarksRecord) => {
    StorageService.saveExamMarks(examId, marksRecord, activeClassId);
    setExamMarksMap(StorageService.getExamMarksMap(activeClassId));

    const session = StorageService.getAuthSession();
    const currentTeacher = session.currentTeacher;
    const schoolCode = currentTeacher?.schoolCode || StorageService.getSchoolProfile().schoolCode || 'SSHSS@111213';
    const targetExam = exams.find(e => e.id === examId);
    CloudSync.recordTeacherActivity(schoolCode, {
      teacherId: currentTeacher?.id || 'teacher',
      teacherName: currentTeacher?.name || 'Teacher',
      subject: currentTeacher?.subject,
      assignedClass: classInfo.className,
      activityType: 'marks_entered',
      description: `Entered and computed marks for "${targetExam?.name || 'Exam'}".`
    }).catch(() => {});

    showToast('Exam marks saved and computed successfully!', 'success');
  };

  // 6. Reminders Handlers
  const handleSaveReminders = (newReminders: Reminder[]) => {
    StorageService.saveReminders(newReminders);
    setReminders(newReminders);
  };

  // 7. Reset & Wipe Handlers
  const handleResetToDefaults = () => {
    StorageService.resetToDefaults();
    refreshAllState();
    showToast('Database reset to clean state successfully!', 'success');
  };

  const handleClearAllData = () => {
    StorageService.clearAllData();
    refreshAllState();
    showToast('All local data wiped.', 'warning');
  };

  // Uncompleted Reminders Count for header badge
  const pendingReminderCount = (reminders || []).filter(r => r && !r.isCompleted).length;

  // Check if current route is School Admin Portal
  const isSchoolAdminRoute =
    currentRoute === '/school-admin' ||
    currentRoute === '/school-admin/' ||
    currentRoute.endsWith('/school-admin') ||
    currentRoute.endsWith('/school-admin/') ||
    (typeof window !== 'undefined' && Boolean(window.location?.search?.includes('portal=school-admin'))) ||
    (typeof window !== 'undefined' && window.location?.hash === '#school-admin');

  // Strict Role-Based Access Guard: Block teacher accounts from /school-admin
  if (isAuthenticated && authRole === 'teacher' && isSchoolAdminRoute) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-slate-100 flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#1A1C23] border border-rose-500/40 shadow-2xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 inline-block">
              Security Restriction • 403 Forbidden
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">Access Denied</h2>
            <p className="text-sm font-semibold text-rose-300">
              Access denied. You do not have permission to access this area.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The School Admin Portal is strictly reserved for School Administrators. Teacher accounts cannot view institutional administration controls or modify school-wide master settings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const targetRoute = import.meta.env.BASE_URL || '/';
              window.history.pushState({}, '', targetRoute);
              setCurrentRoute(targetRoute);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Teacher Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // Render AuthScreen if user is not authenticated
  if (!isAuthenticated) {
    if (showSplash) {
      return <SplashScreen onFinish={() => setShowSplash(false)} />;
    }
    return (
      <>
        <AuthScreen
          onLoginSuccess={handleTeacherLoginSuccess}
          onAdminLoginSuccess={handleAdminLoginSuccess}
        />
        <InstallPromptBanner />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  // Render School Admin Dashboard if authenticated and verified as admin
  if (isAuthenticated && authRole === 'admin' && currentAdmin) {
    return (
      <>
        <SchoolAdminDashboardScreen
          admin={currentAdmin}
          onLogout={handleAdminLogout}
        />
        <InstallPromptBanner />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* 1. App Splash Screen on First Open */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* 2. Top Application Header with Class Switcher */}
      <Header
        schoolName={school.schoolName || "St.Sebastian's Higher Secondary School"}
        schoolCode={school.schoolCode}
        principalName={currentAdmin?.designation || school.designation || school.principalName || 'Principal'}
        classNameStr={classInfo.className || 'Class 12 Science A'}
        classesList={classesList}
        activeClassId={activeClassId}
        teacher={teacher}
        pendingRemindersCount={pendingReminderCount}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenReminders={() => setIsReminderOpen(true)}
        onNavigateHome={() => setActiveTab('dashboard')}
        onSwitchClass={handleSwitchClass}
        onOpenAddClass={() => {
          setAddClassInitialTab('create');
          setIsAddClassOpen(true);
        }}
        onOpenManageClasses={() => {
          setAddClassInitialTab('manage');
          setIsAddClassOpen(true);
        }}
        onDeleteClass={handleDeleteClass}
        onLogout={handleTeacherLogout}
      />

      {/* 3. Main Screen Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-24">
        {activeTab === 'dashboard' && (
          <DashboardScreen
            school={school}
            classInfo={classInfo}
            classesList={classesList}
            activeClassId={activeClassId}
            teacher={teacher}
            students={students}
            attendance={attendance}
            exams={exams}
            examMarksMap={examMarksMap}
            reminders={reminders}
            onNavigate={setActiveTab}
            onOpenReminders={() => setIsReminderOpen(true)}
            onOpenAddClass={() => {
              setAddClassInitialTab('create');
              setIsAddClassOpen(true);
            }}
            onSwitchClass={handleSwitchClass}
            onDeleteClass={handleDeleteClass}
            onOpenSearch={() => setIsSearchOpen(true)}
            onLogout={handleTeacherLogout}
          />
        )}

        {activeTab === 'school_profile' && (
          <SchoolProfileScreen
            school={school}
            classInfo={classInfo}
            teacher={teacher}
            studentCount={students.length}
            onSaveProfile={handleSaveProfile}
            onResetDefaults={handleResetToDefaults}
          />
        )}

        {activeTab === 'students' && (
          <StudentManagementScreen
            students={students}
            attendance={attendance}
            exams={exams}
            examMarksMap={examMarksMap}
            classNameStr={classInfo.className}
            classInfo={classInfo}
            school={school}
            teacher={teacher}
            onSaveStudent={handleSaveStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onBulkDeleteStudents={handleBulkDeleteStudents}
            onImportStudents={handleImportStudents}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceScreen
            school={school}
            classInfo={classInfo}
            teacher={teacher}
            students={students}
            attendanceRecords={attendance}
            onSaveAttendance={handleSaveAttendance}
            onDeleteAttendance={handleDeleteAttendance}
          />
        )}

        {activeTab === 'timetable' && (
          <TimetableScreen
            school={school}
            classInfo={classInfo}
            classesList={classesList}
            teacher={teacher}
            activeClassId={activeClassId}
          />
        )}

        {activeTab === 'exams' && (
          <ExamsScreen
            school={school}
            classInfo={classInfo}
            teacher={teacher}
            students={students}
            exams={exams}
            examMarksMap={examMarksMap}
            onSaveExam={handleSaveExam}
            onDeleteExam={handleDeleteExam}
            onSaveMarksRecord={handleSaveMarksRecord}
          />
        )}

        {activeTab === 'progress' && (
          <ExamProgressScreen
            students={students}
            exams={exams}
            examMarksMap={examMarksMap}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsScreen
            school={school}
            classInfo={classInfo}
            teacher={teacher}
            students={students}
            attendance={attendance}
            exams={exams}
            examMarksMap={examMarksMap}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            school={school}
            classInfo={classInfo}
            classesList={classesList}
            activeClassId={activeClassId}
            teacher={teacher}
            students={students}
            attendance={attendance}
            exams={exams}
            examMarksMap={examMarksMap}
            reminders={reminders}
            onOpenReminderModal={() => setIsReminderOpen(true)}
            onOpenAddClass={() => {
              setAddClassInitialTab('create');
              setIsAddClassOpen(true);
            }}
            onSwitchClass={handleSwitchClass}
            onDeleteClass={handleDeleteClass}
            onDataRestored={() => refreshAllState()}
            onResetToDefaults={handleResetToDefaults}
            onClearAllData={handleClearAllData}
            onLogout={handleTeacherLogout}
          />
        )}
      </main>

      {/* 4. Bottom Tab Bar Navigation */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 5. Universal Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        students={students}
        exams={exams}
        attendance={attendance}
        onClose={() => setIsSearchOpen(false)}
        onSelectStudent={st => {
          setActiveTab('students');
        }}
        onSelectExam={ex => {
          setActiveTab('exams');
        }}
        onNavigate={tab => setActiveTab(tab)}
      />

      {/* 6. Teacher Reminder / Tasks Modal */}
      <ReminderModal
        isOpen={isReminderOpen}
        reminders={reminders}
        onClose={() => setIsReminderOpen(false)}
        onSaveReminder={(newReminder) => {
          const updated = [...reminders, newReminder];
          handleSaveReminders(updated);
        }}
        onToggleComplete={(id) => {
          const updated = reminders.map(r => r.id === id ? { ...r, isCompleted: !r.isCompleted } : r);
          handleSaveReminders(updated);
        }}
        onDeleteReminder={(id) => {
          StorageService.dismissNotificationForTeacher(id);
          const rawId = id.startsWith('rem-broadcast-') ? id.replace('rem-broadcast-', '') : id;
          StorageService.dismissNotificationForTeacher(rawId);
          const updated = reminders.filter(r => r.id !== id && r.id !== rawId);
          handleSaveReminders(updated);
        }}
      />

      {/* 7. Dedicated Add Class & Student Details Modal */}
      <AddClassModal
        isOpen={isAddClassOpen}
        initialTab={addClassInitialTab}
        currentClassInfo={classInfo}
        classesList={classesList}
        activeClassId={activeClassId}
        onClose={() => setIsAddClassOpen(false)}
        onSaveClassAndStudents={handleSaveClassAndStudents}
        onSwitchClass={handleSwitchClass}
        onDeleteClass={handleDeleteClass}
      />

      {/* 8. Notification Permission Banner */}
      <NotificationPermissionBanner />

      {/* 9. In-App PWA Install Prompt Banner */}
      <InstallPromptBanner />

      {/* 10. Toast Message Popups */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
