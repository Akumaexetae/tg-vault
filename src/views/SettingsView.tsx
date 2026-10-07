import { useEffect, useState } from 'react';
import {
  DEFAULT_BACKUP,
  describeSchedule,
  type BackupSettings,
} from '../lib/autoBackup';
import { loadPreference, savePreference } from '../lib/settings';
import { applyTheme, loadTheme, watchSystemTheme, type Theme } from '../lib/theme';
import { isInstagram, instagramHandle } from '../lib/instagram';
import type { Entry } from '../lib/types';

interface Props {
  version: string;
  user: string;
  entries: Entry[];
  onBackupNow: () => Promise<void>;
  onDisconnect: () => void;
}

export function SettingsView({ version, user, entries, onBackupNow, onDisconnect }: Props) {
  const [backup, setBackup] = useState<BackupSettings>(() =>
    loadPreference<BackupSettings>('backup', DEFAULT_BACKUP),
  );
  const [drive, setDrive] = useState<{ configured: boolean; signedIn: boolean }>({
    configured: false,
    signedIn: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [viewer, setViewer] = useState<string>(
    () => loadPreference<{ id: string }>('instagram-viewer', { id: '' }).id,
  );

  // Only accounts with a usable handle can act as a viewer.
  const viewerOptions = entries
    .filter((e) => isInstagram(e.service_key) && instagramHandle(e.username))
    .sort((a, b) => a.username.localeCompare(b.username));

  // The viewer's proxy is stored alongside its id so a row can open a window
  // without the entry list being threaded through every view. It is a copy, so
  // changing that account's proxy means re-picking it here.
  function chooseViewer(id: string) {
    setViewer(id);
    const chosen = entries.find((e) => e.id === id);
    savePreference('instagram-viewer', { id, proxy: chosen?.proxy ?? null });
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    savePreference('theme', next);
    applyTheme(next);
  }

  // On "System", follow the OS while the app is open, not just at launch.
  useEffect(() => {
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);

  useEffect(() => {
    window.vaultBridge?.driveStatus().then(setDrive).catch(() => {});
  }, []);

  const update = (patch: Partial<BackupSettings>) => {
    const next = { ...backup, ...patch };
    setBackup(next);
    savePreference('backup', next);
  };

  const chooseFolder = async () => {
    const folder = await window.vaultBridge.chooseBackupFolder();
    if (folder) update({ folder });
  };

  const runNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onBackupNow();
      const next = { ...backup, lastAt: new Date().toISOString() };
      setBackup(next);
      savePreference('backup', next);
      setMessage('Backup written.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Backup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">This PC only — Gabriel's settings are his own.</p>
        </div>
      </div>

      <div className="settings-stack">
        <section className="card settings-card">
          <h2>Appearance</h2>
          <p className="muted settings-lead">
            Stored on this PC, not in the vault — switching here doesn't change
            anyone else's screen.
          </p>

          <div className="theme-choice" role="radiogroup" aria-label="Theme">
            {([
              ['system', 'System', 'Follow Windows'],
              ['light', 'Light', 'Always light'],
              ['dark', 'Dark', 'Always dark'],
            ] as [Theme, string, string][]).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                className={`theme-option ${theme === value ? 'theme-option-on' : ''}`}
                onClick={() => changeTheme(value)}
              >
                <span className={`theme-swatch theme-swatch-${value}`} aria-hidden="true" />
                <span className="theme-option-label">{label}</span>
                <span className="theme-option-hint">{hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card">
          <h2>Viewing Instagram profiles</h2>
          <p className="muted settings-lead">
            Which account to browse from when you preview a profile. Pick one you
            don't mind being seen as a viewer — it's your session that loads the
            page, not the account you're looking at. Stored on this PC, so you and
            Gabriel can each use your own.
          </p>

          <select
            className="input"
            value={viewer}
            onChange={(e) => chooseViewer(e.target.value)}
          >
            <option value="">Not set — preview buttons hidden</option>
            {viewerOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.username}
              </option>
            ))}
          </select>
          {viewerOptions.length === 0 && (
            <span className="form-hint">
              No Instagram accounts with a usable handle yet.
            </span>
          )}
        </section>

        <section className="card settings-card">
          <h2>Automatic backups</h2>
          <p className="muted settings-lead">
            The vault has one cloud copy and no encryption. A scheduled export to
            a folder you control is the difference between a bad afternoon and a
            lost business.
          </p>

          <label className="settings-row">
            <input
              type="checkbox"
              checked={backup.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            <span>Back up automatically</span>
          </label>

          <div className="form-row settings-row">
            <div className="form-col">
              <label className="form-label">Folder</label>
              <div className="form-row">
                <input
                  className="input"
                  readOnly
                  value={backup.folder ?? 'Not chosen'}
                />
                <button className="btn" onClick={chooseFolder}>
                  Choose…
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-col">
              <label className="form-label">How often</label>
              <select
                className="input"
                value={backup.everyDays}
                onChange={(e) => update({ everyDays: Number(e.target.value) })}
              >
                <option value={1}>Every day</option>
                <option value={7}>Every week</option>
                <option value={14}>Every fortnight</option>
                <option value={30}>Every month</option>
              </select>
            </div>
            <div className="form-col">
              <label className="form-label">Keep the last</label>
              <select
                className="input"
                value={backup.keep}
                onChange={(e) => update({ keep: Number(e.target.value) })}
              >
                <option value={5}>5 backups</option>
                <option value={10}>10 backups</option>
                <option value={25}>25 backups</option>
                <option value={100}>100 backups</option>
              </select>
            </div>
          </div>

          <p className="tile-foot">{describeSchedule(backup)}</p>

          <div className="settings-actions">
            <button
              className="btn btn-primary"
              disabled={busy || !backup.folder}
              onClick={runNow}
            >
              {busy ? 'Writing…' : 'Back up now'}
            </button>
            {message && <span className="detail-meta">{message}</span>}
          </div>

          <p className="connect-hint photo-hint">
            Only files this app wrote are ever deleted when pruning — anything
            else in that folder is left alone.
          </p>
        </section>

        <section className="card settings-card">
          <h2>Google Drive</h2>
          <p className="muted settings-lead">
            {drive.configured
              ? drive.signedIn
                ? 'Connected and signed in.'
                : 'Configured, but not signed in on this PC.'
              : 'Not set up on this PC.'}
          </p>
          {drive.signedIn && (
            <button
              className="btn"
              onClick={async () => {
                await window.vaultBridge.driveSignOut();
                setDrive({ ...drive, signedIn: false });
              }}
            >
              Sign out of Google
            </button>
          )}
        </section>

        <section className="card settings-card">
          <h2>This install</h2>
          <div className="settings-facts">
            <span>
              Signed in as <strong>{user}</strong>
            </span>
            <span>
              Version <strong>{version || '—'}</strong>
            </span>
          </div>
          <button className="btn btn-danger" onClick={onDisconnect}>
            Disconnect this PC from the vault
          </button>
          <p className="connect-hint photo-hint">
            Forgets the vault address and key on this machine. Nothing in the
            vault itself is touched.
          </p>
        </section>
      </div>
    </div>
  );
}
