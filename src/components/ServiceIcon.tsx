import { useState } from 'react';
import { faviconUrl, serviceDef } from '../lib/catalog';

interface Props {
  serviceKey: string;
  serviceUrl?: string;
  size?: number;
}

/** Brand icon from the catalog, favicon for the rest, key glyph as last resort. */
export function ServiceIcon({ serviceKey, serviceUrl = '', size = 28 }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const def = serviceDef(serviceKey);

  if (def && def.icon.type === 'brand') {
    return (
      <span
        className="service-icon"
        style={{ width: size, height: size, background: `#${def.icon.hex}` }}
        title={def.name}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#fff">
          <path d={def.icon.path} />
        </svg>
      </span>
    );
  }

  const src = faviconUrl(def?.url ?? serviceUrl);
  if (src && !imgFailed) {
    return (
      <span className="service-icon service-icon-img" style={{ width: size, height: size }}>
        <img
          src={src}
          width={size * 0.7}
          height={size * 0.7}
          onError={() => setImgFailed(true)}
          alt=""
        />
      </span>
    );
  }

  return (
    <span
      className="service-icon"
      style={{ width: size, height: size, background: '#7fcdf3' }}
      title="Service"
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff">
        <path d="M12.65 10a6 6 0 1 0-.13 4.03l.13-.03H15v3h3v-3h3v-4H12.65zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
      </svg>
    </span>
  );
}
