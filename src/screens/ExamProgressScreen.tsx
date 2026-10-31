import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  LineChart,
  UserCheck
} from 'lucide-react';
import { Student, Exam, ExamMarksRecord } from '../types';
import { calculateStudentTotals, computeExamRankings, getGradeColor } from '../utils/calculations';

interface ExamProgressScreenProps {
  students: Student[];
  exams: Exam[];
  examMarksMap: Record<string, ExamMarksRecord>;
}

export const ExamProgressScreen: React.FC<ExamProgressScreenProps> = ({
  students,
  exams,
  examMarksMap
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students.length > 0 ? students[0].id : ''
  );
  const [activeTab, setActiveTab] = useState<'student' | 'comparison' | 'subjects'>('student');

  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const selectedStudent = students.find(s => s.id === selectedStudentId) || sortedStudents[0];

  // Calculate individual student trajectory across all exams
  const studentExamTrajectory = exams.map(exam => {
    const markData = examMarksMap[exam.id]?.marks?.[selectedStudent?.id || ''];
    const totals = calculateStudentTotals(exam, markData);
    return {
      exam,
      totals,
      rawMarks: markData?.marks || {},
      isAbsent: markData?.isAbsent || {}
    };
  });

  // Calculate overall performance delta (latest exam vs previous)
  let performanceDelta = 0;
  let hasTrajectory = studentExamTrajectory.length >= 2;
  if (hasTrajectory) {
    const latestPct = studentExamTrajectory[studentExamTrajectory.length - 1].totals.percentage;
    const prevPct = studentExamTrajectory[studentExamTrajectory.length - 2].totals.percentage;
    performanceDelta = Number((latestPct - prevPct).toFixed(1));
  }

  // Calculate class averages for each exam for comparison
  const examClassAverages = exams.map(exam => {
    const ranking = computeExamRankings(exam, students, examMarksMap[exam.id]?.marks);
    return {
      exam,
      classAverage: ranking.classAverage,
      passPercentage: ranking.passPercentage,
      highestMark: ranking.highestMark
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Performance Analytics
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            EXAM PROGRESS & TRAJECTORY
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Track student improvement, multi-terminal comparisons, and subject growth charts.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#1A1C23] border border-[#2D3139] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('student')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'student'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Student Trajectory
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'comparison'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Class Exam Comparison
          </button>
        </div>
      </div>

      {/* STUDENT TRAJECTORY VIEW */}
      {activeTab === 'student' && (
        <div className="space-y-6">
          {/* Student Selector Card */}
          <div className="p-5 rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shrink-0">
                {selectedStudent?.rollNo || '1'}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400">Select Student to Analyze</label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="mt-1 px-4 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                >
                  {sortedStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      Roll #{st.rollNo} — {st.name} ({st.admissionNo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasTrajectory && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#0F1115] border border-[#2D3139] self-start sm:self-auto">
                <div
                  className={`p-2 rounded-xl ${
                    performanceDelta >= 0
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {performanceDelta >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Latest Progress
                  </span>
                  <span
                    className={`text-sm font-extrabold font-mono ${
                      performanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {performanceDelta >= 0 ? `+${performanceDelta}% Improvement` : `${performanceDelta}% Decrease`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Trajectory Visual Chart */}
          <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LineChart className="w-5 h-5 text-cyan-400" />
              <span>Academic Trajectory Across Examinations — {selectedStudent?.name}</span>
            </h3>

            {exams.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">No examinations recorded yet</p>
            ) : (
              <div className="space-y-4 pt-2">
                {/* Horizontal Progress Bars */}
                <div className="space-y-4">
                  {studentExamTrajectory.map(item => {
                    const pct = item.totals.percentage;

                    return (
                      <div key={item.exam.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{item.exam.name}</span>
                            <span className="text-slate-500 font-mono text-[11px]">({item.exam.date})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-cyan-300">{pct}%</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeColor(
                                item.totals.grade
                              )}`}
                            >
                              Grade {item.totals.grade}
                            </span>
                          </div>
                        </div>

                        {/* Visual Bar */}
                        <div className="w-full h-3 bg-[#0F1115] rounded-full overflow-hidden p-0.5 border border-[#2D3139]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 80
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : pct >= 60
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                : pct >= 40
                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-gradient-to-r from-rose-500 to-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Subject-Wise Growth Breakdown for Selected Student */}
          {selectedStudent && exams.length > 0 && (
            <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <span>Subject Marks Breakdown by Examination</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {studentExamTrajectory.map(item => (
                  <div
                    key={item.exam.id}
                    className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
                      <h4 className="font-bold text-white text-xs">{item.exam.name}</h4>
                      <span className="font-mono text-xs font-bold text-purple-400">
                        Total: {item.totals.totalObtained}/{item.totals.totalMax}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {item.exam.subjects.map(sub => {
                        const isAbs = item.isAbsent?.[sub.id];
                        const mark = item.rawMarks?.[sub.id];

                        return (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#1A1C23] border border-[#2D3139]/60"
                          >
                            <span className="text-slate-300 truncate mr-2">{sub.name}</span>
                            <span className="font-mono font-bold text-white shrink-0">
                              {isAbs ? 'AB' : mark !== undefined && mark !== null ? `${mark} / ${sub.maxMarks}` : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLASS EXAM COMPARISON VIEW */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Class Performance Trend Across All Examinations</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {examClassAverages.map((item, idx) => (
                <div
                  key={item.exam.id}
                  className="p-5 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase font-mono">Exam {idx + 1}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {item.exam.type}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{item.exam.name}</h4>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2D3139] text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                      <span className="text-slate-500 block text-[10px]">Class Average</span>
                      <span className="text-lg font-bold text-purple-300">{item.classAverage}%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139]">
                      <span className="text-slate-500 block text-[10px]">Pass Rate</span>
                      <span className="text-lg font-bold text-emerald-400">{item.passPercentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
