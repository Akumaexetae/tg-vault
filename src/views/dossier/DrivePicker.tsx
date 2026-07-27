import { useCallback, useEffect, useState } from 'react';
import { FolderIcon, DocumentIcon } from '../../components/icons';
import {
  FOLDER_MIME,
  childrenQuery,
  folderUrl,
  sortDriveFiles,
  type DriveFile,
} from '../../lib/drive';

interface Props {
  onPick: (file: DriveFile) => void;
  onClose: () => void;
}

interface Crumb {
  id: string;
  name: string;
}

const ROOT: Crumb = { id: 'root', name: 'My Drive' };

export function DrivePicker({ onPick, onClose }: Props) {
  const [status, setStatus] = useState<'checking' | 'setup' | 'signin' | 'ready'>(
    'checking',
  );
  const [clientId, setClientId] = useState('');
  const [trail, setTrail] = useState<Crumb[]>([ROOT]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'ready') load(here.id);
  }, [status, here.id, load]);

  const saveClientId = async () => {
    const id = clientId.trim();
    if (!id.endsWith('.apps.googleusercontent.com')) {
      setError('That should end in .apps.googleusercontent.com');
      return;
    }
    await window.vaultBridge.driveSetClientId(id);
    setError('');
    await refreshStatus();
  };

  const signIn = async () => {
    setError('');
    try {
      await window.vaultBridge.driveSignIn();
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choose from Google Drive</h2>

        {status === 'checking' && <p className="muted">Checking…</p>}

        {status === 'setup' && (
          <>
            <p className="confirm-body">
              Drive needs a one-time setup — a free Google Cloud project so the
              app can ask for access on your behalf.
            </p>
            <ol className="setup-steps">
              <li>
                Go to <strong>console.cloud.google.com</strong> → create a project
              </li>
              <li>
                <strong>APIs &amp; Services → Library</strong> → enable{' '}
                <strong>Google Drive API</strong>
              </li>
              <li>
                <strong>OAuth consent screen</strong> → External → add yourself and
                Gabriel as <strong>Test users</strong>
              </li>
              <li>
                <strong>Credentials → Create credentials → OAuth client ID</strong> →
                type <strong>Desktop app</strong>
              </li>
              <li>Copy the client ID and paste it below</li>
            </ol>
            <label className="form-label">Client ID</label>
            <input
              className="input"
              placeholder="…apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <p className="connect-hint photo-hint">
              Not a secret — Google's desktop flow uses PKCE rather than a client
              secret, which is why none is asked for.
            </p>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveClientId}>
                Save
              </button>
            </div>
          </>
        )}

        {status === 'signin' && (
          <>
            <p className="confirm-body">
              Sign in to Google to browse your Drive. Read-only — the app can list
              and link files, never change or delete them.
            </p>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={signIn}>
                Sign in to Google
              </button>
            </div>
          </>
        )}

        {status === 'ready' && (
          <>
            <div className="drive-crumbs">
              {trail.map((c, i) => (
                <button
                  key={c.id}
                  className="drive-crumb"
                  disabled={i === trail.length - 1}
                  onClick={() => setTrail(trail.slice(0, i + 1))}
                >
                  {c.name}
                  {i < trail.length - 1 && <span className="drive-sep">›</span>}
                </button>
              ))}
            </div>

            <div className="card drive-list">
              {loading && <p className="muted">Loading…</p>}
              {!loading && files.length === 0 && !error && (
                <p className="muted">This folder is empty.</p>
              )}
              {files.map((f) => {
                const isFolder = f.mimeType === FOLDER_MIME;
                return (
                  <div key={f.id} className="drive-row">
                    <button
                      className="drive-open"
                      onClick={() =>
                        isFolder
                          ? setTrail([...trail, { id: f.id, name: f.name }])
                          : onPick(f)
                      }
                    >
                      {isFolder ? <FolderIcon size={16} /> : <DocumentIcon size={16} />}
                      <span className="drive-name">{f.name}</span>
                    </button>
                    {isFolder && (
                      <button
                        className="btn btn-tiny"
                        onClick={() =>
                          onPick({ ...f, webViewLink: f.webViewLink ?? folderUrl(f.id) })
                        }
                      >
                        Use this
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions">
              <button
                className="btn modal-action-left"
                onClick={async () => {
                  await window.vaultBridge.driveSignOut();
                  await refreshStatus();
                }}
              >
                Sign out
              </button>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={here.id === 'root'}
                onClick={() =>
                  onPick({
                    id: here.id,
                    name: here.name,
                    mimeType: FOLDER_MIME,
                    webViewLink: folderUrl(here.id),
                  })
                }
              >
                Use “{here.name}”
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
