import { ServiceIcon } from '../../../components/ServiceIcon';
import type { Entry } from '../../../lib/types';

export function LoginsTile({
  entries,
  onOpen,
}: {
  entries: Entry[];
  onOpen: () => void;
}) {
  return (
    <button className="card tile tile-btn" onClick={onOpen}>
      <span className="tile-label">Logins · {entries.length}</span>
      {entries.length === 0 ? (
        <p className="tile-empty">No logins yet.</p>
      ) : (
        <>
          {entries.slice(0, 4).map((e) => (
            <span key={e.id} className="tile-row">
              <ServiceIcon
                serviceKey={e.service_key}
                serviceUrl={e.service_url}
                size={16}
              />
              {e.service_name}
            </span>
          ))}
          {entries.length > 4 && (
            <span className="tile-foot">+{entries.length - 4} more</span>
          )}
        </>
      )}
    </button>
  );
}
