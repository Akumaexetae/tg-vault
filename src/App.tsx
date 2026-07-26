import { useMemo, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EntryModal } from './components/EntryModal';
import { IdentityScreen } from './components/IdentityScreen';
import { ServiceIcon } from './components/ServiceIcon';
import { ToastProvider, useToast } from './components/Toast';
import { useVault } from './hooks/useVault';
import { groupIdOf, serviceGroups } from './lib/groups';
import {
  createCreator,
  createEntry,
  deleteEntry,
  updateEntry,
} from './lib/queries';
import { entryLabel, filterEntries } from './lib/search';
import type { Creator, Entry, EntryInput, User } from './lib/types';
import { ActivityView } from './views/ActivityView';
import { DashboardView } from './views/DashboardView';
import { EntryListView } from './views/EntryListView';

type Route =
  | { view: 'dashboard' }
  | { view: 'all' }
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
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('tg-vault-user');
    return stored === 'Tyler' || stored === 'Gabriel' ? stored : null;
  });

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
      <VaultApp user={user} />
    </ToastProvider>
  );
}

function VaultApp({ user }: { user: User }) {
  const { data, status, refresh } = useVault();
  const toast = useToast();
  const [route, setRoute] = useState<Route>({ view: 'dashboard' });
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [filterService, setFilterService] = useState('');
  const [filterCreator, setFilterCreator] = useState('');

  const readOnly = status !== 'online';
  const groups = useMemo(() => serviceGroups(data?.entries ?? []), [data]);

  if (status === 'unconfigured') {
    return (
      <div className="identity-screen">
        <div className="identity-card setup-card">
          <div className="identity-logo">T&amp;G Vault</div>
          <p className="identity-sub">Almost there — the vault isn't connected yet.</p>
          <ol className="setup-steps">
            <li>Create a free project at <strong>supabase.com</strong></li>
            <li>Run <code>supabase/schema.sql</code> in its SQL editor</li>
            <li>Paste the project URL + anon key into <code>src/config.ts</code></li>
            <li>Rebuild the app</li>
          </ol>
        </div>
      </div>
    );
  }

  if (status === 'loading' || !data) {
    return (
      <div className="identity-screen">
        <div className="loading-pulse">T&amp;G Vault</div>
      </div>
    );
  }

  const { creators, entries, activity } = data;

  // --- Mutations ------------------------------------------------------
  const handleSave = async (input: EntryInput) => {
    const label = entryLabel(input, creators);
    if (modal?.mode === 'edit') {
      await updateEntry(modal.entry.id, input, user, label);
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
        onEdit={(e) => setModal({ mode: 'edit', entry: e })}
        onDelete={setPendingDelete}
        onAdd={() => setModal({ mode: 'new' })}
      />
    );
  } else if (route.view === 'dashboard') {
    content = (
      <DashboardView
        data={data}
        readOnly={readOnly}
        onEdit={(e) => setModal({ mode: 'edit', entry: e })}
        onDelete={setPendingDelete}
        onAdd={() => setModal({ mode: 'new' })}
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
        onEdit={(e) => setModal({ mode: 'edit', entry: e })}
        onDelete={setPendingDelete}
        onAdd={() => setModal({ mode: 'new' })}
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
        onEdit={(e) => setModal({ mode: 'edit', entry: e })}
        onDelete={setPendingDelete}
        onAdd={() => setModal({ mode: 'new', serviceKey: group?.key })}
      />
    );
  } else if (route.view === 'creator') {
    const creator = creators.find((c) => c.id === route.id);
    const list = entries.filter((e) => e.creator_id === route.id);
    content = (
      <EntryListView
        title={creator?.name ?? 'Creator'}
        subtitle={`${list.length} account${list.length === 1 ? '' : 's'}`}
        entries={list}
        creators={creators}
        readOnly={readOnly}
        showCreator={false}
        onEdit={(e) => setModal({ mode: 'edit', entry: e })}
        onDelete={setPendingDelete}
        onAdd={() => setModal({ mode: 'new', creatorId: route.id })}
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          T<span className="logo-amp">&amp;</span>G Vault
        </div>

        <nav className="sidebar-nav">
          {navItem('Dashboard', { view: 'dashboard' }, !searching && route.view === 'dashboard')}
          {navItem('All accounts', { view: 'all' }, !searching && route.view === 'all')}
          {navItem('Activity', { view: 'activity' }, !searching && route.view === 'activity')}

          <div className="nav-section">Services</div>
          {groups.map((g) =>
            navItem(
              `${g.name} (${g.count})`,
              { view: 'service', id: g.id },
              !searching && route.view === 'service' && route.id === g.id,
              <ServiceIcon serviceKey={g.key} serviceUrl={g.url} size={20} />,
            ),
          )}

          <div className="nav-section">Creators</div>
          {creators.map((c) =>
            navItem(
              `${c.name} (${entries.filter((e) => e.creator_id === c.id).length})`,
              { view: 'creator', id: c.id },
              !searching && route.view === 'creator' && route.id === c.id,
              <span className="creator-avatar" style={{ background: c.color }}>
                {c.name[0]}
              </span>,
            ),
          )}
        </nav>

        <div className="sidebar-user">
          <span className={`activity-avatar avatar-${user.toLowerCase()}`}>{user[0]}</span>
          {user}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <input
            className="input search-input"
            placeholder="Search services, creators, usernames…"
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

        <main className="content">{content}</main>
      </div>

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
    </div>
  );
}
