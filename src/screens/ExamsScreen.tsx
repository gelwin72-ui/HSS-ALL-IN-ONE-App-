import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  Download,
  Share2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Info,
  Check,
  X,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { SchoolProfile, ClassInfo, TeacherInfo, Student, Exam, Subject, ExamType, ExamMarksRecord, StudentExamMark } from '../types';
import { computeExamRankings, getGradeColor } from '../utils/calculations';
import { generateExamReportPDF } from '../utils/pdfGenerator';
import { exportExamMarksToCSV } from '../utils/csvHelper';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import jsPDF from 'jspdf';

interface ExamsScreenProps {
  school: SchoolProfile;
  classInfo: ClassInfo;
  teacher: TeacherInfo;
  students: Student[];
  exams: Exam[];
  examMarksMap: Record<string, ExamMarksRecord>;
  onSaveExam: (exam: Exam) => void;
  onDeleteExam: (id: string) => void;
  onSaveMarksRecord: (examId: string, marksRecord: ExamMarksRecord) => void;
}

type TabType = 'entry' | 'create' | 'analytics';

export const ExamsScreen: React.FC<ExamsScreenProps> = ({
  school,
  classInfo,
  teacher,
  students,
  exams,
  examMarksMap,
  onSaveExam,
  onDeleteExam,
  onSaveMarksRecord
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('entry');

  // Currently loaded exam
  const safeExams = exams || [];
  const [selectedExamId, setSelectedExamId] = useState<string>(
    safeExams.length > 0 ? safeExams[0].id : ''
  );
  const [loadedExam, setLoadedExam] = useState<Exam | null>(
    safeExams.length > 0 ? safeExams[0] : null
  );

  // Mark Entry Form in-memory state: studentId -> StudentExamMark
  const [marksState, setMarksState] = useState<Record<string, StudentExamMark>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({}); // key: `${studentId}-${subjectId}`
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Create / Edit Exam Form State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState<ExamType>('First Terminal');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [examAcademicYear, setExamAcademicYear] = useState(classInfo.academicYear || '2025-2026');
  const [subjectsList, setSubjectsList] = useState<Subject[]>([
    { id: 'sub-eng', name: 'English', maxMarks: 100 },
    { id: 'sub-phy', name: 'Physics', maxMarks: 100 },
    { id: 'sub-che', name: 'Chemistry', maxMarks: 100 },
    { id: 'sub-mat', name: 'Mathematics', maxMarks: 100 },
    { id: 'sub-bio', name: 'Biology', maxMarks: 100 },
    { id: 'sub-mal', name: 'Malayalam / Second Lang', maxMarks: 100 }
  ]);
  const [createExamError, setCreateExamError] = useState<string | null>(null);

  // PDF Preview & Dialogs
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFilename, setPreviewFilename] = useState('');
  const [deleteExamTarget, setDeleteExamTarget] = useState<Exam | null>(null);

  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);

  // Synchronize marks when loaded exam changes
  useEffect(() => {
    if (loadedExam) {
      const stored = examMarksMap[loadedExam.id]?.marks || {};
      const initial: Record<string, StudentExamMark> = {};

      students.forEach(st => {
        if (stored[st.id]) {
          initial[st.id] = { ...stored[st.id] };
        } else {
          initial[st.id] = {
            studentId: st.id,
            marks: {},
            isAbsent: {}
          };
        }
      });

      setMarksState(initial);
      setValidationErrors({});
    }
  }, [loadedExam, examMarksMap, students]);

  // Load selected exam
  const handleLoadExam = () => {
    const found = exams.find(e => e.id === selectedExamId);
    if (found) {
      setLoadedExam(found);
      setActiveTab('entry');
      setSavedSuccessMsg(`Exam "${found.name}" loaded successfully!`);
      setTimeout(() => setSavedSuccessMsg(null), 2000);
    }
  };

  // Mark Input Change with validation
  const handleMarkChange = (studentId: string, subjectId: string, maxMarks: number, valueStr: string) => {
    const errorKey = `${studentId}-${subjectId}`;
    const nextErrors = { ...validationErrors };

    if (valueStr === '') {
      delete nextErrors[errorKey];
      setMarksState(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          marks: { ...prev[studentId]?.marks, [subjectId]: null },
          isAbsent: { ...prev[studentId]?.isAbsent, [subjectId]: false }
        }
      }));
      setValidationErrors(nextErrors);
      return;
    }

    const num = Number(valueStr);

    if (isNaN(num)) {
      nextErrors[errorKey] = 'Invalid number';
    } else if (num < 0) {
      nextErrors[errorKey] = 'Cannot be negative';
    } else if (num > maxMarks) {
      nextErrors[errorKey] = `Max is ${maxMarks}`;
    } else {
      delete nextErrors[errorKey];
    }

    setValidationErrors(nextErrors);

    setMarksState(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marks: { ...prev[studentId]?.marks, [subjectId]: isNaN(num) ? null : num },
        isAbsent: { ...prev[studentId]?.isAbsent, [subjectId]: false }
      }
    }));
  };

  // Toggle Absent for Subject
  const handleToggleSubjectAbsent = (studentId: string, subjectId: string) => {
    const currentAbs = marksState[studentId]?.isAbsent?.[subjectId] ?? false;
    const errorKey = `${studentId}-${subjectId}`;
    const nextErrors = { ...validationErrors };
    delete nextErrors[errorKey];
    setValidationErrors(nextErrors);

    setMarksState(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marks: { ...prev[studentId]?.marks, [subjectId]: null },
        isAbsent: { ...prev[studentId]?.isAbsent, [subjectId]: !currentAbs }
      }
    }));
  };

  // Save All Marks to storage
  const handleSaveAllMarks = () => {
    if (!loadedExam) return;

    if (Object.keys(validationErrors).length > 0) {
      alert('Please correct the highlighted mark validation errors before saving.');
      return;
    }

    // Compute all student totals and ranks
    const rankingData = computeExamRankings(loadedExam, sortedStudents, marksState);

    const updatedRecord: ExamMarksRecord = {
      examId: loadedExam.id,
      marks: rankingData.processedMarks,
      updatedAt: new Date().toISOString()
    };

    onSaveMarksRecord(loadedExam.id, updatedRecord);
    setMarksState(rankingData.processedMarks);
    setSavedSuccessMsg(`Marks for "${loadedExam.name}" saved and ranked successfully!`);
    setTimeout(() => setSavedSuccessMsg(null), 2500);
  };

  // Save / Create Exam
  const handleSaveExamForm = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateExamError(null);

    if (!examName.trim()) {
      setCreateExamError('Please enter an exam title.');
      return;
    }

    if (subjectsList.length === 0) {
      setCreateExamError('Please add at least one subject with maximum marks.');
      return;
    }

    for (const sub of subjectsList) {
      if (!sub.name.trim()) {
        setCreateExamError('Subject name cannot be empty.');
        return;
      }
      if (!sub.maxMarks || sub.maxMarks <= 0) {
        setCreateExamError(`Maximum marks for "${sub.name}" must be greater than 0.`);
        return;
      }
    }

    const examId = editingExamId || `exam-${Date.now()}`;
    const newExam: Exam = {
      id: examId,
      name: examName.trim(),
      type: examType,
      date: examDate,
      academicYear: examAcademicYear.trim() || classInfo.academicYear,
      subjects: subjectsList,
      createdAt: new Date().toISOString()
    };

    onSaveExam(newExam);
    setLoadedExam(newExam);
    setSelectedExamId(newExam.id);
    setEditingExamId(null);
    setActiveTab('entry');
    setSavedSuccessMsg(`Exam "${newExam.name}" configured and saved!`);
    setTimeout(() => setSavedSuccessMsg(null), 2500);
  };

  // Add Subject row
  const handleAddSubject = () => {
    const nextId = `sub-${Date.now()}-${subjectsList.length + 1}`;
    setSubjectsList([...subjectsList, { id: nextId, name: '', maxMarks: 100 }]);
  };

  // Remove Subject row
  const handleRemoveSubject = (id: string) => {
    setSubjectsList(subjectsList.filter(s => s.id !== id));
  };

  // Open Edit Exam form
  const handleOpenEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setExamName(exam.name);
    setExamType(exam.type);
    setExamDate(exam.date);
    setExamAcademicYear(exam.academicYear);
    setSubjectsList([...exam.subjects]);
    setCreateExamError(null);
    setActiveTab('create');
  };

  // Subject presets for Higher Secondary Streams
  const applySubjectPreset = (preset: 'science' | 'commerce' | 'humanities') => {
    if (preset === 'science') {
      setSubjectsList([
        { id: 'sub-eng', name: 'English', maxMarks: 100 },
        { id: 'sub-phy', name: 'Physics', maxMarks: 100 },
        { id: 'sub-che', name: 'Chemistry', maxMarks: 100 },
        { id: 'sub-mat', name: 'Mathematics', maxMarks: 100 },
        { id: 'sub-bio', name: 'Biology', maxMarks: 100 },
        { id: 'sub-mal', name: 'Malayalam / Second Lang', maxMarks: 100 }
      ]);
    } else if (preset === 'commerce') {
      setSubjectsList([
        { id: 'sub-eng', name: 'English', maxMarks: 100 },
        { id: 'sub-acc', name: 'Accountancy', maxMarks: 100 },
        { id: 'sub-bst', name: 'Business Studies', maxMarks: 100 },
        { id: 'sub-eco', name: 'Economics', maxMarks: 100 },
        { id: 'sub-ca', name: 'Computer Application', maxMarks: 100 },
        { id: 'sub-mal', name: 'Malayalam / Second Lang', maxMarks: 100 }
      ]);
    } else if (preset === 'humanities') {
      setSubjectsList([
        { id: 'sub-eng', name: 'English', maxMarks: 100 },
        { id: 'sub-his', name: 'History', maxMarks: 100 },
        { id: 'sub-pol', name: 'Political Science', maxMarks: 100 },
        { id: 'sub-soc', name: 'Sociology', maxMarks: 100 },
        { id: 'sub-geo', name: 'Geography', maxMarks: 100 },
        { id: 'sub-mal', name: 'Malayalam / Second Lang', maxMarks: 100 }
      ]);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);

  // Export PDF
  const handleExportPDF = () => {
    if (!loadedExam || isGenerating) return;
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const doc = generateExamReportPDF(school, classInfo, teacher, loadedExam, students, examMarksMap[loadedExam.id]);
        setPreviewDoc(doc);
        setPreviewTitle(`Exam Tabulation Sheet: ${loadedExam.name}`);
        setPreviewFilename(`${loadedExam.name.replace(/[^a-zA-Z0-9]/g, '_')}_Marksheet.pdf`);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  // Compute live ranking & class metrics for loaded exam
  const calculatedRanking = loadedExam
    ? computeExamRankings(loadedExam, sortedStudents, marksState)
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-fade-in relative">
      {/* Loading Overlay for PDF Generation */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1C23] p-6 rounded-3xl border border-[#2D3139] shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-4 animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Compiling Marks Tabulation...</h3>
            <p className="text-sm text-slate-400">Please wait while the official PDF is being generated.</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 mb-1">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Examination & Evaluation
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            EXAM & MARK MANAGEMENT
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Configure exams, dynamic subject maximum marks, and enter student marks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingExamId(null);
              setExamName('');
              setActiveTab('create');
            }}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-orange-900/30 transition flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE EXAM</span>
          </button>

          {loadedExam && (
            <button
              onClick={() => exportExamMarksToCSV(loadedExam, examMarksMap[loadedExam.id], students)}
              className="px-3.5 py-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:bg-[#252830] text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT CSV</span>
            </button>
          )}

          {loadedExam && (
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs sm:text-sm font-bold transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>EXPORT PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Instruction Notice Banner */}
      <div className="p-4 rounded-2xl bg-orange-950/40 border border-orange-500/40 flex items-start gap-3 text-xs text-orange-200">
        <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-orange-300 text-sm">Teacher Instruction:</p>
          <p className="mt-0.5 leading-relaxed">
            Please use the same subject name for all exams. Don't forget to set the maximum mark.
          </p>
        </div>
      </div>

      {/* Exam Selector & Load Bar */}
      <div className="p-4 rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">
            Select an exam and click LOAD for mark entry:
          </label>
          <select
            value={selectedExamId}
            onChange={e => setSelectedExamId(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm font-bold text-white focus:outline-none focus:border-purple-500"
          >
            {exams.length === 0 ? (
              <option value="">No exams created yet</option>
            ) : (
              exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.type} • {ex.date})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadExam}
            disabled={!selectedExamId}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-900/40 transition active:scale-95 disabled:opacity-50"
          >
            LOAD
          </button>

          {loadedExam && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEditExam(loadedExam)}
                className="p-2.5 rounded-xl bg-[#252830] text-slate-300 hover:text-white transition"
                title="Edit Exam & Subjects"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteExamTarget(loadedExam)}
                className="p-2.5 rounded-xl bg-[#252830] text-slate-400 hover:text-rose-400 transition"
                title="Delete Exam"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2D3139] pb-2 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'entry'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-orange-400" />
          <span>MARK ENTRY & TABULATION</span>
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'create'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>{editingExamId ? 'EDIT EXAM & SUBJECTS' : 'CREATE NEW EXAM'}</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4 text-purple-400" />
          <span>CLASS STATISTICS & RANKERS</span>
        </button>
      </div>

      {/* TAB 1: MARK ENTRY & TABULATION */}
      {activeTab === 'entry' && (
        <div className="space-y-6">
          {!loadedExam ? (
            <div className="p-12 text-center rounded-3xl bg-[#1A1C23] border border-[#2D3139] space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Exam Loaded</h3>
              <p className="text-xs text-slate-400">Select an exam from the dropdown above and click LOAD.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Loaded Exam Header info */}
              <div className="p-4 rounded-2xl bg-[#1A1C23] border border-[#2D3139] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Loaded Exam:</span>
                  <span className="font-extrabold text-white text-sm">{loadedExam.name}</span>
                  <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20">
                    {loadedExam.type}
                  </span>
                  <span className="text-slate-400 font-mono">Date: {loadedExam.date}</span>
                </div>

                <div className="text-slate-400 font-mono">
                  {loadedExam.subjects.length} Subjects • Max Total: {loadedExam.subjects.reduce((sum, s) => sum + s.maxMarks, 0)}
                </div>
              </div>

              {/* Mark Entry Table */}
              <div className="rounded-3xl border border-[#2D3139] bg-[#1A1C23] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-[#0F1115] text-slate-400 uppercase font-bold border-b border-[#2D3139] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-3 w-14 text-center">Roll</th>
                        <th className="px-4 py-3 min-w-[160px]">Student Name</th>
                        {loadedExam.subjects.map(sub => (
                          <th key={sub.id} className="px-3 py-3 text-center min-w-[105px]">
                            <div>{sub.name}</div>
                            <div className="text-[10px] font-normal text-purple-400">Max {sub.maxMarks}</div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center min-w-[70px]">Total</th>
                        <th className="px-3 py-3 text-center min-w-[65px]">%</th>
                        <th className="px-3 py-3 text-center min-w-[60px]">Grade</th>
                        <th className="px-3 py-3 text-center min-w-[55px]">Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]/80">
                      {sortedStudents.map(student => {
                        const markRecord = calculatedRanking?.processedMarks[student.id];
                        const studentTotals = markRecord || { totalObtained: 0, totalMax: 0, percentage: 0, grade: 'E', rank: '-' };

                        return (
                          <tr key={student.id} className="hover:bg-[#252830]/40 transition">
                            <td className="px-3 py-3 text-center font-bold text-purple-300 font-mono">
                              {student.rollNo}
                            </td>
                            <td className="px-4 py-3 font-semibold text-white">
                              <div>{student.name}</div>
                              <div className="text-[10px] font-mono text-slate-500 font-normal">
                                {student.admissionNo}
                              </div>
                            </td>

                            {/* Subject Mark Inputs */}
                            {loadedExam.subjects.map(sub => {
                              const errKey = `${student.id}-${sub.id}`;
                              const hasError = !!validationErrors[errKey];
                              const isAbsent = marksState[student.id]?.isAbsent?.[sub.id] ?? false;
                              const currentVal = marksState[student.id]?.marks?.[sub.id];
                              const displayVal = currentVal !== undefined && currentVal !== null ? currentVal.toString() : '';

                              return (
                                <td key={sub.id} className="px-2 py-2 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max={sub.maxMarks}
                                      disabled={isAbsent}
                                      value={isAbsent ? '' : displayVal}
                                      placeholder={isAbsent ? 'AB' : '0'}
                                      onChange={e => handleMarkChange(student.id, sub.id, sub.maxMarks, e.target.value)}
                                      className={`w-16 px-2 py-1.5 rounded-xl text-center text-xs font-mono font-bold transition focus:outline-none ${
                                        isAbsent
                                          ? 'bg-rose-950/40 border border-rose-500/40 text-rose-400 placeholder-rose-400'
                                          : hasError
                                          ? 'bg-rose-950/60 border-2 border-rose-500 text-rose-200'
                                          : 'bg-[#0F1115] border border-[#2D3139] text-white focus:border-purple-500'
                                      }`}
                                    />
                                    {hasError && (
                                      <span className="text-[9px] text-rose-400 font-semibold">{validationErrors[errKey]}</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSubjectAbsent(student.id, sub.id)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition ${
                                        isAbsent
                                          ? 'bg-rose-600 text-white'
                                          : 'text-slate-500 hover:text-slate-300 hover:bg-[#252830]'
                                      }`}
                                    >
                                      {isAbsent ? 'ABSENT' : 'Mark AB'}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}

                            {/* Calculated Totals */}
                            <td className="px-3 py-3 text-center font-mono font-bold text-white">
                              {studentTotals.totalObtained}
                              <div className="text-[9px] text-slate-500 font-normal">/ {studentTotals.totalMax}</div>
                            </td>
                            <td className="px-3 py-3 text-center font-mono font-bold text-cyan-300">
                              {studentTotals.percentage}%
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-extrabold font-mono border ${getGradeColor(
                                  studentTotals.grade || 'E'
                                )}`}
                              >
                                {studentTotals.grade || 'E'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-mono font-extrabold text-amber-400">
                              {studentTotals.rank ? `#${studentTotals.rank}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="sticky bottom-20 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0F1115]/95 backdrop-blur-md p-4 rounded-3xl border border-[#2D3139] shadow-2xl">
                <div className="text-xs text-slate-300">
                  <span>Class Tabulation for <strong>{loadedExam.name}</strong> • </span>
                  <span className="text-purple-300 font-bold">{sortedStudents.length} Students Evaluated</span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAllMarks}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-orange-600 via-purple-600 to-indigo-600 hover:from-orange-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-950/50 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  <span>SAVE ALL STUDENT MARKS</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE / EDIT EXAM */}
      {activeTab === 'create' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingExamId ? 'Edit Exam & Subject Roster' : 'Create New Examination'}
                </h2>
                <p className="text-xs text-slate-400">
                  Set exam title, academic year, and configure subject maximum marks.
                </p>
              </div>
            </div>
            {editingExamId && (
              <button
                onClick={() => {
                  setEditingExamId(null);
                  setActiveTab('entry');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {createExamError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{createExamError}</span>
            </div>
          )}

          <form onSubmit={handleSaveExamForm} className="space-y-6">
            {/* Exam Basic Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Name *</label>
                <input
                  type="text"
                  required
                  value={examName}
                  onChange={e => setExamName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. First Terminal Examination 2025"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Type</label>
                <select
                  value={examType}
                  onChange={e => setExamType(e.target.value as ExamType)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="First Terminal">First Terminal</option>
                  <option value="Second Terminal">Second Terminal</option>
                  <option value="Mid-Term">Mid-Term</option>
                  <option value="Christmas Exam">Christmas Exam</option>
                  <option value="Model Exam">Model Exam</option>
                  <option value="Unit Test">Unit Test</option>
                  <option value="Annual / Board Exam">Annual / Board Exam</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Subject Presets */}
            <div className="pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Manage Subjects & Maximum Marks ({subjectsList.length})
                </label>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => applySubjectPreset('science')}
                    className="px-2 py-1 rounded-lg bg-[#0F1115] border border-[#2D3139] hover:bg-[#252830] text-purple-300 text-[11px]"
                  >
                    Science
                  </button>
                  <button
                    type="button"
                    onClick={() => applySubjectPreset('commerce')}
                    className="px-2 py-1 rounded-lg bg-[#0F1115] border border-[#2D3139] hover:bg-[#252830] text-blue-300 text-[11px]"
                  >
                    Commerce
                  </button>
                  <button
                    type="button"
                    onClick={() => applySubjectPreset('humanities')}
                    className="px-2 py-1 rounded-lg bg-[#0F1115] border border-[#2D3139] hover:bg-[#252830] text-emerald-300 text-[11px]"
                  >
                    Humanities
                  </button>
                </div>
              </div>

              {/* Dynamic Subject Rows */}
              <div className="space-y-2.5">
                {subjectsList.map((subject, idx) => (
                  <div
                    key={subject.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139]"
                  >
                    <span className="w-6 text-center text-xs font-bold text-slate-500 font-mono">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Subject Name (e.g. Physics)"
                      value={subject.name}
                      onChange={e => {
                        const updated = [...subjectsList];
                        updated[idx].name = e.target.value;
                        setSubjectsList(updated);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Max Mark:</span>
                      <input
                        type="number"
                        min="1"
                        required
                        value={subject.maxMarks}
                        onChange={e => {
                          const updated = [...subjectsList];
                          updated[idx].maxMarks = parseInt(e.target.value, 10) || 0;
                          setSubjectsList(updated);
                        }}
                        className="w-20 px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm font-mono font-bold text-purple-300 text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(subject.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#252830] transition"
                      title="Remove Subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSubject}
                className="mt-3 w-full py-2.5 rounded-2xl border-2 border-dashed border-[#2D3139] hover:border-purple-500/40 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>ADD SUBJECT</span>
              </button>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2D3139]">
              <button
                type="button"
                onClick={() => {
                  setEditingExamId(null);
                  setActiveTab('entry');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#252830] text-slate-300 text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-purple-900/30 transition active:scale-95 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>SAVE EXAM</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CLASS STATISTICS & RANKERS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {!calculatedRanking ? (
            <div className="p-12 text-center rounded-3xl bg-[#1A1C23] border border-[#2D3139] space-y-2">
              <Award className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Exam Loaded</h3>
              <p className="text-xs text-slate-400">Load an exam to view class statistics and top rankers.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top 4 Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#1A1C23] border border-[#2D3139]">
                  <span className="text-xs text-slate-400 block">Class Average</span>
                  <span className="text-2xl font-extrabold text-purple-400 font-mono">{calculatedRanking.classAverage}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#1A1C23] border border-emerald-500/30">
                  <span className="text-xs text-emerald-400 block">Highest Mark</span>
                  <span className="text-2xl font-extrabold text-emerald-300 font-mono">{calculatedRanking.highestMark}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#1A1C23] border border-rose-500/30">
                  <span className="text-xs text-rose-400 block">Lowest Mark</span>
                  <span className="text-2xl font-extrabold text-rose-300 font-mono">{calculatedRanking.lowestMark}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#1A1C23] border border-cyan-500/30">
                  <span className="text-xs text-cyan-400 block">Pass Percentage</span>
                  <span className="text-2xl font-extrabold text-cyan-300 font-mono">{calculatedRanking.passPercentage}%</span>
                </div>
              </div>

              {/* Top 3 Rankers Podium */}
              <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Top Rankers Podium — {loadedExam?.name}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {calculatedRanking.topRankers.map((ranker, index) => (
                    <div
                      key={ranker.student.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${
                        index === 0
                          ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/30'
                          : index === 1
                          ? 'bg-[#0F1115] border-[#2D3139]'
                          : 'bg-orange-950/20 border-orange-600/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl font-extrabold flex items-center justify-center text-xs text-white ${
                              index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-500' : 'bg-orange-600'
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{ranker.student.name}</h4>
                            <p className="text-[11px] text-slate-400 font-mono">Roll #{ranker.student.rollNo}</p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold font-mono text-white">
                          {ranker.mark.percentage}%
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#2D3139] flex items-center justify-between text-xs text-slate-400">
                        <span>Total: {ranker.mark.totalObtained} / {ranker.mark.totalMax}</span>
                        <span className="font-bold text-emerald-400">Grade {ranker.mark.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject-Wise Performance Breakdown */}
              <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span>Subject-Wise Performance Breakdown</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {Object.entries(calculatedRanking.subjectStats).map(([subId, stat]) => (
                    <div key={subId} className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">{stat.subjectName}</h4>
                        <span className="text-slate-400 font-mono">Max {stat.maxMarks}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div className="p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-slate-500 block text-[10px]">Average Mark</span>
                          <span className="font-bold text-purple-300">{stat.average} / {stat.maxMarks}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-slate-500 block text-[10px]">Highest Mark</span>
                          <span className="font-bold text-emerald-400">{stat.highest}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-slate-500 block text-[10px]">Passed Students</span>
                          <span className="font-bold text-blue-300">{stat.passCount}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                          <span className="text-slate-500 block text-[10px]">Failed / Needs Imprv</span>
                          <span className="font-bold text-rose-400">{stat.failCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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

      {/* Delete Exam Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteExamTarget}
        title="Delete Examination?"
        message={`Are you sure you want to permanently delete "${deleteExamTarget?.name}" and all recorded student marks for this exam?`}
        confirmLabel="Yes, Delete Exam"
        isDestructive={true}
        onConfirm={() => {
          if (deleteExamTarget) {
            onDeleteExam(deleteExamTarget.id);
            if (loadedExam?.id === deleteExamTarget.id) {
              setLoadedExam(null);
            }
            setDeleteExamTarget(null);
          }
        }}
        onCancel={() => setDeleteExamTarget(null)}
      />
    </div>
  );
};
