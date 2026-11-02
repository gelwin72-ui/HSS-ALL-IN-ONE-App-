import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchoolProfile, ClassInfo, TeacherInfo, Student, AttendanceRecord, Exam, ExamMarksRecord } from '../types';
import { calculateStudentAttendanceStats, calculateStudentTotals, computeExamRankings } from './calculations';

// Helpers for clean PDF styling
const PRIMARY_COLOR: [number, number, number] = [91, 33, 182]; // Purple 800
const SECONDARY_COLOR: [number, number, number] = [15, 23, 42]; // Slate 900
const ACCENT_COLOR: [number, number, number] = [14, 165, 233]; // Sky 500
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // Slate 500

function addHeader(
  doc: jsPDF,
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  title: string,
  subTitle?: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top header banner background
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // School Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(school.schoolName || "St. Sebastian's Higher Secondary School", pageWidth / 2, 11, { align: 'center' });

  // School Address / Code
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subText = [school.schoolAddress, school.schoolCode ? `School Code: ${school.schoolCode}` : '', school.schoolPhone ? `Ph: ${school.schoolPhone}` : '']
    .filter(Boolean)
    .join('  •  ');
  doc.text(subText, pageWidth / 2, 18, { align: 'center' });

  // Class & Teacher Sub-bar
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, 30, pageWidth - 28, 12, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(14, 30, pageWidth - 28, 12, 'S');

  doc.setTextColor(...SECONDARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`CLASS: ${classInfo.className || `${classInfo.standard} ${classInfo.stream} ${classInfo.section}`}`, 18, 38);
  doc.text(`ACADEMIC YEAR: ${classInfo.academicYear}`, pageWidth / 2, 38, { align: 'center' });
  doc.text(`TEACHER: ${teacher.teacherName || 'Class Teacher'}`, pageWidth - 18, 38, { align: 'right' });

  // Report Title Box
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(title.toUpperCase(), pageWidth / 2, 50, { align: 'center' });

  if (subTitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subTitle, pageWidth / 2, 55, { align: 'center' });
  }

  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(14, subTitle ? 58 : 53, pageWidth - 14, subTitle ? 58 : 53);

  return subTitle ? 64 : 58;
}

function addFooter(doc: jsPDF, teacher: TeacherInfo, principalName?: string) {
  const pageCount = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : (((doc.internal as any)?.getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1) || 1);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Signatures line on final page or all pages
    if (i === pageCount) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);

      // Teacher signature line
      doc.line(20, pageHeight - 24, 75, pageHeight - 24);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SECONDARY_COLOR);
      doc.text(`Class Teacher (${teacher.teacherName || 'Signature'})`, 20, pageHeight - 20);

      // Principal signature line
      doc.line(pageWidth - 75, pageHeight - 24, pageWidth - 20, pageHeight - 24);
      doc.text(`Principal (${principalName || 'Signature'})`, pageWidth - 75, pageHeight - 20);
    }

    // Bottom page info
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`HSS ALL IN ONE — Generated on ${dateStr}`, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

/**
 * 1. FULL EXAM REPORT PDF
 * Privacy rule: Excludes admission number and mobile numbers
 */
