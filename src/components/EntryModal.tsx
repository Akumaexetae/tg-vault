import { useState } from 'react';
import { SERVICES, serviceDef } from '../lib/catalog';
import type { Creator, CustomField, Entry, EntryInput } from '../lib/types';
import { CloseIcon } from './icons';
import { ModalOverlay } from './ModalOverlay';
import { ServiceIcon } from './ServiceIcon';

interface Props {
  initial: Entry | null; // null = new entry
  creators: Creator[];
  defaultServiceKey?: string;
  defaultCreatorId?: string;
  onSave: (input: EntryInput) => Promise<void>;
  onAddCreator: (name: string) => Promise<Creator | null>;
  onClose: () => void;
}

/** Accepts a raw base32 secret or a full otpauth:// URI copied from a QR code. */
export function extractSecret(input: string): string {
  const value = input.trim();
  if (!/^otpauth:\/\//i.test(value)) return value;
  const match = /[?&]secret=([^&]+)/i.exec(value);
  return match ? decodeURIComponent(match[1]) : value;
}

export function EntryModal({
  initial,
  creators,
  defaultServiceKey,
  defaultCreatorId,
  onSave,
  onAddCreator,
  onClose,
}: Props) {
  const [serviceKey, setServiceKey] = useState<string>(
    initial?.service_key ?? defaultServiceKey ?? '',
  );
  const [customName, setCustomName] = useState(
    initial?.service_key === 'custom' ? initial.service_name : '',
  );
  const [customUrl, setCustomUrl] = useState(
    initial?.service_key === 'custom' ? initial.service_url : '',
  );
  const [creatorId, setCreatorId] = useState(
    initial?.creator_id ?? defaultCreatorId ?? creators[0]?.id ?? '',
  );
  const [newCreator, setNewCreator] = useState('');
  const [addingCreator, setAddingCreator] = useState(false);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [totpSecret, setTotpSecret] = useState(initial?.totp_secret ?? '');
  const [proxy, setProxy] = useState(initial?.proxy ?? '');
  const [recovery, setRecovery] = useState(initial?.recovery ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [fields, setFields] = useState<CustomField[]>(initial?.custom_fields ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (i: number, patch: Partial<CustomField>) =>
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const handleAddCreator = async () => {
    const name = newCreator.trim();
    if (!name) return;
    const created = await onAddCreator(name);
    if (created) {
      setCreatorId(created.id);
      setNewCreator('');
      setAddingCreator(false);
    }
  };

  const submit = async () => {
    const isCustom = serviceKey === 'custom';
    if (!serviceKey || (isCustom && !customName.trim())) {
      setError('Pick a service (or name your custom one).');
      return;
    }
    if (!creatorId) {
      setError('Pick a creator.');
      return;
    }
    if (!username.trim()) {
      setError('Username / email is required.');
      return;
    }
    const def = serviceDef(serviceKey);
    const input: EntryInput = {
      service_name: isCustom ? customName.trim() : def?.name ?? serviceKey,
      service_key: serviceKey,
      service_url: isCustom ? customUrl.trim() : def?.url ?? '',
      creator_id: creatorId,
      username: username.trim(),
      password,
      totp_secret: totpSecret.trim() || null,
      proxy: proxy.trim() || null,
      recovery: recovery.trim() || null,
      custom_fields: fields.filter((f) => f.key.trim() || f.value.trim()),
      notes: notes.trim() || null,
    };
    setSaving(true);
    setError('');
    try {
      await onSave(input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — are you online?');
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onDismiss={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit account' : 'Add account'}</h2>

        <label className="form-label">Service</label>
        <div className="service-grid">
          {SERVICES.map((s) => (
            <button
              key={s.key}
              className={`service-choice ${serviceKey === s.key ? 'service-choice-active' : ''}`}
              title={s.name}
              onClick={() => setServiceKey(s.key)}
            >
              <ServiceIcon serviceKey={s.key} size={30} />
              <span>{s.name}</span>
            </button>
          ))}
          <button
            className={`service-choice ${serviceKey === 'custom' ? 'service-choice-active' : ''}`}
            onClick={() => setServiceKey('custom')}
          >
            <span className="service-icon service-plus">+</span>
            <span>Custom</span>
          </button>
        </div>

        {serviceKey === 'custom' && (
          <div className="form-row">
            <input
              className="input"
              placeholder="Service name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <input
              className="input"
              placeholder="https://service-website.com"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </div>
        )}

        <label className="form-label">Creator</label>
        <div className="form-row">
          <select
            className="input"
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {addingCreator ? (
            <>
              <input
                className="input"
                placeholder="New creator name"
                value={newCreator}
                autoFocus
                onChange={(e) => setNewCreator(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCreator()}
              />
              <button className="btn" onClick={handleAddCreator}>
                Add
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setAddingCreator(true)}>
              + New creator
            </button>
          )}
        </div>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Username / email</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-col">
            <label className="form-label">Password</label>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">2FA secret (optional, base32)</label>
            <input
              className="input"
              placeholder="e.g. JBSWY3DPEHPK3PXP — or paste an otpauth:// link"
              value={totpSecret}
              onChange={(e) => setTotpSecret(extractSecret(e.target.value))}
            />
          </div>
          <div className="form-col">
            <label className="form-label">Proxy for login window (optional)</label>
            <input
              className="input"
              placeholder="user:pass@host:port  or  host:port"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
            />
          </div>
        </div>

        <label className="form-label">Recovery info (optional)</label>
        <textarea
          className="input textarea"
          placeholder="Recovery email, backup codes, security answers…"
          value={recovery}
          onChange={(e) => setRecovery(e.target.value)}
        />

        <label className="form-label">Custom fields</label>
        {fields.map((f, i) => (
          <div className="form-row" key={i}>
            <input
              className="input input-small"
              placeholder="Label (e.g. PIN)"
              value={f.key}
              onChange={(e) => setField(i, { key: e.target.value })}
            />
            <input
              className="input"
              placeholder="Value"
              value={f.value}
              onChange={(e) => setField(i, { value: e.target.value })}
            />
            <button
              className="icon-btn icon-btn-danger"
              title="Remove field"
              onClick={() => setFields((x) => x.filter((_, j) => j !== i))}
            >
              <CloseIcon size={13} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost"
          onClick={() => setFields((f) => [...f, { key: '', value: '' }])}
        >
          + Add field
        </button>

        <label className="form-label">Notes</label>
        <textarea
          className="input textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add account'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
