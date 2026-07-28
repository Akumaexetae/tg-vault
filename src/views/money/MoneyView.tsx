import { useState } from 'react';
import { CreatorAvatar } from '../../components/CreatorAvatar';
import { splitEarning } from '../../lib/creators/earnings';
import { monthsAgo, monthTotals } from '../../lib/money';
import {
  accountingFilename,
  accountingRows,
  buildAccountingCsv,
} from '../../lib/accounting';
import type { Creator, CreatorEarning, VaultData } from '../../lib/types';

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
  const [offset, setOffset] = useState(0);
  const month = monthsAgo(offset);

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
            <button className="btn btn-tiny" onClick={() => setOffset((o) => o + 1)}>
              ‹
            </button>
            <span className="month-nav-label">{label}</span>
            <button
              className="btn btn-tiny"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
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
        <div className="entry-list">
          {rows.map(({ earning, creator }) => {
            const split = splitEarning(earning.gross, creator.revenue_share);
            const paid = !!earning.paid_at;
            return (
              <div key={earning.id} className="card money-row">
                <button
                  className="money-creator"
                  onClick={() => onOpenCreator(creator)}
                >
                  <CreatorAvatar creator={creator} size={30} />
                  <span>
                    <strong>{creator.name}</strong>
                    <em className="money-share">
                      {creator.revenue_share != null
                        ? `${creator.revenue_share}% share`
                        : 'no share set'}
                    </em>
                  </span>
                </button>

                <div className="money-figure">
                  <span className="tile-label">Gross</span>
                  <b>{money(earning.gross, earning.currency)}</b>
                </div>
                <div className="money-figure">
                  <span className="tile-label">Yours</span>
                  <b className="stat-accent">{money(split.agency, earning.currency)}</b>
                </div>
                <div className="money-figure">
                  <span className="tile-label">Hers</span>
                  <b>{money(split.creator, earning.currency)}</b>
                </div>

                <div className="money-actions">
                  {paid ? (
                    <span className="pill pill-paid" title={`by ${earning.paid_by}`}>
                      Paid
                    </span>
                  ) : (
                    <span className="pill pill-unpaid">Unpaid</span>
                  )}
                  <button
                    className="btn btn-tiny"
                    disabled={readOnly}
                    onClick={() => onTogglePaid(earning, creator, !paid)}
                  >
                    {paid ? 'Undo' : 'Mark paid'}
                  </button>
                  <button
                    className="btn btn-tiny"
                    disabled={readOnly}
                    onClick={() => onRecord(creator)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
