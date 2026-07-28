import { describe, expect, it } from 'vitest';
import {
  buildImport,
  guessColumns,
  parseAmount,
  parseCsv,
  parseDay,
  parseMonth,
} from './csv';

describe('parseCsv', () => {
  it('reads headers and rows', () => {
    const { headers, rows } = parseCsv('Date,Gross\n2026-07-01,100\n2026-07-02,50\n');
    expect(headers).toEqual(['Date', 'Gross']);
    expect(rows).toEqual([
      ['2026-07-01', '100'],
      ['2026-07-02', '50'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const { rows } = parseCsv('a,b\n"x, y","he said ""hi"""\n');
    expect(rows[0]).toEqual(['x, y', 'he said "hi"']);
  });

  it('handles newlines inside quotes', () => {
    const { rows } = parseCsv('a,b\n"line1\nline2",2\n');
    expect(rows[0]).toEqual(['line1\nline2', '2']);
  });

  it('strips the BOM Excel puts on exports', () => {
    const { headers } = parseCsv('﻿Date,Gross\n2026-07-01,5\n');
    expect(headers[0]).toBe('Date');
  });

  it('accepts semicolon-separated files', () => {
    const { headers, rows } = parseCsv('Date;Gross\n2026-07-01;100\n');
    expect(headers).toEqual(['Date', 'Gross']);
    expect(rows[0]).toEqual(['2026-07-01', '100']);
  });

  it('ignores blank lines', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n\n3,4\n');
    expect(rows).toHaveLength(2);
  });
});

describe('parseAmount', () => {
  it('reads plain and thousands-separated numbers', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('reads European formatting', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1 234,56')).toBe(1234.56);
  });

  it('strips currency symbols', () => {
    expect(parseAmount('€1,234.56')).toBe(1234.56);
    expect(parseAmount('$99.00')).toBe(99);
  });

  it('reads negatives in both conventions', () => {
    expect(parseAmount('-45.00')).toBe(-45);
    expect(parseAmount('(45.00)')).toBe(-45);
  });

  it('returns null when there is no number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
  });
});

describe('parseMonth', () => {
  it('reads ISO dates', () => {
    expect(parseMonth('2026-07-26')).toBe('2026-07-01');
    expect(parseMonth('2026-07')).toBe('2026-07-01');
  });

  it('reads slash dates, using a day over 12 to settle the order', () => {
    expect(parseMonth('26/07/2026')).toBe('2026-07-01');
    expect(parseMonth('07/26/2026')).toBe('2026-07-01');
  });

  it('reads two-digit years', () => {
    expect(parseMonth('01/03/26')).toBe('2026-03-01');
  });

  it('returns null for nonsense', () => {
    expect(parseMonth('')).toBeNull();
    expect(parseMonth('not a date')).toBeNull();
  });
});

describe('parseDay', () => {
  it('reads a full ISO date', () => {
    expect(parseDay('2026-07-26')).toBe('2026-07-26');
  });

  it('reads slash dates, using a value over 12 to settle the order', () => {
    expect(parseDay('26/07/2026')).toBe('2026-07-26');
    expect(parseDay('07/26/2026')).toBe('2026-07-26');
  });

  it('returns null for a month-only value rather than inventing the 1st', () => {
    // Guessing a day would pile a whole month onto one date and draw a spike
    // that never happened.
    expect(parseDay('2026-07')).toBeNull();
  });

  it('reads named-month dates that carry a day', () => {
    expect(parseDay('26 July 2026')).toBe('2026-07-26');
    expect(parseDay('July 26, 2026')).toBe('2026-07-26');
  });

  it('rejects a named month with no day', () => {
    expect(parseDay('July 2026')).toBeNull();
  });

  it('returns null for rubbish', () => {
    expect(parseDay('')).toBeNull();
    expect(parseDay('total')).toBeNull();
  });
});

describe('buildImport', () => {
  it('sums transactions into one total per month', () => {
    const parsed = parseCsv(
      'Date,Amount\n2026-07-03,100.50\n2026-07-19,49.50\n2026-06-02,200\n',
    );
    const { rows, skipped } = buildImport(parsed, 0, 1);
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { month: '2026-06-01', gross: 200 },
      { month: '2026-07-01', gross: 150 },
    ]);
  });

  it('counts rows it could not read rather than silently dropping them', () => {
    const parsed = parseCsv('Date,Amount\n2026-07-03,100\nTOTAL,150\n');
    const { rows, skipped } = buildImport(parsed, 0, 1);
    expect(rows).toEqual([{ month: '2026-07-01', gross: 100 }]);
    expect(skipped).toBe(1);
  });
});

describe('guessColumns', () => {
  it('finds date and amount columns by name', () => {
    expect(guessColumns(['Date', 'Description', 'Gross amount'])).toEqual({
      month: 0,
      amount: 2,
    });
  });

  it('falls back to the first two columns when names are unhelpful', () => {
    expect(guessColumns(['a', 'b'])).toEqual({ month: 0, amount: 1 });
  });
});
