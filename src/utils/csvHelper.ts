import { Student, Gender, AttendanceRecord, Exam, ExamMarksRecord } from '../types';

export interface CSVParseResult {
  validStudents: Omit<Student, 'id' | 'createdAt'>[];
  errors: { row: number; reason: string; raw: string }[];
  duplicateRolls: number[];
  totalRows: number;
}

/**
 * Parses raw CSV string into student candidate records with validations
 */
export function parseStudentsCSV(csvText: string, existingRollNumbers: number[] = []): CSVParseResult {
  const lines = csvText.trim().split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { validStudents: [], errors: [{ row: 0, reason: 'File is empty', raw: '' }], duplicateRolls: [], totalRows: 0 };
  }

  // Parse header line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

  const rollIdx = headers.findIndex(h => h.includes('roll') || h === 'rno');
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
  const admIdx = headers.findIndex(h => h.includes('adm') || h.includes('admission') || h.includes('id'));
  const phoneIdx = headers.findIndex(h => h === 'phone' || h.includes('studentphone') || h.includes('mobile'));
  const parentNameIdx = headers.findIndex(h => h.includes('parent') || h.includes('guardian') || h.includes('father'));
  const parentPhoneIdx = headers.findIndex(h => h.includes('parentphone') || h.includes('guardianphone') || h.includes('parentmobile') || (h.includes('parent') && h.includes('phone')));
  const genderIdx = headers.findIndex(h => h.includes('gender') || h.includes('sex'));
  const dobIdx = headers.findIndex(h => h.includes('dob') || h.includes('birth'));
  const addressIdx = headers.findIndex(h => h.includes('address') || h.includes('location'));
  const bloodIdx = headers.findIndex(h => h.includes('blood') || h.includes('group'));
  const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('remark'));

  const validStudents: Omit<Student, 'id' | 'createdAt'>[] = [];
  const errors: { row: number; reason: string; raw: string }[] = [];
  const seenRolls = new Set<number>(existingRollNumbers);
  const duplicateRolls: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const columns = parseCSVLine(rawLine);

    if (columns.length === 0 || columns.every(c => c.trim() === '')) {
      continue; // Skip empty line
    }

    const rowNum = i + 1;

    // Roll Number validation
    const rawRoll = rollIdx !== -1 ? columns[rollIdx]?.trim() : String(i);
    const rollNo = parseInt(rawRoll, 10);
    if (isNaN(rollNo) || rollNo <= 0) {
      errors.push({ row: rowNum, reason: `Invalid roll number: "${rawRoll}"`, raw: rawLine });
      continue;
    }

    if (seenRolls.has(rollNo)) {
      errors.push({ row: rowNum, reason: `Duplicate roll number: ${rollNo}`, raw: rawLine });
      duplicateRolls.push(rollNo);
      continue;
    }

    // Name validation
    const name = nameIdx !== -1 ? columns[nameIdx]?.trim() : columns[1]?.trim() || '';
    if (!name) {
      errors.push({ row: rowNum, reason: 'Student name is missing', raw: rawLine });
      continue;
    }

    // Admission No
    const admissionNo = admIdx !== -1 ? columns[admIdx]?.trim() : `ADM-${1000 + rollNo}`;
    const phone = phoneIdx !== -1 ? columns[phoneIdx]?.trim() : '';
    const parentName = parentNameIdx !== -1 ? columns[parentNameIdx]?.trim() : '';
    const parentPhone = parentPhoneIdx !== -1 ? columns[parentPhoneIdx]?.trim() : '';
    
    // Gender
    let gender: Gender = 'other';
    const rawGender = genderIdx !== -1 ? columns[genderIdx]?.toLowerCase().trim() : '';
    if (rawGender.startsWith('m') || rawGender === 'boy') gender = 'male';
    else if (rawGender.startsWith('f') || rawGender === 'girl') gender = 'female';

    const dob = dobIdx !== -1 ? columns[dobIdx]?.trim() : '2008-01-01';
    const address = addressIdx !== -1 ? columns[addressIdx]?.trim() : '';
    const bloodGroup = bloodIdx !== -1 ? columns[bloodIdx]?.trim() : '';
    const notes = notesIdx !== -1 ? columns[notesIdx]?.trim() : '';

    seenRolls.add(rollNo);
    validStudents.push({
      rollNo,
      admissionNo: admissionNo || `ADM-${1000 + rollNo}`,
      name,
      phone,
      parentName,
      parentPhone,
      gender,
      dob,
      address,
      bloodGroup,
      notes
    });
  }

  return {
    validStudents,
    errors,
    duplicateRolls,
    totalRows: lines.length - 1
  };
}

