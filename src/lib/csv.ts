export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Minimal RFC-4180 parser: quoted fields, escaped quotes, embedded commas and
 * newlines. Written rather than pulled in because a statement export is one
 * small file and a dependency here would be all cost.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM — Excel exports carry one and it corrupts the first header.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i++;
    } else if (ch === ',' || ch === ';') {
      endField();
      i++;
    } else if (ch === '\r') {
      i++;
    } else if (ch === '\n') {
      endRow();
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== '' || row.length > 0) endRow();

  const [headers = [], ...body] = rows;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

/**
 * Money as written by real exports: "1,234.56", "1 234,56", "€1,234.56",
 * "(45.00)" for negatives. Returns null when there's no number in there.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  s = s.replace(/[^\d.,]/g, ''); // drop currency symbols and spaces
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // European: 1.234,56 — dots group, comma decides the decimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * Dates as written by real exports: ISO, US and European orders. Returns the
 * first of that month, since earnings are stored monthly.
 */
export function parseMonth(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-01`;

  const monthYear = /^(\d{4})[/](\d{1,2})$/.exec(s);
  if (monthYear) return `${monthYear[1]}-${monthYear[2].padStart(2, '0')}-01`;

  const slash = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    // A value over 12 can only be a day, which settles the order. Otherwise
    // 01/03 is genuinely ambiguous, so assume day-first (European) — and the
    // import preview shows the parsed months so a wrong guess is visible.
    const month = b > 12 ? a : b;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  const named = new Date(s);
  if (!Number.isNaN(named.getTime())) {
    return `${named.getUTCFullYear()}-${String(named.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }
  return null;
}

/**
 * The exact day, when the value carries one.
 *
 * Returns null for month-only values like "2026-07" — inventing a day there
 * would put a whole month's revenue on the 1st and draw a spike that never
 * happened. Same ambiguity rule as parseMonth: day-first unless proven.
 */
export function parseDay(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const day = b > 12 ? b : a;
    const month = b > 12 ? a : b;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Named months, but ONLY when a day number is genuinely present. Handing a
  // month-only string to Date() yields the 1st, which would pile the whole
  // month onto one day. The negative lookahead stops "July 2026" matching its
  // year as a day.
  const hasDayToken =
    /^(?:[A-Za-z]{3,}\.?\s+\d{1,2}(?!\d)|\d{1,2}(?!\d)\s+[A-Za-z]{3,})/.test(s);
  if (hasDayToken) {
    const named = new Date(s);
    if (!Number.isNaN(named.getTime())) {
      // Read back the LOCAL components. Date() parsed this as local midnight,
      // so toISOString() would shift it a day earlier anywhere east of UTC.
      const y = named.getFullYear();
      const m = String(named.getMonth() + 1).padStart(2, '0');
      const d = String(named.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

export interface ImportRow {
  month: string;
  gross: number;
}

export interface ImportDay {
  day: string;
  gross: number;
}

/**
 * Sums transactions into monthly totals AND keeps the per-day detail.
 *
 * The daily rows are what make day and week charts possible; discarding them
 * (as an earlier version did) throws away resolution the file already has.
 */
export function buildImport(
  parsed: ParsedCsv,
  monthColumn: number,
  amountColumn: number,
): { rows: ImportRow[]; days: ImportDay[]; skipped: number } {
  const months = new Map<string, number>();
  const days = new Map<string, number>();
  let skipped = 0;

  const bump = (map: Map<string, number>, key: string, amount: number) => {
    map.set(key, Math.round(((map.get(key) ?? 0) + amount) * 100) / 100);
  };

  for (const row of parsed.rows) {
    const raw = row[monthColumn] ?? '';
    const month = parseMonth(raw);
    const amount = parseAmount(row[amountColumn] ?? '');
    if (!month || amount === null) {
      skipped++;
      continue;
    }
    bump(months, month, amount);
    const exactDay = parseDay(raw);
    if (exactDay) bump(days, exactDay, amount);
  }

  return {
    rows: [...months.entries()]
      .map(([month, gross]) => ({ month, gross }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    days: [...days.entries()]
      .map(([day, gross]) => ({ day, gross }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    skipped,
  };
}

/** Best-guess column indexes, so the picker starts on something sensible. */
export function guessColumns(headers: string[]): {
  month: number;
  amount: number;
} {
  const find = (patterns: RegExp[]) =>
    headers.findIndex((h) => patterns.some((p) => p.test(h)));
  const month = find([/date/i, /month/i, /period/i, /day/i]);
  const amount = find([/gross/i, /earn/i, /amount/i, /total/i, /net/i, /revenue/i]);
  return { month: month === -1 ? 0 : month, amount: amount === -1 ? 1 : amount };
}