export function generateExamReportPDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  exam: Exam,
  students: Student[],
  marksRecord: ExamMarksRecord | undefined
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = addHeader(doc, school, classInfo, teacher, `EXAM TABULATION SHEET: ${exam.name}`, `Exam Date: ${exam.date}  |  Exam Type: ${exam.type}  |  Total Subjects: ${exam.subjects.length}`);

  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const { processedMarks, classAverage, highestMark, lowestMark, passPercentage, topRankers } = computeExamRankings(exam, sortedStudents, marksRecord?.marks);

  const headRow = [
    'R.No',
    'Student Name',
    ...exam.subjects.map(s => `${s.name}\n(Max ${s.maxMarks})`),
    'Total\nObt',
    'Max\nMarks',
    '%',
    'Grade',
    'Rank',
    'Status'
  ];

  const bodyRows = sortedStudents.map(st => {
    const markData = processedMarks[st.id];
    const subValues = exam.subjects.map(sub => {
      if (markData?.isAbsent?.[sub.id]) return 'AB';
      const m = markData?.marks?.[sub.id];
      return m !== undefined && m !== null ? String(m) : '-';
    });

    return [
      st.rollNo.toString(),
      st.name,
      ...subValues,
      markData?.totalObtained ?? '-',
      markData?.totalMax ?? '-',
      markData?.percentage !== undefined ? `${markData.percentage}%` : '-',
      markData?.grade || '-',
      markData?.rank !== undefined ? `#${markData.rank}` : '-',
      markData?.status || '-'
    ];
  });

  autoTable(doc, {
    startY: startY + 2,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      1: { halign: 'left', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, bottom: 30 }
  });

  // Summary box below table
  const finalY = ((doc as any).lastAutoTable?.finalY ?? 120) + 6;
  const pageWidth = doc.internal.pageSize.getWidth();

  if (finalY < doc.internal.pageSize.getHeight() - 40) {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, finalY, pageWidth - 28, 14, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, finalY, pageWidth - 28, 14, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SECONDARY_COLOR);

    const rankersText = topRankers.length > 0
      ? topRankers.map((r, i) => `Rank ${i + 1}: ${r.student.name} (${r.mark.percentage}%)`).join('  |  ')
      : 'None';

    doc.text(`Class Avg: ${classAverage}%   •   Highest: ${highestMark}   •   Lowest: ${lowestMark}   •   Pass: ${passPercentage}%`, 18, finalY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Top Rankers: ${rankersText}`, 18, finalY + 11);
  }

  addFooter(doc, teacher, school.principalName);
  return doc;
}

/**
 * 2. INDIVIDUAL STUDENT PROGRESS REPORT CARD PDF
 * Privacy rule: Excludes admission number and phone numbers
 */
export function generateStudentProgressReportPDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  student: Student,
  exams: Exam[],
  examMarksMap: Record<string, ExamMarksRecord>,
  attendanceRecords: AttendanceRecord[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const startY = addHeader(doc, school, classInfo, teacher, 'STUDENT PERFORMANCE & PROGRESS REPORT', 'Official Academic & Attendance Evaluation');

  // Student Profile Card in PDF (Admission No and Phone numbers removed for privacy)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, startY + 2, pageWidth - 28, 20, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, startY + 2, pageWidth - 28, 20, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(`STUDENT NAME: ${student.name.toUpperCase()}`, 18, startY + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(`Roll No: ${student.rollNo}`, 18, startY + 15);
  doc.text(`Gender: ${student.gender.toUpperCase()}`, 65, startY + 15);
  doc.text(`Date of Birth: ${student.dob || 'N/A'}`, 115, startY + 15);
  doc.text(`Parent/Guardian: ${student.parentName || 'N/A'}`, 18, startY + 20);

  // Attendance stats for student
  const attStats = calculateStudentAttendanceStats(student.id, attendanceRecords);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('I. ATTENDANCE RECORD', 14, startY + 30);

  const attTableBody = [
    [
      attStats.totalWorkingDays.toString(),
      attStats.daysPresent.toString(),
      attStats.daysAbsent.toString(),
      `${attStats.percentage}%`,
      attStats.percentage >= 85 ? 'Excellent' : attStats.percentage >= 75 ? 'Satisfactory' : 'Needs Attention (<75%)'
    ]
  ];

  autoTable(doc, {
    startY: startY + 33,
    head: [['Total Working Days', 'Days Present', 'Days Absent', 'Attendance %', 'Attendance Status']],
    body: attTableBody,
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 14, right: 14 }
  });

  // Academic Exam Marks breakdown
  const examSectionY = ((doc as any).lastAutoTable?.finalY ?? 90) + 8;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('II. ACADEMIC EVALUATION & EXAMINATION MARKS', 14, examSectionY);

  const examTableRows: any[] = [];

  exams.forEach(exam => {
    const marksRecord = examMarksMap[exam.id];
    const markData = marksRecord?.marks?.[student.id];
    const totals = calculateStudentTotals(exam, markData);

    const subDetails = exam.subjects.map(s => {
      if (markData?.isAbsent?.[s.id]) return `${s.name}: AB/${s.maxMarks}`;
      const m = markData?.marks?.[s.id];
      return `${s.name}: ${m !== undefined ? m : '-'}/${s.maxMarks}`;
    }).join('  |  ');

    examTableRows.push([
      exam.name,
      exam.date,
      subDetails,
      `${totals.totalObtained} / ${totals.totalMax}`,
      `${totals.percentage}%`,
      totals.grade,
      markData?.rank ? `#${markData.rank}` : '-',
      totals.status
    ]);
  });

  if (examTableRows.length === 0) {
    examTableRows.push(['No exams recorded yet', '-', '-', '-', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: examSectionY + 3,
    head: [['Exam Name', 'Date', 'Subject Breakdown (Mark / Max)', 'Total', '%', 'Grade', 'Rank', 'Result']],
    body: examTableRows,
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', cellPadding: 2.5, valign: 'middle' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'left', fontSize: 7.5 }
    },
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 14, right: 14, bottom: 35 }
  });

  // Teacher Remarks Box
  const finalTableY = ((doc as any).lastAutoTable?.finalY ?? 120) + 8;
  if (finalTableY < doc.internal.pageSize.getHeight() - 45) {
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalTableY, pageWidth - 28, 18, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, finalTableY, pageWidth - 28, 18, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text('CLASS TEACHER GENERAL REMARKS & RECOMMENDATIONS:', 18, finalTableY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Consistent effort and regular attendance are advised for continued academic excellence.', 18, finalTableY + 12);
  }

  addFooter(doc, teacher, school.principalName);
  return doc;
}

