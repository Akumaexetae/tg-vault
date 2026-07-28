import { useState } from 'react';
import { monthsAgo, monthTotals } from '../../lib/money';
import {
  accountingFilename,
  accountingRows,
  buildAccountingCsv,
} from '../../lib/accounting';
import type { Creator, CreatorEarning, VaultData } from '../../lib/types';
import { AnalyticsPanel } from './AnalyticsPanel';
import { CreatorRevenuePanel } from './CreatorRevenuePanel';

interface Props {
  data: VaultData;
  readOnly: boolean;
  onImport: () => void;
  onExportAccounts: (filename: string, csv: string) => void;
  onRecord: (creator: Creator) => void;
  onTogglePaid: (earning: CreatorEarning, creator: Creator, paid: boolean) => void;
  onOpenCreator: (creator: Creator) => void;
}

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export function MoneyView({
  data,
  readOnly,
  onImport,
  onExportAccounts,
  onRecord,
  onTogglePaid,
  onOpenCreator,
}: Props) {
  // One month for the whole page: the header arrows drive the payout rows
  // below and, in day view, the chart above.
  const [month, setMonth] = useState(() => monthsAgo(0));
  const shiftMonth = (by: number) => {
    const d = new Date(`${month}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    setMonth(d.toISOString().slice(0, 10));
  };

  const rows = data.earnings
    .filter((e) => e.month.slice(0, 7) === month.slice(0, 7))
    .map((earning) => {
      const creator = data.creators.find((c) => c.id === earning.creator_id);
      return { earning, creator };
    })
    .filter((r): r is { earning: CreatorEarning; creator: Creator } => !!r.creator)
    .sort((a, b) => b.earning.gross - a.earning.gross);

  const totals = monthTotals(data.earnings, data.creators, month);
  const unpaid = rows.filter((r) => !r.earning.paid_at);

  const label = new Date(month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Money</h1>
          <p className="muted">Gross recorded per creator, and who's been paid.</p>
        </div>
        <div className="filter-row">
          <div className="month-nav">
            <button className="btn btn-tiny" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <span className="month-nav-label">{label}</span>
            <button
              className="btn btn-tiny"
              disabled={month >= monthsAgo(0)}
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
          <button
            className="btn"
            title="Every month, per creator, with the splits — for your accountant"
            onClick={() => {
              const rows = accountingRows(data.earnings, data.creators);
              const months = rows.map((r) => r.month);
              onExportAccounts(
                accountingFilename(
                  months[0] ?? 'start',
                  months[months.length - 1] ?? 'end',
                ),
                buildAccountingCsv(rows),
              );
            }}
          >
            Accountant export
          </button>
          <button className="btn btn-primary" disabled={readOnly} onClick={onImport}>
            Import statement
          </button>
        </div>
      </div>

      <AnalyticsPanel
        data={data}
        currency={totals[0]?.currency ?? 'EUR'}
        month={month}
      />

      <h2 className="money-month-heading">{label}</h2>

      {totals.map((t) => (
        <div key={t.currency} className="stat-row money-totals">
          <div className="stat-card card">
            <span className="stat-label">Gross</span>
            <span className="stat-value">{money(t.gross, t.currency)}</span>
          </div>
          <div className="stat-card card stat-card-primary">
            <span className="stat-label">Your cut</span>
            <span className="stat-value stat-accent">{money(t.agency, t.currency)}</span>
          </div>
          <div className="stat-card card">
            <span className="stat-label">To creators</span>
            <span className="stat-value">{money(t.creators, t.currency)}</span>
            <span className="delta-none">
              {unpaid.length} unpaid
            </span>
          </div>
        </div>
      ))}

      {rows.length === 0 ? (
        <div className="empty-state card">
          <p>Nothing recorded for {label}.</p>
          <button className="btn btn-primary" disabled={readOnly} onClick={onImport}>
            Import a statement
          </button>
        </div>
      ) : (
        <CreatorRevenuePanel
          data={data}
          currency={totals[0]?.currency ?? 'EUR'}
          month={month}
          readOnly={readOnly}
          onRecord={onRecord}
          onTogglePaid={onTogglePaid}
          onOpenCreator={onOpenCreator}
        />
      )}

    </div>
  );
}