/**
 * Standard CSV line parser handling quoted commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Downloads a string file in the browser
 */
export function downloadFile(content: string, fileName: string, contentType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads the sample CSV template
 */
export function downloadSampleStudentCSV() {
  const headers = ['Roll Number', 'Admission Number', 'Full Name', 'Phone Number', 'Parent Name', 'Parent Phone Number', 'Gender', 'Date of Birth (YYYY-MM-DD)', 'Address', 'Blood Group', 'Notes'];

  const csvContent = [
    headers.map(escapeCSVCell).join(',')
  ].join('\r\n');

  downloadFile(csvContent, 'HSS_Student_Import_Template.csv');
}

/**
 * Exports registered students to CSV
 */
export function exportStudentsToCSV(students: Student[], className: string = 'HSS_Class') {
  const headers = ['Roll Number', 'Admission Number', 'Full Name', 'Phone', 'Parent/Guardian', 'Parent Phone', 'Gender', 'Date of Birth', 'Blood Group', 'Address', 'Notes'];
  
  const rows = students
    .sort((a, b) => a.rollNo - b.rollNo)
    .map(st => [
      st.rollNo.toString(),
      st.admissionNo,
      st.name,
      st.phone || '',
      st.parentName || '',
      st.parentPhone || '',
      st.gender,
      st.dob || '',
      st.bloodGroup || '',
      st.address || '',
      st.notes || ''
    ]);

  const csvContent = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map(row => row.map(escapeCSVCell).join(','))
  ].join('\r\n');

  const filename = `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Students_List.csv`;
  downloadFile(csvContent, filename);
}

/**
 * Exports attendance records to CSV
 */
export function exportAttendanceToCSV(attendance: AttendanceRecord[], students: Student[], className: string = 'HSS_Class') {
  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const sortedDates = [...attendance].sort((a, b) => a.date.localeCompare(b.date));

  const headers = ['Roll No', 'Admission No', 'Student Name', ...sortedDates.map(d => d.date), 'Total Present', 'Total Absent', 'Percentage'];

  const rows = sortedStudents.map(st => {
    let presentCount = 0;
    let absentCount = 0;

    const dateStatuses = sortedDates.map(rec => {
      if (rec.presentStudentIds?.includes(st.id)) {
        presentCount++;
        return 'P';
      } else if (rec.absentStudentIds?.includes(st.id)) {
        absentCount++;
        return 'A';
      } else {
        return '-';
      }
    });

    const totalDays = sortedDates.length;
    const percentage = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) + '%' : '100%';

    return [
      st.rollNo.toString(),
      st.admissionNo,
      st.name,
      ...dateStatuses,
      presentCount.toString(),
      absentCount.toString(),
      percentage
    ];
  });

  const csvContent = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map(row => row.map(escapeCSVCell).join(','))
  ].join('\r\n');

  downloadFile(csvContent, `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance_Register.csv`);
}

/**
 * Exports exam marks to CSV
 */
export function exportExamMarksToCSV(exam: Exam, marksRecord: ExamMarksRecord | undefined, students: Student[]) {
  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const subjectHeaders = exam.subjects.map(s => `${s.name} (Max ${s.maxMarks})`);
  const headers = ['Roll No', 'Admission No', 'Student Name', ...subjectHeaders, 'Total Marks', 'Max Total', 'Percentage', 'Grade', 'Rank', 'Status'];

  const rows = sortedStudents.map(st => {
    const markData = marksRecord?.marks?.[st.id];
    const subValues = exam.subjects.map(sub => {
      if (markData?.isAbsent?.[sub.id]) return 'AB';
      const m = markData?.marks?.[sub.id];
      return m !== undefined && m !== null ? String(m) : '-';
    });

    return [
      st.rollNo.toString(),
      st.admissionNo,
      st.name,
      ...subValues,
      markData?.totalObtained !== undefined ? String(markData.totalObtained) : '-',
      markData?.totalMax !== undefined ? String(markData.totalMax) : '-',
      markData?.percentage !== undefined ? `${markData.percentage}%` : '-',
      markData?.grade || '-',
      markData?.rank !== undefined ? String(markData.rank) : '-',
      markData?.status || '-'
    ];
  });

  const csvContent = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map(row => row.map(escapeCSVCell).join(','))
  ].join('\r\n');

  downloadFile(csvContent, `${exam.name.replace(/[^a-zA-Z0-9]/g, '_')}_Marks_Sheet.csv`);
}

function escapeCSVCell(cell: string | number): string {
  const str = String(cell ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
