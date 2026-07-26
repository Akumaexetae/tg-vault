import { useState } from 'react';
import { sortCreators } from '../lib/creators/sort';
import { grossByCreator, monthsAgo } from '../lib/money';
import type { Creator, VaultData } from '../lib/types';
import { CreatorCard } from './CreatorCard';

type Filter = 'all' | 'active' | 'archived';

interface Props {
  data: VaultData;
  readOnly: boolean;
  onOpen: (creator: Creator) => void;
  onAdd: () => void;
}

const MATCHES: Record<Filter, (c: Creator) => boolean> = {
  all: () => true,
  active: (c) => c.status === 'active' || c.status === 'onboarding',
  archived: (c) => c.status === 'ended' || c.status === 'paused',
};

export function CreatorsView({ data, readOnly, onOpen, onAdd }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const month = monthsAgo(0);
  const gross = new Map(
    grossByCreator(data.earnings, month).map((r) => [r.creator_id, r]),
  );

  const all = sortCreators(data.creators);
  const shown = all.filter(MATCHES[filter]);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${all.length}` },
    { key: 'active', label: `Active ${all.filter(MATCHES.active).length}` },
    { key: 'archived', label: `Archived ${all.filter(MATCHES.archived).length}` },
  ];

  return (
    <div className="view">
      <div className="view-header">
        <h1>Creators</h1>
        <div className="chip-row">
          {chips.map((c) => (
            <button
              key={c.key}
              className={`chip ${filter === c.key ? 'chip-active' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-grid">
        {shown.map((creator) => {
          const row = gross.get(creator.id);
          return (
            <CreatorCard
              key={creator.id}
              creator={creator}
              loginCount={
                data.entries.filter((e) => e.creator_id === creator.id).length
              }
              monthGross={row?.gross ?? null}
              currency={row?.currency ?? creator.payout_currency ?? 'EUR'}
              onOpen={() => onOpen(creator)}
            />
          );
        })}

        <button className="creator-card creator-card-add" disabled={readOnly} onClick={onAdd}>
          <span>+</span>
          Add creator
        </button>
      </div>

      {shown.length === 0 && (
        <div className="empty-state card">
          <p>No creators match that filter.</p>
        </div>
      )}
    </div>
  );
}
