import { EntryRow } from '../components/EntryRow';
import { serviceGroups } from '../lib/groups';
import { healthReport } from '../lib/health';
import { timeAgo } from '../lib/time';
import type { Entry, VaultData } from '../lib/types';

interface Props {
  data: VaultData;
  readOnly: boolean;
  reusedIds: Set<string>;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onTogglePin: (entry: Entry) => void;
  onAdd: () => void;
  onShowHealth: () => void;
}

export function DashboardView({
  data,
  readOnly,
  reusedIds,
  onEdit,
  onDelete,
  onTogglePin,
  onAdd,
  onShowHealth,
}: Props) {
  const groups = serviceGroups(data.entries);
  const pinned = data.entries.filter((e) => e.pinned);
  const recent = [...data.entries]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
  const health = healthReport(data.entries);
  const issues = new Set([...health.weak, ...health.reused, ...health.old].map((e) => e.id));

  const rowProps = {
    creators: data.creators,
    readOnly,
    onEdit,
    onDelete,
    onTogglePin,
  };

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
        <button className="stat-card card stat-card-btn" onClick={onShowHealth}>
          <span className={`stat-value ${issues.size ? 'stat-warn' : 'stat-ok'}`}>
            {issues.size}
          </span>
          <span className="stat-label">Need attention</span>
        </button>
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
            {pinned.length > 0 && (
              <>
                <h2>★ Pinned</h2>
                <div className="entry-list dash-pinned">
                  {pinned.map((e) => (
                    <EntryRow key={e.id} entry={e} reused={reusedIds.has(e.id)} {...rowProps} />
                  ))}
                </div>
              </>
            )}
            <h2>Recently updated</h2>
            <div className="entry-list">
              {recent.map((e) => (
                <EntryRow key={e.id} entry={e} reused={reusedIds.has(e.id)} {...rowProps} />
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
