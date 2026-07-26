import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../components/icons';
import { timeAgo } from '../lib/time';
import type { Creator, SecureNote } from '../lib/types';

interface Props {
  notes: SecureNote[];
  creators: Creator[];
  readOnly: boolean;
  onSave: (note: { id?: string; title: string; body: string; creator_id: string | null }) => Promise<void>;
  onDelete: (note: SecureNote) => void;
}

export function NotesView({ notes, creators, readOnly, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<SecureNote | 'new' | null>(null);

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Secure notes</h1>
          <p className="muted">IBANs, SIRET, API keys, recovery kits — anything that isn't a login.</p>
        </div>
        <button className="btn btn-primary" disabled={readOnly} onClick={() => setEditing('new')}>
          + Add note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state card">
          <p>No notes yet.</p>
        </div>
      ) : (
        <div className="note-grid">
          {notes.map((n) => {
            const creator = creators.find((c) => c.id === n.creator_id);
            return (
              <div key={n.id} className="card note-card">
                <div className="note-head">
                  <strong>{n.title}</strong>
                  {creator && (
                    <span className="pill" style={{ background: `${creator.color}22`, color: creator.color }}>
                      {creator.name}
                    </span>
                  )}
                  <div className="note-actions">
                    <button className="icon-btn" title="Edit" disabled={readOnly} onClick={() => setEditing(n)}>
                      <PencilIcon size={13} />
                    </button>
                    <button
                      className="icon-btn icon-btn-danger"
                      title="Delete"
                      disabled={readOnly}
                      onClick={() => onDelete(n)}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
                <pre className="note-body">{n.body}</pre>
                <span className="detail-meta">
                  Updated {timeAgo(n.updated_at)} by {n.updated_by}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <NoteModal
          initial={editing === 'new' ? null : editing}
          creators={creators}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function NoteModal({
  initial,
  creators,
  onSave,
  onClose,
}: {
  initial: SecureNote | null;
  creators: Creator[];
  onSave: Props['onSave'];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [creatorId, setCreatorId] = useState(initial?.creator_id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the note a title.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        body,
        creator_id: creatorId || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — are you online?');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit note' : 'New note'}</h2>
        <label className="form-label">Title</label>
        <input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
        <label className="form-label">Linked to (optional)</label>
        <select className="input" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
          <option value="">— none —</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="form-label">Content</label>
        <textarea
          className="input textarea note-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}
