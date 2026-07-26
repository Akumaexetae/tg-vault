import { useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { ConnectScreen } from './components/ConnectScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EntryModal } from './components/EntryModal';
import { IdentityScreen } from './components/IdentityScreen';
import { ServiceIcon } from './components/ServiceIcon';
import { ToastProvider, useToast } from './components/Toast';
import { useVault } from './hooks/useVault';
import { backupFilename, buildBackup, buildCsv } from './lib/backup';
import { groupIdOf, serviceGroups } from './lib/groups';
import {
  canDeleteCreator,
  createCreator,
  createCreatorFull,
  createEntry,
  deleteCreator,
  deleteDocument,
  deleteEntry,
  deleteNote,
  documentUrl,
  saveDocument,
  saveEarning,
  saveNote,
  setPinned,
  updateCreator,
  updateEntry,
  uploadDocumentFile,
} from './lib/queries';
import { entryLabel, filterEntries } from './lib/search';
import { clearConnection, loadConnection } from './lib/settings';
import { resetClient } from './lib/supabase';
import type {
  Creator,
  CreatorDocument,
  CreatorInput,
  Entry,
  EntryInput,
  SecureNote,
  User,
} from './lib/types';
import { ActivityView } from './views/ActivityView';
import { DashboardView } from './views/DashboardView';
import { EntryListView } from './views/EntryListView';
import { HealthView } from './views/HealthView';
import { NotesView } from './views/NotesView';
import { CreatorModal, toInput } from './views/dossier/CreatorModal';
import { DocumentsView, type NewDocument } from './views/dossier/DocumentsView';
import { DossierView } from './views/dossier/DossierView';
import { EarningsModal } from './views/dossier/EarningsModal';
import { sortCreators } from './lib/creators/sort';

type Route =
  | { view: 'dashboard' }
  | { view: 'all' }
  | { view: 'notes' }
  | { view: 'health' }
  | { view: 'activity' }
  | { view: 'service'; id: string }
  | { view: 'creator'; id: string };

type ModalState =
  | null
  | { mode: 'new'; serviceKey?: string; creatorId?: string }
  | { mode: 'edit'; entry: Entry };

const CREATOR_COLORS = [
  '#e91e8c', '#8e44ad', '#00aff0', '#16a085',
  '#e67e22', '#2962ff', '#c2185b', '#00897b',
];

export function App() {
  const [connected, setConnected] = useState(() => loadConnection() !== null);
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('tg-vault-user');
    return stored === 'Tyler' || stored === 'Gabriel' ? stored : null;
  });

  // First launch: point this PC at the vault, then say who's using it.
  if (!connected) {
    return (
      <ConnectScreen
        onConnected={() => {
          resetClient();
          setConnected(true);
        }}
      />
    );
  }

  if (!user) {
    return (
      <IdentityScreen
        onPick={(u) => {
          localStorage.setItem('tg-vault-user', u);
          setUser(u);
        }}
      />
    );
  }

  return (
    <ToastProvider>
      <VaultApp
        user={user}
        onDisconnect={() => {
          clearConnection();
          resetClient();
          setConnected(false);
        }}
      />
    </ToastProvider>
  );
}

