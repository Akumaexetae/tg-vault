import { splitEarning } from './creators/earnings';
import type { Creator, CreatorEarning } from './types';

export interface AccountingRow {
  month: string;
  creator: string;
  gross: number;
  currency: string;
  agencyCut: number;
  creatorPayout: number;
  sharePercent: number | null;
  paid: boolean;
  paidOn: string | null;
}

const csvCell = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * One row per creator per month, with the split worked out.
 *
 * This is the view an accountant needs: what came in, what the agency kept,
 * what was owed out, and whether it was actually paid.
 */
export function accountingRows(
  earnings: CreatorEarning[],
  creators: Creator[],
  from?: string,
  to?: string,
): AccountingRow[] {
  const byId = new Map(creators.map((c) => [c.id, c]));
  return earnings
    .filter((e) => (!from || e.month >= from) && (!to || e.month <= to))
    .map((e) => {
      const creator = byId.get(e.creator_id);
      const split = splitEarning(e.gross, creator?.revenue_share ?? null);
      return {
        month: e.month.slice(0, 7),
        creator: creator?.name ?? 'Unknown',
        gross: e.gross,
        currency: e.currency || 'EUR',
        agencyCut: split.agency,
        creatorPayout: split.creator,
        sharePercent: creator?.revenue_share ?? null,
        paid: !!e.paid_at,
        paidOn: e.paid_at ? e.paid_at.slice(0, 10) : null,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.creator.localeCompare(b.creator));
}

export interface MonthSummary {
  month: string;
  currency: string;
  gross: number;
  agencyCut: number;
  creatorPayout: number;
  unpaid: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly totals, kept per currency so nothing incomparable is added up. */
export function monthlySummary(rows: AccountingRow[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const r of rows) {
    const key = `${r.month}|${r.currency}`;
    const s = map.get(key) ?? {
      month: r.month,
      currency: r.currency,
      gross: 0,
      agencyCut: 0,
      creatorPayout: 0,
      unpaid: 0,
    };
    s.gross = round2(s.gross + r.gross);
    s.agencyCut = round2(s.agencyCut + r.agencyCut);
    s.creatorPayout = round2(s.creatorPayout + r.creatorPayout);
    if (!r.paid) s.unpaid = round2(s.unpaid + r.creatorPayout);
    map.set(key, s);
  }
  return [...map.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency),
  );
}

/**
 * A single CSV holding the detail and a summary, separated by a blank line —
 * one file to send the accountant rather than two.
 */
export function buildAccountingCsv(rows: AccountingRow[]): string {
  const detailHeader = [
    'Month', 'Creator', 'Gross', 'Currency', 'Share %',
    'Agency cut', 'Creator payout', 'Paid', 'Paid on',
  ];
  const detail = rows.map((r) =>
    [
      r.month, r.creator, r.gross, r.currency,
      r.sharePercent ?? '', r.agencyCut, r.creatorPayout,
      r.paid ? 'yes' : 'no', r.paidOn ?? '',
    ].map(csvCell).join(','),
  );

  const summaryHeader = [
    'Month', 'Currency', 'Gross', 'Agency cut', 'Creator payouts', 'Still unpaid',
  ];
  const summary = monthlySummary(rows).map((s) =>
    [s.month, s.currency, s.gross, s.agencyCut, s.creatorPayout, s.unpaid]
      .map(csvCell)
      .join(','),
  );

  return [
    detailHeader.join(','),
    ...detail,
    '',
    'SUMMARY BY MONTH',
    summaryHeader.join(','),
    ...summary,
  ].join('\r\n');
}

export const accountingFilename = (from: string, to: string): string =>
  `tg-agency-revenue-${from}-to-${to}.csv`;
