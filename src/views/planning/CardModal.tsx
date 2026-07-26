import { useState } from 'react';
import { LANES } from '../../lib/board';
import type { BoardCard, Creator, Lane, User } from '../../lib/types';

export interface CardInput {
  title: string;
  notes: string | null;
  lane: Lane;
  assignee: User | null;
  creator_id: string | null;
  due_date: string | null;
}

interface Props {
  initial: BoardCard | null;
  defaultLane: Lane;
  creators: Creator[];
  onSave: (input: CardInput) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function CardModal({
  initial,
  defaultLane,
  creators,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lane, setLane] = useState<Lane>(initial?.lane ?? defaultLane);
  const [assignee, setAssignee] = useState<User | ''>(initial?.assignee ?? '');
  const [creatorId, setCreatorId] = useState(initial?.creator_id ?? '');
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the card a title.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim() || null,
        lane,
        assignee: assignee || null,
        creator_id: creatorId || null,
        due_date: dueDate || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit card' : 'New card'}</h2>

        <label className="form-label">Title</label>
        <input
          className="input"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <label className="form-label">Notes</label>
        <textarea
          className="input textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Column</label>
            <select
              className="input"
              value={lane}
              onChange={(e) => setLane(e.target.value as Lane)}
            >
              {LANES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-col">
            <label className="form-label">Who</label>
            <select
              className="input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as User | '')}
            >
              <option value="">— anyone —</option>
              <option value="Tyler">Tyler</option>
              <option value="Gabriel">Gabriel</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Creator (optional)</label>
            <select
              className="input"
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
            >
              <option value="">— none —</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-col">
            <label className="form-label">Due date (optional)</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          {initial && onDelete && (
            <button className="btn btn-danger modal-action-left" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : initial ? 'Save' : 'Add card'}
          </button>
        </div>
      </div>
    </div>
  );
}
