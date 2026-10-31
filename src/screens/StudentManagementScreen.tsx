import React, { useState, useRef } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  ArrowUpDown,
  Trash2,
  Edit2,
  Eye,
  Phone,
  Calendar,
  MapPin,
  Heart,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  X,
  Check,
  Share2,
  AlertTriangle,
  FileCode,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { Student, Gender, AttendanceRecord, Exam, ExamMarksRecord, SchoolProfile, ClassInfo, TeacherInfo } from '../types';
import { parseStudentsCSV, downloadSampleStudentCSV, exportStudentsToCSV, CSVParseResult } from '../utils/csvHelper';
import { exportStudentsToSVG, parseStudentsSVG, downloadSVGFile } from '../utils/svgHelper';
import { extractTextFromPDF, parseStudentsPDF } from '../utils/pdfHelper';
import { calculateStudentAttendanceStats } from '../utils/calculations';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StudentCameraModal } from '../components/StudentCameraModal';

interface StudentManagementScreenProps {
  students: Student[];
  attendance: AttendanceRecord[];
  exams: Exam[];
  examMarksMap: Record<string, ExamMarksRecord>;
  classNameStr: string;
  classInfo?: ClassInfo;
  school?: SchoolProfile;
  teacher?: TeacherInfo;
  onSaveStudent: (student: Student) => boolean | { error: string };
  onUpdateStudent: (student: Student) => boolean | { error: string };
  onDeleteStudent: (id: string) => void;
  onBulkDeleteStudents: (ids: string[]) => void;
  onImportStudents: (newStudents: Omit<Student, 'id' | 'createdAt'>[], replaceAll: boolean) => void;
}

type TabType = 'list' | 'add' | 'import';

