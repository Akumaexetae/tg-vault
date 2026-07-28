import { useMemo, useState } from 'react';
import {
  aggregate,
  dataRange,
  presetRange,
  previousRange,
  sensibleGranularity,
  totalsFor,
  type DateRange,
  type Granularity,
  type RangePreset,
} from '../../lib/analytics';
import { monthsAgo } from '../../lib/money';
import type { VaultData } from '../../lib/types';
import { RevenueChart } from './RevenueChart';

interface Props {
  data: VaultData;
  currency: string;
}

/**
 * Short day-count presets were dropped: earnings are recorded monthly, so a
 * 7- or 30-day window mostly showed one bucket or none, which is where the
 * confusing single-bar chart came from.
 */
const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'last365', label: '12 months' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All time' },
];

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

export function AnalyticsPanel({ data, currency }: Props) {
  const [preset, setPreset] = useState<RangePreset>('last365');
  const [custom, setCustom] = useState<DateRange>(() => presetRange('last30'));
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [mode, setMode] = useState<'total' | 'creator'>('total');
  const [showTable, setShowTable] = useState(false);
  // Day view browses one month at a time rather than the whole history.
  const [dayMonth, setDayMonth] = useState(() => monthsAgo(0));

  // "All time" means the span the data covers, not since 1970 — otherwise
  // every empty bucket back to the Nixon administration gets drawn.
  const covered = useMemo(
    () => dataRange(data.daily, data.earnings),
    [data.daily, data.earnings],
  );
  /*
   * Choosing "By day" switches the range control to a month browser — a whole
   * history of days is unreadable, and the useful question is "how did this
   * month go", not "show me 400 bars".
   */
  const byDay = granularity === 'day';
  const monthEnd = (first: string) => {
    const d = new Date(`${first}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  };

  const range = byDay
    ? { from: dayMonth, to: monthEnd(dayMonth) }
    : preset === 'custom'
      ? custom
      : preset === 'all'
        ? (covered ?? presetRange('last365'))
        : presetRange(preset);

  const effective = granularity === 'auto' ? sensibleGranularity(range) : granularity;

  const shiftMonth = (by: number) => {
    const d = new Date(`${dayMonth}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    setDayMonth(d.toISOString().slice(0, 10));
  };
  const monthLabel = new Date(`${dayMonth}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const points = useMemo(
    () => aggregate(data.daily, data.earnings, data.creators, range, effective),
    [data, range.from, range.to, effective],
  );
  const totals = useMemo(() => totalsFor(points), [points]);

  const prior = useMemo(() => {
    const prev = previousRange(range);
    return totalsFor(
      aggregate(data.daily, data.earnings, data.creators, prev, effective),
    );
  }, [data, range.from, range.to, effective]);

  const delta =
    prior.agency > 0
      ? Math.round(((totals.agency - prior.agency) / prior.agency) * 100)
      : null;

  const hasDaily = data.daily.length > 0;

  return (
    <section className="analytics">
      <div className="analytics-controls">
        {byDay ? (
          <div className="month-nav">
            <button className="btn btn-tiny" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <span className="month-nav-label">{monthLabel}</span>
            <button
              className="btn btn-tiny"
              disabled={dayMonth >= monthsAgo(0)}
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
        ) : (
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
            <button
              className={`chip ${preset === 'custom' ? 'chip-active' : ''}`}
              onClick={() => setPreset('custom')}
            >
              Custom
            </button>
          </div>
        )}

        {!byDay && preset === 'custom' && (
          <div className="analytics-dates">
            <input
              className="input input-small"
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            />
            <span className="muted">to</span>
            <input
              className="input input-small"
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            />
          </div>
        )}

        <div className="analytics-right">
          <select
            className="input input-small"
            value={granularity}
            onChange={(e) =>
              setGranularity(e.target.value as Granularity | 'auto')
            }
            title="How finely to group the data"
          >
            <option value="auto">Auto ({sensibleGranularity(range)})</option>
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
            <option value="year">By year</option>
          </select>

          <div className="chip-row">
            <button
              className={`chip ${mode === 'total' ? 'chip-active' : ''}`}
              onClick={() => setMode('total')}
            >
              Total
            </button>
            <button
              className={`chip ${mode === 'creator' ? 'chip-active' : ''}`}
              onClick={() => setMode('creator')}
            >
              By creator
            </button>
          </div>

          <button
            className={`chip ${showTable ? 'chip-active' : ''}`}
            onClick={() => setShowTable((t) => !t)}
          >
            Table
          </button>
        </div>
      </div>

      <div className="stat-row analytics-stats">
        <div className="stat-card card stat-card-primary">
          <span className="stat-label">Your cut</span>
          <span className="stat-value stat-accent">{money(totals.agency, currency)}</span>
          {delta === null ? (
            <span className="delta-none">no earlier period to compare</span>
          ) : (
            <span className={delta >= 0 ? 'delta-up' : 'delta-down'}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs previous
            </span>
          )}
        </div>
        <div className="stat-card card">
          <span className="stat-label">Gross</span>
          <span className="stat-value">{money(totals.gross, currency)}</span>
          <span className="delta-none">{money(totals.creators, currency)} to creators</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Average per {effective}</span>
          <span className="stat-value">{money(totals.average, currency)}</span>
          {totals.best && (
            <span className="delta-none">
              best {totals.best.label} · {money(totals.best.gross, currency)}
            </span>
          )}
        </div>
      </div>

      <RevenueChart
        points={points}
        creators={data.creators}
        currency={currency}
        mode={mode}
        granularity={effective}
      />

      {!hasDaily && (effective === 'day' || effective === 'week') && (
        <p className="muted chart-note">
          No daily detail yet — these buckets come from monthly figures. Import a
          statement and day and week resolution fills in for those months.
        </p>
      )}

      {showTable && (
        <div className="card analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Gross</th>
                <th>Your cut</th>
                <th>To creators</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td>{money(p.gross, currency)}</td>
                  <td>{money(p.agency, currency)}</td>
                  <td>{money(p.creators, currency)}</td>
                  <td className="detail-meta">{p.approximate ? 'monthly' : 'daily'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
