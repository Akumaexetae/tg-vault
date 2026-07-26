import { EntryRow } from '../components/EntryRow';
import { healthReport } from '../lib/health';
import type { Creator, Entry } from '../lib/types';

interface Props {
  entries: Entry[];
  creators: Creator[];
  readOnly: boolean;
  reusedIds: Set<string>;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onTogglePin: (entry: Entry) => void;
}

export function HealthView({
  entries,
  creators,
  readOnly,
  reusedIds,
  onEdit,
  onDelete,
  onTogglePin,
}: Props) {
  const report = healthReport(entries);
  const sections: { title: string; hint: string; list: Entry[] }[] = [
    {
      title: 'Reused passwords',
      hint: 'The same password is on more than one account — one leak exposes both.',
      list: report.reused,
    },
    {
      title: 'Weak passwords',
      hint: 'Short, common, or only one character type.',
      list: report.weak,
    },
    {
      title: 'Not changed in 6+ months',
      hint: 'Worth rotating, especially on shared logins.',
      list: report.old,
    },
  ];

  const clean = sections.every((s) => s.list.length === 0);

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Password health</h1>
          <p className="muted">{report.total} accounts checked.</p>
        </div>
      </div>

      {clean ? (
        <div className="empty-state card">
          <p>Everything looks healthy. 🎉</p>
        </div>
      ) : (
        sections.map(
          (s) =>
            s.list.length > 0 && (
              <section key={s.title} className="health-section">
                <h2>
                  {s.title} <span className="health-count">{s.list.length}</span>
                </h2>
                <p className="muted health-hint">{s.hint}</p>
                <div className="entry-list">
                  {s.list.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      creators={creators}
                      readOnly={readOnly}
                      reused={reusedIds.has(e.id)}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </section>
            ),
        )
      )}
    </div>
  );
}