export const StudentManagementScreen: React.FC<StudentManagementScreenProps> = ({
  students,
  attendance,
  exams,
  examMarksMap,
  classNameStr,
  classInfo,
  school,
  teacher,
  onSaveStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onImportStudents
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('list');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'roll' | 'name'>('roll');

  // Modals & Selected items
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Add/Edit Form state
  const [formRollNo, setFormRollNo] = useState<string>('');
  const [formAdmissionNo, setFormAdmissionNo] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formParentName, setFormParentName] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [formGender, setFormGender] = useState<Gender>('male');
  const [formDob, setFormDob] = useState('2008-05-15');
  const [formAddress, setFormAddress] = useState('');
  const [formBloodGroup, setFormBloodGroup] = useState('O+');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Camera Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTargetStudent, setCameraTargetStudent] = useState<Student | null>(null);
  const [isFormCamera, setIsFormCamera] = useState(false);

  // File Import State (PDF / CSV / SVG)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgFileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const formPhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importedFileType, setImportedFileType] = useState<'csv' | 'svg' | 'pdf'>('csv');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [rawFileText, setRawFileText] = useState('');
  const [importReplaceAll, setImportReplaceAll] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Open add form with next suggested roll number
  const handleOpenAddForm = () => {
    const maxRoll = students.length > 0 ? Math.max(...students.map(s => s.rollNo)) : 0;
    const nextRoll = maxRoll + 1;
    setFormRollNo(nextRoll.toString());
    setFormAdmissionNo(`ADM-2025-${String(nextRoll).padStart(3, '0')}`);
    setFormName('');
    setFormPhone('');
    setFormParentName('');
    setFormParentPhone('');
    setFormGender('male');
    setFormDob('2008-01-01');
    setFormAddress('');
    setFormBloodGroup('O+');
    setFormNotes('');
    setFormPhotoUrl('');
    setFormError(null);
    setEditingStudent(null);
    setActiveTab('add');
  };

  // Open edit modal for an existing student
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormRollNo(student.rollNo.toString());
    setFormAdmissionNo(student.admissionNo);
    setFormName(student.name);
    setFormPhone(student.phone || '');
    setFormParentName(student.parentName || '');
    setFormParentPhone(student.parentPhone || '');
    setFormGender(student.gender);
    setFormDob(student.dob || '2008-01-01');
    setFormAddress(student.address || '');
    setFormBloodGroup(student.bloodGroup || 'O+');
    setFormNotes(student.notes || '');
    setFormPhotoUrl(student.photoUrl || student.avatar || '');
    setFormError(null);
    setActiveTab('add');
  };

  // Quick Camera Launch for a student
  const handleLaunchCameraForStudent = (student: Student) => {
    setCameraTargetStudent(student);
    setIsFormCamera(false);
    setIsCameraOpen(true);
  };

  // Form Camera Launch
  const handleLaunchCameraForForm = () => {
    setCameraTargetStudent(null);
    setIsFormCamera(true);
    setIsCameraOpen(true);
  };

  // Handle Photo Captured from Camera or Upload
  const handlePhotoCaptured = (photoDataUrl: string) => {
    if (isFormCamera) {
      setFormPhotoUrl(photoDataUrl);
    } else if (cameraTargetStudent) {
      const updated: Student = {
        ...cameraTargetStudent,
        photoUrl: photoDataUrl
      };
      onUpdateStudent(updated);
      if (selectedStudent && selectedStudent.id === cameraTargetStudent.id) {
        setSelectedStudent(updated);
      }
      setFormSuccess(`Profile photo updated for ${cameraTargetStudent.name}!`);
      setTimeout(() => setFormSuccess(null), 2500);
    }
  };

  // Form Photo Upload from File
  const handleFormPhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 400, 400);
          setFormPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Add / Edit Form
  const handleSubmitStudentForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rollNoInt = parseInt(formRollNo, 10);
    if (isNaN(rollNoInt) || rollNoInt <= 0) {
      setFormError('Please enter a valid positive Roll Number.');
      return;
    }

    if (!formName.trim()) {
      setFormError('Student full name is required.');
      return;
    }

    // Check duplicate roll number (if adding new, or if editing and changed roll number)
    const existingSameRoll = students.find(s => s.rollNo === rollNoInt && (!editingStudent || s.id !== editingStudent.id));
    if (existingSameRoll) {
      setFormError(`Roll Number ${rollNoInt} is already assigned to "${existingSameRoll.name}". Roll numbers must be unique.`);
      return;
    }

    const studentData: Student = {
      id: editingStudent ? editingStudent.id : `st-${Date.now()}`,
      rollNo: rollNoInt,
      admissionNo: formAdmissionNo.trim() || `ADM-${1000 + rollNoInt}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      parentName: formParentName.trim(),
      parentPhone: formParentPhone.trim(),
      gender: formGender,
      dob: formDob,
      address: formAddress.trim(),
      bloodGroup: formBloodGroup,
      notes: formNotes.trim(),
      photoUrl: formPhotoUrl || undefined,
      createdAt: editingStudent ? editingStudent.createdAt : new Date().toISOString()
    };

    if (editingStudent) {
      const res = onUpdateStudent(studentData);
      if (typeof res === 'object' && res.error) {
        setFormError(res.error);
        return;
      }
      setFormSuccess(`Updated details for "${studentData.name}" successfully!`);
    } else {
      const res = onSaveStudent(studentData);
      if (typeof res === 'object' && res.error) {
        setFormError(res.error);
        return;
      }
      setFormSuccess(`Student "${studentData.name}" added successfully!`);
    }

    setTimeout(() => {
      setFormSuccess(null);
      setActiveTab('list');
      setEditingStudent(null);
    }, 1200);
  };

  // File reading (CSV / SVG)
  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileType('csv');
    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setRawFileText(text);
      const existingRolls = importReplaceAll ? [] : students.map(s => s.rollNo);
      const result = parseStudentsCSV(text, existingRolls);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handleSVGFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileType('svg');
    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setRawFileText(text);
      const existingRolls = importReplaceAll ? [] : students.map(s => s.rollNo);
      const result = parseStudentsSVG(text, existingRolls);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handlePDFFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileType('pdf');
    setIsPdfLoading(true);
    setFormError(null);

    try {
      const rawLines = await extractTextFromPDF(file);
      const existingRolls = importReplaceAll ? [] : students.map(s => s.rollNo);
      const existingAdms = importReplaceAll ? [] : students.map(s => s.admissionNo);
      const result = parseStudentsPDF(rawLines, existingRolls, existingAdms);

      setParseResult(result as any);
      if (result.validStudents.length === 0) {
        setFormError('No valid student entries could be extracted from this PDF file.');
      }
    } catch (err: any) {
      console.error('PDF Parse Error:', err);
      setFormError('Failed to read PDF document. Please verify the PDF contains readable student text.');
    } finally {
      setIsPdfLoading(false);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    }
  };

  const handleExportStudentsSVG = () => {
    const classData = classInfo || {
      id: 'active',
      standard: 'Class 12',
      stream: 'General',
      section: 'A',
      className: classNameStr,
      academicYear: '2025-2026',
      classStrength: students.length
    };
    const svgStr = exportStudentsToSVG(students, classData, school, teacher);
    const fileName = `${classNameStr.replace(/[^a-zA-Z0-9]/g, '_')}_Students_Vector_Register.svg`;
    downloadSVGFile(svgStr, fileName);
    setFormSuccess('Student list SVG exported successfully with full details!');
    setTimeout(() => setFormSuccess(null), 3000);
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.validStudents.length === 0) return;
    onImportStudents(parseResult.validStudents, importReplaceAll);
    setImportSuccessMsg(`Successfully imported ${parseResult.validStudents.length} student records from ${importedFileType.toUpperCase()}!`);
    setParseResult(null);
    setRawFileText('');
    setTimeout(() => {
      setImportSuccessMsg(null);
      setActiveTab('list');
    }, 1500);
  };

  // Filtered & Sorted Student List
  const filteredStudents = students
    .filter(s => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toString().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.parentPhone && s.parentPhone.includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'roll') return a.rollNo - b.rollNo;
      return a.name.localeCompare(b.name);
    });

  // Bulk Selection Handlers
  const handleToggleSelectStudent = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const handleConfirmBulkDelete = () => {
    onBulkDeleteStudents(selectedIds);
    setSelectedIds([]);
    setBulkMode(false);
    setBulkDeleteConfirm(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-1">
            <Users className="w-3.5 h-3.5" /> Student Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            STUDENT MANAGEMENT
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Total {students.length} students enrolled in {classNameStr}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddForm}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'add'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>ADD STUDENT</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>IMPORT SVG / CSV</span>
          </button>

          <button
            onClick={handleExportStudentsSVG}
            className="px-3.5 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-sm"
            title="Download full Student Register as detailed SVG vector graphic (includes full contact & admission numbers)"
          >
            <Download className="w-4 h-4 text-purple-400" />
            <span>EXPORT SVG</span>
          </button>

          <button
            onClick={() => exportStudentsToCSV(students, classNameStr)}
            className="px-3.5 py-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:bg-[#252830] text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
            title="Export CSV (Allowed to include student details)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#2D3139] pb-2 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'list'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-purple-400" />
          <span>REGISTERED STUDENTS ({students.length})</span>
        </button>

        <button
          onClick={handleOpenAddForm}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'add'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>{editingStudent ? 'EDIT STUDENT' : 'ADD STUDENT'}</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'import'
              ? 'bg-[#1A1C23] text-white border border-[#2D3139]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4 text-blue-400" />
          <span>IMPORT SVG / CSV</span>
        </button>
      </div>

      {/* TAB 1: REGISTERED STUDENTS LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search, Sort, and Bulk Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1A1C23] p-3.5 rounded-2xl border border-[#2D3139]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, roll number, admission number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy(sortBy === 'roll' ? 'name' : 'roll')}
                className="px-3.5 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
                <span>Sort: {sortBy === 'roll' ? 'Roll Number' : 'Alphabetical'}</span>
              </button>

              <button
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
                  bulkMode
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-[#0F1115] border-[#2D3139] text-slate-300 hover:border-slate-600'
                }`}
              >
                {bulkMode ? 'Cancel Selection' : 'Select'}
              </button>
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {bulkMode && (
            <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-semibold"
                >
                  {selectedIds.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-purple-300 font-bold">
                  {selectedIds.length} of {filteredStudents.length} selected
                </span>
              </div>

              {selectedIds.length > 0 && (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-md transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedIds.length})</span>
                </button>
              )}
            </div>
          )}

          {/* Student Cards Grid / List */}
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#1A1C23] border border-[#2D3139] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-slate-500 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">No Students Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No students matching "${searchQuery}". Try a different roll number or name.`
                  : 'Add your first student or import from CSV to get started.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenAddForm}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
                >
                  Add First Student
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStudents.map(student => {
                const isSelected = selectedIds.includes(student.id);

                return (
                  <div
                    key={student.id}
                    className={`p-4 rounded-2xl bg-[#1A1C23] border transition-all duration-200 relative group flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-500/30'
                        : 'border-[#2D3139] hover:border-purple-500/40 hover:shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Top Roll & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {bulkMode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(student.id)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-[#2D3139] bg-[#0F1115]"
                            />
                          ) : (
                            <div className="relative group/avatar shrink-0">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-purple-700 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md border border-white/10">
                                {student.photoUrl || student.avatar ? (
                                  <img
                                    src={student.photoUrl || student.avatar}
                                    alt={student.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{student.rollNo}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleLaunchCameraForStudent(student);
                                }}
                                title="Take / Update Photo with Camera"
                                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-md border border-[#1A1C23] transition opacity-0 group-hover:opacity-100 group-hover/avatar:opacity-100 scale-90 hover:scale-105"
                              >
                                <Camera className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3
                              onClick={() => setSelectedStudent(student)}
                              className="text-sm font-bold text-white hover:text-purple-300 cursor-pointer truncate"
                            >
                              {student.name}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Adm: {student.admissionNo}
                            </p>
                          </div>
                        </div>

                        {/* Gender & Blood Badge */}
                        <div className="flex items-center gap-1 shrink-0">
                          {student.bloodGroup && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              {student.bloodGroup}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              student.gender === 'female'
                                ? 'bg-pink-500/10 text-pink-300 border border-pink-500/20'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            }`}
                          >
                            {student.gender}
                          </span>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="mt-3.5 space-y-1 text-xs text-slate-300">
                        {student.phone && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <a href={`tel:${student.phone}`} className="hover:text-purple-300 transition truncate">
                              Student: {student.phone}
                            </a>
                          </div>
                        )}
                        {student.parentName && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">
                              Parent: {student.parentName}{' '}
                              {student.parentPhone && (
                                <a href={`tel:${student.parentPhone}`} className="text-slate-300 hover:text-blue-300">
                                  ({student.parentPhone})
                                </a>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Strip */}
                    <div className="mt-4 pt-3 border-t border-[#2D3139] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Profile</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(student)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#252830] transition"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#252830] transition"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD / EDIT STUDENT FORM */}
      {activeTab === 'add' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingStudent ? `Edit Student: ${editingStudent.name}` : 'Add New Student'}
                </h2>
                <p className="text-xs text-slate-400">
                  Fill in all required fields. Roll number must be unique.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('list');
                setEditingStudent(null);
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2.5 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitStudentForm} className="space-y-5">
            {/* Student Photo Section */}
            <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group/photo shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1A1C23] border-2 border-[#2D3139] flex items-center justify-center text-slate-500 shadow-lg">
                  {formPhotoUrl ? (
                    <img
                      src={formPhotoUrl}
                      alt="Student Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-9 h-9 text-slate-600" />
                  )}
                </div>
                {formPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setFormPhotoUrl('')}
                    title="Remove Photo"
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md border border-[#0F1115] transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-purple-400" /> Student Profile Photo
                </h4>
                <p className="text-[11px] text-slate-400">
                  Use your device camera to take an instant photo or upload an image file for this student record.
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLaunchCameraForForm}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{formPhotoUrl ? 'Retake with Camera' : 'Take Photo with Camera'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => formPhotoFileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    type="file"
                    ref={formPhotoFileInputRef}
                    accept="image/*"
                    onChange={handleFormPhotoFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Roll Number *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formRollNo}
                  onChange={e => setFormRollNo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  placeholder="e.g. 1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admission Number *
                </label>
                <input
                  type="text"
                  required
                  value={formAdmissionNo}
                  onChange={e => setFormAdmissionNo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  placeholder="e.g. ADM-2025-001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Aadhavan Nair"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Student Phone Number
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. +91 98471 23456"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Parent / Guardian Name
                </label>
                <input
                  type="text"
                  value={formParentName}
                  onChange={e => setFormParentName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. K. V. Nair"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Parent Phone Number
                </label>
                <input
                  type="tel"
                  value={formParentPhone}
                  onChange={e => setFormParentPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. +91 98471 23450"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender</label>
                <select
                  value={formGender}
                  onChange={e => setFormGender(e.target.value as Gender)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Date of Birth <span className="text-slate-400 text-[10px] font-normal">(e.g. DD/MM/YYYY or YYYY-MM-DD)</span>
                </label>
                <input
                  type="text"
                  value={formDob}
                  onChange={e => setFormDob(e.target.value)}
                  placeholder="DD/MM/YYYY or YYYY-MM-DD"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 font-mono placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Blood Group
                </label>
                <select
                  value={formBloodGroup}
                  onChange={e => setFormBloodGroup(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O-">O-</option>
                  <option value="A-">A-</option>
                  <option value="B-">B-</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. House Name, Street, Town, District"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Optional Notes / Club
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Class Leader, NSS, Sports"
                />
              </div>
            </div>

            {/* Form Save Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2D3139]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setEditingStudent(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#252830] hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-900/30 transition active:scale-95 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>SAVE STUDENT</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: IMPORT STUDENTS (PDF / SVG / CSV) */}
      {activeTab === 'import' && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">IMPORT STUDENTS FROM PDF / SVG / CSV</h2>
                <p className="text-xs text-slate-400">
                  Import class roster from PDF documents (.pdf), vector registers (.svg) or spreadsheets (.csv)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadSampleStudentCSV}
                className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] text-purple-300 border border-purple-500/30 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV</span>
              </button>
            </div>
          </div>

          {importSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 text-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {formError && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-3 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Triple Upload Cards: PDF, SVG & CSV */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. PDF Import Card */}
            <div className="border-2 border-dashed border-rose-500/40 hover:border-rose-500 rounded-3xl p-5 text-center bg-[#0F1115] transition flex flex-col items-center justify-between">
              <input
                type="file"
                ref={pdfFileInputRef}
                accept=".pdf,application/pdf"
                onChange={handlePDFFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">IMPORT PDF DOCUMENT</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a PDF student register or class list. Text & tables are automatically parsed and previewed.
                </p>
              </div>
              <button
                type="button"
                disabled={isPdfLoading}
                onClick={() => pdfFileInputRef.current?.click()}
                className="mt-4 px-4 py-2.5 w-full rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>{isPdfLoading ? 'Parsing PDF...' : 'Upload & Parse PDF'}</span>
              </button>
            </div>

            {/* 2. SVG Import Card */}
            <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-500 rounded-3xl p-5 text-center bg-[#0F1115] transition flex flex-col items-center justify-between">
              <input
                type="file"
                ref={svgFileInputRef}
                accept=".svg,image/svg+xml"
                onChange={handleSVGFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">IMPORT SVG REGISTER</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload an SVG student roster or exported register with full student contact & admission columns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => svgFileInputRef.current?.click()}
                className="mt-4 px-4 py-2.5 w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                <span>Upload & Parse SVG</span>
              </button>
            </div>

            {/* 3. CSV Import Card */}
            <div className="border-2 border-dashed border-blue-500/30 hover:border-blue-500 rounded-3xl p-5 text-center bg-[#0F1115] transition flex flex-col items-center justify-between">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={handleCSVFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">IMPORT CSV FILE</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a standard spreadsheet (.csv) containing columns for Roll No, Name, Phone, and Parent details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2.5 w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload & Parse CSV</span>
              </button>
            </div>
          </div>

          {/* Preview & Validation Results */}
          {parseResult && (
            <div className="space-y-4 animate-fade-in pt-2">
              <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20 uppercase">
                    Format: {importedFileType.toUpperCase()}
                  </span>
                  <span className="text-slate-300">
                    Total Rows: <strong className="text-white font-mono">{parseResult.totalRows}</strong>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Valid Records: <strong className="font-mono">{parseResult.validStudents.length}</strong>
                  </span>
                  {parseResult.errors.length > 0 && (
                    <span className="text-rose-400 font-bold">
                      Warnings: <strong className="font-mono">{parseResult.errors.length}</strong>
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importReplaceAll}
                    onChange={e => {
                      setImportReplaceAll(e.target.checked);
                      if (rawFileText) {
                        const existingRolls = e.target.checked ? [] : students.map(s => s.rollNo);
                        const result = importedFileType === 'svg'
                          ? parseStudentsSVG(rawFileText, existingRolls)
                          : parseStudentsCSV(rawFileText, existingRolls);
                        setParseResult(result);
                      }
                    }}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-[#2D3139] bg-[#0F1115]"
                  />
                  <span>Replace existing class student roster</span>
                </label>
              </div>

              {/* Error messages if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-1.5 text-xs text-rose-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Row Parsing Warnings ({parseResult.errors.length}):</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pl-5 list-disc">
                    {parseResult.errors.map((err, idx) => (
                      <p key={idx}>
                        Row {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Step-by-Step Parsed Columns Preview Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Step 2: Review Structured Student Information Columns</span>
                  <span>{parseResult.validStudents.length} Students Ready to Import</span>
                </div>
                <div className="rounded-2xl border border-[#2D3139] overflow-x-auto max-h-72 bg-[#0F1115]">
                  <table className="w-full text-left text-xs text-slate-300 min-w-[750px]">
                    <thead className="bg-[#1A1C23] text-slate-400 uppercase font-semibold border-b border-[#2D3139] sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">Roll No</th>
                        <th className="px-3 py-2.5">Admission No</th>
                        <th className="px-3 py-2.5">Student Name</th>
                        <th className="px-3 py-2.5">Student Phone</th>
                        <th className="px-3 py-2.5">Parent Name</th>
                        <th className="px-3 py-2.5">Parent Phone</th>
                        <th className="px-3 py-2.5">Gender</th>
                        <th className="px-3 py-2.5">DOB</th>
                        <th className="px-3 py-2.5">Division/Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]/60 font-mono">
                      {parseResult.validStudents.map((st, idx) => (
                        <tr key={idx} className="hover:bg-[#252830]/50">
                          <td className="px-3 py-2 font-bold text-purple-300">{st.rollNo}</td>
                          <td className="px-3 py-2 text-indigo-300">{st.admissionNo}</td>
                          <td className="px-3 py-2 font-sans font-semibold text-white">{st.name}</td>
                          <td className="px-3 py-2 text-emerald-400">{st.phone || '-'}</td>
                          <td className="px-3 py-2 font-sans">{st.parentName || '-'}</td>
                          <td className="px-3 py-2 text-emerald-400">{st.parentPhone || '-'}</td>
                          <td className="px-3 py-2 uppercase">{st.gender}</td>
                          <td className="px-3 py-2">{st.dob || '-'}</td>
                          <td className="px-3 py-2 font-sans">{st.division || st.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirm Import Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setParseResult(null);
                    setRawFileText('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#252830] text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={parseResult.validStudents.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-purple-900/40 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>CONFIRM & IMPORT {parseResult.validStudents.length} STUDENTS</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STUDENT PROFILE MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3139] bg-[#0F1115]">
              <div className="flex items-center gap-3.5">
                <div className="relative group/modalphoto shrink-0">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-lg border border-white/10">
                    {selectedStudent.photoUrl || selectedStudent.avatar ? (
                      <img
                        src={selectedStudent.photoUrl || selectedStudent.avatar}
                        alt={selectedStudent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{selectedStudent.rollNo}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchCameraForStudent(selectedStudent)}
                    title="Change Photo with Camera"
                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-md border border-[#0F1115] transition"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Roll #{selectedStudent.rollNo} • Admission No: {selectedStudent.admissionNo} • {classNameStr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Quick Contacts Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedStudent.phone && (
                  <a
                    href={`tel:${selectedStudent.phone}`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call Student ({selectedStudent.phone})
                  </a>
                )}
                {selectedStudent.parentPhone && (
                  <a
                    href={`tel:${selectedStudent.parentPhone}`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call Parent ({selectedStudent.parentPhone})
                  </a>
                )}
              </div>

              {/* Personal Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-xs">
                <div>
                  <span className="text-slate-500 block">Gender</span>
                  <span className="font-bold text-slate-200 uppercase">{selectedStudent.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date of Birth</span>
                  <span className="font-bold text-slate-200">{selectedStudent.dob || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Blood Group</span>
                  <span className="font-bold text-rose-400">{selectedStudent.bloodGroup || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Parent / Guardian</span>
                  <span className="font-bold text-slate-200">{selectedStudent.parentName || 'N/A'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Address</span>
                  <span className="font-bold text-slate-200">{selectedStudent.address || 'N/A'}</span>
                </div>
                {selectedStudent.notes && (
                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-[#2D3139]">
                    <span className="text-slate-500 block">Notes & Activities</span>
                    <span className="text-purple-300 font-medium">{selectedStudent.notes}</span>
                  </div>
                )}
              </div>

              {/* Attendance Statistics for this student */}
              {(() => {
                const att = calculateStudentAttendanceStats(selectedStudent.id, attendance);
                return (
                  <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center justify-between">
                      <span>Attendance Summary</span>
                      <span className="font-mono text-emerald-400 font-bold">{att.percentage}%</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                        <span className="text-slate-400 block text-[10px]">Working Days</span>
                        <span className="font-bold text-white font-mono">{att.totalWorkingDays}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#1A1C23] border border-emerald-500/20">
                        <span className="text-emerald-400 block text-[10px]">Present</span>
                        <span className="font-bold text-emerald-300 font-mono">{att.daysPresent}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#1A1C23] border border-rose-500/20">
                        <span className="text-rose-400 block text-[10px]">Absent</span>
                        <span className="font-bold text-rose-300 font-mono">{att.daysAbsent}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Exam Marks Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Examination Marks
                </h4>
                {exams.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No exams recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {exams.map(exam => {
                      const markData = examMarksMap[exam.id]?.marks?.[selectedStudent.id];
                      return (
                        <div
                          key={exam.id}
                          className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{exam.name}</span>
                            <span className="text-purple-400 font-mono font-bold">
                              {markData?.percentage !== undefined ? `${markData.percentage}% (Grade ${markData.grade})` : 'Marks Pending'}
                            </span>
                          </div>

                          {markData && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] pt-1">
                              {exam.subjects.map(sub => {
                                const isAbs = markData.isAbsent?.[sub.id];
                                const m = markData.marks?.[sub.id];
                                return (
                                  <div key={sub.id} className="p-1.5 rounded-lg bg-[#1A1C23] border border-[#2D3139]/70 flex items-center justify-between">
                                    <span className="text-slate-400 truncate mr-1">{sub.name}</span>
                                    <span className="font-mono font-bold text-slate-200">
                                      {isAbs ? 'AB' : m !== undefined ? `${m}/${sub.maxMarks}` : '-'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#2D3139] bg-[#0F1115] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const toEdit = selectedStudent;
                  setSelectedStudent(null);
                  handleOpenEdit(toEdit);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Details
              </button>

              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 rounded-xl bg-[#252830] text-slate-300 text-xs font-semibold hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmStudent}
        title="Delete Student?"
        message={`Are you sure you want to permanently remove Roll #${deleteConfirmStudent?.rollNo} (${deleteConfirmStudent?.name}) from class records? This will also remove their attendance and mark records.`}
        confirmLabel="Yes, Delete"
        isDestructive={true}
        onConfirm={() => {
          if (deleteConfirmStudent) {
            onDeleteStudent(deleteConfirmStudent.id);
            setDeleteConfirmStudent(null);
          }
        }}
        onCancel={() => setDeleteConfirmStudent(null)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        title={`Delete ${selectedIds.length} Selected Students?`}
        message={`This will permanently remove ${selectedIds.length} selected student records from the database.`}
        confirmLabel={`Delete ${selectedIds.length} Students`}
        isDestructive={true}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
      {/* Student Camera Capture Modal */}
      <StudentCameraModal
        isOpen={isCameraOpen}
        studentName={isFormCamera ? formName || 'New Student' : cameraTargetStudent?.name}
        onCapture={handlePhotoCaptured}
        onClose={() => {
          setIsCameraOpen(false);
          setCameraTargetStudent(null);
          setIsFormCamera(false);
        }}
      />
    </div>
  );
};
