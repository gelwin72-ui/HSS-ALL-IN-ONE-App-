import { Exam, Student, StudentExamMark, AttendanceRecord, GradingSystem } from '../types';

/**
 * Calculates grade based on percentage and grading scale
 */
export function calculateGrade(percentage: number, system: GradingSystem = 'kerala_hss'): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 30) return 'D+';
  if (percentage >= 20) return 'D';
  return 'E';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
    case 'A': return 'text-teal-400 bg-teal-950/60 border-teal-500/40';
    case 'B+': return 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40';
    case 'B': return 'text-blue-400 bg-blue-950/60 border-blue-500/40';
    case 'C+': return 'text-amber-400 bg-amber-950/60 border-amber-500/40';
    case 'C': return 'text-orange-400 bg-orange-950/60 border-orange-500/40';
    case 'D+': return 'text-rose-400 bg-rose-950/60 border-rose-500/40';
    default: return 'text-red-400 bg-red-950/60 border-red-500/40';
  }
}

export function getGradePoint(grade: string): number {
  switch (grade) {
    case 'A+': return 9;
    case 'A': return 8;
    case 'B+': return 7;
    case 'B': return 6;
    case 'C+': return 5;
    case 'C': return 4;
    case 'D+': return 3;
    case 'D': return 2;
    default: return 1;
  }
}

/**
 * Calculates a single student's totals for an exam
 */
export function calculateStudentTotals(
  exam: Exam,
  studentMark: StudentExamMark | undefined,
  passingPercentage: number = 30
): {
  totalObtained: number;
  totalMax: number;
  percentage: number;
  average: number;
  grade: string;
  status: 'Pass' | 'Fail' | 'Needs Improvement';
  isAllAbsent: boolean;
} {
  let totalObtained = 0;
  let totalMax = 0;
  let subjectCount = 0;
  let hasFailInSubject = false;
  let absentCount = 0;

  const subjects = exam?.subjects || [];
  subjects.forEach(sub => {
    totalMax += sub.maxMarks || 0;
    const isAbs = studentMark?.isAbsent?.[sub.id] ?? false;
    const mark = studentMark?.marks?.[sub.id];

    if (isAbs) {
      absentCount++;
      hasFailInSubject = true;
    } else if (mark !== undefined && mark !== null) {
      totalObtained += Number(mark);
      subjectCount++;
      const subPct = sub.maxMarks > 0 ? (Number(mark) / sub.maxMarks) * 100 : 0;
      if (subPct < passingPercentage) {
        hasFailInSubject = true;
      }
    }
  });

  const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const average = subjectCount > 0 ? Number((totalObtained / subjectCount).toFixed(2)) : 0;
  const grade = calculateGrade(percentage);
  const isAllAbsent = subjects.length > 0 && absentCount === subjects.length;

  let status: 'Pass' | 'Fail' | 'Needs Improvement' = 'Pass';
  if (isAllAbsent || percentage < passingPercentage || hasFailInSubject) {
    status = 'Fail';
  } else if (percentage < passingPercentage + 15) {
    status = 'Needs Improvement';
  }

  return {
    totalObtained,
    totalMax,
    percentage,
    average,
    grade,
    status,
    isAllAbsent
  };
}

/**
 * Computes rankings and computed values for all students in an exam
 */
