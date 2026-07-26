import { useState } from 'react';
import {
  buildImport,
  guessColumns,
  parseCsv,
  type ImportRow,
  type ParsedCsv,
} from '../../lib/csv';
import type { Creator } from '../../lib/types';

interface Props {
  creators: Creator[];
  defaultCreatorId?: string;
  onImport: (
    creatorId: string,
    rows: ImportRow[],
    currency: string,
  ) => Promise<void>;
  onClose: () => void;
}

/**
 * Format-agnostic statement import: read any CSV, let the user point at the
 * date and amount columns, show exactly what was parsed, then commit.
 *
 * Deliberately not hardcoded to one platform's export — OnlyFans publishes no
 * spec and changes its format, and this also works for Fansly or a bank export.
 */
export function ImportModal({
  creators,
  defaultCreatorId,
  onImport,
  onClose,
}: Props) {
  const [creatorId, setCreatorId] = useState(
    defaultCreatorId ?? creators.find((c) => c.kind === 'creator')?.id ?? '',
  );
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState('');
  const [monthCol, setMonthCol] = useState(0);
  const [amountCol, setAmountCol] = useState(1);
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pickFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (result.headers.length < 2 || result.rows.length === 0) {
        setError("That file doesn't look like a statement — no rows found.");
        return;
      }
      const guess = guessColumns(result.headers);
      setParsed(result);
      setFileName(file.name);
      setMonthCol(guess.month);
      setAmountCol(guess.amount);
      setError('');
    } catch {
      setError('Could not read that file.');
    }
  };

  const preview = parsed ? buildImport(parsed, monthCol, amountCol) : null;

  const submit = async () => {
    if (!creatorId) {
      setError('Pick a creator.');
      return;
    }
    if (!preview || preview.rows.length === 0) {
      setError('Nothing to import — check the column choices.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onImport(creatorId, preview.rows, currency.trim().toUpperCase() || 'EUR');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Import a statement</h2>
        <p className="confirm-body">
          Any CSV works — point at the date and amount columns and check the
          preview before importing. Rows for the same month are added together.
        </p>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Creator</label>
            <select
              className="input"
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
            >
              {creators
                .filter((c) => c.kind === 'creator')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-col" style={{ maxWidth: 110 }}>
            <label className="form-label">Currency</label>
            <input
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
        </div>

        <label className="form-label">Statement file</label>
        <input
          className="input"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        {parsed && (
          <>
            <p className="tile-foot">
              {fileName} — {parsed.rows.length} row
              {parsed.rows.length === 1 ? '' : 's'}, {parsed.headers.length} columns
            </p>

            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Date column</label>
                <select
                  className="input"
                  value={monthCol}
                  onChange={(e) => setMonthCol(Number(e.target.value))}
                >
                  {parsed.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-col">
                <label className="form-label">Amount column</label>
                <select
                  className="input"
                  value={amountCol}
                  onChange={(e) => setAmountCol(Number(e.target.value))}
                >
                  {parsed.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="form-label">What will be imported</label>
            <div className="card import-preview">
              {preview && preview.rows.length === 0 && (
                <p className="tile-empty">
                  Nothing readable in those columns — try different ones.
                </p>
              )}
              {preview?.rows.map((r) => (
                <div key={r.month} className="import-row">
                  <span>
                    {new Date(r.month).toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <b>
                    {r.gross.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    {currency}
                  </b>
                </div>
              ))}
            </div>

            {preview && preview.skipped > 0 && (
              <p className="tile-foot">
                {preview.skipped} row{preview.skipped === 1 ? '' : 's'} skipped —
                no readable date or amount. Usually headers, totals or blank lines.
              </p>
            )}
            <p className="connect-hint import-note">
              A month already recorded will be replaced by the figure above.
            </p>
          </>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || !preview || preview.rows.length === 0}
            onClick={submit}
          >
            {saving
              ? 'Importing…'
              : preview
                ? `Import ${preview.rows.length} month${preview.rows.length === 1 ? '' : 's'}`
                : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
