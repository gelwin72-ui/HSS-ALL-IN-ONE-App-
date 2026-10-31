import { Student, AttendanceRecord, SchoolProfile, ClassInfo, TeacherInfo, Gender } from '../types';
import { CSVParseResult } from './csvHelper';

/**
 * Download helper for SVG files
 */
export function downloadSVGFile(svgContent: string, fileName: string) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.svg') ? fileName : `${fileName}.svg`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXML(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 1. EXPORT STUDENTS AS DETAILED SVG
 * Contains sensitive information: Admission No, Student Phone, Parent's Name, Parent's Phone, DOB, Gender
 * Also embeds structured machine-readable metadata so it can be re-imported via Import SVG!
 */
export function exportStudentsToSVG(
  students: Student[],
  classInfo: ClassInfo,
  school?: SchoolProfile,
  teacher?: TeacherInfo
): string {
  const sorted = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const rowHeight = 36;
  const headerHeight = 160;
  const tableHeaderHeight = 40;
  const padding = 30;
  const width = 1200;
  const height = headerHeight + tableHeaderHeight + sorted.length * rowHeight + padding * 2 + 50;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Columns definition: x position, width, label
  const cols = [
    { key: 'rollNo', label: 'Roll No', width: 80, x: padding },
    { key: 'admissionNo', label: 'Admission No', width: 140, x: padding + 80 },
    { key: 'name', label: 'Student Full Name', width: 220, x: padding + 220 },
    { key: 'phone', label: 'Student Phone', width: 140, x: padding + 440 },
    { key: 'parentName', label: "Parent's Name", width: 180, x: padding + 580 },
    { key: 'parentPhone', label: "Parent's Phone", width: 140, x: padding + 760 },
    { key: 'gender', label: 'Gender', width: 80, x: padding + 900 },
    { key: 'dob', label: 'Date of Birth', width: 110, x: padding + 980 },
    { key: 'division', label: 'Division/Notes', width: 110, x: padding + 1090 }
  ];

  // Serialized raw JSON embedded inside SVG XML for lossless re-import
  const rawDataJSON = JSON.stringify(
    sorted.map(s => ({
      rollNo: s.rollNo,
      admissionNo: s.admissionNo,
      name: s.name,
      phone: s.phone || '',
      parentName: s.parentName || '',
      parentPhone: s.parentPhone || '',
      gender: s.gender,
      dob: s.dob || '',
      address: s.address || '',
      bloodGroup: s.bloodGroup || '',
      division: s.division || '',
      notes: s.notes || ''
    }))
  );

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4c1d95" />
      <stop offset="50%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="tableHeadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Embedded Machine-Readable Student Data for Import SVG Feature -->
  <metadata id="hss-student-data" data-format="hss-student-roster" data-count="${sorted.length}">
    <![CDATA[${rawDataJSON}]]>
  </metadata>

  <style>
    .title { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 800; font-size: 24px; fill: #ffffff; }
    .subtitle { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 500; font-size: 13px; fill: #c4b5fd; }
    .meta { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 600; font-size: 12px; fill: #e0e7ff; }
    .th { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 12px; fill: #ffffff; text-transform: uppercase; }
    .td { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 500; font-size: 12px; fill: #1f2937; }
    .td-bold { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 12px; fill: #111827; }
    .td-phone { font-family: 'Courier New', monospace; font-weight: 600; font-size: 11.5px; fill: #4338ca; }
    .td-adm { font-family: 'Courier New', monospace; font-weight: 700; font-size: 11px; fill: #6b21a8; }
    .badge { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 10px; fill: #ffffff; }
    .footer-text { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 11px; fill: #6b7280; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#f8fafc" rx="16" />

  <!-- Top Header Card -->
  <g filter="url(#shadow)">
    <rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${headerHeight - 20}" rx="12" fill="url(#headerGrad)" />
  </g>

  <!-- School and Header Text -->
  <text x="${padding + 24}" y="${padding + 40}" class="title">${escapeXML(school?.schoolName || "St. Sebastian's Higher Secondary School")}</text>
  <text x="${padding + 24}" y="${padding + 64}" class="subtitle">${escapeXML(school?.schoolAddress || 'Kerala, India')} • School Code: ${escapeXML(school?.schoolCode || 'SSHSS@111213')} • Official Student Register</text>

  <!-- Sub Meta Bar -->
  <rect x="${padding + 24}" y="${padding + 82}" width="${width - padding * 2 - 48}" height="32" rx="8" fill="#000000" fill-opacity="0.25" />
  <text x="${padding + 36}" y="${padding + 102}" class="meta">CLASS: ${escapeXML(classInfo.className || `${classInfo.standard} ${classInfo.stream}`)} (${escapeXML(classInfo.academicYear || '2025-2026')})</text>
  <text x="${width / 2}" y="${padding + 102}" text-anchor="middle" class="meta">TOTAL ENROLLED: ${sorted.length} STUDENTS</text>
  <text x="${width - padding - 36}" y="${padding + 102}" text-anchor="end" class="meta">TEACHER: ${escapeXML(teacher?.teacherName || 'Class Teacher')}</text>

  <!-- Table Container -->
  <g transform="translate(0, ${headerHeight + 10})">
    <!-- Table Header Background -->
    <rect x="${padding}" y="0" width="${width - padding * 2}" height="${tableHeaderHeight}" rx="8" fill="url(#tableHeadGrad)" />

    <!-- Table Header Columns -->
    <text x="${cols[0].x + 12}" y="25" class="th">${cols[0].label}</text>
    <text x="${cols[1].x + 10}" y="25" class="th">${cols[1].label}</text>
    <text x="${cols[2].x + 10}" y="25" class="th">${cols[2].label}</text>
    <text x="${cols[3].x + 10}" y="25" class="th">${cols[3].label}</text>
    <text x="${cols[4].x + 10}" y="25" class="th">${cols[4].label}</text>
    <text x="${cols[5].x + 10}" y="25" class="th">${cols[5].label}</text>
    <text x="${cols[6].x + 10}" y="25" class="th">${cols[6].label}</text>
    <text x="${cols[7].x + 10}" y="25" class="th">${cols[7].label}</text>
    <text x="${cols[8].x + 10}" y="25" class="th">${cols[8].label}</text>

    <!-- Table Rows -->
`;

  sorted.forEach((st, i) => {
    const y = tableHeaderHeight + i * rowHeight;
    const isEven = i % 2 === 0;
    const rowBg = isEven ? '#ffffff' : '#f1f5f9';

    svg += `
    <!-- Row ${i + 1} -->
    <g class="student-row" data-roll="${st.rollNo}" data-admission="${escapeXML(st.admissionNo)}" data-name="${escapeXML(st.name)}" data-phone="${escapeXML(st.phone || '')}" data-parent="${escapeXML(st.parentName || '')}" data-parentphone="${escapeXML(st.parentPhone || '')}" data-gender="${st.gender}" data-dob="${escapeXML(st.dob || '')}">
      <rect x="${padding}" y="${y}" width="${width - padding * 2}" height="${rowHeight}" fill="${rowBg}" stroke="#e2e8f0" stroke-width="0.5" />
      <text x="${cols[0].x + 16}" y="${y + 22}" class="td-bold">${st.rollNo}</text>
      <text x="${cols[1].x + 10}" y="${y + 22}" class="td-adm">${escapeXML(st.admissionNo || '-')}</text>
      <text x="${cols[2].x + 10}" y="${y + 22}" class="td-bold">${escapeXML(st.name)}</text>
      <text x="${cols[3].x + 10}" y="${y + 22}" class="td-phone">${escapeXML(st.phone || '-')}</text>
      <text x="${cols[4].x + 10}" y="${y + 22}" class="td">${escapeXML(st.parentName || '-')}</text>
      <text x="${cols[5].x + 10}" y="${y + 22}" class="td-phone">${escapeXML(st.parentPhone || '-')}</text>
      <text x="${cols[6].x + 10}" y="${y + 22}" class="td" style="text-transform: capitalize;">${escapeXML(st.gender)}</text>
      <text x="${cols[7].x + 10}" y="${y + 22}" class="td">${escapeXML(st.dob || '-')}</text>
      <text x="${cols[8].x + 10}" y="${y + 22}" class="td">${escapeXML(st.division || st.notes || '-')}</text>
    </g>`;
  });

  const footerY = headerHeight + tableHeaderHeight + sorted.length * rowHeight + 35;

  svg += `
  </g>

  <!-- Footer Info -->
  <text x="${padding}" y="${footerY}" class="footer-text">HSS ALL IN ONE — Confidential Student SVG Export — Generated on ${dateStr}</text>
  <text x="${width - padding}" y="${footerY}" text-anchor="end" class="footer-text">Valid Official Record • ${classInfo.className}</text>
</svg>`;

  return svg;
}

/**
 * 2. EXPORT ATTENDANCE REGISTER AS DETAILED SVG
 * Contains sensitive info: Admission No, Student Phone, Parent Phone, and daily present/absent matrix
 */
export function exportAttendanceToSVG(
  attendance: AttendanceRecord[],
  students: Student[],
  classInfo: ClassInfo,
  school?: SchoolProfile,
  teacher?: TeacherInfo
): string {
  const sortedStudents = [...students].sort((a, b) => a.rollNo - b.rollNo);
  const sortedDates = [...attendance].sort((a, b) => a.date.localeCompare(b.date));

  // Determine width based on number of dates (minimum 1300)
  const baseWidth = 850;
  const dateColWidth = 36;
  const dynamicWidth = Math.max(1300, baseWidth + sortedDates.length * dateColWidth + 240);
  const rowHeight = 34;
  const headerHeight = 150;
  const tableHeaderHeight = 40;
  const padding = 25;
  const height = headerHeight + tableHeaderHeight + sortedStudents.length * rowHeight + padding * 2 + 50;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dynamicWidth} ${height}" width="${dynamicWidth}" height="${height}">
  <defs>
    <linearGradient id="attHeaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065f46" />
      <stop offset="50%" stop-color="#047857" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="attTableHead" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>

  <style>
    .title { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 800; font-size: 22px; fill: #ffffff; }
    .subtitle { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 500; font-size: 13px; fill: #a7f3d0; }
    .meta { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 600; font-size: 12px; fill: #ecfdf5; }
    .th { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 11px; fill: #ffffff; text-transform: uppercase; }
    .th-date { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 9.5px; fill: #ffffff; text-anchor: middle; }
    .td { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 500; font-size: 11.5px; fill: #1f2937; }
    .td-bold { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 700; font-size: 11.5px; fill: #111827; }
    .td-phone { font-family: 'Courier New', monospace; font-weight: 600; font-size: 11px; fill: #047857; }
    .td-adm { font-family: 'Courier New', monospace; font-weight: 700; font-size: 10.5px; fill: #4338ca; }
    .status-p { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11px; fill: #059669; text-anchor: middle; }
    .status-a { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11px; fill: #e11d48; text-anchor: middle; }
    .status-blank { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; font-size: 11px; fill: #9ca3af; text-anchor: middle; }
    .footer-text { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 11px; fill: #6b7280; }
  </style>

  <!-- Background -->
  <rect width="${dynamicWidth}" height="${height}" fill="#f8fafc" rx="16" />

  <!-- Top Header Card -->
  <rect x="${padding}" y="${padding}" width="${dynamicWidth - padding * 2}" height="${headerHeight - 20}" rx="12" fill="url(#attHeaderGrad)" />

  <text x="${padding + 24}" y="${padding + 38}" class="title">${escapeXML(school?.schoolName || "St. Sebastian's Higher Secondary School")} — ATTENDANCE REGISTER</text>
  <text x="${padding + 24}" y="${padding + 62}" class="subtitle">${escapeXML(school?.schoolAddress || 'Kerala, India')} • School Code: ${escapeXML(school?.schoolCode || 'SSHSS@111213')} • Official Attendance Vector Export</text>

  <!-- Sub Meta Bar -->
  <rect x="${padding + 24}" y="${padding + 78}" width="${dynamicWidth - padding * 2 - 48}" height="32" rx="8" fill="#000000" fill-opacity="0.25" />
  <text x="${padding + 36}" y="${padding + 98}" class="meta">CLASS: ${escapeXML(classInfo.className)} (${escapeXML(classInfo.academicYear)})</text>
  <text x="${dynamicWidth / 2}" y="${padding + 98}" text-anchor="middle" class="meta">WORKING DAYS: ${sortedDates.length}  •  REGISTERED STUDENTS: ${sortedStudents.length}</text>
  <text x="${dynamicWidth - padding - 36}" y="${padding + 98}" text-anchor="end" class="meta">TEACHER: ${escapeXML(teacher?.teacherName || 'Class Teacher')}</text>

  <!-- Table Container -->
  <g transform="translate(0, ${headerHeight + 10})">
    <!-- Table Header Background -->
    <rect x="${padding}" y="0" width="${dynamicWidth - padding * 2}" height="${tableHeaderHeight}" rx="8" fill="url(#attTableHead)" />

    <!-- Table Header Static Columns -->
    <text x="${padding + 12}" y="25" class="th">R.No</text>
    <text x="${padding + 55}" y="25" class="th">Admission No</text>
    <text x="${padding + 175}" y="25" class="th">Student Name</text>
    <text x="${padding + 365}" y="25" class="th">Student Phone</text>
    <text x="${padding + 495}" y="25" class="th">Parent Phone</text>
`;

  // Date column headers
  let dateStartX = padding + 630;
  sortedDates.forEach((rec, dIdx) => {
    const dX = dateStartX + dIdx * dateColWidth;
    const formattedDay = rec.date.slice(5); // e.g. "08-25"
    svg += `    <text x="${dX + dateColWidth / 2}" y="25" class="th-date">${formattedDay}</text>\n`;
  });

  const statsStartX = dateStartX + sortedDates.length * dateColWidth;
  svg += `
    <text x="${statsStartX + 20}" y="25" class="th">Pres</text>
    <text x="${statsStartX + 65}" y="25" class="th">Abs</text>
    <text x="${statsStartX + 110}" y="25" class="th">Att %</text>
`;

  // Student rows
  sortedStudents.forEach((st, i) => {
    const y = tableHeaderHeight + i * rowHeight;
    const isEven = i % 2 === 0;
    const rowBg = isEven ? '#ffffff' : '#f1f5f9';

    let presentCount = 0;
    let absentCount = 0;

    let dateCells = '';
    sortedDates.forEach((rec, dIdx) => {
      const dX = dateStartX + dIdx * dateColWidth;
      if (rec.presentStudentIds?.includes(st.id)) {
        presentCount++;
        dateCells += `<text x="${dX + dateColWidth / 2}" y="${y + 21}" class="status-p">P</text>`;
      } else if (rec.absentStudentIds?.includes(st.id)) {
        absentCount++;
        dateCells += `<text x="${dX + dateColWidth / 2}" y="${y + 21}" class="status-a">A</text>`;
      } else {
        dateCells += `<text x="${dX + dateColWidth / 2}" y="${y + 21}" class="status-blank">-</text>`;
      }
    });

    const totalD = sortedDates.length;
    const pct = totalD > 0 ? ((presentCount / totalD) * 100).toFixed(1) : '100';

    svg += `
    <!-- Row ${st.rollNo} -->
    <g>
      <rect x="${padding}" y="${y}" width="${dynamicWidth - padding * 2}" height="${rowHeight}" fill="${rowBg}" stroke="#e2e8f0" stroke-width="0.5" />
      <text x="${padding + 16}" y="${y + 21}" class="td-bold">${st.rollNo}</text>
      <text x="${padding + 55}" y="${y + 21}" class="td-adm">${escapeXML(st.admissionNo || '-')}</text>
      <text x="${padding + 175}" y="${y + 21}" class="td-bold">${escapeXML(st.name)}</text>
      <text x="${padding + 365}" y="${y + 21}" class="td-phone">${escapeXML(st.phone || '-')}</text>
      <text x="${padding + 495}" y="${y + 21}" class="td-phone">${escapeXML(st.parentPhone || '-')}</text>
      ${dateCells}
      <text x="${statsStartX + 25}" y="${y + 21}" class="td-bold" fill="#059669">${presentCount}</text>
      <text x="${statsStartX + 70}" y="${y + 21}" class="td-bold" fill="#e11d48">${absentCount}</text>
      <text x="${statsStartX + 115}" y="${y + 21}" class="td-bold">${pct}%</text>
    </g>`;
  });

  const footerY = headerHeight + tableHeaderHeight + sortedStudents.length * rowHeight + 35;

  svg += `
  </g>

  <!-- Footer -->
  <text x="${padding}" y="${footerY}" class="footer-text">HSS ALL IN ONE — Official Attendance Register SVG — Generated on ${dateStr}</text>
  <text x="${dynamicWidth - padding}" y="${footerY}" text-anchor="end" class="footer-text">Complete Record with Student & Parent Contact Numbers</text>
</svg>`;

  return svg;
}

/**
 * 3. IMPORT SVG & DOCUMENT PARSER
 * Parses SVG files (or plain text / documents) and extracts structured student data step-by-step
 */
export function parseStudentsSVG(svgContent: string, existingRollNumbers: number[] = []): CSVParseResult {
  const validStudents: Omit<Student, 'id' | 'createdAt'>[] = [];
  const errors: { row: number; reason: string; raw: string }[] = [];
  const duplicateRolls: number[] = [];
  const seenRolls = new Set<number>(existingRollNumbers);

  try {
    // 1. First check if SVG has embedded machine-readable <metadata id="hss-student-data">
    const metadataMatch = svgContent.match(/<metadata[^>]*id=["']hss-student-data["'][^>]*>([\s\S]*?)<\/metadata>/i);
    if (metadataMatch && metadataMatch[1]) {
      const cdataClean = metadataMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
      try {
        const parsedJson = JSON.parse(cdataClean);
        if (Array.isArray(parsedJson) && parsedJson.length > 0) {
          parsedJson.forEach((item, idx) => {
            const rollNo = parseInt(String(item.rollNo || idx + 1), 10);
            if (isNaN(rollNo) || rollNo <= 0) {
              errors.push({ row: idx + 1, reason: `Invalid roll number: "${item.rollNo}"`, raw: JSON.stringify(item) });
              return;
            }
            if (seenRolls.has(rollNo)) {
              duplicateRolls.push(rollNo);
              errors.push({ row: idx + 1, reason: `Duplicate roll number: ${rollNo}`, raw: JSON.stringify(item) });
              return;
            }
            seenRolls.add(rollNo);
            validStudents.push({
              rollNo,
              admissionNo: item.admissionNo || `ADM-${1000 + rollNo}`,
              name: item.name || `Student ${rollNo}`,
              phone: item.phone || '',
              parentName: item.parentName || '',
              parentPhone: item.parentPhone || '',
              gender: (item.gender === 'female' || item.gender === 'other') ? item.gender : 'male',
              dob: item.dob || '2008-01-01',
              address: item.address || '',
              bloodGroup: item.bloodGroup || '',
              division: item.division || '',
              notes: item.notes || ''
            });
          });

          if (validStudents.length > 0) {
            return {
              validStudents,
              errors,
              duplicateRolls,
              totalRows: parsedJson.length
            };
          }
        }
      } catch (e) {
        // Fallback to DOM / XML parsing
      }
    }

    // 2. Parse using DOMParser for XML / SVG nodes
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for student-row groups (like in our export format)
    const rowNodes = doc.querySelectorAll('g.student-row, g[data-roll], g[data-name]');
    if (rowNodes.length > 0) {
      rowNodes.forEach((row, idx) => {
        const rollStr = row.getAttribute('data-roll') || String(idx + 1);
        const rollNo = parseInt(rollStr, 10);
        const name = row.getAttribute('data-name') || '';
        const admissionNo = row.getAttribute('data-admission') || `ADM-${1000 + (isNaN(rollNo) ? idx + 1 : rollNo)}`;
        const phone = row.getAttribute('data-phone') || '';
        const parentName = row.getAttribute('data-parent') || '';
        const parentPhone = row.getAttribute('data-parentphone') || '';
        const rawGender = (row.getAttribute('data-gender') || 'male').toLowerCase();
        const gender: Gender = (rawGender === 'female' || rawGender === 'other') ? (rawGender as Gender) : 'male';
        const dob = row.getAttribute('data-dob') || '2008-01-01';

        if (isNaN(rollNo) || rollNo <= 0) {
          errors.push({ row: idx + 1, reason: `Invalid roll number in SVG node: "${rollStr}"`, raw: row.outerHTML });
          return;
        }

        if (seenRolls.has(rollNo)) {
          duplicateRolls.push(rollNo);
          errors.push({ row: idx + 1, reason: `Duplicate roll number: ${rollNo}`, raw: row.outerHTML });
          return;
        }

        seenRolls.add(rollNo);
        validStudents.push({
          rollNo,
          admissionNo,
          name: name || `Student ${rollNo}`,
          phone,
          parentName,
          parentPhone,
          gender,
          dob,
          address: '',
          bloodGroup: 'O+',
          division: '',
          notes: ''
        });
      });

      if (validStudents.length > 0) {
        return {
          validStudents,
          errors,
          duplicateRolls,
          totalRows: rowNodes.length
        };
      }
    }

    // 3. Fallback: Parse text nodes from any general SVG table
    const textNodes = Array.from(doc.querySelectorAll('text')).map(t => t.textContent?.trim() || '');
    const cleanLines = textNodes.filter(t => t.length > 0);

    // Try finding structured patterns (e.g. Roll, Adm, Name, Phone...)
    let currentRoll = 1;
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      // Check if line looks like "1" or "Roll 1" followed by student name
      const numMatch = line.match(/^(\d+)$/);
      if (numMatch && i + 1 < cleanLines.length) {
        const potentialRoll = parseInt(numMatch[1], 10);
        if (potentialRoll > 0 && potentialRoll < 500 && !seenRolls.has(potentialRoll)) {
          const nextText = cleanLines[i + 1];
          // If next is not a single number, it might be admission or name
          if (nextText && !nextText.match(/^\d+$/) && nextText.length > 2) {
            seenRolls.add(potentialRoll);
            validStudents.push({
              rollNo: potentialRoll,
              admissionNo: `ADM-${1000 + potentialRoll}`,
              name: nextText,
              phone: '',
              parentName: '',
              parentPhone: '',
              gender: 'male',
              dob: '2008-01-01',
              address: '',
              bloodGroup: 'O+',
              division: '',
              notes: ''
            });
            currentRoll = potentialRoll + 1;
            i++; // skip name
          }
        }
      }
    }
  } catch (err: any) {
    errors.push({ row: 0, reason: `Failed to parse SVG structure: ${err.message || 'Invalid format'}`, raw: '' });
  }

  return {
    validStudents,
    errors,
    duplicateRolls,
    totalRows: validStudents.length + errors.length
  };
}
