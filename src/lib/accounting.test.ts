import { describe, expect, it } from 'vitest';
import {
  accountingFilename,
  accountingRows,
  buildAccountingCsv,
  monthlySummary,
} from './accounting';
import { makeCreator } from './creators/fixtures';
import type { CreatorEarning } from './types';

const bella = makeCreator({ id: 'b', name: 'Bella', revenue_share: 45 });
const mia = makeCreator({ id: 'm', name: 'Mia', revenue_share: 20 });

const earning = (over: Partial<CreatorEarning> & { creator_id: string; month: string; gross: number }): CreatorEarning => ({
  id: `${over.creator_id}-${over.month}`,
  currency: 'EUR',
  notes: null,
  paid_at: null,
  paid_by: null,
  paid_reference: null,
  created_at: over.month,
  updated_by: 'Tyler',
  ...over,
});

describe('accountingRows', () => {
  const earnings = [
    earning({ creator_id: 'b', month: '2026-07-01', gross: 1000 }),
    earning({ creator_id: 'm', month: '2026-06-01', gross: 500, paid_at: '2026-07-05T00:00:00Z' }),
  ];

  it('works out the split per creator using her own share', () => {
    const rows = accountingRows(earnings, [bella, mia]);
    const july = rows.find((r) => r.creator === 'Bella')!;
    expect(july.agencyCut).toBe(450);
    expect(july.creatorPayout).toBe(550);
    expect(july.sharePercent).toBe(45);
  });

  it('reports paid status and date', () => {
    const rows = accountingRows(earnings, [bella, mia]);
    const june = rows.find((r) => r.creator === 'Mia')!;
    expect(june.paid).toBe(true);
    expect(june.paidOn).toBe('2026-07-05');
  });

  it('sorts by month then creator', () => {
    const rows = accountingRows(earnings, [bella, mia]);
    expect(rows.map((r) => `${r.month} ${r.creator}`)).toEqual([
      '2026-06 Mia',
      '2026-07 Bella',
    ]);
  });

  it('filters to a date range', () => {
    const rows = accountingRows(earnings, [bella, mia], '2026-07-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].creator).toBe('Bella');
  });

  it('survives an earning whose creator was deleted', () => {
    const orphan = [earning({ creator_id: 'gone', month: '2026-07-01', gross: 100 })];
    const rows = accountingRows(orphan, []);
    expect(rows[0].creator).toBe('Unknown');
    expect(rows[0].agencyCut).toBe(0);
  });
});

describe('monthlySummary', () => {
  it('totals each month and tracks what is still unpaid', () => {
    const rows = accountingRows(
      [
        earning({ creator_id: 'b', month: '2026-07-01', gross: 1000 }),
        earning({ creator_id: 'm', month: '2026-07-01', gross: 500, paid_at: '2026-08-01T00:00:00Z' }),
      ],
      [bella, mia],
    );
    const [july] = monthlySummary(rows);
    expect(july.gross).toBe(1500);
    expect(july.agencyCut).toBe(550); // 450 + 100
    expect(july.creatorPayout).toBe(950); // 550 + 400
    expect(july.unpaid).toBe(550); // only Bella's is outstanding
  });

  it('keeps currencies apart rather than adding them', () => {
    const rows = accountingRows(
      [
        earning({ creator_id: 'b', month: '2026-07-01', gross: 1000 }),
        earning({ creator_id: 'm', month: '2026-07-01', gross: 800, currency: 'USD' }),
      ],
      [bella, mia],
    );
    const summary = monthlySummary(rows);
    expect(summary).toHaveLength(2);
    expect(summary.map((s) => s.currency)).toEqual(['EUR', 'USD']);
  });
});

describe('buildAccountingCsv', () => {
  const rows = accountingRows(
    [earning({ creator_id: 'b', month: '2026-07-01', gross: 1000 })],
    [bella],
  );

  it('includes a detail section and a summary section', () => {
    const csv = buildAccountingCsv(rows);
    expect(csv).toContain('Month,Creator,Gross,Currency,Share %');
    expect(csv).toContain('SUMMARY BY MONTH');
    expect(csv).toContain('2026-07,Bella,1000,EUR,45,450,550,no,');
  });

  it('quotes creator names containing commas', () => {
    const tricky = accountingRows(
      [earning({ creator_id: 'x', month: '2026-07-01', gross: 10 })],
      [makeCreator({ id: 'x', name: 'Smith, Jane' })],
    );
    expect(buildAccountingCsv(tricky)).toContain('"Smith, Jane"');
  });
});

describe('accountingFilename', () => {
  it('names the file by its range', () => {
    expect(accountingFilename('2026-01', '2026-12')).toBe(
      'tg-agency-revenue-2026-01-to-2026-12.csv',
    );
  });
});