/**
 * 3. MONTHLY ATTENDANCE REPORT PDF
 * Privacy rule: Excludes admission number and phone numbers
 */
export function generateMonthlyAttendancePDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  monthName: string,
  year: number,
  students: Student[],
  attendanceRecords: AttendanceRecord[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = addHeader(doc, school, classInfo, teacher, `MONTHLY CLASS ATTENDANCE REGISTER`, `Month: ${monthName} ${year}  |  Total Registered Strength: ${students.length}`);

  const monthNumber = getMonthNumber(monthName);
  const monthPrefix = `${year}-${String(monthNumber).padStart(2, '0')}`;
  const monthRecords = attendanceRecords.filter(r => r.date.startsWith(monthPrefix));
  const workingDays = monthRecords.length;

  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);

  const head = [['R.No', 'Student Name', 'Total Days', 'Days Present', 'Days Absent', 'Attendance %', 'Status']];
  const body = sortedStudents.map(st => {
    let present = 0;
    let absent = 0;

    monthRecords.forEach(rec => {
      if (rec.presentStudentIds?.includes(st.id)) present++;
      else if (rec.absentStudentIds?.includes(st.id)) absent++;
    });

    const pct = workingDays > 0 ? Number(((present / workingDays) * 100).toFixed(1)) : 100;
    const status = pct >= 85 ? 'Good' : pct >= 75 ? 'Satisfactory' : 'Shortage (<75%)';

    return [
      st.rollNo.toString(),
      st.name,
      workingDays.toString(),
      present.toString(),
      absent.toString(),
      `${pct}%`,
      status
    ];
  });

  autoTable(doc, {
    startY: startY + 2,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 30 }
  });

  addFooter(doc, teacher, school.principalName);
  return doc;
}

/**
 * 4. DAILY ATTENDANCE & ABSENT STUDENTS REPORT PDF
 * Privacy rule: Excludes admission number and phone numbers
 */
