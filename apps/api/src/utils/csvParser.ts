/**
 * CSV / plain-text email address parser.
 * Supports:
 * - CSV with headers: email, Email, email_address, EMAIL, etc.
 * - Plain text, one address per line
 * - Comma-separated addresses
 * - Deduplication
 * - Validation
 */

// RFC 5322 simplified email regex
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

const KNOWN_EMAIL_HEADERS = new Set([
  'email',
  'email_address',
  'emailaddress',
  'e-mail',
  'e_mail',
  'mail',
]);

export interface ParseResult {
  valid: string[];
  invalid: string[];
  duplicates: number;
  total: number;
}

/**
 * Parse a CSV or plain-text file buffer and extract unique valid email addresses.
 */
export function parseEmailFile(content: string): ParseResult {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { valid: [], invalid: [], duplicates: 0, total: 0 };
  }

  const allCandidates: string[] = [];

  // Detect if this looks like a CSV (contains commas)
  const firstLine = lines[0];
  const isCSV = firstLine.includes(',');

  if (isCSV) {
    // Parse CSV
    const headers = firstLine
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

    const emailColIndex = headers.findIndex((h) => KNOWN_EMAIL_HEADERS.has(h));

    if (emailColIndex !== -1) {
      // Has a recognized email header — skip first row
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const candidate = cols[emailColIndex]?.trim().replace(/['"]/g, '');
        if (candidate) allCandidates.push(candidate);
      }
    } else {
      // No recognized header — treat all comma-separated values as potential emails
      for (const line of lines) {
        const cols = parseCSVLine(line);
        for (const col of cols) {
          const candidate = col.trim().replace(/['"]/g, '');
          if (candidate) allCandidates.push(candidate);
        }
      }
    }
  } else {
    // Plain text — one email per line
    for (const line of lines) {
      allCandidates.push(line.replace(/['"]/g, '').trim());
    }
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const candidate of allCandidates) {
    if (!candidate) continue;
    const normalized = candidate.toLowerCase();

    if (seen.has(normalized)) {
      duplicates++;
      continue;
    }
    seen.add(normalized);

    if (isValidEmail(candidate)) {
      valid.push(normalized);
    } else {
      invalid.push(candidate);
    }
  }

  return {
    valid,
    invalid,
    duplicates,
    total: allCandidates.length,
  };
}

/** Basic CSV line parser that handles quoted fields. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
