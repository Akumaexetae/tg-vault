import type { Creator, CreatorStatus } from '../../lib/types';

interface Props {
  creator: Creator;
  variant: 'wide' | 'tall';
  owed: number;
  currency: string;
}

const STATUS_LABEL: Record<CreatorStatus, string> = {
  prospect: 'PROSPECT',
  onboarding: 'ONBOARDING',
  active: 'ACTIVE',
  paused: 'PAUSED',
  ended: 'ARCHIVED',
};

/**
 * Same content in both variants — only the arrangement differs. Keeping this
 * one component is what stops the two layouts becoming two dossier pages.
 */
export function DossierHero({ creator, variant, owed, currency }: Props) {
  const money = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const stats = [
    {
      label: 'SHARE',
      value: creator.revenue_share != null ? `${creator.revenue_share}%` : '—',
    },
    { label: 'OWED', value: owed ? `${money(owed)} ${currency}` : '—' },
    {
      label: 'SUBS',
      value: creator.subscriber_count?.toLocaleString() ?? '—',
      hint: creator.subscriber_count_as_of
        ? `as of ${creator.subscriber_count_as_of}`
        : undefined,
    },
  ];

  const subtitle =
    [creator.legal_name, creator.timezone].filter(Boolean).join(' · ') ||
    (creator.kind === 'agency' ? 'Shared agency logins' : 'No details yet');

  return (
    <div className={`dossier-hero dossier-hero-${variant}`}>
      <div className="dossier-hero-id">
        <span className="dossier-avatar">{creator.name[0]}</span>
        <div className="dossier-hero-text">
          <div className="dossier-hero-name">{creator.name}</div>
          <div className="dossier-hero-sub">{subtitle}</div>
        </div>
      </div>

      {creator.kind === 'creator' && (
        <div className="dossier-hero-stats">
          {stats.map((s) => (
            <div key={s.label} className="dossier-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
              {s.hint && <em className="dossier-stat-hint">{s.hint}</em>}
            </div>
          ))}
        </div>
      )}

      <span className="dossier-badge">{STATUS_LABEL[creator.status]}</span>
    </div>
  );
}
