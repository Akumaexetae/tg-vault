import { useCallback, useEffect, useState } from 'react';
import { CreatorAvatar } from '../../components/CreatorAvatar';
import { DocumentIcon, FolderIcon } from '../../components/icons';
import {
  FOLDER_MIME,
  childrenQuery,
  extractDriveId,
  sortDriveFiles,
  type DriveFile,
} from '../../lib/drive';
import type { Creator } from '../../lib/types';
import { DriveTile } from './DriveTile';

interface Props {
  creator: Creator;
  onSetup: () => void;
  onChooseFolder: () => void;
}

interface Crumb {
  id: string;
  name: string;
}

type Status = 'checking' | 'setup' | 'signin' | 'ready';

export function DriveView({ creator, onSetup, onChooseFolder }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  const rootId = extractDriveId(creator.drive_folder_url ?? '');

  // Reset to the creator's own folder whenever the creator changes.
  useEffect(() => {
    setTrail(rootId ? [{ id: rootId, name: creator.name }] : []);
  }, [rootId, creator.name]);

  const here = trail[trail.length - 1];

  const refreshStatus = useCallback(async () => {
    const s = await window.vaultBridge.driveStatus();
    setStatus(!s.configured ? 'setup' : !s.signedIn ? 'signin' : 'ready');
  }, []);

  useEffect(() => {
    refreshStatus().catch(() => setStatus('setup'));
  }, [refreshStatus]);

  const load = useCallback(async (folderId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = (await window.vaultBridge.driveList(
        childrenQuery(folderId),
      )) as DriveFile[];
      setFiles(sortDriveFiles(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that folder.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'ready' && here) load(here.id);
  }, [status, here, load]);

  const signIn = async () => {
    setError('');
    try {
      await window.vaultBridge.driveSignIn();
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  };

  if (!rootId) {
    return (
      <div className="view">
        <div className="view-header">
          <h1>
            <span className="title-with-icon">
              <CreatorAvatar creator={creator} size={30} />
              {creator.name} · Drive
            </span>
          </h1>
        </div>
        <div className="empty-state card">
          <p>No Drive folder linked for {creator.name}.</p>
          <button className="btn btn-primary" onClick={onChooseFolder}>
            Choose a folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>
            <span className="title-with-icon">
              <CreatorAvatar creator={creator} size={30} />
              {creator.name} · Drive
            </span>
          </h1>
          {status === 'ready' && (
            <div className="drive-crumbs">
              {trail.map((c, i) => (
                <button
                  key={`${c.id}-${i}`}
                  className="drive-crumb"
                  disabled={i === trail.length - 1}
                  onClick={() => setTrail(trail.slice(0, i + 1))}
                >
                  {c.name}
                  {i < trail.length - 1 && <span className="drive-sep">›</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="filter-row">
          {status === 'ready' && (
            <>
              <button
                className={`btn btn-tiny ${layout === 'grid' ? 'btn-primary' : ''}`}
                onClick={() => setLayout('grid')}
              >
                Grid
              </button>
              <button
                className={`btn btn-tiny ${layout === 'list' ? 'btn-primary' : ''}`}
                onClick={() => setLayout('list')}
              >
                List
              </button>
              <button className="btn" onClick={onChooseFolder}>
                Change folder
              </button>
              <button
                className="btn"
                onClick={() =>
                  window.vaultBridge?.openExternal(creator.drive_folder_url ?? '')
                }
              >
                Open in Drive
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'checking' && <p className="muted">Checking…</p>}

      {status === 'setup' && (
        <div className="empty-state card">
          <p>Google Drive isn't set up on this PC yet.</p>
          <button className="btn btn-primary" onClick={onSetup}>
            Set up Drive
          </button>
        </div>
      )}

      {status === 'signin' && (
        <div className="empty-state card">
          <p>Sign in to Google to browse this folder.</p>
          <p className="muted">
            Read-only — the app can list and open files, never change or delete
            them.
          </p>
          <button className="btn btn-primary" onClick={signIn}>
            Sign in to Google
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {loading && <p className="muted">Loading…</p>}
          {error && <div className="form-error">{error}</div>}
          {!loading && !error && files.length === 0 && (
            <div className="empty-state card">
              <p>This folder is empty.</p>
            </div>
          )}

          {layout === 'grid' ? (
            <div className="drive-grid">
              {files.map((f) => (
                <DriveTile
                  key={f.id}
                  file={f}
                  onOpen={() =>
                    f.mimeType === FOLDER_MIME
                      ? setTrail([...trail, { id: f.id, name: f.name }])
                      : window.vaultBridge?.openExternal(f.webViewLink ?? '')
                  }
                />
              ))}
            </div>
          ) : (
            <div className="entry-list">
              {files.map((f) => (
                <button
                  key={f.id}
                  className="card drive-list-row"
                  onClick={() =>
                    f.mimeType === FOLDER_MIME
                      ? setTrail([...trail, { id: f.id, name: f.name }])
                      : window.vaultBridge?.openExternal(f.webViewLink ?? '')
                  }
                >
                  {f.mimeType === FOLDER_MIME ? (
                    <FolderIcon size={18} />
                  ) : (
                    <DocumentIcon size={18} />
                  )}
                  <span className="drive-name">{f.name}</span>
                  {f.modifiedTime && (
                    <span className="detail-meta">
                      {new Date(f.modifiedTime).toLocaleDateString()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
