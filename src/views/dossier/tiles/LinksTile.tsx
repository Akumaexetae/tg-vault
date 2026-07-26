import type { Creator, CreatorDocument } from '../../../lib/types';

interface Props {
  creator: Creator;
  documents: CreatorDocument[];
  onOpenDocuments: () => void;
}

export function LinksTile({ creator, documents, onOpenDocuments }: Props) {
  const links = [
    creator.of_url && { label: 'OnlyFans', url: creator.of_url },
    creator.getmysocial_url && {
      label: 'Getmysocial',
      url: creator.getmysocial_url,
    },
    creator.drive_folder_url && {
      label: 'Drive folder',
      url: creator.drive_folder_url,
    },
    ...creator.socials,
  ].filter(Boolean) as { label: string; url: string }[];

  return (
    <div className="card tile">
      <span className="tile-label">Links &amp; files</span>
      {links.length === 0 && <p className="tile-empty">No links yet.</p>}
      {links.map((l) => (
        <button
          key={l.url}
          className="tile-row tile-link"
          onClick={() => window.vaultBridge?.openExternal(l.url)}
        >
          🔗 {l.label} ↗
        </button>
      ))}
      <button className="tile-row tile-link" onClick={onOpenDocuments}>
        📄 {documents.length} document{documents.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}