export function generateAbsentReportPDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  date: string,
  students: Student[],
  record: AttendanceRecord | undefined
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = addHeader(doc, school, classInfo, teacher, `DAILY ATTENDANCE & ABSENTEE REPORT`, `Date: ${date}  |  Total Enrolled: ${students.length}`);

  const presentCount = record?.presentStudentIds?.length ?? 0;
  const absentCount = record?.absentStudentIds?.length ?? 0;
  const total = presentCount + absentCount || students.length;
  const attPct = total > 0 ? ((presentCount / total) * 100).toFixed(1) : '100';

  // Stats Summary
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(241, 245, 249);
  doc.rect(14, startY + 2, pageWidth - 28, 12, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, startY + 2, pageWidth - 28, 12, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(`Total Students: ${students.length}   •   Present: ${presentCount}   •   Absent: ${absentCount}   •   Attendance: ${attPct}%`, 18, startY + 10);

  // Absent students table
  const absentStudents = students.filter(s => record?.absentStudentIds?.includes(s.id)).sort((a, b) => a.rollNo - b.rollNo);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(`ABSENT STUDENTS LIST (${absentStudents.length})`, 14, startY + 22);

  const head = [['Sl No', 'Roll No', 'Student Name', 'Parent / Guardian', 'Attendance Status']];
  const body = absentStudents.map((st, idx) => [
    (idx + 1).toString(),
    st.rollNo.toString(),
    st.name,
    st.parentName || 'N/A',
    'Absent'
  ]);

  if (body.length === 0) {
    body.push(['-', '-', 'All Students Were Present on this Date!', '-', '-']);
  }

  autoTable(doc, {
    startY: startY + 25,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 3 },
    headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14, bottom: 30 }
  });

  addFooter(doc, teacher, school.principalName);
  return doc;
}

/**
 * 5. COMPLETE APPLICATION DOSSIER PDF
 * Privacy rule: Excludes admission numbers and mobile numbers
 */
export function generateFullSchoolDataPDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  students: Student[],
  attendance: AttendanceRecord[],
  exams: Exam[],
  examMarks: Record<string, ExamMarksRecord>
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = addHeader(doc, school, classInfo, teacher, 'COMPREHENSIVE CLASS DOSSIER & MASTER REPORT', `Full Academic, Student, and Attendance Dossier`);

  // 1. School & Teacher Summary
  autoTable(doc, {
    startY: startY + 2,
    head: [['Section', 'Institutional Details']],
    body: [
      ['School Name & Code', `${school.schoolName} (Code: ${school.schoolCode})`],
      ['Address & Contact', `${school.schoolAddress} | Ph: ${school.schoolPhone} | ${school.schoolEmail}`],
      ['Principal', `${school.principalName} (Ph: ${school.principalPhone})`],
      ['Class & Stream', `${classInfo.className} - Standard: ${classInfo.standard}, Stream: ${classInfo.stream}, Section: ${classInfo.section}`],
      ['Academic Year & Strength', `Year: ${classInfo.academicYear} | Strength: ${students.length} Registered Students`],
      ['Class Teacher', `${teacher.teacherName} (${teacher.designation}) | Ph: ${teacher.phone} | ${teacher.email}`]
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: 14, right: 14 }
  });

  // 2. Student Master List (Excludes admission numbers and mobile numbers)
  const studentsY = ((doc as any).lastAutoTable?.finalY ?? 90) + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('I. REGISTERED STUDENTS MASTER LIST', 14, studentsY);

  const studentRows = [...students].sort((a, b) => a.rollNo - b.rollNo).map(s => [
    s.rollNo.toString(),
    s.name,
    s.gender.toUpperCase(),
    s.division || classInfo.section || '-',
    s.parentName || '-'
  ]);

  autoTable(doc, {
    startY: studentsY + 3,
    head: [['R.No', 'Student Name', 'Gender', 'Division', 'Parent / Guardian']],
    body: studentRows,
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  // 3. Exams Summary
  doc.addPage();
  addHeader(doc, school, classInfo, teacher, 'COMPREHENSIVE CLASS DOSSIER — EXAMINATIONS');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('II. CONDUCTED EXAMINATIONS & SUBJECTS', 14, 65);

  const examRows = exams.map(e => [
    e.name,
    e.type,
    e.date,
    e.subjects.map(s => `${s.name} (${s.maxMarks})`).join(', ')
  ]);

  autoTable(doc, {
    startY: 68,
    head: [['Exam Name', 'Type', 'Date', 'Subjects & Max Marks']],
    body: examRows.length > 0 ? examRows : [['No exams created', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 3: { halign: 'left' } },
    margin: { left: 14, right: 14 }
  });

  addFooter(doc, teacher, school.principalName);
  return doc;
}

/**
 * Universal Native Android Share or Download handler
 */
export async function shareOrDownloadPDF(doc: jsPDF, filename: string, title: string, fallbackText?: string): Promise<boolean> {
  try {
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    // 1. Priority: Web Share API (Safest for Android WebViews & AppsGeyser to bypass native DownloadManager crashes)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: title,
          text: fallbackText || `HSS ALL IN ONE - ${title}`,
          files: [file]
        });
        return true;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return true; // User intentionally cancelled
        console.warn('Share API failed, falling back to safe download:', shareErr);
      }
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: fallbackText || `HSS ALL IN ONE - ${title}`,
        });
        // If file sharing is not supported but text sharing is, we still proceed to download fallback
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return true;
      }
    }

    // 2. Safe Fallback Download (Creates object URL, clicks, and cleans up safely without window.open or location.href)
    const url = window.URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Clean up safely to prevent memory leaks and without closing the app
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 1000);
    
    return true;

  } catch (err: any) {
    console.error('PDF generation/download error:', err);
    // Absolute fallback if Blob handling completely fails
    try {
      doc.save(filename);
    } catch (saveErr) {
      console.error('doc.save fallback also failed:', saveErr);
    }
    return true;
  }
}

