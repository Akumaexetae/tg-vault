import { useState } from 'react';
import { CreatorAvatar } from '../../components/CreatorAvatar';
import {
  showsPersonalFields,
  validatePayout,
  validateRevenueShare,
} from '../../lib/creators/validation';
import { validateImage } from '../../lib/images';
import type {
  ContractStatus,
  Creator,
  CreatorInput,
  CreatorStatus,
  PayoutMethod,
  PayoutSchedule,
  SocialLink,
} from '../../lib/types';

const CREATOR_COLORS = [
  '#e91e8c', '#8e44ad', '#00aff0', '#16a085',
  '#e67e22', '#2962ff', '#c2185b', '#00897b',
];

const STATUSES: CreatorStatus[] = [
  'prospect', 'onboarding', 'active', 'paused', 'ended',
];

interface Props {
  initial: Creator | null; // null = new creator
  existingCount: number;
  onSave: (input: CreatorInput, photo: File | null) => Promise<void>;
  onArchive?: () => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

/** Blank creator, used when adding. */
function emptyInput(existingCount: number): CreatorInput {
  return {
    name: '',
    color: CREATOR_COLORS[existingCount % CREATOR_COLORS.length],
    kind: 'creator',
    status: 'prospect',
    legal_name: null,
    date_of_birth: null,
    nationality: null,
    id_reference: null,
    email: null,
    phone: null,
    telegram: null,
    timezone: null,
    revenue_share: null,
    start_date: null,
    contract_status: 'none',
    notice_period_days: null,
    minimum_guarantee: null,
    payout_method: null,
    payout_details: null,
    payout_currency: 'EUR',
    payout_schedule: 'monthly',
    of_url: null,
    getmysocial_url: null,
    socials: [],
    subscriber_count: null,
    subscriber_count_as_of: null,
    drive_folder_url: null,
    avatar_path: null,
  };
}

export function toInput(creator: Creator): CreatorInput {
  const { id, created_at, updated_at, updated_by, ...rest } = creator;
  void id;
  void created_at;
  void updated_at;
  void updated_by;
  return rest;
}

export function CreatorModal({
  initial,
  existingCount,
  onSave,
  onArchive,
  onDelete,
  onClose,
}: Props) {
  const [form, setForm] = useState<CreatorInput>(
    initial ? toInput(initial) : emptyInput(existingCount),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const pickPhoto = (file: File | null) => {
    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const set = <K extends keyof CreatorInput>(key: K, value: CreatorInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const text = (key: keyof CreatorInput) => ({
    value: (form[key] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, (e.target.value || null) as CreatorInput[typeof key]),
  });

  const num = (key: keyof CreatorInput) => ({
    value: form[key] === null || form[key] === undefined ? '' : String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      set(key, (raw === '' ? null : Number(raw)) as CreatorInput[typeof key]);
    },
  });

  const setSocial = (i: number, patch: Partial<SocialLink>) =>
    set(
      'socials',
      form.socials.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  const personal = showsPersonalFields(form.kind);

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Give the creator a name.');
      return;
    }
    const shareError = validateRevenueShare(form.revenue_share);
    if (shareError) {
      setError(shareError);
      return;
    }
    const payoutError = validatePayout(form.payout_method, form.payout_details);
    if (payoutError) {
      setError(payoutError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          ...form,
          name: form.name.trim(),
          socials: form.socials.filter((s) => s.label.trim() && s.url.trim()),
        },
        photo,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — are you online?');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? `Edit ${initial.name}` : 'Add creator'}</h2>

        <div className="photo-picker">
          {photoPreview ? (
            <img className="photo-preview" src={photoPreview} alt="" />
          ) : initial ? (
            <CreatorAvatar creator={initial} size={64} />
          ) : (
            <span
              className="creator-photo"
              style={{ width: 64, height: 64, background: form.color, fontSize: 27 }}
            >
              {form.name[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <div className="photo-picker-text">
            <label className="form-label">Photo</label>
            <input
              className="input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
            <p className="connect-hint photo-hint">
              Shrunk to 512px on upload. Her public persona photo — nothing private.
            </p>
          </div>
        </div>

        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Stage name</label>
            <input className="input" autoFocus {...text('name')} />
          </div>
          <div className="form-col">
            <label className="form-label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => set('status', e.target.value as CreatorStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-col" style={{ maxWidth: 110 }}>
            <label className="form-label">Colour</label>
            <select
              className="input"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
            >
              {CREATOR_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!personal && (
          <p className="connect-hint">
            This is the shared agency record — personal and commercial details
            don't apply.
          </p>
        )}

        {personal && (
          <>
            <div className="form-section">Identity</div>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Legal name</label>
                <input className="input" {...text('legal_name')} />
              </div>
              <div className="form-col">
                <label className="form-label">Date of birth</label>
                <input className="input" type="date" {...text('date_of_birth')} />
              </div>
              <div className="form-col">
                <label className="form-label">Nationality</label>
                <input className="input" {...text('nationality')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">ID reference</label>
                <input
                  className="input"
                  placeholder="FR passport ••••4821"
                  {...text('id_reference')}
                />
              </div>
              <div className="form-col">
                <label className="form-label">Timezone</label>
                <input className="input" placeholder="Europe/Paris" {...text('timezone')} />
              </div>
            </div>
            <p className="connect-hint">
              A reference only — keep the scan itself in Drive and link it under
              Documents.
            </p>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Email</label>
                <input className="input" {...text('email')} />
              </div>
              <div className="form-col">
                <label className="form-label">Phone</label>
                <input className="input" {...text('phone')} />
              </div>
              <div className="form-col">
                <label className="form-label">Telegram</label>
                <input className="input" placeholder="@handle" {...text('telegram')} />
              </div>
            </div>

            <div className="form-section">Commercial</div>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Your share (%)</label>
                <input className="input" inputMode="decimal" {...num('revenue_share')} />
              </div>
              <div className="form-col">
                <label className="form-label">Start date</label>
                <input className="input" type="date" {...text('start_date')} />
              </div>
              <div className="form-col">
                <label className="form-label">Contract</label>
                <select
                  className="input"
                  value={form.contract_status}
                  onChange={(e) =>
                    set('contract_status', e.target.value as ContractStatus)
                  }
                >
                  <option value="none">None</option>
                  <option value="sent">Sent</option>
                  <option value="signed">Signed</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Notice period (days)</label>
                <input className="input" inputMode="numeric" {...num('notice_period_days')} />
              </div>
              <div className="form-col">
                <label className="form-label">Minimum guarantee</label>
                <input className="input" inputMode="decimal" {...num('minimum_guarantee')} />
              </div>
            </div>

            <div className="form-section">Payout</div>
            <div className="form-row">
              <div className="form-col">
                <label className="form-label">Method</label>
                <select
                  className="input"
                  value={form.payout_method ?? ''}
                  onChange={(e) =>
                    set('payout_method', (e.target.value || null) as PayoutMethod | null)
                  }
                >
                  <option value="">— not set —</option>
                  <option value="iban">IBAN</option>
                  <option value="paypal">PayPal</option>
                  <option value="wise">Wise</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-col">
                <label className="form-label">Currency</label>
                <input className="input" {...text('payout_currency')} />
              </div>
              <div className="form-col">
                <label className="form-label">Schedule</label>
                <select
                  className="input"
                  value={form.payout_schedule ?? 'monthly'}
                  onChange={(e) =>
                    set('payout_schedule', e.target.value as PayoutSchedule)
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <label className="form-label">Payout details</label>
            <input
              className="input"
              placeholder="IBAN, PayPal address, wallet…"
              {...text('payout_details')}
            />
          </>
        )}

        <div className="form-section">Links</div>
        <div className="form-row">
          <div className="form-col">
            <label className="form-label">OnlyFans</label>
            <input className="input" {...text('of_url')} />
          </div>
          <div className="form-col">
            <label className="form-label">Getmysocial</label>
            <input className="input" {...text('getmysocial_url')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Drive folder</label>
            <input
              className="input"
              placeholder="https://drive.google.com/drive/folders/…"
              {...text('drive_folder_url')}
            />
          </div>
          {personal && (
            <>
              <div className="form-col" style={{ maxWidth: 130 }}>
                <label className="form-label">Subscribers</label>
                <input className="input" inputMode="numeric" {...num('subscriber_count')} />
              </div>
              <div className="form-col" style={{ maxWidth: 160 }}>
                <label className="form-label">Counted on</label>
                <input
                  className="input"
                  type="date"
                  {...text('subscriber_count_as_of')}
                />
              </div>
            </>
          )}
        </div>

        <label className="form-label">Other socials</label>
        {form.socials.map((s, i) => (
          <div className="form-row" key={i}>
            <input
              className="input input-small"
              placeholder="Label"
              value={s.label}
              onChange={(e) => setSocial(i, { label: e.target.value })}
            />
            <input
              className="input"
              placeholder="https://…"
              value={s.url}
              onChange={(e) => setSocial(i, { url: e.target.value })}
            />
            <button
              className="icon-btn icon-btn-danger"
              title="Remove"
              onClick={() =>
                set('socials', form.socials.filter((_, j) => j !== i))
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost"
          onClick={() => set('socials', [...form.socials, { label: '', url: '' }])}
        >
          + Add social
        </button>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          {initial && initial.kind === 'creator' && onArchive && (
            <button className="btn modal-action-left" onClick={onArchive}>
              {initial.status === 'ended' ? 'Restore' : 'Archive'}
            </button>
          )}
          {initial && onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add creator'}
          </button>
        </div>
      </div>
    </div>
  );
}