export function computeExamRankings(
  exam: Exam,
  students: Student[],
  marksRecord: Record<string, StudentExamMark> | undefined,
  passingPercentage: number = 30
): {
  processedMarks: Record<string, StudentExamMark>;
  classAverage: number;
  highestMark: number;
  lowestMark: number;
  passPercentage: number;
  topRankers: { student: Student; mark: StudentExamMark }[];
  subjectStats: Record<string, {
    subjectName: string;
    maxMarks: number;
    average: number;
    highest: number;
    lowest: number;
    passCount: number;
    failCount: number;
    absentCount: number;
  }>;
} {
  const processed: Record<string, StudentExamMark> = {};
  const scoresWithStudents: { student: Student; mark: StudentExamMark; total: number; percentage: number }[] = [];

  students.forEach(student => {
    const raw = marksRecord?.[student.id] || { studentId: student.id, marks: {}, isAbsent: {} };
    const totals = calculateStudentTotals(exam, raw, passingPercentage);

    const fullMark: StudentExamMark = {
      ...raw,
      studentId: student.id,
      totalObtained: totals.totalObtained,
      totalMax: totals.totalMax,
      percentage: totals.percentage,
      grade: totals.grade,
      status: totals.status,
    };

    processed[student.id] = fullMark;
    scoresWithStudents.push({
      student,
      mark: fullMark,
      total: totals.totalObtained,
      percentage: totals.percentage
    });
  });

  // Sort by total descending to assign ranks
  scoresWithStudents.sort((a, b) => b.total - a.total);

  let currentRank = 1;
  scoresWithStudents.forEach((item, index) => {
    if (index > 0 && item.total < scoresWithStudents[index - 1].total) {
      currentRank = index + 1;
    }
    item.mark.rank = currentRank;
    processed[item.student.id].rank = currentRank;
  });

  // Calculate class metrics
  const totalScoreSum = scoresWithStudents.reduce((sum, s) => sum + s.total, 0);
  const totalPercentageSum = scoresWithStudents.reduce((sum, s) => sum + s.percentage, 0);
  const studentCount = scoresWithStudents.length || 1;
  const classAverage = Number((totalPercentageSum / studentCount).toFixed(1));

  const highestMark = scoresWithStudents.length > 0 ? scoresWithStudents[0].total : 0;
  const lowestMark = scoresWithStudents.length > 0 ? scoresWithStudents[scoresWithStudents.length - 1].total : 0;

  const passedStudents = scoresWithStudents.filter(s => s.mark.status === 'Pass' || s.mark.status === 'Needs Improvement').length;
  const passPercentage = Number(((passedStudents / studentCount) * 100).toFixed(1));

  const topRankers = scoresWithStudents.slice(0, 3).map(s => ({ student: s.student, mark: s.mark }));

  // Calculate subject-wise stats
  const subjectStats: Record<string, {
    subjectName: string;
    maxMarks: number;
    average: number;
    highest: number;
    lowest: number;
    passCount: number;
    failCount: number;
    absentCount: number;
  }> = {};

  const subjects = exam?.subjects || [];
  subjects.forEach(sub => {
    let subSum = 0;
    let subHighest = -1;
    let subLowest = 9999;
    let subPass = 0;
    let subFail = 0;
    let subAbsent = 0;
    let validCount = 0;

    students.forEach(st => {
      const mark = processed[st.id]?.marks?.[sub.id];
      const isAbs = processed[st.id]?.isAbsent?.[sub.id];

      if (isAbs) {
        subAbsent++;
      } else if (mark !== undefined && mark !== null) {
        const val = Number(mark);
        subSum += val;
        validCount++;
        if (val > subHighest) subHighest = val;
        if (val < subLowest) subLowest = val;
        const passMark = (sub.maxMarks * passingPercentage) / 100;
        if (val >= passMark) subPass++;
        else subFail++;
      }
    });

    subjectStats[sub.id] = {
      subjectName: sub.name,
      maxMarks: sub.maxMarks,
      average: validCount > 0 ? Number((subSum / validCount).toFixed(1)) : 0,
      highest: subHighest === -1 ? 0 : subHighest,
      lowest: subLowest === 9999 ? 0 : subLowest,
      passCount: subPass,
      failCount: subFail,
      absentCount: subAbsent
    };
  });

  return {
    processedMarks: processed,
    classAverage,
    highestMark,
    lowestMark,
    passPercentage,
    topRankers,
    subjectStats
  };
}

/**
 * Attendance calculation helpers
 */
export function calculateStudentAttendanceStats(
  studentId: string,
  attendanceRecords: AttendanceRecord[]
): {
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysOnDuty: number;
  percentage: number;
} {
  const totalWorkingDays = attendanceRecords.length;
  if (totalWorkingDays === 0) {
    return { totalWorkingDays: 0, daysPresent: 0, daysAbsent: 0, daysOnDuty: 0, percentage: 100 };
  }

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysOnDuty = 0;

  attendanceRecords.forEach(rec => {
    if (rec.presentStudentIds?.includes(studentId)) {
      daysPresent++;
    } else if (rec.absentStudentIds?.includes(studentId)) {
      daysAbsent++;
    } else if (rec.onDutyStudentIds?.includes(studentId)) {
      daysOnDuty++;
      daysPresent++; // count on duty as present
    }
  });

  const percentage = Number(((daysPresent / totalWorkingDays) * 100).toFixed(1));

  return {
    totalWorkingDays,
    daysPresent,
    daysAbsent,
    daysOnDuty,
    percentage
  };
}

/**
 * Monthly attendance summary for class
 */
export function calculateMonthlyAttendanceSummary(
  monthStr: string, // "YYYY-MM"
  students: Student[],
  attendanceRecords: AttendanceRecord[]
): {
  workingDays: number;
  records: AttendanceRecord[];
  studentSummaries: {
    student: Student;
    presentDays: number;
    absentDays: number;
    percentage: number;
  }[];
  overallClassPercentage: number;
} {
  const monthRecords = attendanceRecords.filter(r => r.date.startsWith(monthStr));
  const workingDays = monthRecords.length;

  if (workingDays === 0) {
    return {
      workingDays: 0,
      records: [],
      studentSummaries: students.map(st => ({
        student: st,
        presentDays: 0,
        absentDays: 0,
        percentage: 100
      })),
      overallClassPercentage: 100
    };
  }

  let totalPossible = workingDays * students.length;
  let totalPresentCount = 0;

  const studentSummaries = students.map(student => {
    let present = 0;
    let absent = 0;

    monthRecords.forEach(rec => {
      if (rec.presentStudentIds?.includes(student.id)) {
        present++;
      } else if (rec.absentStudentIds?.includes(student.id)) {
        absent++;
      }
    });

    totalPresentCount += present;
    const percentage = Number(((present / workingDays) * 100).toFixed(1));

    return {
      student,
      presentDays: present,
      absentDays: absent,
      percentage
    };
  });

  const overallClassPercentage = totalPossible > 0 ? Number(((totalPresentCount / totalPossible) * 100).toFixed(1)) : 100;

  return {
    workingDays,
    records: monthRecords,
    studentSummaries,
    overallClassPercentage
  };
}
