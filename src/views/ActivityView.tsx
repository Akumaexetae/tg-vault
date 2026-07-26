import { timeAgo } from '../lib/time';
import type { Activity } from '../lib/types';

export function ActivityView({ activity }: { activity: Activity[] }) {
  return (
    <div className="view">
      <div className="view-header">
        <h1>Activity</h1>
      </div>
      <div className="card activity-card activity-full">
        {activity.length === 0 && <p className="muted">No activity yet.</p>}
        {activity.map((a) => (
          <div key={a.id} className="activity-item">
            <span className={`activity-avatar avatar-${a.who.toLowerCase()}`}>{a.who[0]}</span>
            <span className="activity-text">
              <strong>{a.who}</strong> {a.action} {a.entry_label}
              <span className="activity-time">{timeAgo(a.created_at)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
