import { EntryRow } from '../components/EntryRow';
import { serviceGroups } from '../lib/groups';
import { timeAgo } from '../lib/time';
import type { Entry, VaultData } from '../lib/types';

interface Props {
  data: VaultData;
  readOnly: boolean;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onAdd: () => void;
}

export function DashboardView({ data, readOnly, onEdit, onDelete, onAdd }: Props) {
  const groups = serviceGroups(data.entries);
  const recent = [...data.entries]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);

  return (
    <div className="view">
      <div className="view-header">
        <h1>Dashboard</h1>
        <button className="btn btn-primary" disabled={readOnly} onClick={onAdd}>
          + Add account
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card card">
          <span className="stat-value">{data.entries.length}</span>
          <span className="stat-label">Accounts</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{groups.length}</span>
          <span className="stat-label">Services</span>
        </div>
        <div className="stat-card card">
          <span className="stat-value">{data.creators.length}</span>
          <span className="stat-label">Creators</span>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className="empty-state card">
          <p>No accounts yet.</p>
          <button className="btn btn-primary" disabled={readOnly} onClick={onAdd}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="dash-columns">
          <section className="dash-main">
            <h2>Recently updated</h2>
            <div className="entry-list">
              {recent.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  creators={data.creators}
                  readOnly={readOnly}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
          <aside className="dash-side">
            <h2>Activity</h2>
            <div className="card activity-card">
              {data.activity.length === 0 && <p className="muted">Nothing yet.</p>}
              {data.activity.slice(0, 10).map((a) => (
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
      )}
    </div>
  );
}