function VaultApp({
  user,
  onDisconnect,
}: {
  user: User;
  onDisconnect: () => void;
}) {
  const { data, status, refresh } = useVault();
  const toast = useToast();
  const [route, setRoute] = useState<Route>({ view: 'dashboard' });
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [pendingNoteDelete, setPendingNoteDelete] = useState<SecureNote | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [creatorTab, setCreatorTab] = useState<'overview' | 'logins' | 'documents'>(
    'overview',
  );
  const [creatorModal, setCreatorModal] = useState<Creator | 'new' | null>(null);
  const [earningsFor, setEarningsFor] = useState<Creator | null>(null);
  const [pendingCreatorDelete, setPendingCreatorDelete] = useState<Creator | null>(null);
  const [pendingDocDelete, setPendingDocDelete] = useState<CreatorDocument | null>(null);
  const [version, setVersion] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterCreator, setFilterCreator] = useState('');

  const readOnly = status !== 'online';
  const groups = useMemo(() => serviceGroups(data?.entries ?? []), [data]);

  // Passwords appearing on more than one account — surfaced as a "reused" flag.
  const reusedIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.entries ?? []) {
      if (e.password) counts.set(e.password, (counts.get(e.password) ?? 0) + 1);
    }
    return new Set(
      (data?.entries ?? [])
        .filter((e) => (counts.get(e.password) ?? 0) > 1)
        .map((e) => e.id),
    );
  }, [data]);

  // Auto-update: the new version is already downloaded, it just needs a restart.
  useEffect(() => {
    window.vaultBridge?.updateStatus().then(setUpdateReady).catch(() => {});
    window.vaultBridge?.onUpdateReady(() => setUpdateReady(true));
    window.vaultBridge?.appVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'unconfigured') {
    onDisconnect();
    return null;
  }

  if (status === 'loading' || !data) {
    return (
      <div className="identity-screen">
        <div className="loading-pulse">T&amp;G Vault</div>
      </div>
    );
  }

  const { creators, entries, notes, documents, activity } = data;
  const sortedCreators = sortCreators(creators);

  // --- Mutations ------------------------------------------------------
  const handleSave = async (input: EntryInput) => {
    const label = entryLabel(input, creators);
    if (modal?.mode === 'edit') {
      await updateEntry(modal.entry, input, user, label);
    } else {
      await createEntry(input, user, label);
    }
    await refresh();
    toast('Saved');
  };

  const handleDelete = async (entry: Entry) => {
    setPendingDelete(null);
    try {
      await deleteEntry(entry.id, user, entryLabel(entry, creators));
      await refresh();
      toast('Deleted');
    } catch {
      toast('Delete failed — are you online?', 'error');
    }
  };

  const handleTogglePin = async (entry: Entry) => {
    try {
      await setPinned(entry.id, !entry.pinned);
      await refresh();
    } catch {
      toast('Could not update pin', 'error');
    }
  };

  const handleAddCreator = async (name: string): Promise<Creator | null> => {
    try {
      const color = CREATOR_COLORS[creators.length % CREATOR_COLORS.length];
      const created = await createCreator(name, color);
      await refresh();
      return created;
    } catch {
      toast('Could not add creator — name taken?', 'error');
      return null;
    }
  };

  const handleSaveNote = async (note: {
    id?: string;
    title: string;
    body: string;
    creator_id: string | null;
  }) => {
    await saveNote(note, user);
    await refresh();
    toast('Note saved');
  };

  const handleDeleteNote = async (note: SecureNote) => {
    setPendingNoteDelete(null);
    try {
      await deleteNote(note.id, user, note.title);
      await refresh();
      toast('Note deleted');
    } catch {
      toast('Delete failed — are you online?', 'error');
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const now = new Date().toISOString();
    const contents =
      format === 'json'
        ? JSON.stringify(buildBackup(data, now), null, 2)
        : buildCsv(data);
    try {
      const saved = await window.vaultBridge?.saveBackup({
        filename: backupFilename(now, format),
        contents,
      });
      if (saved) toast(`Backup saved — ${format.toUpperCase()}`);
    } catch {
      toast('Could not save backup', 'error');
    }
  };

  // --- Dossier ---------------------------------------------------------
  const handleSaveCreator = async (input: CreatorInput) => {
    if (creatorModal && creatorModal !== 'new') {
      await updateCreator(creatorModal, input, user);
    } else {
      await createCreatorFull(input, user);
    }
    await refresh();
    toast('Saved');
  };

  const handleArchiveCreator = async (creator: Creator) => {
    const next = creator.status === 'ended' ? 'active' : 'ended';
    try {
      await updateCreator(creator, { ...toInput(creator), status: next }, user);
      await refresh();
      setCreatorModal(null);
      toast(next === 'ended' ? 'Creator archived' : 'Creator restored');
    } catch {
      toast('Could not update — are you online?', 'error');
    }
  };

  /** Deletion is blocked while anything hangs off the creator (spec §4). */
  const attemptDeleteCreator = (creator: Creator) => {
    const blocked = canDeleteCreator(creator.id, data);
    if (blocked) {
      toast(blocked, 'error');
      return;
    }
    setCreatorModal(null);
    setPendingCreatorDelete(creator);
  };

  const handleDeleteCreator = async (creator: Creator) => {
    setPendingCreatorDelete(null);
    try {
      await deleteCreator(creator.id, user, creator.name);
      await refresh();
      setRoute({ view: 'dashboard' });
      toast('Creator deleted');
    } catch {
      toast('Delete failed — are you online?', 'error');
    }
  };

  const handleAddDocument = async (creatorId: string, doc: NewDocument) => {
    let storagePath: string | null = null;
    if (doc.file) {
      storagePath = await uploadDocumentFile(doc.file, creatorId);
    }
    await saveDocument(
      {
        creator_id: creatorId,
        label: doc.label,
        kind: doc.kind,
        url: doc.url,
        storage_path: storagePath,
        size_bytes: doc.file?.size ?? null,
      },
      user,
    );
    await refresh();
    toast('Document added');
  };

  const handleDeleteDocument = async (doc: CreatorDocument) => {
    setPendingDocDelete(null);
    try {
      await deleteDocument(doc.id, user, doc.label);
      await refresh();
      toast('Document deleted');
    } catch {
      toast('Delete failed — are you online?', 'error');
    }
  };

  const handleOpenDocument = async (doc: CreatorDocument) => {
    try {
      const url = await documentUrl(doc);
      if (url) window.vaultBridge?.openExternal(url);
    } catch {
      toast('Could not open that document', 'error');
    }
  };

  const handleSaveEarnings = async (
    creator: Creator,
    month: string,
    gross: number,
    currency: string,
  ) => {
    await saveEarning(creator.id, month, gross, currency, user);
    await refresh();
    toast('Earnings recorded');
  };

  const rowHandlers = {
    reusedIds,
    onEdit: (e: Entry) => setModal({ mode: 'edit', entry: e }),
    onDelete: setPendingDelete,
    onTogglePin: handleTogglePin,
    onAdd: () => setModal({ mode: 'new' }),
  };

  // --- Route content ----------------------------------------------------
  const searching = query.trim().length > 0;
  let content;
  if (searching) {
    content = (
      <EntryListView
        title={`Search: “${query.trim()}”`}
        entries={filterEntries(entries, creators, query)}
        creators={creators}
        readOnly={readOnly}
        emptyText="Nothing matches."
        {...rowHandlers}
      />
    );
  } else if (route.view === 'dashboard') {
    content = (
      <DashboardView
        data={data}
        readOnly={readOnly}
        onShowHealth={() => setRoute({ view: 'health' })}
        {...rowHandlers}
      />
    );
  } else if (route.view === 'all') {
    const filtered = entries.filter(
      (e) =>
        (!filterService || groupIdOf(e) === filterService) &&
        (!filterCreator || e.creator_id === filterCreator),
    );
    content = (
      <EntryListView
        title="All accounts"
        entries={filtered}
        creators={creators}
        readOnly={readOnly}
        {...rowHandlers}
        headerExtra={
          <div className="filter-row">
            <select
              className="input input-small"
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
            >
              <option value="">All services</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              className="input input-small"
              value={filterCreator}
              onChange={(e) => setFilterCreator(e.target.value)}
            >
              <option value="">All creators</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
    );
  } else if (route.view === 'service') {
    const group = groups.find((g) => g.id === route.id);
    const list = entries.filter((e) => groupIdOf(e) === route.id);
    content = (
      <EntryListView
        title={
          <span className="title-with-icon">
            <ServiceIcon serviceKey={group?.key ?? 'custom'} serviceUrl={group?.url} size={34} />
            {group?.name ?? 'Service'}
          </span>
        }
        entries={list}
        creators={creators}
        readOnly={readOnly}
        {...rowHandlers}
        onAdd={() => setModal({ mode: 'new', serviceKey: group?.key })}
      />
    );
  } else if (route.view === 'creator') {
    const creator = creators.find((c) => c.id === route.id);
    const list = entries.filter((e) => e.creator_id === route.id);
    if (!creator) {
      content = (
        <div className="view">
          <div className="empty-state card">
            <p>That creator no longer exists.</p>
          </div>
        </div>
      );
    } else if (creatorTab === 'logins') {
      content = (
        <EntryListView
          title={
            <span className="title-with-icon">
              <button className="btn btn-tiny" onClick={() => setCreatorTab('overview')}>
                ← {creator.name}
              </button>
              Logins
            </span>
          }
          subtitle={`${list.length} account${list.length === 1 ? '' : 's'}`}
          entries={list}
          creators={creators}
          readOnly={readOnly}
          showCreator={false}
          {...rowHandlers}
          onAdd={() => setModal({ mode: 'new', creatorId: route.id })}
        />
      );
    } else if (creatorTab === 'documents') {
      content = (
        <DocumentsView
          creatorName={creator.name}
          documents={documents.filter((d) => d.creator_id === creator.id)}
          readOnly={readOnly}
          onAdd={(doc) => handleAddDocument(creator.id, doc)}
          onDelete={setPendingDocDelete}
          onOpen={handleOpenDocument}
          onBack={() => setCreatorTab('overview')}
        />
      );
    } else {
      content = (
        <DossierView
          creator={creator}
          data={data}
          readOnly={readOnly}
          onEdit={() => setCreatorModal(creator)}
          onOpenLogins={() => setCreatorTab('logins')}
          onOpenDocuments={() => setCreatorTab('documents')}
          onRecordEarnings={() => setEarningsFor(creator)}
        />
      );
    }
  } else if (route.view === 'notes') {
    content = (
      <NotesView
        notes={notes}
        creators={creators}
        readOnly={readOnly}
        onSave={handleSaveNote}
        onDelete={setPendingNoteDelete}
      />
    );
  } else if (route.view === 'health') {
    content = (
      <HealthView
        entries={entries}
        creators={creators}
        readOnly={readOnly}
        reusedIds={reusedIds}
        onEdit={rowHandlers.onEdit}
        onDelete={rowHandlers.onDelete}
        onTogglePin={handleTogglePin}
      />
    );
  } else {
    content = <ActivityView activity={activity} />;
  }

  const navItem = (label: string, r: Route, active: boolean, icon?: React.ReactNode) => (
    <button
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
      onClick={() => {
        setQuery('');
        setRoute(r);
      }}
    >
      {icon}
      <span className="nav-label">{label}</span>
    </button>
  );

  const on = (view: Route['view']) => !searching && route.view === view;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          T<span className="logo-amp">&amp;</span>G Vault
        </div>

        <nav className="sidebar-nav">
          {navItem('Dashboard', { view: 'dashboard' }, on('dashboard'))}
          {navItem('All accounts', { view: 'all' }, on('all'))}
          {navItem('Secure notes', { view: 'notes' }, on('notes'))}
          {navItem('Password health', { view: 'health' }, on('health'))}
          {navItem('Activity', { view: 'activity' }, on('activity'))}

          <div className="nav-section">Services</div>
          {groups.map((g) =>
            navItem(
              `${g.name} (${g.count})`,
              { view: 'service', id: g.id },
              !searching && route.view === 'service' && route.id === g.id,
              <ServiceIcon serviceKey={g.key} serviceUrl={g.url} size={20} />,
            ),
          )}

          <div className="nav-section">
            Creators
            <button
              className="icon-btn nav-section-add"
              title="Add creator"
              disabled={readOnly}
              onClick={() => setCreatorModal('new')}
            >
              +
            </button>
          </div>
          {sortedCreators.map((c) => (
            <button
              key={c.id}
              className={`nav-item ${
                !searching && route.view === 'creator' && route.id === c.id
                  ? 'nav-item-active'
                  : ''
              } ${c.status === 'ended' || c.status === 'paused' ? 'nav-item-dim' : ''}`}
              onClick={() => {
                setQuery('');
                setCreatorTab('overview');
                setRoute({ view: 'creator', id: c.id });
              }}
            >
              <span className="creator-avatar" style={{ background: c.color }}>
                {c.name[0]}
              </span>
              <span className="nav-label">
                {c.name} ({entries.filter((e) => e.creator_id === c.id).length})
              </span>
              {c.status !== 'active' && c.kind === 'creator' && (
                <span
                  className="status-dot"
                  title={c.status}
                  style={{
                    background:
                      c.status === 'ended'
                        ? '#8aa1ae'
                        : c.status === 'paused'
                          ? '#fab219'
                          : '#7fcdf3',
                  }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="backup-row">
            <button className="btn btn-tiny" onClick={() => handleExport('json')}>
              Backup JSON
            </button>
            <button className="btn btn-tiny" onClick={() => handleExport('csv')}>
              CSV
            </button>
          </div>
          <div className="sidebar-user">
            <span className={`activity-avatar avatar-${user.toLowerCase()}`}>{user[0]}</span>
            {user}
            {version && <span className="version-tag">v{version}</span>}
            <button
              className="icon-btn sidebar-disconnect"
              title="Disconnect this PC from the vault"
              onClick={onDisconnect}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <input
            className="input search-input"
            placeholder="Search services, creators, usernames…    (Ctrl+K for quick copy)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={readOnly}
            onClick={() => setModal({ mode: 'new' })}
          >
            + Add account
          </button>
        </header>

        {status === 'offline' && (
          <div className="offline-banner">
            Offline — showing last synced data. Editing is disabled until you reconnect.
          </div>
        )}

        {updateReady && (
          <div className="update-banner">
            A new version is ready.
            <button
              className="btn btn-tiny update-btn"
              onClick={() => window.vaultBridge?.restartForUpdate()}
            >
              Restart now
            </button>
          </div>
        )}

        <main className="content">{content}</main>
      </div>

      {paletteOpen && (
        <CommandPalette
          entries={entries}
          creators={creators}
          onClose={() => setPaletteOpen(false)}
          onToast={toast}
        />
      )}

      {modal && (
        <EntryModal
          initial={modal.mode === 'edit' ? modal.entry : null}
          creators={creators}
          defaultServiceKey={modal.mode === 'new' ? modal.serviceKey : undefined}
          defaultCreatorId={modal.mode === 'new' ? modal.creatorId : undefined}
          onSave={handleSave}
          onAddCreator={handleAddCreator}
          onClose={() => setModal(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete account?"
          body={`This permanently removes ${entryLabel(pendingDelete, creators)} for both of you.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {creatorModal && (
        <CreatorModal
          initial={creatorModal === 'new' ? null : creatorModal}
          existingCount={creators.length}
          onSave={handleSaveCreator}
          onArchive={
            creatorModal !== 'new'
              ? () => handleArchiveCreator(creatorModal)
              : undefined
          }
          onDelete={
            creatorModal !== 'new'
              ? () => attemptDeleteCreator(creatorModal)
              : undefined
          }
          onClose={() => setCreatorModal(null)}
        />
      )}

      {earningsFor && (
        <EarningsModal
          creator={earningsFor}
          earnings={data.earnings.filter((e) => e.creator_id === earningsFor.id)}
          onSave={(month, gross, currency) =>
            handleSaveEarnings(earningsFor, month, gross, currency)
          }
          onClose={() => setEarningsFor(null)}
        />
      )}

      {pendingCreatorDelete && (
        <ConfirmDialog
          title="Delete creator?"
          body={`This permanently removes ${pendingCreatorDelete.name} for both of you. She has no logins, documents or earnings attached.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteCreator(pendingCreatorDelete)}
          onCancel={() => setPendingCreatorDelete(null)}
        />
      )}

      {pendingDocDelete && (
        <ConfirmDialog
          title="Delete document?"
          body={`This removes “${pendingDocDelete.label}” for both of you.${
            pendingDocDelete.url ? ' The file in Drive is untouched.' : ''
          }`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteDocument(pendingDocDelete)}
          onCancel={() => setPendingDocDelete(null)}
        />
      )}

      {pendingNoteDelete && (
        <ConfirmDialog
          title="Delete note?"
          body={`This permanently removes “${pendingNoteDelete.title}” for both of you.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteNote(pendingNoteDelete)}
          onCancel={() => setPendingNoteDelete(null)}
        />
      )}
    </div>
  );
}
