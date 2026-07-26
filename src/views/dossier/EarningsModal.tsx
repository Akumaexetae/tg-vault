import { useState } from 'react';
import { monthKey, splitEarning } from '../../lib/creators/earnings';
import type { Creator, CreatorEarning } from '../../lib/types';

interface Props {
  creator: Creator;
  earnings: CreatorEarning[];
  onSave: (month: string, gross: number, currency: string) => Promise<void>;
  onClose: () => void;
}

export function EarningsModal({ creator, earnings, onSave, onClose }: Props) {
  const thisMonth = monthKey(new Date().toISOString()).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState(creator.payout_currency ?? 'EUR');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const existing = earnings.find((e) => e.month.slice(0, 7) === month);
  const amount = Number(gross);
  const preview =
    Number.isFinite(amount) && amount > 0
      ? splitEarning(amount, creator.revenue_share)
      : null;

  const submit = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Pick a month.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter the gross as a number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(`${month}-01`, amount, currency.trim().toUpperCase() || 'EUR');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — are you online?');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>Record earnings — {creator.name}</h2>
        <p className="confirm-body">
          Gross for the month, straight off her OnlyFans statement. Your cut is
          worked out from the revenue share, not stored.
        </p>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Month</label>
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="form-col">
            <label className="form-label">Gross</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={gross}
              autoFocus
              onChange={(e) => setGross(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="form-col" style={{ maxWidth: 90 }}>
            <label className="form-label">Currency</label>
            <input
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
        </div>

        {existing && (
          <p className="tile-foot">
            Replaces the {existing.gross.toLocaleString()} {existing.currency}{' '}
            already recorded for this month.
          </p>
        )}

        {preview && (
          <div className="split-preview">
            <span>
              <b>{preview.agency.toLocaleString()}</b> {currency} yours
            </span>
            <span>
              <b>{preview.creator.toLocaleString()}</b> {currency} hers
            </span>
            <em>
              at {creator.revenue_share ?? 0}%
            </em>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
