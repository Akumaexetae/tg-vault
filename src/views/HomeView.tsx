import { CreatorAvatar } from '../components/CreatorAvatar';
import { healthReport } from '../lib/health';
import {
  agencySeries,
  creatorsMissingEarnings,
  grossByCreator,
  monthDelta,
  monthsAgo,
  monthTotals,
} from '../lib/money';
import { timeAgo } from '../lib/time';
import type { Creator, VaultData } from '../lib/types';

interface Props {
  data: VaultData;
  readOnly: boolean;
  onOpenCreator: (creator: Creator) => void;
  onOpenHealth: () => void;
  onRecordEarnings: (creator: Creator) => void;
}

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta-none">no prior month</span>;
  if (value === 0) return <span className="delta-none">level with last month</span>;
  const up = value > 0;
  return (
    <span className={up ? 'delta-up' : 'delta-down'}>
      {up ? '▲' : '▼'} {Math.abs(value)}% vs last month
    </span>
  );
}

export function HomeView({
  data,
  readOnly,
  onOpenCreator,
  onOpenHealth,
  onRecordEarnings,
}: Props) {
  const thisMonth = monthsAgo(0);
  const lastMonth = monthsAgo(1);

  const totals = monthTotals(data.earnings, data.creators, thisMonth);
  const primary = totals[0];
  const others = totals.slice(1);
  const currency = primary?.currency ?? 'EUR';

  const previous = monthTotals(data.earnings, data.creators, lastMonth).find(
    (t) => t.currency === currency,
  );

  const series = agencySeries(data.earnings, data.creators, currency);
  const peak = Math.max(...series.map((s) => s.agency), 1);

  const byCreator = grossByCreator(data.earnings, thisMonth);
  const creatorById = new Map(data.creators.map((c) => [c.id, c]));

  const missing = creatorsMissingEarnings(data.creators, data.earnings, thisMonth);
  const health = healthReport(data.entries);
  const healthIssues = new Set(
    [...health.weak, ...health.reused, ...health.old].map((e) => e.id),
  ).size;

  const hasEarnings = data.earnings.length > 0;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Home</h1>
          <p className="muted">
            {new Date(thisMonth).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {!hasEarnings ? (
        <div className="empty-state card">
          <p>No income recorded yet.</p>
          <p className="muted">
            Open a creator and use <strong>Record month</strong> to enter her gross —
            your cut and what she's owed are worked out from her revenue share.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-card card">
              <span className="stat-label">Gross this month</span>
              <span className="stat-value">{money(primary?.gross ?? 0, currency)}</span>
              <Delta value={monthDelta(primary?.gross ?? 0, previous?.gross ?? 0)} />
            </div>

            <div className="stat-card card stat-card-primary">
              <span className="stat-label">Your cut</span>
              <span className="stat-value stat-accent">
                {money(primary?.agency ?? 0, currency)}
              </span>
              <Delta value={monthDelta(primary?.agency ?? 0, previous?.agency ?? 0)} />
            </div>

            <div className="stat-card card">
              <span className="stat-label">Owed to creators</span>
              <span className="stat-value">
                {money(primary?.creators ?? 0, currency)}
              </span>
              <span className="delta-none">
                {byCreator.length} payout{byCreator.length === 1 ? '' : 's'} due
              </span>
            </div>
          </div>

          {others.length > 0 && (
            <p className="muted currency-note">
              Also this month:{' '}
              {others
                .map((o) => `${money(o.gross, o.currency)} gross (${money(o.agency, o.currency)} yours)`)
                .join(' · ')}{' '}
              — shown separately, not converted.
            </p>
          )}

          <div className="dash-columns">
            <section className="dash-main">
              <h2>Agency revenue · 6 months</h2>
              <div className="card home-chart">
                <div className="tile-bars home-bars">
                  {series.map((s, i) => (
                    <i
                      key={s.month}
                      className={i === series.length - 1 ? 'hi' : ''}
                      style={{ height: `${Math.max((s.agency / peak) * 100, 3)}%` }}
                      title={`${s.month.slice(0, 7)} — ${money(s.agency, currency)}`}
                    />
                  ))}
                </div>
                <div className="home-bar-labels">
                  {series.map((s) => (
                    <span key={s.month}>{s.month.slice(5, 7)}</span>
                  ))}
                </div>
              </div>

              <h2>Needs attention</h2>
              <div className="card activity-card">
                {missing.length === 0 && healthIssues === 0 && (
                  <p className="muted">Nothing outstanding.</p>
                )}
                {missing.map((c) => (
                  <div key={c.id} className="attention-row">
                    <CreatorAvatar creator={c} size={22} />
                    <span>
                      <strong>{c.name}</strong> — no earnings recorded this month
                    </span>
                    <button
                      className="btn btn-tiny"
                      disabled={readOnly}
                      onClick={() => onRecordEarnings(c)}
                    >
                      Record
                    </button>
                  </div>
                ))}
                {healthIssues > 0 && (
                  <div className="attention-row">
                    <span className="attention-icon">🔑</span>
                    <span>
                      {healthIssues} account{healthIssues === 1 ? '' : 's'} with weak,
                      reused or ageing passwords
                    </span>
                    <button className="btn btn-tiny" onClick={onOpenHealth}>
                      Review
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="dash-side">
              <h2>This month by creator</h2>
              <div className="card activity-card">
                {byCreator.length === 0 && <p className="muted">Nothing recorded yet.</p>}
                {byCreator.map((row) => {
                  const creator = creatorById.get(row.creator_id);
                  if (!creator) return null;
                  return (
                    <button
                      key={row.creator_id}
                      className="creator-line"
                      onClick={() => onOpenCreator(creator)}
                    >
                      <CreatorAvatar creator={creator} size={24} />
                      <span className="creator-line-name">{creator.name}</span>
                      <b>{money(row.gross, row.currency)}</b>
                    </button>
                  );
                })}
              </div>

              <h2>Activity</h2>
              <div className="card activity-card">
                {data.activity.length === 0 && <p className="muted">Nothing yet.</p>}
                {data.activity.slice(0, 6).map((a) => (
                  <div key={a.id} className="activity-item">
                    <span className={`activity-avatar avatar-${a.who.toLowerCase()}`}>
                      {a.who[0]}
                    </span>
                    <span className="activity-text">
                      <strong>{a.who}</strong> {a.action} {a.entry_label}
                      <span className="activity-time">{timeAgo(a.created_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
