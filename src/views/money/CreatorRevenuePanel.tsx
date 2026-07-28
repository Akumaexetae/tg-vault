import { useMemo, useState } from 'react';
import { CreatorAvatar } from '../../components/CreatorAvatar';
import {
  aggregate,
  dataRange,
  presetRange,
  totalsFor,
  type RangePreset,
} from '../../lib/analytics';
import { splitEarning } from '../../lib/creators/earnings';
import type { Creator, CreatorEarning, VaultData } from '../../lib/types';
import { RevenueChart } from './RevenueChart';

interface Props {
  data: VaultData;
  currency: string;
  /** The page's selected month — drives the payout row below the chart. */
  month: string;
  readOnly: boolean;
  onRecord: (creator: Creator) => void;
  onTogglePaid: (earning: CreatorEarning, creator: Creator, paid: boolean) => void;
  onOpenCreator: (creator: Creator) => void;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'last365', label: '12 months' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All time' },
];

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

/**
 * One creator's earnings over time.
 *
 * This replaced the per-creator row list. The list answered "what did each
 * creator make this month" but nothing about the trend, which is the question
 * that actually decides who to invest attention in. The paid/edit controls the
 * rows carried are kept here for the selected creator, and the dropdown marks
 * anyone with an unpaid month so nothing gets lost behind the selection.
 */
export function CreatorRevenuePanel({
  data,
  currency,
  month,
  readOnly,
  onRecord,
  onTogglePaid,
  onOpenCreator,
}: Props) {
  const [preset, setPreset] = useState<RangePreset>('last365');

  // Only creators with money recorded — an empty dropdown entry is a dead end.
  const earners = useMemo(() => {
    const gross = new Map<string, number>();
    for (const e of data.earnings) {
      gross.set(e.creator_id, (gross.get(e.creator_id) ?? 0) + e.gross);
    }
    return data.creators
      .filter((c) => gross.has(c.id))
      .sort((a, b) => (gross.get(b.id) ?? 0) - (gross.get(a.id) ?? 0));
  }, [data.creators, data.earnings]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Falls back to the top earner, and survives that creator disappearing.
  const selected =
    earners.find((c) => c.id === selectedId) ?? earners[0] ?? null;

  const covered = useMemo(
    () => dataRange(data.daily, data.earnings),
    [data.daily, data.earnings],
  );
  const range =
    preset === 'all' ? (covered ?? presetRange('last365')) : presetRange(preset);

  const points = useMemo(() => {
    if (!selected) return [];
    return aggregate(
      data.daily.filter((d) => d.creator_id === selected.id),
      data.earnings.filter((e) => e.creator_id === selected.id),
      [selected],
      range,
      'month',
      currency,
    );
  }, [data.daily, data.earnings, selected, range.from, range.to, currency]);

  const totals = useMemo(() => totalsFor(points), [points]);

  // Which creators are owed money — shown in the dropdown so the selection
  // never hides an outstanding payout.
  const unpaidIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of data.earnings) {
      if (e.paid_at) continue;
      const creator = data.creators.find((c) => c.id === e.creator_id);
      if (!creator) continue;
      if (splitEarning(e.gross, creator.revenue_share).creator > 0) ids.add(e.creator_id);
    }
    return ids;
  }, [data.earnings, data.creators]);

  const thisMonth = selected
    ? data.earnings.find(
        (e) => e.creator_id === selected.id && e.month.slice(0, 7) === month.slice(0, 7),
      )
    : undefined;

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  if (!selected) {
    return (
      <div className="empty-state card">
        <p>No earnings recorded yet — import a statement and this fills in.</p>
      </div>
    );
  }

  const split = thisMonth
    ? splitEarning(thisMonth.gross, selected.revenue_share)
    : null;
  const paid = !!thisMonth?.paid_at;

  return (
    <section className="analytics creator-revenue">
      <div className="analytics-controls">
        <div className="creator-picker">
          <button
            className="money-creator"
            onClick={() => onOpenCreator(selected)}
            title={`Open ${selected.name}`}
          >
            <CreatorAvatar creator={selected} size={30} />
          </button>
          <select
            className="input input-small"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Creator"
          >
            {earners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {unpaidIds.has(c.id) ? ' • unpaid' : ''}
              </option>
            ))}
          </select>
          <span className="money-share">
            {selected.revenue_share != null
              ? `${selected.revenue_share}% share`
              : 'no share set'}
          </span>
        </div>

        <div className="analytics-right">
          <div className="chip-row">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`chip ${preset === p.key ? 'chip-active' : ''}`}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stat-row analytics-stats">
        <div className="stat-card card">
          <span className="stat-label">{selected.name} gross</span>
          <span className="stat-value">{money(totals.gross, currency)}</span>
          <span className="delta-none">
            {totals.activePeriods > 0
              ? `over ${totals.activePeriods} month${totals.activePeriods === 1 ? '' : 's'} trading`
              : 'nothing recorded'}
          </span>
        </div>
        <div className="stat-card card stat-card-primary">
          <span className="stat-label">Your cut</span>
          <span className="stat-value stat-accent">{money(totals.agency, currency)}</span>
          <span className="delta-none">
            {totals.best && totals.best.gross > 0
              ? `best ${totals.best.label} ${money(totals.best.gross, currency)}`
              : 'no best month yet'}
          </span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">To {selected.name}</span>
          <span className="stat-value">{money(totals.creators, currency)}</span>
          <span className="delta-none">
            {money(totals.average, currency)} average per month
          </span>
        </div>
      </div>

      <RevenueChart
        points={points}
        creators={[selected]}
        currency={currency}
        mode="total"
        granularity="month"
      />

      {/*
       * The paid/edit controls the old row list carried, kept for the month the
       * page header is pointing at.
       */}
      <div className="card money-row creator-month-row">
        <div className="money-creator">
          <span>
            <strong>{monthLabel}</strong>
            <em className="money-share">{selected.name}</em>
          </span>
        </div>

        {thisMonth && split ? (
          <>
            <div className="money-figure">
              <span className="tile-label">Gross</span>
              <b>{money(thisMonth.gross, thisMonth.currency)}</b>
            </div>
            <div className="money-figure">
              <span className="tile-label">Yours</span>
              <b className="stat-accent">{money(split.agency, thisMonth.currency)}</b>
            </div>
            <div className="money-figure">
              <span className="tile-label">Hers</span>
              <b>{money(split.creator, thisMonth.currency)}</b>
            </div>
            <div className="money-actions">
              <span className={`pill ${paid ? 'pill-paid' : 'pill-unpaid'}`}>
                {paid ? 'Paid' : 'Unpaid'}
              </span>
              <button
                className="btn btn-tiny"
                disabled={readOnly}
                onClick={() => onTogglePaid(thisMonth, selected, !paid)}
              >
                {paid ? 'Undo' : 'Mark paid'}
              </button>
              <button
                className="btn btn-tiny"
                disabled={readOnly}
                onClick={() => onRecord(selected)}
              >
                Edit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="money-figure">
              <span className="tile-label">Gross</span>
              <b className="muted">nothing recorded</b>
            </div>
            <div className="money-actions">
              <button
                className="btn btn-tiny"
                disabled={readOnly}
                onClick={() => onRecord(selected)}
              >
                Record
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
