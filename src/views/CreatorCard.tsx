import { avatarUrl } from '../lib/queries';
import type { Creator, CreatorStatus } from '../lib/types';
import { CreatorAvatar } from '../components/CreatorAvatar';

interface Props {
  creator: Creator;
  loginCount: number;
  monthGross: number | null;
  currency: string;
  onOpen: () => void;
}

const STATUS_LABEL: Record<CreatorStatus, string> = {
  prospect: 'PROSPECT',
  onboarding: 'ONBOARDING',
  active: 'ACTIVE',
  paused: 'PAUSED',
  ended: 'ARCHIVED',
};

const compact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(n));

export function CreatorCard({
  creator,
  loginCount,
  monthGross,
  currency,
  onOpen,
}: Props) {
  const photo = avatarUrl(creator.avatar_path, creator.updated_at);
  const dimmed = creator.status === 'ended' || creator.status === 'paused';

  return (
    <button
      className={`creator-card ${dimmed ? 'creator-card-dim' : ''}`}
      onClick={onOpen}
    >
      <div
        className="creator-card-banner"
        style={
          photo
            ? { backgroundImage: `url(${photo})` }
            : {
                background: `linear-gradient(115deg, ${creator.color}, var(--accent-dark))`,
              }
        }
      >
        <span className="creator-card-status">{STATUS_LABEL[creator.status]}</span>
        <CreatorAvatar creator={creator} size={44} className="creator-card-face" />
      </div>

      <div className="creator-card-body">
        <div className="creator-card-name">{creator.name}</div>
        <div className="creator-card-sub">
          {creator.kind === 'agency'
            ? 'Shared agency logins'
            : [
                creator.revenue_share != null ? `${creator.revenue_share}%` : null,
                `${loginCount} login${loginCount === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
        </div>

        {creator.kind === 'creator' && (
          <div className="creator-card-stats">
            <div>
              <b>{monthGross != null ? `${compact(monthGross)} ${currency}` : '—'}</b>
              <span>THIS MONTH</span>
            </div>
            <div>
              <b>{creator.subscriber_count?.toLocaleString() ?? '—'}</b>
              <span>SUBS</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
