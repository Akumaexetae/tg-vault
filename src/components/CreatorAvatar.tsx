import { useState } from 'react';
import { avatarUrl } from '../lib/queries';
import type { Creator } from '../lib/types';

interface Props {
  creator: Creator;
  size?: number;
  className?: string;
}

/** Photo when there is one, coloured initial when there isn't. */
export function CreatorAvatar({ creator, size = 32, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : avatarUrl(creator.avatar_path, creator.updated_at);

  return (
    <span
      className={`creator-photo ${className}`}
      style={{
        width: size,
        height: size,
        background: creator.color,
        fontSize: size * 0.42,
      }}
      title={creator.name}
    >
      {url ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        creator.name[0]?.toUpperCase()
      )}
    </span>
  );
}
