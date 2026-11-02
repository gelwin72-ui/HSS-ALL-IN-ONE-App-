export type Gender = 'male' | 'female' | 'other';

export interface TeacherAccount {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  gmail?: string;
  phone: string;
  schoolName: string;
  schoolCode: string;
  academicYear?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: 'teacher' | 'admin' | 'teacher+admin';
  subject?: string;
  primarySubject?: string;
  standard?: string;
  stream?: string;
  section?: string;
  assignedClass?: string;
  teacherClassId?: string;
  designation: string;
  password?: string;
  specializationSubjects?: string[];
  avatar?: string;
  photoUrl?: string;
  dob?: string; // YYYY-MM-DD
  createdAt: string;
  lastActiveAt?: string;
  recentActivity?: string;
  studentCount?: number;
  attendanceCount?: number;
  examCount?: number;
}

export interface TeacherActivityItem {
  id: string;
  schoolCode: string;
  teacherId: string;
  teacherName: string;
  subject?: string;
  assignedClass?: string;
  activityType: 'signup' | 'login' | 'attendance' | 'student_added' | 'marks_entered' | 'timetable_updated' | 'profile_updated';
  description: string;
  details?: string;
  timestamp: string;
}

export interface SchoolAdminAccount {
  id: string;
  schoolName: string;
  schoolCode: string;
  adminPassword?: string; // Optional password/PIN (managed via Firebase Auth)
  adminName: string;
  designation?: string;
  email?: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  avatar?: string;
  photoUrl?: string;
  role: 'admin';
  createdAt: string;
}

export interface PrincipalBroadcast {
  id: string;
  schoolCode: string;
  senderName: string;
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  category?: 'administrative' | 'academic' | 'exam' | 'meeting' | 'holiday' | 'general';
  targetAudience?: string; // e.g. "All Teachers", "Science Stream", "Class Teachers"
  date: string;
  time: string;
  createdAt: string;
}

export type AuthRole = 'teacher' | 'admin';

export interface AuthSession {
  isLoggedIn: boolean;
  role: AuthRole;
  currentTeacher: TeacherAccount | null;
  currentAdmin: SchoolAdminAccount | null;
}

export interface SchoolProfile {
  schoolName: string;
  schoolAddress: string;
  schoolCode: string;
  schoolPhone: string;
  schoolEmail: string;
  principalName: string;
  principalPhone: string;
  designation?: string;
}

export interface ClassInfo {
  id?: string;
  standard: string; // e.g. "Class 12 (Plus Two)" or "Class 11 (Plus One)"
  stream: string;   // e.g. "Science (Bio-Maths)", "Commerce", "Humanities", "General"
  section: string;  // e.g. "A", "B", "C"
  className: string; // e.g. "Class 12 Science A"
  academicYear: string; // e.g. "2025-2026"
  classStrength: number;
}

export interface ClassItem {
  id: string;
  standard: string;
  stream: string;
  section: string;
  className: string;
  academicYear: string;
  classStrength: number;
  createdAt: string;
  teacherId?: string;
  teacherUid?: string;
  teacherName?: string;
  schoolCode?: string;
  isTeacherCreated?: boolean;
  createdByTeacherId?: string;
  createdByTeacherEmail?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface TeacherInfo {
  teacherName: string;
  phone: string;
  email: string;
  designation: string; // e.g. "HSST Physics", "PGT Mathematics", "Class Teacher"
  avatar?: string;
  photoUrl?: string;
  dob?: string;
  academicYear?: string;
}

export interface Student {
  id: string;
  rollNo: number;
  admissionNo: string;
  name: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  guardianPhone?: string;
  division?: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  address: string;
  bloodGroup?: string;
  notes?: string;
  photoUrl?: string;
  avatar?: string;
  createdAt: string;
  classId?: string;
  teacherId?: string;
  schoolCode?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  presentStudentIds: string[];
  absentStudentIds: string[];
  onDutyStudentIds?: string[];
  notes?: string;
  savedAt: string;
  classId?: string;
  teacherId?: string;
  schoolCode?: string;
}

export interface Subject {
  id: string;
  name: string;
  maxMarks: number;
}

export type ExamType = 'First Terminal' | 'Second Terminal' | 'Mid-Term' | 'Christmas Exam' | 'Model Exam' | 'Unit Test' | 'Annual / Board Exam' | 'Other';

export interface Exam {
  id: string;
  name: string;
  type: ExamType;
  date: string; // YYYY-MM-DD
  academicYear: string;
  subjects: Subject[];
  createdAt: string;
  classId?: string;
  teacherId?: string;
  schoolCode?: string;
}

export interface StudentExamMark {
  studentId: string;
  marks: Record<string, number | null>; // subjectId -> mark
  isAbsent?: Record<string, boolean>;   // subjectId -> isAbsent
  totalObtained?: number;
  totalMax?: number;
  percentage?: number;
  grade?: string;
  rank?: number;
  status?: 'Pass' | 'Fail' | 'Needs Improvement';
}

export interface ExamMarksRecord {
  examId: string;
  marks: Record<string, StudentExamMark>; // studentId -> StudentExamMark
  updatedAt: string;
  classId?: string;
  teacherId?: string;
  schoolCode?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  category: 'attendance' | 'exam' | 'marks' | 'meeting' | 'general';
  priority?: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  createdAt: string;
}

export type GradingSystem = 'kerala_hss' | 'cbse' | 'percentage';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColorKey = 'purple' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'teal' | 'orange' | 'custom';
export type UIAppearance = 'modern' | 'compact' | 'classic' | 'glassmorphism' | 'high_contrast';

export interface AppSettings {
  theme: ThemeMode;
  accentColor?: AccentColorKey;
  customColorHex?: string;
  uiAppearance?: UIAppearance;
  gradingSystem: GradingSystem;
  passingPercentage: number;
  notificationsEnabled: boolean;
  autoBackupPrompt: boolean;
}

export interface AppDataBackup {
  version: string;
  backupDate: string;
  schoolProfile: SchoolProfile;
  classInfo: ClassInfo;
  teacherInfo: TeacherInfo;
  students: Student[];
  attendance: AttendanceRecord[];
  exams: Exam[];
  examMarks: Record<string, ExamMarksRecord>;
  reminders: Reminder[];
  settings: AppSettings;
  timetables?: TimetableSlot[];
}

export type TimetableDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export type TimetablePeriodType = 'lecture' | 'lab' | 'practical' | 'activity' | 'sports' | 'library' | 'remedial' | 'free';

export interface TimetableSlot {
  id: string;
  day: TimetableDay;
  periodNumber: number; // 1 to 8
  startTime: string; // e.g. "09:30 AM"
  endTime: string;   // e.g. "10:15 AM"
  subject: string;
  subjectCode?: string;
  className: string; // e.g. "Class 12 Science A"
  classId?: string;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  roomNumber?: string;
  schoolCode: string;
  type?: TimetablePeriodType;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PeriodTimingConfig {
  periodNumber: number;
  label: string;
  startTime: string;
  endTime: string;
  isBreakAfter?: boolean;
  breakLabel?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  target?: string;
  details?: string;
  status: 'SUCCESS' | 'DENIED' | 'INFO' | 'WARNING' | 'ERROR';
}

