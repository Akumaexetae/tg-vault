import { useState } from 'react';
import {
  AttachIcon,
  CloseIcon,
  DocumentIcon,
  IdIcon,
} from '../../components/icons';
import { ModalOverlay } from '../../components/ModalOverlay';
import { validateDocument } from '../../lib/creators/validation';
import { timeAgo } from '../../lib/time';
import type { CreatorDocument } from '../../lib/types';

export interface NewDocument {
  label: string;
  kind: CreatorDocument['kind'];
  url: string | null;
  file: File | null;
}

interface Props {
  creatorName: string;
  documents: CreatorDocument[];
  readOnly: boolean;
  onAdd: (doc: NewDocument) => Promise<void>;
  onDelete: (doc: CreatorDocument) => void;
  onOpen: (doc: CreatorDocument) => void;
  onBack: () => void;
}

const ICON: Record<CreatorDocument['kind'], typeof DocumentIcon> = {
  contract: DocumentIcon,
  id: IdIcon,
  other: AttachIcon,
};

export function DocumentsView({
  creatorName,
  documents,
  readOnly,
  onAdd,
  onDelete,
  onOpen,
  onBack,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<CreatorDocument['kind']>('contract');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setAdding(false);
    setLabel('');
    setUrl('');
    setFile(null);
    setError('');
  };

  const submit = async () => {
    if (!label.trim()) {
      setError('Give the document a label.');
      return;
    }
    const invalid = validateDocument({
      url: url.trim() || null,
      storagePath: file ? 'pending' : null,
      sizeBytes: file?.size ?? null,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onAdd({ label: label.trim(), kind, url: url.trim() || null, file });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <button className="btn btn-tiny" onClick={onBack}>
            ← {creatorName}
          </button>
          <h1 className="view-title-spaced">Documents</h1>
        </div>
        <button
          className="btn btn-primary"
          disabled={readOnly}
          onClick={() => setAdding(true)}
        >
          + Add document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state card">
          <p>No documents yet.</p>
        </div>
      ) : (
        <div className="entry-list">
          {documents.map((d) => {
            const Icon = ICON[d.kind];
            return (
            <div key={d.id} className="card entry-row">
              <div className="entry-main">
                <Icon size={20} className="doc-icon" />
                <div className="entry-id">
                  <span className="entry-service">{d.label}</span>
                  <span className="entry-tags">
                    <span className="pill">{d.url ? 'Link' : 'File'}</span>
                  </span>
                </div>
                <span className="detail-meta">
                  added {timeAgo(d.created_at)} by {d.updated_by}
                </span>
                <div className="entry-actions">
                  <button className="btn btn-tiny" onClick={() => onOpen(d)}>
                    Open
                  </button>
                  <button
                    className="icon-btn icon-btn-danger"
                    title="Delete"
                    disabled={readOnly}
                    onClick={() => onDelete(d)}
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {adding && (
        <ModalOverlay onDismiss={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add document</h2>

            <label className="form-label">Label</label>
            <input
              className="input"
              value={label}
              autoFocus
              placeholder="Management contract"
              onChange={(e) => setLabel(e.target.value)}
            />

            <label className="form-label">Type</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as CreatorDocument['kind'])}
            >
              <option value="contract">Contract</option>
              <option value="id">ID</option>
              <option value="other">Other</option>
            </select>

            <label className="form-label">Drive link</label>
            <input
              className="input"
              placeholder="https://drive.google.com/…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value) setFile(null);
              }}
            />

            <label className="form-label">…or upload a file (max 10 MB)</label>
            <input
              className="input"
              type="file"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                if (picked) setUrl('');
              }}
            />
            <p className="connect-hint">
              Anything large or sensitive belongs in Drive — link it rather than
              uploading. ID scans especially: this vault isn't encrypted.
            </p>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions">
              <button className="btn" onClick={reset}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={submit}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
