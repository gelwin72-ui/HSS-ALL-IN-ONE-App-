import * as pdfjsLib from 'pdfjs-dist';
import { Student, Gender } from '../types';

// Ensure PDF worker is set up
if (typeof window !== 'undefined' && pdfjsLib) {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    }
  } catch (e) {
    console.warn('PDF worker setup warning:', e);
  }
}

export interface ExtractedPDFStudent {
  rollNo: number;
  admissionNo: string;
  name: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  gender: Gender;
  dob?: string;
  division?: string;
  notes?: string;
}

export interface PDFParseResult {
  totalRows: number;
  validStudents: ExtractedPDFStudent[];
  duplicates: Array<{ student: ExtractedPDFStudent; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
}

/**
 * Extract raw text items from a PDF File or ArrayBuffer
 */
export async function extractTextFromPDF(fileOrBuffer: File | ArrayBuffer): Promise<string[][]> {
  const arrayBuffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const allPagesLines: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items by vertical position (Y coordinate)
    const lineMap: Map<number, Array<{ x: number; text: string }>> = new Map();

    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;

      const y = Math.round(item.transform[5]); // Y coordinate
      const x = Math.round(item.transform[4]); // X coordinate
      const text = item.str.trim();

      // Find closest existing Y key within 3.5 units
      let foundKey: number | null = null;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - y) <= 3.5) {
          foundKey = key;
          break;
        }
      }

      if (foundKey !== null) {
        lineMap.get(foundKey)!.push({ x, text });
      } else {
        lineMap.set(y, [{ x, text }]);
      }
    }

    // Sort Y keys descending (top to bottom of page)
    const sortedYKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const yKey of sortedYKeys) {
      const lineItems = lineMap.get(yKey)!;
      // Sort items left to right
      lineItems.sort((a, b) => a.x - b.x);

      const lineCells = lineItems.map(i => i.text);
      if (lineCells.length > 0) {
        allPagesLines.push(lineCells);
      }
    }
  }

  return allPagesLines;
}

/**
 * Parse structured student records from extracted PDF text lines
 */
