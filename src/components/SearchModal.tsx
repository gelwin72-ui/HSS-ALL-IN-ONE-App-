import React, { useState } from 'react';
import { Search, Users, FileSpreadsheet, CalendarCheck, X, ArrowRight, Phone, Award } from 'lucide-react';
import { Student, Exam, AttendanceRecord } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  students: Student[];
  exams: Exam[];
  attendance: AttendanceRecord[];
  onClose: () => void;
  onSelectStudent: (student: Student) => void;
  onSelectExam: (exam: Exam) => void;
  onNavigate: (tab: any) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  students,
  exams,
  attendance,
  onClose,
  onSelectStudent,
  onSelectExam,
  onNavigate
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const safeStudents = students || [];
  const safeExams = exams || [];
  const safeAttendance = attendance || [];

  const cleanQuery = query.toLowerCase().trim();

  const filteredStudents = cleanQuery
    ? safeStudents.filter(
        s =>
          s &&
          (s.name?.toLowerCase().includes(cleanQuery) ||
          s.rollNo?.toString().includes(cleanQuery) ||
          s.admissionNo?.toLowerCase().includes(cleanQuery) ||
          s.phone?.includes(cleanQuery) ||
          s.parentPhone?.includes(cleanQuery))
      )
    : [];

  const filteredExams = cleanQuery
    ? safeExams.filter(
        e =>
          e &&
          (e.name?.toLowerCase().includes(cleanQuery) ||
          e.type?.toLowerCase().includes(cleanQuery) ||
          e.academicYear?.includes(cleanQuery))
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2.5 sm:p-4 pt-4 sm:pt-16 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[88vh] sm:max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#2D3139] flex items-center gap-3 bg-[#0F1115]">
          <Search className="w-5 h-5 text-purple-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search by student name, roll no, admission no, or exam..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#252830] text-slate-300 hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <p>Type to instantly search students, exams, and class records.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => { onNavigate('students'); onClose(); }}
                  className="px-3 py-1.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-xs text-slate-300 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" /> View All Students ({safeStudents.length})
                </button>
                <button
                  onClick={() => { onNavigate('attendance'); onClose(); }}
                  className="px-3 py-1.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-xs text-slate-300 flex items-center gap-1.5"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" /> Mark Today's Attendance
                </button>
                <button
                  onClick={() => { onNavigate('exams'); onClose(); }}
                  className="px-3 py-1.5 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-xs text-slate-300 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" /> View Exams ({safeExams.length})
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Students Results */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Students ({filteredStudents.length})
                </h4>
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">No matching students found</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredStudents.map(student => (
                      <button
                        key={student.id}
                        onClick={() => {
                          onSelectStudent(student);
                          onClose();
                        }}
                        className="w-full text-left flex items-center justify-between p-3 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs">
                            {student.rollNo}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                              {student.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Adm: {student.admissionNo} • Ph: {student.parentPhone || student.phone || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transform group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Exams Results */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Examinations ({filteredExams.length})
                </h4>
                {filteredExams.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">No matching exams found</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredExams.map(exam => (
                      <button
                        key={exam.id}
                        onClick={() => {
                          onSelectExam(exam);
                          onClose();
                        }}
                        className="w-full text-left flex items-center justify-between p-3 rounded-2xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] transition group"
                      >
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                            {exam.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {exam.type} • {exam.date} • {exam.subjects?.length ?? 0} Subjects
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transform group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
