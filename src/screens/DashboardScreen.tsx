import React, { useState, useMemo } from 'react';
import {
  School,
  Users,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  TrendingUp,
  FileText,
  Settings,
  Sparkles,
  ArrowUpRight,
  UserCheck,
  Award,
  ChevronRight,
  Bell,
  Clock,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  PlusCircle,
  Plus,
  UserPlus,
  BookOpen,
  Layers,
  Check,
  Trash2,
  FolderOpen,
  ArrowRight,
  Radio,
  Cake,
  X,
  Search,
  Star,
  ClipboardCheck,
  ClipboardList,
  MessageSquare,
  Bus,
  Image as ImageIcon,
  Key,
  HelpCircle,
  LogOut,
  User,
  BookMarked,
  PieChart,
  DollarSign,
  Link as LinkIcon
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
import { ScreenTab } from '../components/BottomNav';

interface DashboardScreenProps {
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
  onNavigate: (tab: ScreenTab) => void;
  onOpenReminders: () => void;
  onOpenAddClass: () => void;
  onSwitchClass?: (classId: string) => void;
  onDeleteClass?: (classId: string) => void;
  onOpenSearch?: () => void;
  onLogout?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
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
  onNavigate,
  onOpenReminders,
  onOpenAddClass,
  onSwitchClass,
  onDeleteClass,
  onOpenSearch,
  onLogout
}) => {
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);

  // Calculate today's attendance stats
  const todayStr = new Date().toISOString().split('T')[0];
  const safeAttendance = attendance || [];
  const safeStudents = students || [];
  const safeReminders = reminders || [];
  const safeExams = exams || [];

  const todayAttendance = safeAttendance.find(a => a && a.date === todayStr);
  const presentCount = todayAttendance?.presentStudentIds?.length || 0;
  const totalStudentsCount = safeStudents.length;
  const attendancePercentage = totalStudentsCount > 0 ? Math.round((presentCount / totalStudentsCount) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 animate-fade-in text-gray-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-xl shadow-purple-950/40">
            <School className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              HSS ALL IN ONE
            </h1>
            <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">
              {school.schoolName || "St. Sebastian's Higher Secondary School"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenAddClass}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-950/40 transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>
          <button
            type="button"
            onClick={onOpenReminders}
            className="p-3 rounded-2xl bg-[#1A1C23] border border-[#2D3139] hover:border-purple-500/50 text-slate-300 hover:text-white transition relative cursor-pointer shadow-md"
            title="Notice Board & Reminders"
          >
            <Bell className="w-5 h-5" />
            {safeReminders.filter(r => r && !r.isCompleted).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {safeReminders.filter(r => r && !r.isCompleted).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1A1C23] via-[#22252F] to-[#16181F] border border-[#2D3139] p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-purple-600/20 border-2 border-purple-500/40 overflow-hidden shadow-xl flex items-center justify-center font-black text-2xl sm:text-3xl text-purple-300">
                {teacher.photoUrl ? (
                  <img src={teacher.photoUrl} alt={teacher.teacherName} className="w-full h-full object-cover" />
                ) : (
                  <span>{teacher.teacherName ? teacher.teacherName.charAt(0).toUpperCase() : 'T'}</span>
                )}
              </div>
              <span className="absolute -bottom-1.5 -right-1.5 p-1 rounded-full bg-emerald-500 text-white ring-2 ring-[#1A1C23]" title="Active Account">
                <Check className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[11px] font-extrabold tracking-wider uppercase backdrop-blur-sm border border-purple-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Verified Faculty Portal</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {teacher.teacherName || 'Faculty Member'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-semibold">
                {teacher.designation || 'Class Teacher'}{classInfo.className ? ` • ` : ''}{classInfo.className && <span className="text-purple-300">{classInfo.className}</span>}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {school.schoolName || "St. Sebastian's Higher Secondary School"} {school.schoolCode ? `(${school.schoolCode})` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            <button
              type="button"
              onClick={() => onNavigate('school_profile')}
              className="px-4 py-2.5 rounded-2xl bg-[#252830] hover:bg-[#303440] border border-[#373C48] text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <User className="w-4 h-4 text-purple-400" />
              <span>School Profile</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-950/50 transition flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#1A1C23] border border-[#2D3139] p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Students</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalStudentsCount}</div>
          <div className="text-[11px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
            <span>Enrolled in active class</span>
          </div>
        </div>

        <div className="bg-[#1A1C23] border border-[#2D3139] p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today Attendance</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{attendancePercentage}%</div>
          <div className="text-[11px] text-slate-400 mt-1 font-semibold">
            {presentCount} of {totalStudentsCount} present
          </div>
        </div>

        <div className="bg-[#1A1C23] border border-[#2D3139] p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Exams</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{safeExams.length}</div>
          <div className="text-[11px] text-blue-400 mt-1 font-semibold">
            Term assessments scheduled
          </div>
        </div>

        <div className="bg-[#1A1C23] border border-[#2D3139] p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Notice Board</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{safeReminders.length}</div>
          <div className="text-[11px] text-amber-400 mt-1 font-semibold">
            Active circulars & tasks
          </div>
        </div>
      </div>

      {/* Main Core Features Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Core Management Modules
          </h3>
          <span className="text-xs text-slate-400">Tap any module to open</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Attendance Card */}
          <div
            onClick={() => onNavigate('attendance')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Attendance Management
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mark daily student attendance, track absentees, and view attendance reports.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>Open Attendance</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Students Roster Card */}
          <div
            onClick={() => onNavigate('students')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Students & Roster
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manage student profiles, roll numbers, guardian contacts, and remarks.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>View Students</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Timetable Card */}
          <div
            onClick={() => onNavigate('timetable')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Timetable & Schedule
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Weekly class periods, substitution management, and homework assignments.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>Open Timetable</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Exams & Marks Card */}
          <div
            onClick={() => onNavigate('exams')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Exams & Mark Entry
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter term examination scores, tool marks, and compute student grade rankings.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>Open Mark Entry</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Academic Trajectory Card */}
          <div
            onClick={() => onNavigate('progress')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Academic Trajectory
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Holistic performance graphs, term-over-term comparisons, and progress analytics.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>View Trajectory</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Reports Card */}
          <div
            onClick={() => onNavigate('reports')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Reports & PDF Export
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate and print student report cards, attendance summaries, and fee rosters.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>Open Reports</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Notice Board & Reminders Card */}
          <div
            onClick={onOpenReminders}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                Notice Board & Reminders
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                School circulars, principal announcements, and task reminder lists.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>View Notices</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* School Profile Card */}
          <div
            onClick={() => onNavigate('school_profile')}
            className="bg-[#1A1C23] hover:bg-[#22252E] border border-[#2D3139] hover:border-purple-500/60 p-5 rounded-3xl transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition">
                <School className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-white group-hover:text-purple-300 transition mb-1">
                School Profile & Classes
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure institution details, class streams, subjects, and Teachers directory.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between text-xs font-bold text-purple-400">
              <span>Manage School</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-8 pb-4 border-t border-[#2D3139] text-center space-y-1 text-xs text-slate-500">
        <p className="font-extrabold text-slate-400 tracking-wide uppercase">
          HSS ALL IN ONE
        </p>
        <p>Higher Secondary School Management System • Multi-Device Sync Active</p>
      </footer>
    </div>
  );
};
