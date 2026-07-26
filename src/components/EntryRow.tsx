import { useState } from 'react';
import { useTotp } from '../hooks/useTotp';
import { timeAgo } from '../lib/time';
import type { Creator, Entry } from '../lib/types';
import { ServiceIcon } from './ServiceIcon';
import { useToast } from './Toast';

interface Props {
  entry: Entry;
  creators: Creator[];
  readOnly: boolean;
  showCreator?: boolean;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button
      className="icon-btn"
      title={`Copy ${label}`}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => toast(`${label} copied`))
          .catch(() => toast(`Could not copy ${label}`, 'error'))
      }
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
      </svg>
    </button>
  );
}

function TotpBadge({ secret }: { secret: string }) {
  const totp = useTotp(secret);
  const toast = useToast();
  if (!totp) return <span className="totp-invalid">bad 2FA secret</span>;
  const frac = totp.secondsLeft / 30;
  const r = 8;
  const circ = 2 * Math.PI * r;
  return (
    <button
      className="totp-badge"
      title="Copy 2FA code"
      onClick={() =>
        navigator.clipboard.writeText(totp.code).then(() => toast('2FA code copied'))
      }
    >
      <svg width="20" height="20" viewBox="0 0 20 20" className="totp-ring">
        <circle cx="10" cy="10" r={r} fill="none" stroke="#d4eefb" strokeWidth="3" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="#00aff0"
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 10 10)"
        />
      </svg>
      <span className="totp-code">
        {totp.code.slice(0, 3)} {totp.code.slice(3)}
      </span>
    </button>
  );
}

export function EntryRow({
  entry,
  creators,
  readOnly,
  showCreator = true,
  onEdit,
  onDelete,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const creator = creators.find((c) => c.id === entry.creator_id);
  const hasDetails =
    !!entry.recovery || entry.custom_fields.length > 0 || !!entry.notes;

  return (
    <div className="entry-row card">
      <div className="entry-main">
        <ServiceIcon serviceKey={entry.service_key} serviceUrl={entry.service_url} />
        <div className="entry-id">
          <span className="entry-service">{entry.service_name}</span>
          {showCreator && creator && (
            <span
              className="pill"
              style={{ background: `${creator.color}22`, color: creator.color }}
            >
              {creator.name}
            </span>
          )}
        </div>

        <div className="entry-field entry-username" title={entry.username}>
          <span className="field-value">{entry.username}</span>
          <CopyButton value={entry.username} label="Username" />
        </div>

        <div className="entry-field entry-password">
          <button
            className="password-mask"
            title={revealed ? 'Hide password' : 'Reveal password'}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? entry.password : '••••••••'}
          </button>
          <CopyButton value={entry.password} label="Password" />
        </div>

        <div className="entry-totp">
          {entry.totp_secret ? <TotpBadge secret={entry.totp_secret} /> : null}
        </div>

        <div className="entry-actions">
          {entry.service_url && (
            <button
              className="btn btn-login"
              title="Open this account in its own logged-in window"
              onClick={() =>
                window.vaultBridge?.openLogin({
                  id: entry.id,
                  url: entry.service_url,
                  username: entry.username,
                  password: entry.password,
                })
              }
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" />
              </svg>
              Log in
            </button>
          )}
          {entry.service_url && (
            <button
              className="icon-btn"
              title="Open site in your browser"
              onClick={() => window.vaultBridge?.openExternal(entry.service_url)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM5 5h5V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-2v5H5V5z" />
              </svg>
            </button>
          )}
          {hasDetails && (
            <button
              className={`icon-btn ${expanded ? 'icon-btn-active' : ''}`}
              title="Details"
              onClick={() => setExpanded((e) => !e)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d={expanded ? 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z' : 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z'} />
              </svg>
            </button>
          )}
          <button className="icon-btn" title="Edit" disabled={readOnly} onClick={() => onEdit(entry)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
          <button className="icon-btn icon-btn-danger" title="Delete" disabled={readOnly} onClick={() => onDelete(entry)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="entry-details">
          {entry.recovery && (
            <div className="detail-block">
              <span className="detail-label">Recovery</span>
              <pre className="detail-text">{entry.recovery}</pre>
            </div>
          )}
          {entry.custom_fields.length > 0 && (
            <div className="detail-block">
              <span className="detail-label">Fields</span>
              <div className="detail-fields">
                {entry.custom_fields.map((f, i) => (
                  <div key={i} className="detail-field">
                    <span className="detail-field-key">{f.key}</span>
                    <span className="detail-field-value">{f.value}</span>
                    <CopyButton value={f.value} label={f.key} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {entry.notes && (
            <div className="detail-block">
              <span className="detail-label">Notes</span>
              <pre className="detail-text">{entry.notes}</pre>
            </div>
          )}
          <span className="detail-meta">
            Updated {timeAgo(entry.updated_at)} by {entry.updated_by}
          </span>
        </div>
      )}
    </div>
  );
}
