import { useState } from 'react';
import { splitEarning } from '../../lib/creators/earnings';
import type { Creator, VaultData } from '../../lib/types';
import { DossierHero } from './DossierHero';
import { EarningsTile } from './tiles/EarningsTile';
import { LinksTile } from './tiles/LinksTile';
import { LoginsTile } from './tiles/LoginsTile';
import { PayoutTile } from './tiles/PayoutTile';

export type DossierLayout = 'wide' | 'tall';

const LAYOUT_KEY = 'tg-vault-dossier-layout';

interface Props {
  creator: Creator;
  data: VaultData;
  readOnly: boolean;
  onEdit: () => void;
  onOpenLogins: () => void;
  onOpenDocuments: () => void;
  onRecordEarnings: () => void;
}

export function DossierView({
  creator,
  data,
  readOnly,
  onEdit,
  onOpenLogins,
  onOpenDocuments,
  onRecordEarnings,
}: Props) {
  // Layout is a personal preference, stored per install — Tyler and Gabriel
  // can differ.
  const [layout, setLayout] = useState<DossierLayout>(
    () => (localStorage.getItem(LAYOUT_KEY) as DossierLayout) ?? 'wide',
  );

  const switchLayout = (next: DossierLayout) => {
    localStorage.setItem(LAYOUT_KEY, next);
    setLayout(next);
  };

  const entries = data.entries.filter((e) => e.creator_id === creator.id);
  const documents = data.documents.filter((d) => d.creator_id === creator.id);
  const earnings = data.earnings
    .filter((e) => e.creator_id === creator.id)
    .sort((a, b) => a.month.localeCompare(b.month));

  const latest = earnings[earnings.length - 1];
  const currency = creator.payout_currency ?? latest?.currency ?? 'EUR';
  // Owed = what she is due from the most recent recorded month.
  const owed = latest ? splitEarning(latest.gross, creator.revenue_share).creator : 0;

  // One set of tiles, two containers.
  const tiles = (
    <>
      {creator.kind === 'creator' && (
        <EarningsTile
          earnings={earnings}
          currency={currency}
          revenueShare={creator.revenue_share}
          readOnly={readOnly}
          onRecord={onRecordEarnings}
        />
      )}
      <LoginsTile entries={entries} onOpen={onOpenLogins} />
      {creator.kind === 'creator' && <PayoutTile creator={creator} />}
      <LinksTile
        creator={creator}
        documents={documents}
        onOpenDocuments={onOpenDocuments}
      />
    </>
  );

  return (
    <div className="view">
      <div className="view-header">
        <h1>{creator.name}</h1>
        <div className="filter-row">
          <div className="layout-toggle">
            <button
              className={`btn btn-tiny ${layout === 'wide' ? 'btn-primary' : ''}`}
              title="Wide hero"
              onClick={() => switchLayout('wide')}
            >
              Wide
            </button>
            <button
              className={`btn btn-tiny ${layout === 'tall' ? 'btn-primary' : ''}`}
              title="Compact hero"
              onClick={() => switchLayout('tall')}
            >
              Compact
            </button>
          </div>
          <button className="btn" disabled={readOnly} onClick={onEdit}>
            Edit creator
          </button>
        </div>
      </div>

      {layout === 'wide' ? (
        <>
          <DossierHero
            creator={creator}
            variant="wide"
            owed={owed}
            currency={currency}
          />
          <div className="dossier-grid-wide">{tiles}</div>
        </>
      ) : (
        <div className="dossier-grid-tall">
          <DossierHero
            creator={creator}
            variant="tall"
            owed={owed}
            currency={currency}
          />
          {tiles}
        </div>
      )}
    </div>
  );
}
