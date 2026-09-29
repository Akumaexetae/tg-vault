import { useState, type ReactNode } from 'react';
import { EntryRow } from '../components/EntryRow';
import { sortByPassword } from '../lib/search';
import type { Creator, Entry } from '../lib/types';

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
  const shown = byPassword ? sortByPassword(entries) : entries;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <div className="view-header-actions">
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
          <button className="btn btn-primary" disabled={readOnly} onClick={onAdd}>
            + Add account
          </button>
        </div>
      </div>
      {headerExtra}
      {entries.length === 0 ? (
        <div className="empty-state card">
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="entry-list">
          {shown.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              creators={creators}
              readOnly={readOnly}
              showCreator={showCreator}
              reused={reusedIds.has(e.id)}
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
