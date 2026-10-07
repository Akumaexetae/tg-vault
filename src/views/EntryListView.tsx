import { useState, type ReactNode } from 'react';
import { EntryRow } from '../components/EntryRow';
import { sortByPassword } from '../lib/search';
import { loadPreference, savePreference } from '../lib/settings';
import { groupByDay } from '../lib/time';
import type { Creator, Entry, User } from '../lib/types';

/** Whose accounts to show. 'all' is the default and the normal view. */
type Owner = 'all' | User;

const OWNERS: [Owner, string][] = [
  ['all', 'All'],
  ['Tyler', 'Tyler'],
  ['Gabriel', 'Gabriel'],
];

interface Props {
  title: ReactNode;
  subtitle?: string;
  entries: Entry[];
  creators: Creator[];
  readOnly: boolean;
  showCreator?: boolean;
  emptyText?: string;
  reusedIds: Set<string>;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onTogglePin: (entry: Entry) => void;
  onAdd: () => void;
  headerExtra?: ReactNode;
}

/** Shared layout for Service / Creator / All-accounts / Search views. */
export function EntryListView({
  title,
  subtitle,
  entries,
  creators,
  readOnly,
  showCreator = true,
  emptyText = 'No accounts here yet.',
  reusedIds,
  onEdit,
  onDelete,
  onTogglePin,
  onAdd,
  headerExtra,
}: Props) {
  const [byPassword, setByPassword] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  // Remembered per machine: whoever groups by date tends to want it every time.
  const [byDate, setByDate] = useState(() => loadPreference('group-by-date', false));
  const [owner, setOwner] = useState<Owner>(() => loadPreference<Owner>('owner-filter', 'all'));

  function chooseOwner(next: Owner) {
    setOwner(next);
    savePreference('owner-filter', next);
  }

  // Rows added before migration 012 have no created_by. They stay visible under
  // "All" but cannot be attributed, so a name filter would silently hide them —
  // which on a credential list is worse than showing an extra row.
  const owned = owner === 'all' ? entries : entries.filter((e) => e.created_by === owner);
  const shown = byPassword ? sortByPassword(owned) : owned;
  const unattributed = entries.filter((e) => !e.created_by).length;

  function toggleByDate() {
    setByDate((on) => {
      savePreference('group-by-date', !on);
      return !on;
    });
  }

  // Newest day first. Grouping is on when the row reached the vault, which is
  // not the same as how old the account is — see entries.account_created_at.
  const groups = byDate ? groupByDay(shown, (e) => e.created_at) : [];

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <div className="view-header-actions">
          {entries.length > 0 && (
            <button
              className={revealAll ? 'btn btn-toggle is-on' : 'btn btn-toggle'}
              aria-pressed={revealAll}
              onClick={() => setRevealAll((on) => !on)}
            >
              {revealAll ? 'Hide passwords' : 'Show all passwords'}
            </button>
          )}
          {entries.length > 1 && (
            <button
              className={byPassword ? 'btn btn-toggle is-on' : 'btn btn-toggle'}
              aria-pressed={byPassword}
              title="Sort accounts by password (numbers in order)"
              onClick={() => setByPassword((on) => !on)}
            >
              {byPassword ? 'Sorted by password ✕' : 'Sort by password'}
            </button>
          )}
          {entries.length > 1 && (
            <div className="owner-filter" role="group" aria-label="Whose accounts">
              {OWNERS.map(([value, label]) => (
                <button
                  key={value}
                  className={owner === value ? 'owner-btn owner-btn-on' : 'owner-btn'}
                  aria-pressed={owner === value}
                  onClick={() => chooseOwner(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {entries.length > 1 && (
            <button
              className={byDate ? 'btn btn-toggle is-on' : 'btn btn-toggle'}
              aria-pressed={byDate}
              title="Group accounts by the day they were added to the vault"
              onClick={toggleByDate}
            >
              {byDate ? 'Grouped by date ✕' : 'Group by date'}
            </button>
          )}
          <button className="btn btn-primary" disabled={readOnly} onClick={onAdd}>
            + Add account
          </button>
        </div>
      </div>
      {headerExtra}
      {owner !== 'all' && unattributed > 0 && (
        <p className="muted filter-note">
          {unattributed} older {unattributed === 1 ? 'account has' : 'accounts have'} no
          recorded owner and {unattributed === 1 ? 'is' : 'are'} hidden by this filter.
        </p>
      )}
      {entries.length === 0 ? (
        <div className="empty-state card">
          <p>{emptyText}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state card">
          <p>No accounts added by {owner}.</p>
        </div>
      ) : (
        <div className="entry-list">
          {byDate
            ? groups.map((g) => (
                <div key={g.key} className="entry-day-group">
                  <div className="entry-day-header">
                    <span className="entry-day-label">{g.heading}</span>
                    <span className="entry-day-count">
                      {g.items.length} {g.items.length === 1 ? 'account' : 'accounts'}
                    </span>
                  </div>
                  {g.items.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      creators={creators}
                      readOnly={readOnly}
                      showCreator={showCreator}
                      reused={reusedIds.has(e.id)}
                      revealAll={revealAll}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              ))
            : shown.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  creators={creators}
                  readOnly={readOnly}
                  showCreator={showCreator}
                  reused={reusedIds.has(e.id)}
                  revealAll={revealAll}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                />
              ))}
        </div>
      )}
    </div>
  );
}
