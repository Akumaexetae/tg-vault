import { useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { ConnectScreen } from './components/ConnectScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CreatorAvatar } from './components/CreatorAvatar';
import { NavGroup } from './components/NavGroup';
import { PowerIcon } from './components/icons';
import { EntryModal } from './components/EntryModal';
import { IdentityScreen } from './components/IdentityScreen';
import { ServiceIcon } from './components/ServiceIcon';
import { ToastProvider, useToast } from './components/Toast';
import { useVault } from './hooks/useVault';
import { backupFilename, buildBackup, buildCsv, buildCreatorsCsv } from './lib/backup';
import {
  DEFAULT_BACKUP,
  autoBackupName,
  isBackupDue,
  prunableBackups,
  type BackupSettings,
} from './lib/autoBackup';
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
  saveEarnings,
  setEarningPaid,
  createCard,
  updateCard,
  moveCard,
  deleteCard,
  rebalanceLane,
  saveNote,
  setPinned,
  updateCreator,
  updateEntry,
  uploadAvatar,
  uploadDocumentFile,
} from './lib/queries';
import { resizeAvatar } from './lib/images';
import { entryLabel, filterEntries } from './lib/search';
import {
  clearConnection,
  loadConnection,
  loadPreference,
  loadUser,
  savePreference,
  saveUser,
} from './lib/settings';
import { resetClient } from './lib/supabase';
import type {
  Creator,
  CreatorDocument,
  CreatorEarning,
  CreatorInput,
  BoardCard,
  Lane,
  Entry,
  EntryInput,
  SecureNote,
  User,
} from './lib/types';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { CreatorsView } from './views/CreatorsView';
import { EntryListView } from './views/EntryListView';
import { HomeView } from './views/HomeView';
import { ImportModal } from './views/money/ImportModal';
import { MoneyView } from './views/money/MoneyView';
import { BoardView } from './views/planning/BoardView';
import { CardModal, type CardInput } from './views/planning/CardModal';
import { CanvasView } from './views/planning/CanvasView';
import { DriveView } from './views/drive/DriveView';
import { DrivePicker } from './views/dossier/DrivePicker';
import { HealthView } from './views/HealthView';
import { NotesView } from './views/NotesView';
import { CreatorModal, toInput } from './views/dossier/CreatorModal';
import { DocumentsView, type NewDocument } from './views/dossier/DocumentsView';
import { DossierView } from './views/dossier/DossierView';
import { EarningsModal } from './views/dossier/EarningsModal';
import { sortCreators } from './lib/creators/sort';
import { needsRebalance, positionForDrop, rebalance } from './lib/board';