export function parseStudentsPDF(
  lines: string[][],
  existingRollNos: number[] = [],
  existingAdmissionNos: string[] = []
): PDFParseResult {
  const validStudents: ExtractedPDFStudent[] = [];
  const duplicates: Array<{ student: ExtractedPDFStudent; reason: string }> = [];
  const errors: Array<{ row: number; reason: string }> = [];

  let nextSuggestedRoll = existingRollNos.length > 0 ? Math.max(...existingRollNos) + 1 : 1;
  let totalRowsProcessed = 0;

  lines.forEach((lineCells, lineIndex) => {
    const lineStr = lineCells.join(' ');
    const lowerLine = lineStr.toLowerCase();

    // Skip table headers and metadata
    if (
      lowerLine.includes('roll') && (lowerLine.includes('name') || lowerLine.includes('student') || lowerLine.includes('adm')) ||
      lowerLine.includes('page ') || lowerLine.includes('school') || lowerLine.includes('register') ||
      lowerLine.includes('sl.no') || lowerLine.includes('sr.no')
    ) {
      return;
    }

    // Must contain some student-like content
    if (lineCells.length < 1 || lineStr.trim().length < 2) {
      return;
    }

    totalRowsProcessed++;

    // Extract potential fields
    let rollNo: number | null = null;
    let admissionNo = '';
    let name = '';
    let phone = '';
    let parentName = '';
    let parentPhone = '';
    let gender: Gender = 'male';
    let dob = '';
    let division = '';
    let notes = '';

    // Extract phone numbers (10 digits)
    const phoneMatches = lineStr.match(/\b[6-9]\d{9}\b/g) || [];
    if (phoneMatches.length > 0) {
      phone = phoneMatches[0];
      if (phoneMatches.length > 1) {
        parentPhone = phoneMatches[1];
      }
    }

    // Extract DOB (DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY)
    const dobMatch = lineStr.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/);
    if (dobMatch) {
      dob = dobMatch[0];
    }

    // Extract Gender
    if (/\b(female|girl|f)\b/i.test(lineStr)) {
      gender = 'female';
    } else if (/\b(male|boy|m)\b/i.test(lineStr)) {
      gender = 'male';
    }

    // Try cell-by-cell extraction first
    let textTokens: string[] = [];

    lineCells.forEach(cell => {
      const cleanCell = cell.trim();
      if (!cleanCell) return;

      // Check if pure integer (Roll No)
      if (rollNo === null && /^\d{1,3}$/.test(cleanCell)) {
        const val = parseInt(cleanCell, 10);
        if (val > 0 && val < 500) {
          rollNo = val;
          return;
        }
      }

      // Check if admission number pattern (e.g. ADM-2025-001, A-102, 12345)
      if (!admissionNo && /^(adm|reg|st|id|no)?[\-_]?\d{3,8}$/i.test(cleanCell)) {
        admissionNo = cleanCell.toUpperCase();
        return;
      }

      // Skip phone numbers and DOBs already processed
      if (cleanCell.match(/\b[6-9]\d{9}\b/) || cleanCell === dob) {
        return;
      }

      // Ignore gender cells
      if (/^(male|female|m|f|boy|girl)$/i.test(cleanCell)) {
        return;
      }

      textTokens.push(cleanCell);
    });

    // Fallback Roll No if not found in cells
    if (rollNo === null) {
      const firstNumMatch = lineStr.match(/^\s*(\d{1,3})\b/);
      if (firstNumMatch) {
        rollNo = parseInt(firstNumMatch[1], 10);
      } else {
        rollNo = nextSuggestedRoll;
        nextSuggestedRoll++;
      }
    }

    // Extract names from textTokens
    const cleanTokens = textTokens.filter(t => !/^\d+$/.test(t) && t.length > 1);
    if (cleanTokens.length > 0) {
      name = cleanTokens[0];
      if (cleanTokens.length > 1) {
        // If second token looks like a parent name
        if (cleanTokens[1].toLowerCase().startsWith('d/o') || cleanTokens[1].toLowerCase().startsWith('s/o') || cleanTokens.length >= 3) {
          parentName = cleanTokens.slice(1).join(' ').replace(/^(d\/o|s\/o|c\/o)\s*/i, '');
        } else {
          name = `${cleanTokens[0]} ${cleanTokens[1]}`;
          if (cleanTokens.length > 2) {
            parentName = cleanTokens.slice(2).join(' ');
          }
        }
      }
    } else {
      // Fallback name if missing
      name = `Student ${rollNo}`;
    }

    // Clean up name
    name = name.replace(/[^a-zA-Z\s\.\-']/g, '').trim();
    if (!name) name = `Student ${rollNo}`;

    // Auto admission number if missing
    if (!admissionNo) {
      admissionNo = `ADM-${new Date().getFullYear()}-${String(rollNo).padStart(3, '0')}`;
    }

    const studentRecord: ExtractedPDFStudent = {
      rollNo,
      admissionNo,
      name,
      phone,
      parentName,
      parentPhone,
      gender,
      dob,
      division,
      notes
    };

    // Check for duplicates
    const isDuplicateRoll = existingRollNos.includes(rollNo) || validStudents.some(s => s.rollNo === rollNo);
    const isDuplicateAdm = existingAdmissionNos.includes(admissionNo) || validStudents.some(s => s.admissionNo === admissionNo);

    if (isDuplicateRoll) {
      duplicates.push({
        student: studentRecord,
        reason: `Roll No ${rollNo} already exists in classroom`
      });
      // Adjust rollNo to avoid collision if importing
      studentRecord.rollNo = nextSuggestedRoll;
      nextSuggestedRoll++;
    }

    if (isDuplicateAdm) {
      duplicates.push({
        student: studentRecord,
        reason: `Admission No ${admissionNo} is already registered`
      });
      studentRecord.admissionNo = `${admissionNo}-DUP`;
    }

    validStudents.push(studentRecord);
  });

  return {
    totalRows: totalRowsProcessed,
    validStudents,
    duplicates,
    errors
  };
}
