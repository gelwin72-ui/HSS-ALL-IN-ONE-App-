import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Users,
  UserCheck,
  UserX,
  Share2,
  Copy,
  Download,
  Phone,
  MessageSquare,
  Calendar,
  Trash2,
  Edit3,
  Sparkles,
  FileText,
  Clock,
  ArrowRight,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import { SchoolProfile, ClassInfo, TeacherInfo, Student, AttendanceRecord } from '../types';
import { generateAbsentReportPDF, generateMonthlyAttendancePDF, generateAttendanceHistoryPDF } from '../utils/pdfGenerator';
import { shareTextContent } from '../utils/pdfGenerator';
import { exportAttendanceToCSV } from '../utils/csvHelper';
import { exportAttendanceToSVG, downloadSVGFile } from '../utils/svgHelper';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import jsPDF from 'jspdf';

interface AttendanceScreenProps {
  school: SchoolProfile;
  classInfo: ClassInfo;
  teacher: TeacherInfo;
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void;
  onDeleteAttendance: (id: string) => void;
}

type TabType = 'mark' | 'absent' | 'history' | 'monthly';

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({
  school,
  classInfo,
  teacher,
  students,
  attendanceRecords,
  onSaveAttendance,
  onDeleteAttendance
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('mark');

  // Selected date for marking (Defaults to current date YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Present/Absent state mapping: studentId -> 'P' | 'A'
  const [attendanceState, setAttendanceState] = useState<Record<string, 'P' | 'A'>>({});
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Month selector for monthly register
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // "YYYY-MM"
  );

  // PDF Preview modal state
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFilename, setPreviewFilename] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Attendance History Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<'class' | 'individual'>('class');
  const [exportStudentId, setExportStudentId] = useState<string>('');
  const [exportRangePreset, setExportRangePreset] = useState<'all' | 'this_month' | 'last_month' | 'custom'>('all');
  const [exportFromDate, setExportFromDate] = useState<string>('');
  const [exportToDate, setExportToDate] = useState<string>('');

  const handleGenerateCustomAttendancePDF = () => {
    if (isGenerating) return;

    let fromD = exportFromDate;
    let toD = exportToDate;
    let periodLabel = 'All Time Recorded Days';

    const today = new Date();

    if (exportRangePreset === 'this_month') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      fromD = `${y}-${m}-01`;
      toD = today.toISOString().split('T')[0];
      periodLabel = `This Month (${fromD} to ${toD})`;
    } else if (exportRangePreset === 'last_month') {
      const prevMDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevM = new Date(today.getFullYear(), today.getMonth(), 0);
      fromD = prevMDate.toISOString().split('T')[0];
      toD = lastDayPrevM.toISOString().split('T')[0];
      periodLabel = `Previous Month (${fromD} to ${toD})`;
    } else if (exportRangePreset === 'custom') {
      periodLabel = `Custom Period (${fromD || 'Start'} to ${toD || 'End'})`;
    }

    setIsGenerating(true);
    setIsExportModalOpen(false);

    setTimeout(() => {
      try {
        const pdf = generateAttendanceHistoryPDF(
          school,
          classInfo,
          teacher,
          students,
          attendanceRecords,
          {
            reportType: exportReportType,
            selectedStudentId: exportStudentId || (students[0]?.id || ''),
            fromDate: fromD,
            toDate: toD,
            periodLabel
          }
        );

        const selStudent = students.find(s => s.id === exportStudentId);
        const title = exportReportType === 'individual'
          ? `Attendance History - ${selStudent ? selStudent.name : 'Student'}`
          : `Classroom Attendance History Report`;

        const filename = exportReportType === 'individual'
          ? `${selStudent ? selStudent.name.replace(/\s+/g, '_') : 'Student'}_Attendance_History.pdf`
          : `${classInfo.className.replace(/\s+/g, '_')}_Attendance_History.pdf`;

        setPreviewTitle(title);
        setPreviewFilename(filename);
        setPreviewDoc(pdf);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  // Delete confirm dialog
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Sorted students list
  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);

  // Load attendance state when selectedDate changes or records update
  useEffect(() => {
    const existing = attendanceRecords.find(r => r.date === selectedDate);
    const initial: Record<string, 'P' | 'A'> = {};

    if (existing) {
      students.forEach(st => {
        if (existing.absentStudentIds && existing.absentStudentIds.includes(st.id)) {
          initial[st.id] = 'A';
        } else {
          initial[st.id] = 'P';
        }
      });
      setAttendanceNotes(existing.notes || '');
    } else {
      // Default all to Present for faster one-tap marking
      students.forEach(st => {
        initial[st.id] = 'P';
      });
      setAttendanceNotes('');
    }

    setAttendanceState(initial);
  }, [selectedDate, attendanceRecords, students]);

  // Live count calculations for currently selected date
  const presentStudents = sortedStudents.filter(st => attendanceState[st.id] !== 'A');
  const absentStudents = sortedStudents.filter(st => attendanceState[st.id] === 'A');
  const totalCount = sortedStudents.length;
  const presentCount = presentStudents.length;
  const absentCount = absentStudents.length;
  const attendancePercentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : '0';

  // Toggle single student attendance
  const toggleAttendance = (studentId: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'A' ? 'P' : 'A'
    }));
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    const next: Record<string, 'P' | 'A'> = {};
    students.forEach(st => {
      next[st.id] = 'P';
    });
    setAttendanceState(next);
  };

  // Mark all absent
  const handleMarkAllAbsent = () => {
    const next: Record<string, 'P' | 'A'> = {};
    students.forEach(st => {
      next[st.id] = 'A';
    });
    setAttendanceState(next);
  };

  // Save Attendance to Storage
  const handleSaveAttendance = () => {
    const presentIds = Object.keys(attendanceState).filter(id => attendanceState[id] === 'P');
    const absentIds = Object.keys(attendanceState).filter(id => attendanceState[id] === 'A');

    const existing = attendanceRecords.find(r => r.date === selectedDate);
    const newRecord: AttendanceRecord = {
      id: existing ? existing.id : `att-${Date.now()}`,
      date: selectedDate,
      presentStudentIds: presentIds,
      absentStudentIds: absentIds,
      notes: attendanceNotes.trim() || undefined,
      savedAt: new Date().toISOString()
    };

    onSaveAttendance(newRecord);
    setSavedSuccessMsg(`Attendance for ${selectedDate} saved successfully! (${presentIds.length} Present, ${absentIds.length} Absent)`);

    setTimeout(() => {
      setSavedSuccessMsg(null);
      if (absentIds.length > 0) {
        setActiveTab('absent');
      }
    }, 1200);
  };

  // Generate text for sharing absent student list (Protects sensitive numbers & admission info)
  const getAbsentListShareText = () => {
    const dateFormatted = new Date(selectedDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    let text = `🏫 *${school.schoolName || 'Higher Secondary School'}*\n`;
    text += `📋 *CLASS ATTENDANCE REPORT*\n`;
    text += `Class: ${classInfo.className}\n`;
    text += `Date: ${dateFormatted}\n`;
    text += `Class Strength: ${totalCount} | Present: ${presentCount} | Absent: ${absentCount}\n\n`;

    if (absentStudents.length === 0) {
      text += `✅ *All Students Were Present Today!*\n`;
    } else {
      text += `🚨 *ABSENT STUDENTS LIST (${absentStudents.length})*:\n`;
      absentStudents.forEach((st, idx) => {
        text += `${idx + 1}. Roll ${st.rollNo}: ${st.name}\n`;
      });
    }

    text += `\nClass Teacher: ${teacher.teacherName}\n`;
    text += `Generated via HSS ALL IN ONE`;
    return text;
  };

  const handleExportAttendanceSVG = () => {
    const svgStr = exportAttendanceToSVG(attendanceRecords, students, classInfo, school, teacher);
    const fileName = `${classInfo.className.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance_Register_Full.svg`;
    downloadSVGFile(svgStr, fileName);
    setSavedSuccessMsg('Attendance Register SVG exported successfully with full details!');
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  const handleShareAbsentList = async () => {
    const text = getAbsentListShareText();
    const shared = await shareTextContent(`Absent List - ${classInfo.className} (${selectedDate})`, text);
    if (shared) {
      setSavedSuccessMsg('Absent student list shared / copied to clipboard!');
      setTimeout(() => setSavedSuccessMsg(null), 2500);
    }
  };

  const handleCopyAbsentList = () => {
    const text = getAbsentListShareText();
    navigator.clipboard.writeText(text);
    setSavedSuccessMsg('Absent list copied to clipboard!');
    setTimeout(() => setSavedSuccessMsg(null), 2500);
  };

  const handleExportAbsentPDF = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const currentRec = attendanceRecords.find(r => r.date === selectedDate) || {
          id: 'preview',
          date: selectedDate,
          presentStudentIds: presentStudents.map(s => s.id),
          absentStudentIds: absentStudents.map(s => s.id),
          savedAt: new Date().toISOString()
        };

        const doc = generateAbsentReportPDF(school, classInfo, teacher, selectedDate, students, currentRec);
        setPreviewDoc(doc);
        setPreviewTitle(`Absent Students Report - ${selectedDate}`);
        setPreviewFilename(`${classInfo.className.replace(/[^a-zA-Z0-9]/g, '_')}_Absent_List_${selectedDate}.pdf`);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleExportMonthlyPDF = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(monthStr, 10) - 1] || 'Month';

        const doc = generateMonthlyAttendancePDF(school, classInfo, teacher, monthName, year, students, attendanceRecords);
        setPreviewDoc(doc);
        setPreviewTitle(`Monthly Attendance Register - ${monthName} ${year}`);
        setPreviewFilename(`${classInfo.className.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance_${monthName}_${year}.pdf`);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in relative">
      {/* Loading Overlay for PDF Generation */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1C23] p-6 rounded-3xl border border-[#2D3139] shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Generating Document...</h3>
            <p className="text-sm text-slate-400">Please wait while the PDF is being compiled.</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
            <CalendarCheck className="w-3.5 h-3.5" /> Daily Roster
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ATTENDANCE MANAGEMENT
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Mark daily attendance, track absentees, and generate monthly registers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportAttendanceSVG}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-sm"
            title="Download Attendance Register as detailed SVG vector graphic (includes full contact & admission numbers)"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>EXPORT SVG</span>
          </button>

          <button
            onClick={() => exportAttendanceToCSV(attendanceRecords, students, classInfo.className)}
            className="px-3.5 py-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:bg-[#252830] text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
            title="Export full attendance register as CSV"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#2D3139] pb-2 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('mark')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'mark'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-emerald-400" />
          <span>MARK ATTENDANCE</span>
        </button>

        <button
          onClick={() => setActiveTab('absent')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'absent'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserX className="w-4 h-4 text-rose-400" />
          <span>ABSENT STUDENTS ({absentCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-blue-400" />
          <span>ATTENDANCE HISTORY ({attendanceRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'monthly'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-purple-400" />
          <span>MONTHLY REGISTER</span>
        </button>
      </div>

      {savedSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: MARK ATTENDANCE */}
      {activeTab === 'mark' && (
        <div className="space-y-6">
          {/* Top Date Picker & Quick Stats Card */}
          <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400">Selected Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="mt-0.5 px-3 py-1.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Fast Bulk Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>MARK ALL PRESENT</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkAllAbsent}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>MARK ALL ABSENT</span>
                </button>
              </div>
            </div>

            {/* Live Stats Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#2D3139]">
              <div className="p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]">
                <span className="text-[11px] text-slate-400 block">Total Students</span>
                <span className="text-xl sm:text-2xl font-extrabold text-white font-mono">{totalCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F1115] border border-emerald-500/30">
                <span className="text-[11px] text-emerald-400 block">Present Count</span>
                <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">{presentCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F1115] border border-rose-500/30">
                <span className="text-[11px] text-rose-400 block">Absent Count</span>
                <span className="text-xl sm:text-2xl font-extrabold text-rose-400 font-mono">{absentCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F1115] border border-purple-500/30">
                <span className="text-[11px] text-purple-400 block">Attendance Rate</span>
                <span className="text-xl sm:text-2xl font-extrabold text-purple-300 font-mono">{attendancePercentage}%</span>
              </div>
            </div>
          </div>

          {/* Students Marking Roster */}
          {sortedStudents.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#1A1C23] border border-[#2D3139] space-y-3">
              <Users className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Students Registered</h3>
              <p className="text-xs text-slate-400">Add students to your class before marking attendance.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Roll & Student Name</span>
                <span>Attendance Status (Tap to toggle)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {sortedStudents.map(student => {
                  const isPresent = attendanceState[student.id] !== 'A';

                  return (
                    <div
                      key={student.id}
                      onClick={() => toggleAttendance(student.id)}
                      className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                        isPresent
                          ? 'bg-[#1A1C23] border-[#2D3139] hover:border-emerald-500/40'
                          : 'bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl font-extrabold flex items-center justify-center text-xs shrink-0 transition ${
                            isPresent
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-rose-500 text-white shadow-md'
                          }`}
                        >
                          {student.rollNo}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${isPresent ? 'text-white' : 'text-rose-200 font-extrabold'}`}>
                            {student.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Adm: {student.admissionNo}
                          </p>
                        </div>
                      </div>

                      {/* Fast Switch Button */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            isPresent
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-600 text-white shadow-md'
                          }`}
                        >
                          {isPresent ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>PRESENT</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>ABSENT</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Save Attendance Button */}
          {sortedStudents.length > 0 && (
            <div className="sticky bottom-20 z-20 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0F1115]/95 backdrop-blur-md p-4 rounded-3xl border border-[#2D3139] shadow-2xl">
              <div className="text-xs text-slate-300">
                <span>Saving attendance for <strong>{selectedDate}</strong>: </span>
                <span className="text-emerald-400 font-bold">{presentCount} Present</span>
                <span>, </span>
                <span className="text-rose-400 font-bold">{absentCount} Absent</span>
              </div>

              <button
                type="button"
                onClick={handleSaveAttendance}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>SAVE ATTENDANCE</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ABSENT STUDENTS */}
      {activeTab === 'absent' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">ABSENT STUDENTS LIST</h2>
                <p className="text-xs text-slate-400">
                  Date: {selectedDate} • Total {absentCount} absentees identified
                </p>
              </div>
            </div>

            {/* Actions for absent list */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAbsentList}
                className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] text-slate-200 border border-[#2D3139] text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>COPY LIST</span>
              </button>

              <button
                type="button"
                onClick={handleShareAbsentList}
                className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>SHARE LIST (ANDROID)</span>
              </button>

              <button
                type="button"
                onClick={handleExportAbsentPDF}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT AS PDF</span>
              </button>
            </div>
          </div>

          {absentStudents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">All Students Present!</h3>
              <p className="text-xs text-slate-400">No absentees were recorded for {selectedDate}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {absentStudents.map(student => (
                  <div
                    key={student.id}
                    className="p-4 rounded-2xl bg-[#0F1115] border border-rose-500/30 shadow-md flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                          {student.rollNo}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{student.name}</h4>
                          <p className="text-xs text-slate-400">Adm: {student.admissionNo}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        ABSENT
                      </span>
                    </div>

                    {/* Parent contact info & instant call/sms */}
                    <div className="pt-2 border-t border-[#2D3139] flex items-center justify-between text-xs">
                      <div className="truncate mr-2">
                        <span className="text-slate-400 block text-[10px]">Parent: {student.parentName || 'Guardian'}</span>
                        <span className="font-mono text-slate-300">{student.parentPhone || student.phone || 'No phone'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {student.parentPhone && (
                          <>
                            <a
                              href={`tel:${student.parentPhone}`}
                              className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
                              title="Call Parent"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Dear Parent, your ward ${student.name} (Roll #${student.rollNo}) was marked absent on ${selectedDate} at ${school.schoolName}. - ${teacher.teacherName}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
                              title="WhatsApp Parent"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">ATTENDANCE HISTORY</h2>
                <p className="text-xs text-slate-400">
                  {attendanceRecords.length} recorded school days in database
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition active:scale-95 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT ATTENDANCE PDF</span>
              </button>
            </div>
          </div>

          {attendanceRecords.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-2">
              <Calendar className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Records Found</h3>
              <p className="text-xs text-slate-400">Saved attendance records will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...attendanceRecords]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(record => {
                  const pCount = Array.isArray(record?.presentStudentIds) ? record.presentStudentIds.length : 0;
                  const aCount = Array.isArray(record?.absentStudentIds) ? record.absentStudentIds.length : 0;
                  const total = pCount + aCount || (students?.length || 0);
                  const pct = total > 0 ? ((pCount / total) * 100).toFixed(1) : '100';

                  return (
                    <div
                      key={record.id}
                      className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-[#1A1C23] border border-[#2D3139] text-purple-400 flex flex-col items-center justify-center font-mono shrink-0">
                          <span className="text-xs font-bold">{record.date.split('-')[2]}</span>
                          <span className="text-[9px] uppercase text-slate-400">
                            {new Date(record.date).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                          </h4>
                          <div className="flex items-center gap-3 text-xs mt-0.5">
                            <span className="text-emerald-400 font-bold font-mono">{pCount} Present</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-rose-400 font-bold font-mono">{aCount} Absent</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-purple-300 font-mono font-semibold">{pct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(record.date);
                            setActiveTab('mark');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(record.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-[#252830] transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MONTHLY REGISTER */}
      {activeTab === 'monthly' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">CLASS ATTENDANCE REPORTS</h2>
                <p className="text-xs text-slate-400">
                  Select month to export full class summary register
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />

              <button
                type="button"
                onClick={handleExportMonthlyPDF}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-purple-900/30 transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT MONTHLY ATTENDANCE PDF</span>
              </button>
            </div>
          </div>

          {/* Monthly Table Summary */}
          <div className="rounded-2xl border border-[#2D3139] overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 uppercase font-semibold border-b border-[#2D3139]">
                <tr>
                  <th className="px-3 py-3">Roll</th>
                  <th className="px-3 py-3">Student Name</th>
                  <th className="px-3 py-3 text-center">Days Present</th>
                  <th className="px-3 py-3 text-center">Days Absent</th>
                  <th className="px-3 py-3 text-center">Attendance %</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3139]/60 font-mono">
                {sortedStudents.map(st => {
                  const monthRecords = attendanceRecords.filter(r => r.date.startsWith(selectedMonth));
                  let p = 0;
                  let a = 0;

                  monthRecords.forEach(rec => {
                    if (rec.presentStudentIds && rec.presentStudentIds.includes(st.id)) p++;
                    else if (rec.absentStudentIds && rec.absentStudentIds.includes(st.id)) a++;
                  });

                  const total = monthRecords.length;
                  const pct = total > 0 ? Number(((p / total) * 100).toFixed(1)) : 100;

                  return (
                    <tr key={st.id} className="hover:bg-[#252830]/40">
                      <td className="px-3 py-2.5 font-bold text-purple-300">{st.rollNo}</td>
                      <td className="px-3 py-2.5 font-sans font-medium text-white">{st.name}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-400 font-bold">{p}</td>
                      <td className="px-3 py-2.5 text-center text-rose-400 font-bold">{a}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-100">{pct}%</td>
                      <td className="px-3 py-2.5 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pct >= 85
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : pct >= 75
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {pct >= 85 ? 'Good' : pct >= 75 ? 'Satisfactory' : 'Shortage'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={!!previewDoc}
        doc={previewDoc}
        title={previewTitle}
        filename={previewFilename}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Attendance History Export Options Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3139] bg-[#0F1115]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">EXPORT ATTENDANCE PDF</h3>
                  <p className="text-xs text-slate-400">Configure report scope and date range</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs sm:text-sm">
              {/* Report Scope Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">1. Select Report Target Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportReportType('class')}
                    className={`p-3 rounded-xl border font-semibold text-center transition ${
                      exportReportType === 'class'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400 hover:text-white'
                    }`}
                  >
                    Classroom (All Students)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportReportType('individual')}
                    className={`p-3 rounded-xl border font-semibold text-center transition ${
                      exportReportType === 'individual'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400 hover:text-white'
                    }`}
                  >
                    Individual Student
                  </button>
                </div>
              </div>

              {/* Individual Student Picker if selected */}
              {exportReportType === 'individual' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Select Student</label>
                  <select
                    value={exportStudentId}
                    onChange={e => setExportStudentId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white focus:outline-none focus:border-purple-500 text-xs sm:text-sm font-semibold"
                  >
                    <option value="">-- Choose Student --</option>
                    {sortedStudents.map(st => (
                      <option key={st.id} value={st.id}>
                        Roll #{st.rollNo} - {st.name} (Adm: {st.admissionNo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">2. Select Date Range</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setExportRangePreset('all')}
                    className={`p-2.5 rounded-xl border font-semibold transition ${
                      exportRangePreset === 'all'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                    }`}
                  >
                    Complete History
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportRangePreset('this_month')}
                    className={`p-2.5 rounded-xl border font-semibold transition ${
                      exportRangePreset === 'this_month'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportRangePreset('last_month')}
                    className={`p-2.5 rounded-xl border font-semibold transition ${
                      exportRangePreset === 'last_month'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportRangePreset('custom')}
                    className={`p-2.5 rounded-xl border font-semibold transition ${
                      exportRangePreset === 'custom'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#0F1115] border-[#2D3139] text-slate-400'
                    }`}
                  >
                    Custom Dates
                  </button>
                </div>
              </div>

              {/* Custom Date Pickers */}
              {exportRangePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">From Date</label>
                    <input
                      type="date"
                      value={exportFromDate}
                      onChange={e => setExportFromDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">To Date</label>
                    <input
                      type="date"
                      value={exportToDate}
                      onChange={e => setExportToDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2D3139] bg-[#0F1115]">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#252830] hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateCustomAttendancePDF}
                disabled={exportReportType === 'individual' && !exportStudentId}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>GENERATE & PREVIEW PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Record Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        title="Delete Attendance Record?"
        message="Are you sure you want to permanently delete this daily attendance entry?"
        confirmLabel="Yes, Delete"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteAttendance(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