type Route =
  | { view: 'dashboard' }
  | { view: 'creators' }
  | { view: 'money' }
  | { view: 'planning' }
  | { view: 'drive'; id: string }
  | { view: 'all' }
  | { view: 'notes' }
  | { view: 'health' }
  | { view: 'activity' }
  | { view: 'settings' }
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
  const [user, setUser] = useState<User | null>(() => loadUser());

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
          saveUser(u);
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
  const [importOpen, setImportOpen] = useState(false);
  const [cardModal, setCardModal] = useState<BoardCard | { lane: Lane } | null>(null);
  const [planningTab, setPlanningTab] = useState<'board' | 'canvas'>('board');
  // Either 'setup' (configure Drive, nothing to assign) or a creator whose
  // folder we're choosing.
  const [drivePicker, setDrivePicker] = useState<Creator | 'setup' | null>(null);
  // Sidebar groups remember their open/closed state per install.
  const [openGroups, setOpenGroups] = useState<{ creators: boolean; vault: boolean; drive: boolean }>(
    () => {
      try {
        return {
          creators: true,
          vault: true,
          drive: true,
          ...loadPreference('nav-groups', {}),
        };
      } catch {
        return { creators: true, vault: true, drive: true };
      }
    },
  );

  const toggleGroup = (key: 'creators' | 'vault' | 'drive') =>
    setOpenGroups((g) => {
      const next = { ...g, [key]: !g[key] };
      savePreference('nav-groups', next);
      return next;
    });
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

  // Run a scheduled backup shortly after load, once data is present. Delayed so
  // it never competes with the first render.
  useEffect(() => {
    if (!data) return;
    const settings = loadPreference<BackupSettings>('backup', DEFAULT_BACKUP);
    if (!isBackupDue(settings)) return;
    const timer = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        const existing = await window.vaultBridge.listBackups(settings.folder as string);
        await window.vaultBridge.runAutoBackup({
          folder: settings.folder as string,
          filename: autoBackupName(now),
          contents: JSON.stringify(buildBackup(data, now), null, 2),
          prune: prunableBackups([...existing, autoBackupName(now)], settings.keep),
        });
        savePreference('backup', { ...settings, lastAt: now });
        toast('Backup saved');
      } catch {
        // A failed backup must never interrupt the app; Settings shows the state.
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [data, toast]);

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

  /** Writes a dated backup to the chosen folder and prunes old ones. */
  const runAutoBackup = async () => {
    const settings = loadPreference<BackupSettings>('backup', DEFAULT_BACKUP);
    if (!settings.folder) throw new Error('Choose a backup folder first.');
    const now = new Date().toISOString();
    const existing = await window.vaultBridge.listBackups(settings.folder);
    await window.vaultBridge.runAutoBackup({
      folder: settings.folder,
      filename: autoBackupName(now),
      contents: JSON.stringify(buildBackup(data, now), null, 2),
      prune: prunableBackups([...existing, autoBackupName(now)], settings.keep),
    });
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
  const handleSaveCreator = async (input: CreatorInput, photo: File | null) => {
    const existing = creatorModal && creatorModal !== 'new' ? creatorModal : null;

    // Create first when new, so the avatar can be keyed by the creator's id.
    const saved = existing ?? (await createCreatorFull(input, user));

    let avatarPath = input.avatar_path;
    if (photo) {
      avatarPath = await uploadAvatar(saved.id, await resizeAvatar(photo));
    }

    if (existing || avatarPath !== input.avatar_path) {
      await updateCreator(saved, { ...input, avatar_path: avatarPath }, user);
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

  // --- Planning board ---------------------------------------------------
  const handleMoveCard = async (card: BoardCard, lane: Lane, index: number) => {
    const position = positionForDrop(data.cards, lane, index, card.id);
    try {
      await moveCard(card.id, lane, position, user);
      // Repeated drops into the same gap halve it each time; renumber before
      // the positions collapse into each other.
      const moved = data.cards.map((c) =>
        c.id === card.id ? { ...c, lane, position } : c,
      );
      if (needsRebalance(moved, lane)) {
        await rebalanceLane(rebalance(moved, lane));
      }
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not move that card', 'error');
    }
  };

  const handleSaveCard = async (input: CardInput) => {
    if (cardModal && 'id' in cardModal) {
      await updateCard(cardModal.id, input, user, `card “${input.title}”`);
    } else {
      const column = data.cards.filter((c) => c.lane === input.lane);
      await createCard(
        { ...input, position: positionForDrop(data.cards, input.lane, column.length, '') },
        user,
      );
    }
    await refresh();
    toast('Saved');
  };

  const handleDeleteCard = async (card: BoardCard) => {
    setCardModal(null);
    try {
      await deleteCard(card.id, user, card.title);
      await refresh();
      toast('Card deleted');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const handleTogglePaid = async (
    earning: CreatorEarning,
    creator: Creator,
    paid: boolean,
  ) => {
    try {
      await setEarningPaid(
        earning.id,
        paid,
        user,
        null,
        `${creator.name} ${earning.month.slice(0, 7)}`,
      );
      await refresh();
      toast(paid ? 'Marked paid' : 'Marked unpaid');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  };

  const handleImportStatement = async (
    creatorId: string,
    rows: { month: string; gross: number }[],
    currency: string,
  ) => {
    await saveEarnings(creatorId, rows, currency, user);
    await refresh();
    toast(`Imported ${rows.length} month${rows.length === 1 ? '' : 's'}`);
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
      <HomeView
        data={data}
        readOnly={readOnly}
        onOpenCreator={(c) => {
          setCreatorTab('overview');
          setRoute({ view: 'creator', id: c.id });
        }}
        onOpenHealth={() => setRoute({ view: 'health' })}
        onRecordEarnings={setEarningsFor}
      />
    );
  } else if (route.view === 'money') {
    content = (
      <MoneyView
        data={data}
        readOnly={readOnly}
        onImport={() => setImportOpen(true)}
        onExportAccounts={async (filename, csv) => {
          try {
            const saved = await window.vaultBridge?.saveBackup({ filename, contents: csv });
            if (saved) toast('Accountant export saved');
          } catch {
            toast('Could not save the export', 'error');
          }
        }}
        onRecord={setEarningsFor}
        onTogglePaid={handleTogglePaid}
        onOpenCreator={(c) => {
          setCreatorTab('overview');
          setRoute({ view: 'creator', id: c.id });
        }}
      />
    );
  } else if (route.view === 'drive') {
    const creator = creators.find((c) => c.id === route.id);
    content = creator ? (
      <DriveView
        creator={creator}
        onSetup={() => setDrivePicker('setup')}
        onChooseFolder={() => setDrivePicker(creator)}
      />
    ) : (
      <div className="view">
        <div className="empty-state card">
          <p>That creator no longer exists.</p>
        </div>
      </div>
    );
  } else if (route.view === 'planning') {
    const tabs = (
      <div className="planning-tabs">
        <button
          className={`btn btn-tiny ${planningTab === 'board' ? 'btn-primary' : ''}`}
          onClick={() => setPlanningTab('board')}
        >
          Board
        </button>
        <button
          className={`btn btn-tiny ${planningTab === 'canvas' ? 'btn-primary' : ''}`}
          onClick={() => setPlanningTab('canvas')}
        >
          Canvas
        </button>
      </div>
    );
    content =
      planningTab === 'board' ? (
        <>
          <div className="planning-switch">{tabs}</div>
          <BoardView
            data={data}
            readOnly={readOnly}
            onAdd={(lane) => setCardModal({ lane })}
            onEdit={setCardModal}
            onMove={handleMoveCard}
          />
        </>
      ) : (
        <div className="canvas-page">
          <div className="planning-switch">{tabs}</div>
          <CanvasView user={user} readOnly={readOnly} onToast={toast} />
        </div>
      );
  } else if (route.view === 'creators') {
    content = (
      <CreatorsView
        data={data}
        readOnly={readOnly}
        onOpen={(c) => {
          setCreatorTab('overview');
          setRoute({ view: 'creator', id: c.id });
        }}
        onAdd={() => setCreatorModal('new')}
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
  } else if (route.view === 'settings') {
    content = (
      <SettingsView
        version={version}
        user={user}
        onBackupNow={runAutoBackup}
        onDisconnect={onDisconnect}
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
          {navItem('Home', { view: 'dashboard' }, on('dashboard'))}
          {navItem('Money', { view: 'money' }, on('money'))}
          {navItem('Planning', { view: 'planning' }, on('planning'))}

          <NavGroup
            label="Creators"
            count={creators.length}
            active={on('creators')}
            expanded={openGroups.creators}
            onNavigate={() => {
              setQuery('');
              setRoute({ view: 'creators' });
              if (!openGroups.creators) toggleGroup('creators');
            }}
            onToggle={() => toggleGroup('creators')}
            action={
              <button
                className="nav-group-add"
                title="Add creator"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatorModal('new');
                }}
              >
                +
              </button>
            }
          >
            {sortedCreators.map((c) => (
              <button
                key={c.id}
                className={`nav-item nav-child ${
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
                <CreatorAvatar creator={c} size={20} />
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
          </NavGroup>

          <NavGroup
            label="Vault"
            count={entries.length}
            active={on('all')}
            expanded={openGroups.vault}
            onNavigate={() => {
              setQuery('');
              setRoute({ view: 'all' });
              if (!openGroups.vault) toggleGroup('vault');
            }}
            onToggle={() => toggleGroup('vault')}
          >
            <button
              className={`nav-item nav-child ${on('health') ? 'nav-item-active' : ''}`}
              onClick={() => {
                setQuery('');
                setRoute({ view: 'health' });
              }}
            >
              <span className="nav-child-icon">🔑</span>
              <span className="nav-label">Password health</span>
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                className={`nav-item nav-child ${
                  !searching && route.view === 'service' && route.id === g.id
                    ? 'nav-item-active'
                    : ''
                }`}
                onClick={() => {
                  setQuery('');
                  setRoute({ view: 'service', id: g.id });
                }}
              >
                <ServiceIcon serviceKey={g.key} serviceUrl={g.url} size={20} />
                <span className="nav-label">
                  {g.name} ({g.count})
                </span>
              </button>
            ))}
          </NavGroup>

          <NavGroup
            label="Drive"
            count={creators.filter((c) => c.drive_folder_url).length}
            active={!searching && route.view === 'drive'}
            expanded={openGroups.drive}
            onNavigate={() => {
              const first = sortedCreators.find((c) => c.drive_folder_url);
              setQuery('');
              if (first) setRoute({ view: 'drive', id: first.id });
              if (!openGroups.drive) toggleGroup('drive');
            }}
            onToggle={() => toggleGroup('drive')}
          >
            {sortedCreators.filter((c) => c.drive_folder_url).length === 0 && (
              <p className="nav-empty">No Drive folders linked yet.</p>
            )}
            {sortedCreators
              .filter((c) => c.drive_folder_url)
              .map((c) => (
                <button
                  key={c.id}
                  className={`nav-item nav-child ${
                    !searching && route.view === 'drive' && route.id === c.id
                      ? 'nav-item-active'
                      : ''
                  }`}
                  onClick={() => {
                    setQuery('');
                    setRoute({ view: 'drive', id: c.id });
                  }}
                >
                  <CreatorAvatar creator={c} size={20} />
                  <span className="nav-label">{c.name}</span>
                </button>
              ))}
          </NavGroup>

          {navItem('Secure notes', { view: 'notes' }, on('notes'))}
          {navItem('Activity', { view: 'activity' }, on('activity'))}
          {navItem('Settings', { view: 'settings' }, on('settings'))}
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
              <PowerIcon size={14} />
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

      {cardModal && (
        <CardModal
          initial={'id' in cardModal ? cardModal : null}
          defaultLane={'id' in cardModal ? cardModal.lane : cardModal.lane}
          creators={creators}
          onSave={handleSaveCard}
          onDelete={
            'id' in cardModal ? () => handleDeleteCard(cardModal) : undefined
          }
          onClose={() => setCardModal(null)}
        />
      )}

      {drivePicker && (
        <DrivePicker
          assignTo={drivePicker === 'setup' ? null : drivePicker}
          onPick={async (file) => {
            const target = drivePicker;
            setDrivePicker(null);
            if (target === 'setup' || !target) return;
            try {
              await updateCreator(
                target,
                { ...toInput(target), drive_folder_url: file.webViewLink ?? null },
                user,
              );
              await refresh();
              toast(`Folder linked to ${target.name}`);
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not save that', 'error');
            }
          }}
          onClose={() => setDrivePicker(null)}
        />
      )}

      {importOpen && (
        <ImportModal
          creators={creators}
          onImport={handleImportStatement}
          onClose={() => setImportOpen(false)}
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