/**
 * Share text list (e.g. absent list) to WhatsApp, SMS, or any Android app
 * Privacy rule: Sensitive student/parent mobile numbers and admission numbers are excluded
 */
export async function shareTextContent(title: string, text: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text
      });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return true;
    }
  }
  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

function getMonthNumber(monthName: string): number {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const idx = months.indexOf(monthName.toLowerCase());
  return idx !== -1 ? idx + 1 : new Date().getMonth() + 1;
}

export interface AttendancePDFOptions {
  reportType: 'class' | 'individual';
  selectedStudentId?: string;
  fromDate?: string;
  toDate?: string;
  periodLabel?: string;
}

/**
 * 5. COMPREHENSIVE ATTENDANCE HISTORY PDF
 * Exports classroom or individual student attendance history with custom date ranges
 */
export function generateAttendanceHistoryPDF(
  school: SchoolProfile,
  classInfo: ClassInfo,
  teacher: TeacherInfo,
  students: Student[],
  attendanceRecords: AttendanceRecord[],
  options: AttendancePDFOptions
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const { reportType, selectedStudentId, fromDate, toDate, periodLabel } = options;

  // Filter records by date range if specified
  const filteredRecords = attendanceRecords.filter(r => {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const workingDays = filteredRecords.length;
  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);

  if (reportType === 'individual' && selectedStudentId) {
    const student = students.find(s => s.id === selectedStudentId);
    const studentName = student ? student.name : 'Student';
    const rollNo = student ? student.rollNo : '-';

    const startY = addHeader(
      doc,
      school,
      classInfo,
      teacher,
      `INDIVIDUAL ATTENDANCE HISTORY REPORT`,
      `Student: ${studentName.toUpperCase()} (Roll #${rollNo})  |  Period: ${periodLabel || 'All Time'}`
    );

    let presentDays = 0;
    let absentDays = 0;

    const dailyRows = filteredRecords.map(rec => {
      const isPresent = rec.presentStudentIds?.includes(selectedStudentId);
      const isAbsent = rec.absentStudentIds?.includes(selectedStudentId);

      let status = 'PRESENT';
      if (isAbsent) {
        status = 'ABSENT';
        absentDays++;
      } else if (isPresent) {
        presentDays++;
      } else {
        presentDays++;
      }

      const dateObj = new Date(rec.date);
      const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });
      const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      return [formattedDate, dayName, status, rec.notes || '-'];
    });

    const attPct = workingDays > 0 ? ((presentDays / workingDays) * 100).toFixed(1) : '100';

    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY + 2, pageWidth - 28, 14, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, startY + 2, pageWidth - 28, 14, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SECONDARY_COLOR);
    doc.text(
      `Working Days: ${workingDays}   •   Present: ${presentDays}   •   Absent: ${absentDays}   •   Attendance: ${attPct}%`,
      18,
      startY + 11
    );

    autoTable(doc, {
      startY: startY + 20,
      head: [['Date', 'Day of Week', 'Attendance Status', 'Teacher Remarks']],
      body: dailyRows.length > 0 ? dailyRows : [['-', '-', 'No attendance records found', '-']],
      theme: 'grid',
      styles: { fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold' }, 3: { halign: 'left' } },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'ABSENT') {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'PRESENT') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14, bottom: 30 }
    });

    addFooter(doc, teacher, school.principalName);
    return doc;
  }

  // Classroom-wide Attendance Report
  const startY = addHeader(
    doc,
    school,
    classInfo,
    teacher,
    `CLASSROOM ATTENDANCE HISTORY REPORT`,
    `Period: ${periodLabel || `${fromDate || 'Beginning'} to ${toDate || 'Today'}`}  |  Total Working Days: ${workingDays}`
  );

  let totalClassPresents = 0;
  let totalPossiblePresents = workingDays * sortedStudents.length;

  const tableRows = sortedStudents.map(st => {
    let p = 0;
    let a = 0;

    filteredRecords.forEach(rec => {
      if (rec.presentStudentIds?.includes(st.id)) p++;
      else if (rec.absentStudentIds?.includes(st.id)) a++;
      else p++;
    });

    totalClassPresents += p;
    const pct = workingDays > 0 ? Number(((p / workingDays) * 100).toFixed(1)) : 100;
    const status = pct >= 85 ? 'Good' : pct >= 75 ? 'Satisfactory' : 'Shortage (<75%)';

    return [
      st.rollNo.toString(),
      st.name,
      workingDays.toString(),
      p.toString(),
      a.toString(),
      `${pct}%`,
      status
    ];
  });

  const overallClassPct = totalPossiblePresents > 0 ? ((totalClassPresents / totalPossiblePresents) * 100).toFixed(1) : '100';

  doc.setFillColor(241, 245, 249);
  doc.rect(14, startY + 2, pageWidth - 28, 12, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, startY + 2, pageWidth - 28, 12, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(
    `Enrolled Students: ${students.length}   •   Total School Days: ${workingDays}   •   Average Class Attendance: ${overallClassPct}%`,
    18,
    startY + 10
  );

  autoTable(doc, {
    startY: startY + 18,
    head: [['R.No', 'Student Name', 'Total Days', 'Days Present', 'Days Absent', 'Attendance %', 'Status']],
    body: tableRows.length > 0 ? tableRows : [['-', 'No students found', '0', '0', '0', '0%', '-']],
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 30 }
  });

  addFooter(doc, teacher, school.principalName);
  return doc;
}

