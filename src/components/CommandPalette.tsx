import { useEffect, useMemo, useRef, useState } from 'react';
import { filterEntries } from '../lib/search';
import { totpCode } from '../lib/totp';
import type { Creator, Entry } from '../lib/types';
import { ServiceIcon } from './ServiceIcon';

interface Props {
  entries: Entry[];
  creators: Creator[];
  onClose: () => void;
  onToast: (message: string, kind?: 'ok' | 'error') => void;
}

/** Ctrl+K palette: Enter copies the password, Shift+Enter opens the login window. */
export function CommandPalette({ entries, creators, onClose, onToast }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => filterEntries(entries, creators, query).slice(0, 40),
    [entries, creators, query],
  );

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-item-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (entry: Entry | undefined, login: boolean) => {
    if (!entry) return;
    if (login) {
      if (!entry.service_url) {
        onToast('No URL on this account', 'error');
        return;
      }
      window.vaultBridge?.openLogin({
        id: entry.id,
        url: entry.service_url,
        username: entry.username,
        password: entry.password,
        totp: entry.totp_secret ? (totpCode(entry.totp_secret)?.code ?? null) : null,
        proxy: entry.proxy,
      });
      onToast(`Opening ${entry.service_name}…`);
    } else {
      navigator.clipboard
        .writeText(entry.password)
        .then(() => onToast(`Password copied — ${entry.service_name}`))
        .catch(() => onToast('Could not copy', 'error'));
    }
    onClose();
  };

  return (
    <div className="modal-overlay palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          autoFocus
          placeholder="Search accounts…  ⏎ copy password   ⇧⏎ log in"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(results[index], e.shiftKey);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">No matches</div>}
          {results.map((entry, i) => {
            const creator = creators.find((c) => c.id === entry.creator_id);
            return (
              <div
                key={entry.id}
                className={`palette-item ${i === index ? 'palette-item-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={(e) => run(entry, e.shiftKey)}
              >
                <ServiceIcon serviceKey={entry.service_key} serviceUrl={entry.service_url} size={22} />
                <span className="palette-service">{entry.service_name}</span>
                {creator && (
                  <span className="pill" style={{ background: `${creator.color}22`, color: creator.color }}>
                    {creator.name}
                  </span>
                )}
                <span className="palette-username">{entry.username}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
