import type { ReactNode } from 'react';
import { EntryRow } from '../components/EntryRow';
import type { Creator, Entry } from '../lib/types';

interface Props {
  title: ReactNode;
  subtitle?: string;
  entries: Entry[];
  creators: Creator[];
  readOnly: boolean;
  showCreator?: boolean;
  emptyText?: string;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
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
  onEdit,
  onDelete,
  onAdd,
  headerExtra,
}: Props) {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="btn btn-primary" disabled={readOnly} onClick={onAdd}>
          + Add account
        </button>
      </div>
      {headerExtra}
      {entries.length === 0 ? (
        <div className="empty-state card">
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="entry-list">
          {entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              creators={creators}
              readOnly={readOnly}
              showCreator={showCreator}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
