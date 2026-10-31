import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Phone,
  User,
  Shield,
  Sparkles,
  ArrowRight,
  School,
  FileText,
  AlertCircle,
  Layers,
  Check,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { ClassInfo, ClassItem, Student, Gender } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface AddClassModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'manage';
  currentClassInfo: ClassInfo;
  classesList: ClassItem[];
  activeClassId: string;
  onClose: () => void;
  onSaveClassAndStudents: (
    newClassInfo: ClassInfo,
    newStudents: Student[],
    isAdditionalClass: boolean
  ) => void;
  onSwitchClass: (classId: string) => void;
  onDeleteClass: (classId: string) => void;
}

export const AddClassModal: React.FC<AddClassModalProps> = ({
  isOpen,
  initialTab = 'create',
  currentClassInfo,
  classesList = [],
  activeClassId,
  onClose,
  onSaveClassAndStudents,
  onSwitchClass,
  onDeleteClass
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'create' | 'manage'>(initialTab);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Class Setup Form State
  const [standard, setStandard] = useState('Class 11 (Plus One)');
  const [stream, setStream] = useState('Commerce');
  const [section, setSection] = useState('B');
  const [academicYear, setAcademicYear] = useState('2025-2026');

  // Single Student Input Fields
  const [studentName, setStudentName] = useState('');
  const [rollNo, setRollNo] = useState<number>(1);
  const [classDivision, setClassDivision] = useState('B');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [admissionNo, setAdmissionNo] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');

  // Queued students for this new class
  const [queuedStudents, setQueuedStudents] = useState<Student[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const generatedClassName = `${standard} ${stream} ${section}`.trim();

  // Add individual student to queue
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!studentName.trim()) {
      setErrorMessage('Please enter student name.');
      return;
    }

    if (queuedStudents.some(s => s.rollNo === rollNo)) {
      setErrorMessage(`Roll number ${rollNo} is already added in this class roster.`);
      return;
    }

    const adm = admissionNo.trim() || `ADM-${academicYear.split('-')[0]}-${String(rollNo).padStart(3, '0')}`;

    const newStudent: Student = {
      id: `st-new-${Date.now()}-${queuedStudents.length + 1}`,
      rollNo,
      admissionNo: adm,
      name: studentName.trim(),
      phone: studentPhone.trim() || '',
      parentName: parentName.trim() || '',
      parentPhone: parentPhone.trim() || '',
      division: classDivision.trim() || section,
      gender,
      dob: '2008-01-01',
      address: 'Kerala, India',
      bloodGroup,
      createdAt: new Date().toISOString()
    };

    const updated = [...queuedStudents, newStudent].sort((a, b) => a.rollNo - b.rollNo);
    setQueuedStudents(updated);

    // Prepare next roll number and reset individual fields
    setRollNo(prev => prev + 1);
    setStudentName('');
    setStudentPhone('');
    setParentName('');
    setParentPhone('');
    setAdmissionNo('');
    setSuccessMessage(`Added Roll #${newStudent.rollNo} ${newStudent.name}`);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleRemoveStudent = (id: string) => {
    setQueuedStudents(queuedStudents.filter(s => s.id !== id));
  };

  const handleFinalSubmit = () => {
    if (queuedStudents.length === 0) {
      setErrorMessage('Please add at least one student to this class roster.');
      return;
    }

    const newClass: ClassInfo = {
      standard,
      stream,
      section,
      className: generatedClassName,
      academicYear,
      classStrength: queuedStudents.length
    };

    onSaveClassAndStudents(newClass, queuedStudents, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3139] bg-[#1A1C23]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-0.5">
                <Sparkles className="w-3 h-3" /> Multi-Class Management
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {activeModalTab === 'create' ? 'CREATE ADDITIONAL CLASS & ROSTER' : 'MY CLASSES DIRECTORY'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modal Tabs */}
            <div className="hidden sm:flex items-center p-1 rounded-xl bg-[#0F1115] border border-[#2D3139]">
              <button
                type="button"
                onClick={() => setActiveModalTab('create')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeModalTab === 'create'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add New Class</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('manage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeModalTab === 'manage'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>My Classes Directory ({classesList.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="sm:hidden flex border-b border-[#2D3139] bg-[#0F1115]">
          <button
            type="button"
            onClick={() => setActiveModalTab('create')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition ${
              activeModalTab === 'create'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400'
            }`}
          >
            + Add New Class
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('manage')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition ${
              activeModalTab === 'manage'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400'
            }`}
          >
            My Classes Directory ({classesList.length})
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2.5 text-xs sm:text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 text-xs sm:text-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: CREATE NEW CLASS */}
          {activeModalTab === 'create' && (
            <>
              {/* SECTION 1: CLASS INFO & CONFIG */}
              <div className="p-5 rounded-3xl bg-[#0F1115] border border-[#2D3139] space-y-4">
                <div className="flex items-center justify-between border-b border-[#2D3139] pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Step 1: Class Information
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-purple-300 bg-purple-950/70 border border-purple-500/30 px-3 py-1 rounded-xl">
                    Preview: {generatedClassName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Standard / Level
                    </label>
                    <select
                      value={standard}
                      onChange={e => setStandard(e.target.value)}
                      className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Class 12 (Plus Two)">Class 12 (Plus Two)</option>
                      <option value="Class 11 (Plus One)">Class 11 (Plus One)</option>
                      <option value="Class 10 (SSLC)">Class 10 (SSLC)</option>
                      <option value="Class 9">Class 9</option>
                      <option value="Class 8">Class 8</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Stream / Course
                    </label>
                    <select
                      value={stream}
                      onChange={e => setStream(e.target.value)}
                      className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Science (Bio-Maths)">Science (Bio-Maths)</option>
                      <option value="Science (Computer Science)">Science (Computer Science)</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Commerce (Computer App)">Commerce (Computer App)</option>
                      <option value="Humanities">Humanities</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Section / Division
                    </label>
                    <select
                      value={section}
                      onChange={e => {
                        setSection(e.target.value);
                        setClassDivision(e.target.value);
                      }}
                      className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="A">Division A</option>
                      <option value="B">Division B</option>
                      <option value="C">Division C</option>
                      <option value="D">Division D</option>
                      <option value="E">Division E</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Academic Year
                    </label>
                    <select
                      value={academicYear}
                      onChange={e => setAcademicYear(e.target.value)}
                      className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="2025-2026">2025-2026</option>
                      <option value="2026-2027">2026-2027</option>
                      <option value="2024-2025">2024-2025</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ADD STUDENT FORM */}
              <div className="p-5 rounded-3xl bg-[#0F1115] border border-[#2D3139] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#2D3139] pb-3">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Step 2: Add Students with Contact & Parent Details
                  </h3>
                </div>

                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* Roll No */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Roll Number *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={rollNo}
                        onChange={e => setRollNo(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Student Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Student Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Abhiram Menon"
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Class Division */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Division
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. A, B, C"
                        value={classDivision}
                        onChange={e => setClassDivision(e.target.value.toUpperCase())}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Student Phone */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Student Phone No.
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98471 23456"
                        value={studentPhone}
                        onChange={e => setStudentPhone(e.target.value)}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Parent Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Parent / Guardian Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. K. P. Menon"
                        value={parentName}
                        onChange={e => setParentName(e.target.value)}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Parent Phone */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Parent Phone No.
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98471 23450"
                        value={parentPhone}
                        onChange={e => setParentPhone(e.target.value)}
                        className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Gender & Blood Group */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Gender
                        </label>
                        <select
                          value={gender}
                          onChange={e => setGender(e.target.value as Gender)}
                          className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-2 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Blood
                        </label>
                        <select
                          value={bloodGroup}
                          onChange={e => setBloodGroup(e.target.value)}
                          className="w-full bg-[#1A1C23] border border-[#2D3139] rounded-xl px-2 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="O+">O+</option>
                          <option value="A+">A+</option>
                          <option value="B+">B+</option>
                          <option value="AB+">AB+</option>
                          <option value="O-">O-</option>
                          <option value="A-">A-</option>
                          <option value="B-">B-</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-950/50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Student to Roster</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* SECTION 3: QUEUED STUDENTS ROSTER TABLE */}
              <div className="p-5 rounded-3xl bg-[#0F1115] border border-[#2D3139] space-y-3">
                <div className="flex items-center justify-between border-b border-[#2D3139] pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Students Roster ({queuedStudents.length} Added)
                    </h4>
                  </div>

                  {queuedStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQueuedStudents([])}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Clear Roster
                    </button>
                  )}
                </div>

                {queuedStudents.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No students added to this class yet. Fill details above and tap "Add Student to Roster" or use "Quick Fill 5 Sample Students".
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-[#2D3139]">
                        <tr>
                          <th className="py-2 px-2">Roll</th>
                          <th className="py-2 px-2">Student Name</th>
                          <th className="py-2 px-2">Division</th>
                          <th className="py-2 px-2">Student Phone</th>
                          <th className="py-2 px-2">Parent Name</th>
                          <th className="py-2 px-2">Parent Phone</th>
                          <th className="py-2 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3139]/40">
                        {queuedStudents.map(st => (
                          <tr key={st.id} className="hover:bg-[#1A1C23] transition">
                            <td className="py-2.5 px-2 font-mono font-bold text-purple-400">
                              #{st.rollNo}
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-white">{st.name}</td>
                            <td className="py-2.5 px-2 font-mono text-cyan-300">{st.division || section}</td>
                            <td className="py-2.5 px-2 font-mono text-slate-300">{st.phone || '-'}</td>
                            <td className="py-2.5 px-2 text-slate-300">{st.parentName || '-'}</td>
                            <td className="py-2.5 px-2 font-mono text-emerald-400">{st.parentPhone || '-'}</td>
                            <td className="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudent(st.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                                title="Remove student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: MANAGE & SWITCH EXISTING CLASSES */}
          {activeModalTab === 'manage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                <FolderOpen className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-0.5">My Classes Directory ({classesList.length} total)</p>
                  <p className="text-purple-300/80">
                    Switch your active working class with one click, or delete unneeded/duplicate classes from your catalog. (At least one class is preserved as default).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classesList.map(item => {
                  const isActive = item.id === activeClassId;
                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                        isActive
                          ? 'bg-purple-900/20 border-purple-500 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/30'
                          : 'bg-[#0F1115] border-[#2D3139] hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {item.academicYear}
                          </span>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Active Working Class
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500">
                              Directory Entry
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-extrabold text-white tracking-tight">
                          {item.className}
                        </h4>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-purple-300 font-medium">{item.stream}</span>
                          <span>•</span>
                          <span>Section {item.section}</span>
                          <span>•</span>
                          <span className="font-mono text-cyan-300 font-bold">{item.classStrength || 0} Students</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-[#2D3139]">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchClass(item.id);
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-950/40 active:scale-95"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Switch to this Class</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                            <Check className="w-4 h-4 text-emerald-400" />
                            Currently Selected
                          </span>
                        )}

                        {classesList.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setClassToDelete(item)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition flex items-center gap-1.5 active:scale-95"
                            title="Delete this class from directory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600 font-medium italic">
                            Default Class
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('create')}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Another Additional Class</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Action Bar */}
        {activeModalTab === 'create' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-[#2D3139] bg-[#1A1C23]">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>Ready to add <strong>{generatedClassName}</strong> with {queuedStudents.length} students</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] text-slate-300 text-xs sm:text-sm font-semibold transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={queuedStudents.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-950/60 transition active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>SAVE AS NEW SEPARATE CLASS</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!classToDelete}
        title="Delete Class from Directory"
        message={`Are you sure you want to delete "${classToDelete?.className}"? This will permanently remove this class along with its enrolled students, attendance records, and exam marks.`}
        confirmLabel="Delete Class"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (classToDelete) {
            onDeleteClass(classToDelete.id);
            setClassToDelete(null);
          }
        }}
        onCancel={() => setClassToDelete(null)}
      />
    </div>
  );
};
