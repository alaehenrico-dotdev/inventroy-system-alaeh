// ============================================================
// Minimal RFC4180-ish CSV helpers - just enough for the Product
// Catalog import/export (quoted fields, escaped quotes, CRLF or
// LF row endings). No streaming, no third-party dependency: the
// catalog is a few dozen rows, not a few hundred thousand.
// ============================================================

// Parses CSV text into an array of row objects keyed by the header row.
// Blank lines are skipped. Every row is padded/truncated to the header's
// column count so a ragged row doesn't shift later fields silently.
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === '') continue; // blank line

    const record: Record<string, string> = {};
    header.forEach((key, col) => {
      record[key] = (row[col] ?? '').trim();
    });
    out.push(record);
  }

  return out;
}

// Splits raw CSV text into rows of raw (unquoted) field strings.
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalize CRLF -> LF up front; a literal \r inside a quoted field is
  // rare enough for this use case not to bother preserving.
  const src = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  // Flush the last field/row if the text didn't end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Quotes a field only when it needs it (contains a comma, quote, or newline).
function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Serializes an array of plain objects into CSV text using `columns` as
// both the header row and the per-row field order.
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c])).join(','));
  }
  return lines.join('\n');
}