// -------------------------------------------------------------
// SCHOOL ADMIN PDF EXPORT SUITE (VALID STANDALONE PDFs)
// -------------------------------------------------------------

export function generateSchoolAdminAuditPDF(
  school: SchoolProfile,
  admin: { adminName?: string; email?: string; schoolCode?: string },
  teachers: any[],
  classesList: any[],
  metrics: {
    totalStudents: number;
    overallAttendanceRate: number;
    overallAcademicAverage?: number;
  }
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top header banner
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(school.schoolName || "St. Sebastian's Higher Secondary School", pageWidth / 2, 11, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subText = [
    school.schoolAddress,
    admin.schoolCode || school.schoolCode ? `School Code: ${admin.schoolCode || school.schoolCode}` : '',
    school.schoolPhone ? `Ph: ${school.schoolPhone}` : ''
  ].filter(Boolean).join('  •  ');
  doc.text(subText, pageWidth / 2, 18, { align: 'center' });

  // Sub-bar
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 30, pageWidth - 28, 12, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 30, pageWidth - 28, 12, 'S');

  doc.setTextColor(...SECONDARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`CONSOLIDATED INSTITUTIONAL AUDIT & TEACHER DIRECTORY`, 18, 38);
  doc.text(`DATE: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 18, 38, { align: 'right' });

  // Summary Metrics Box
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('INSTITUTIONAL PERFORMANCE SUMMARY', 14, 50);

  const metricsData = [
    ['Total Registered Teachers', teachers.length.toString()],
    ['Active Classrooms', classesList.length.toString()],
    ['Total Enrolled Students', metrics.totalStudents.toString()],
    ['Overall Attendance Rate', `${metrics.overallAttendanceRate}%`],
    ['Academic Average Performance', `${metrics.overallAcademicAverage || 0}%`]
  ];

  autoTable(doc, {
    startY: 54,
    body: metricsData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: SECONDARY_COLOR, cellWidth: 70 },
      1: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY_COLOR }
    },
    margin: { left: 14, right: 14 }
  });

  const nextY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('ASSOCIATED TEACHERS & ASSIGNED CLASSROOMS', 14, nextY);

  const teacherRows = teachers.map((t, idx) => [
    (idx + 1).toString(),
    t.name || 'Teacher',
    t.designation || 'Faculty',
    t.subject || t.primarySubject || 'General',
    t.assignedClass || '—',
    t.phone || '—',
    t.status === 'inactive' ? 'Inactive' : 'Active'
  ]);

  autoTable(doc, {
    startY: nextY + 4,
    head: [['#', 'Teacher Name', 'Designation', 'Subject', 'Assigned Class', 'Phone', 'Status']],
    body: teacherRows.length > 0 ? teacherRows : [['-', 'No teachers registered', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8.5, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' }, 4: { halign: 'left' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 30 }
  });

  // Footer signature
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 80, pageHeight - 24, pageWidth - 14, pageHeight - 24);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(`Principal / School Head (${admin.adminName || 'Authorized Signatory'})`, pageWidth - 80, pageHeight - 19);

  return doc;
}

export function generateSchoolAdminStudentsPDF(
  school: SchoolProfile,
  admin: { adminName?: string; email?: string; schoolCode?: string },
  students: any[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(school.schoolName || "St. Sebastian's Higher Secondary School", pageWidth / 2, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`School Code: ${admin.schoolCode || school.schoolCode || ''}  •  CONSOLIDATED STUDENTS ROSTER`, pageWidth / 2, 17, { align: 'center' });

  const studentRows = students.map((s, idx) => [
    (idx + 1).toString(),
    s.admissionNo || s.rollNo || '-',
    s.name || '-',
    s.className || `${s.standard || ''} ${s.stream || ''} ${s.section || ''}`.trim() || '-',
    s.gender ? s.gender.toUpperCase() : '-',
    s.parentPhone || s.phone || '-',
    s.attendancePercentage !== undefined ? `${s.attendancePercentage}%` : '—'
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Adm / Roll', 'Student Name', 'Classroom', 'Gender', 'Contact Phone', 'Att %']],
    body: studentRows.length > 0 ? studentRows : [['-', '-', 'No students enrolled', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  return doc;
}

export function generateSchoolAdminTeachersPDF(
  school: SchoolProfile,
  admin: { adminName?: string; email?: string; schoolCode?: string },
  teachers: any[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(school.schoolName || "St. Sebastian's Higher Secondary School", pageWidth / 2, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`School Code: ${admin.schoolCode || school.schoolCode || ''}  •  FACULTY & TEACHER DIRECTORY`, pageWidth / 2, 17, { align: 'center' });

  const teacherRows = teachers.map((t, idx) => [
    (idx + 1).toString(),
    t.name || 'Teacher',
    t.email || t.gmail || '-',
    t.subject || t.primarySubject || 'General',
    t.assignedClass || '—',
    t.dob || '—',
    t.phone || '—',
    t.status === 'inactive' ? 'Inactive' : 'Active'
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Teacher Name', 'Email', 'Subject', 'Class Assigned', 'DOB', 'Phone', 'Status']],
    body: teacherRows.length > 0 ? teacherRows : [['-', 'No teachers registered', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  return doc;
}

