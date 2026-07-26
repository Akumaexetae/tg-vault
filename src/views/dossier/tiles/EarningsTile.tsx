import { lastSixMonths, splitEarning } from '../../../lib/creators/earnings';
import type { CreatorEarning } from '../../../lib/types';

interface Props {
  earnings: CreatorEarning[];
  currency: string;
  revenueShare: number | null;
  readOnly: boolean;
  onRecord: () => void;
}

export function EarningsTile({
  earnings,
  currency,
  revenueShare,
  readOnly,
  onRecord,
}: Props) {
  const series = lastSixMonths(earnings);
  const peak = Math.max(...series.map((s) => s.gross), 1);
  const latest = series[series.length - 1];
  const split = splitEarning(latest.gross, revenueShare);

  return (
    <div className="card tile">
      <div className="tile-head">
        <span className="tile-label">Earnings · 6 months</span>
        <button className="btn btn-tiny" disabled={readOnly} onClick={onRecord}>
          Record month
        </button>
      </div>

      {earnings.length === 0 ? (
        <p className="tile-empty">
          No earnings recorded yet — add a month to start the chart.
        </p>
      ) : (
        <>
          <div className="tile-bars">
            {series.map((s, i) => (
              <i
                key={s.month}
                className={i === series.length - 1 ? 'hi' : ''}
                style={{ height: `${Math.max((s.gross / peak) * 100, 3)}%` }}
                title={`${s.month.slice(0, 7)} — ${s.gross.toLocaleString()} ${currency}`}
              />
            ))}
          </div>
          <div className="tile-foot">
            {latest.gross.toLocaleString()} {currency} this month
            {revenueShare != null && (
              <>
                {' · '}
                <strong>{split.agency.toLocaleString()}</strong> yours,{' '}
                {split.creator.toLocaleString()} hers
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
