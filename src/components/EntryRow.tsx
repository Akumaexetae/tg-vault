import { useState } from 'react';
import { useTotp } from '../hooks/useTotp';
import { isOld, isWeak } from '../lib/health';
import { instagramHandle, instagramProfileUrl, isInstagram } from '../lib/instagram';
import { compactViews, isStale, primaryCount, type AccountViews } from '../lib/crm';
import { axisLabel, chartGeometry, formatGain, sparkPoints, type AccountTrend, type ChartPoint } from '../lib/metrics';
import { loadPreference } from '../lib/settings';
import { timeAgo } from '../lib/time';
import { totpCode } from '../lib/totp';
import type { Creator, Entry } from '../lib/types';
import { ServiceIcon } from './ServiceIcon';
import { useToast } from './Toast';

interface Props {
  entry: Entry;
  creators: Creator[];
  readOnly: boolean;
  showCreator?: boolean;
  reused?: boolean;
  /** CRM view counts for this account, null when it has none. */
  views?: AccountViews | null;
  /** Cached profile pictures as data URLs, keyed by lowercased handle. */
  avatars?: Record<string, string>;
  /** Recorded daily history for this account, null when none exists yet. */
  trend?: AccountTrend | null;
  /** List-wide "show all passwords"; a row can still be toggled on its own after. */
  revealAll?: boolean;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onTogglePin: (entry: Entry) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button
      className="icon-btn"
      title={`Copy ${label}`}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => toast(`${label} copied`))
          .catch(() => toast(`Could not copy ${label}`, 'error'))
      }
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
      </svg>
    </button>
  );
}

function TotpBadge({ secret }: { secret: string }) {
  const totp = useTotp(secret);
  const toast = useToast();
  if (!totp) return <span className="totp-invalid">bad 2FA secret</span>;
  const frac = totp.secondsLeft / 30;
  const r = 8;
  const circ = 2 * Math.PI * r;
  return (
    <button
      className="totp-badge"
      title="Copy 2FA code"
      onClick={() =>
        navigator.clipboard.writeText(totp.code).then(() => toast('2FA code copied'))
      }
    >
      <svg width="20" height="20" viewBox="0 0 20 20" className="totp-ring">
        <circle cx="10" cy="10" r={r} fill="none" stroke="#d4eefb" strokeWidth="3" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="#00aff0"
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 10 10)"
        />
      </svg>
      <span className="totp-code">
        {totp.code.slice(0, 3)} {totp.code.slice(3)}
      </span>
    </button>
  );
}

export function EntryRow({
  entry,
  creators,
  readOnly,
  showCreator = true,
  reused = false,
  views = null,
  avatars,
  trend = null,
  revealAll = false,
  onEdit,
  onDelete,
  onTogglePin,
}: Props) {
  const [revealed, setRevealed] = useState(revealAll);
  // Follow the list-wide toggle when it flips, without an effect.
  const [lastRevealAll, setLastRevealAll] = useState(revealAll);
  if (revealAll !== lastRevealAll) {
    setLastRevealAll(revealAll);
    setRevealed(revealAll);
  }
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<ChartPoint | null>(null);
  const toast = useToast();
  const creator = creators.find((c) => c.id === entry.creator_id);
  const history = entry.history ?? [];
  // A recorded chart is a reason to expand in its own right. Without this the
  // chevron only appeared on rows that happened to carry recovery info or a
  // proxy, so most accounts had a chart with no way to open it.
  const hasChart = !!trend && trend.points.length > 1;
  const hasDetails =
    !!entry.recovery || entry.custom_fields.length > 0 || !!entry.notes ||
    !!entry.proxy || history.length > 0 || hasChart;

  const flags = [
    isWeak(entry.password) && { key: 'weak', label: 'weak' },
    reused && { key: 'reused', label: 'reused' },
    isOld(entry) && { key: 'old', label: 'old' },
  ].filter(Boolean) as { key: string; label: string }[];

  const handleLogin = () => {
    window.vaultBridge?.openLogin({
      id: entry.id,
      url: entry.service_url,
      username: entry.username,
      password: entry.password,
      totp: entry.totp_secret ? (totpCode(entry.totp_secret)?.code ?? null) : null,
      proxy: entry.proxy,
    });
  };

  // Preview the profile using the viewing account's session, so nobody has to
  // sign into a warmed account just to read its own numbers. Hidden unless a
  // viewer is set, and never shown on the viewer's own row.
  const viewerPref = loadPreference<{ id: string; proxy: string | null }>(
    'instagram-viewer',
    { id: '', proxy: null },
  );
  const viewerId = viewerPref.id;
  const profileUrl = isInstagram(entry.service_key)
    ? instagramProfileUrl(entry.username)
    : null;
  const canPreview = !!profileUrl && !!viewerId && viewerId !== entry.id;

  // The account's own picture where we have one, so a list of 80-odd rows is
  // scannable. Falls back to the service glyph, which is what every row showed
  // before and is never worse than a broken image.
  const handle = isInstagram(entry.service_key) ? instagramHandle(entry.username) : null;
  const avatar = handle ? avatars?.[handle.toLowerCase()] : undefined;

  const handlePreview = () => {
    if (!profileUrl || !viewerId) return;
    window.vaultBridge?.openProfile({
      viewerId,
      url: profileUrl,
      title: entry.username,
      proxy: viewerPref.proxy,
    });
  };

  const handleLogout = async () => {
    await window.vaultBridge?.logoutAccount(entry.id);
    toast('Session cleared for this account');
  };

  return (
    <div className="entry-row card">
      <div className="entry-main entry-main-account">
        <button
          className={`pin-btn ${entry.pinned ? 'pin-btn-on' : ''}`}
          title={entry.pinned ? 'Unpin' : 'Pin to dashboard'}
          disabled={readOnly}
          onClick={() => onTogglePin(entry)}
        >
          {entry.pinned ? '★' : '☆'}
        </button>

        {avatar ? (
          <img className="entry-avatar" src={avatar} alt="" title={entry.username} />
        ) : (
          <ServiceIcon serviceKey={entry.service_key} serviceUrl={entry.service_url} />
        )}
        <div className="entry-id">
          <span className="entry-service">{entry.service_name}</span>
          <span className="entry-tags">
            {showCreator && creator && (
              <span
                className="pill"
                style={{ background: `${creator.color}22`, color: creator.color }}
              >
                {creator.name}
              </span>
            )}
            {(entry.tags ?? []).map((tag) => (
              <span key={tag} className="pill pill-tag">
                {tag}
              </span>
            ))}
            {flags.map((f) => (
              <span key={f.key} className={`pill pill-${f.key}`}>
                {f.label}
              </span>
            ))}
          </span>
        </div>

        <div className="entry-field entry-username" title={entry.username}>
          <span className="field-value">{entry.username}</span>
          <CopyButton value={entry.username} label="Username" />
        </div>

        <div className="entry-field entry-password">
          <button
            className="password-mask"
            title={revealed ? 'Hide password' : 'Reveal password'}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? entry.password : '••••••••'}
          </button>
          <CopyButton value={entry.password} label="Password" />
        </div>

        <div className="entry-totp">
          {entry.totp_secret ? <TotpBadge secret={entry.totp_secret} /> : null}
        </div>

        <div
          className="entry-views"
          title={
            views
              ? [
                  `${views.impressions ?? 0} impressions (Instagram's rolling window)`,
                  `${views.views ?? 0} plays`,
                  views.measuredAt
                    ? `measured ${new Date(views.measuredAt).toLocaleDateString('en-GB')}`
                    : 'never measured by Bundle',
                ].join(' · ')
              : 'No figures — this account is not connected to the CRM'
          }
        >
          {views || trend ? (
            <>
              {/* The recorded line, where there is one. Two readings minimum:
                  a single dot says nothing about a trend. */}
              {trend && sparkPoints(trend.points) ? (
                <svg className="views-spark" viewBox="0 0 64 20" width="64" height="20" aria-hidden="true">
                  <polyline points={sparkPoints(trend.points)} />
                </svg>
              ) : null}
              <span className="views-figures">
                <span className={`views-count ${views && isStale(views.measuredAt) ? 'views-stale' : ''}`}>
                  {compactViews(trend?.total ?? primaryCount(views))}
                </span>
                {trend?.gain !== null && trend?.gain !== undefined ? (
                  <span className={`views-gain ${trend.gain > 0 ? 'views-gain-up' : ''}`}>
                    {formatGain(trend.gain)}
                  </span>
                ) : (
                  <span className="views-label">views</span>
                )}
              </span>
            </>
          ) : (
            <span className="created-empty">—</span>
          )}
        </div>

        <div className="entry-actions">
          {/*
            One slot, two buttons. Instagram accounts are looked AT, not logged
            into — signing into a warmed account is the risky act — so they get
            View instead of Log in. Both are the same size so the action column
            stays aligned in a list that mixes services.

            Like the other actions it keeps its slot when unavailable, because
            the buttons are right-aligned and a missing one slides the rest.
          */}
          {isInstagram(entry.service_key) ? (
            <button
              className={`btn btn-login ${canPreview ? '' : 'icon-btn-hidden'}`}
              title={
                canPreview
                  ? 'Open this profile from your viewing account'
                  : 'Set a viewing account in Settings to preview profiles'
              }
              aria-hidden={!canPreview}
              tabIndex={canPreview ? undefined : -1}
              disabled={!canPreview}
              onClick={handlePreview}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
              </svg>
              View
            </button>
          ) : (
            <button
              className={`btn btn-login ${entry.service_url ? '' : 'icon-btn-hidden'}`}
              title="Open this account in its own logged-in window"
              aria-hidden={!entry.service_url}
              tabIndex={entry.service_url ? undefined : -1}
              disabled={!entry.service_url}
              onClick={handleLogin}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" />
              </svg>
              Log in
            </button>
          )}
          <button
            className={`icon-btn ${entry.service_url ? '' : 'icon-btn-hidden'}`}
            title="Open site in your browser"
            aria-hidden={!entry.service_url}
            tabIndex={entry.service_url ? undefined : -1}
            disabled={!entry.service_url}
            onClick={() => window.vaultBridge?.openExternal(entry.service_url)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM5 5h5V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-2v5H5V5z" />
            </svg>
          </button>
          {/*
            Always rendered, hidden when there is nothing to expand. Dropping the
            button from the DOM instead would make every row with details one slot
            wider than its neighbours, so the whole action column zig-zags.
          */}
          <button
            className={`icon-btn ${expanded ? 'icon-btn-active' : ''} ${hasDetails ? '' : 'icon-btn-hidden'}`}
            title={hasDetails ? 'Details' : ''}
            aria-hidden={!hasDetails}
            tabIndex={hasDetails ? undefined : -1}
            disabled={!hasDetails}
            onClick={() => setExpanded((e) => !e)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d={expanded ? 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z' : 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z'} />
            </svg>
          </button>
          <button className="icon-btn" title="Edit" disabled={readOnly} onClick={() => onEdit(entry)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
          <button className="icon-btn icon-btn-danger" title="Delete" disabled={readOnly} onClick={() => onDelete(entry)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="entry-details">
          {trend && trend.points.length > 1 && (() => {
            const g = chartGeometry(trend.points);
            if (!g) return null;
            const best = g.points.reduce((a, b) => ((b.gain ?? -1) > (a.gain ?? -1) ? b : a), g.points[0]);
            const mid = (g.min + g.max) / 2;

            return (
              <div className="trend-panel">
                <div className="trend-head">
                  <span className="detail-label">Views</span>
                  <span className="trend-summary">
                    <strong>{(trend.total ?? 0).toLocaleString('en-GB')}</strong> total
                    {trend.gain !== null && <> · {formatGain(trend.gain)} yesterday</>}
                    {best.gain ? <> · best day {formatGain(best.gain)}</> : null}
                  </span>
                </div>

                <div className="trend-chart">
                  <div className="trend-scale">
                    <span>{axisLabel(g.max)}</span>
                    <span>{axisLabel(mid)}</span>
                    <span>{axisLabel(g.min)}</span>
                  </div>

                  <div className="trend-plot">
                    {/* Stretched to the panel's width with a non-scaling stroke,
                        so the line stays an even weight at any size. */}
                    <svg
                      className="trend-svg"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-label="Total views over time"
                    >
                      <line className="trend-grid" x1="0" y1="50" x2="100" y2="50" vectorEffect="non-scaling-stroke" />
                      <polygon className="trend-area" points={g.area} />
                      <polyline className="trend-line" points={g.line} vectorEffect="non-scaling-stroke" />
                    </svg>

                    {/* Dots sit outside the stretched SVG: inside it they would
                        be squashed into ellipses by the same scaling. */}
                    {g.points.map((p) => (
                      <span
                        key={p.day}
                        className={`trend-dot ${hovered?.day === p.day ? 'trend-dot-on' : ''}`}
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                        onMouseEnter={() => setHovered(p)}
                        onMouseLeave={() => setHovered(null)}
                      />
                    ))}

                    {/* Anchored to the hovered reading, and tucked in near an
                        edge so it never hangs outside the panel. */}
                    {hovered && (
                      <div
                        className="trend-tip"
                        style={{
                          left: `${hovered.x}%`,
                          top: `${hovered.y}%`,
                          transform: `translate(${
                            hovered.x > 78 ? '-100%' : hovered.x < 22 ? '0%' : '-50%'
                          }, calc(-100% - 12px))`,
                        }}
                      >
                        <div className="trend-tip-day">
                          {new Date(`${hovered.day}T00:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <div className="trend-tip-row">
                          <span className="trend-tip-value">
                            {hovered.total.toLocaleString('en-GB')}
                          </span>
                          <span className="trend-tip-unit">views</span>
                          {hovered.gain !== null && (
                            <span className={`trend-tip-gain ${hovered.gain > 0 ? 'views-gain-up' : ''}`}>
                              {formatGain(hovered.gain)}
                            </span>
                          )}
                        </div>
                        <div className="trend-tip-row">
                          <span className="trend-tip-value">
                            {hovered.followers === null ? '—' : hovered.followers.toLocaleString('en-GB')}
                          </span>
                          <span className="trend-tip-unit">
                            {hovered.followers === null ? 'followers not recorded' : 'followers'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="trend-foot">
                  <span>{g.points[0].day}</span>
                  <span>{trend.points.length} days recorded</span>
                  <span>{g.points[g.points.length - 1].day}</span>
                </div>
              </div>
            );
          })()}

          {entry.proxy && (
            <div className="detail-block">
              <span className="detail-label">Proxy</span>
              <span className="detail-field-value">{entry.proxy}</span>
            </div>
          )}
          {entry.recovery && (
            <div className="detail-block">
              <span className="detail-label">Recovery</span>
              <pre className="detail-text">{entry.recovery}</pre>
            </div>
          )}
          {entry.custom_fields.length > 0 && (
            <div className="detail-block">
              <span className="detail-label">Fields</span>
              <div className="detail-fields">
                {entry.custom_fields.map((f, i) => (
                  <div key={i} className="detail-field">
                    <span className="detail-field-key">{f.key}</span>
                    <span className="detail-field-value">{f.value}</span>
                    <CopyButton value={f.value} label={f.key} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {entry.notes && (
            <div className="detail-block">
              <span className="detail-label">Notes</span>
              <pre className="detail-text">{entry.notes}</pre>
            </div>
          )}
          {history.length > 0 && (
            <div className="detail-block">
              <span className="detail-label">History</span>
              <div className="detail-fields">
                {history.map((h, i) => (
                  <div key={i} className="detail-field">
                    <span className="detail-field-value history-pw">{h.password}</span>
                    <CopyButton value={h.password} label="Old password" />
                    <span className="detail-meta">
                      replaced {timeAgo(h.changed_at)} by {h.changed_by}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="detail-footer">
            <span className="detail-meta">
              Updated {timeAgo(entry.updated_at)} by {entry.updated_by}
            </span>
            <button className="btn btn-ghost btn-tiny" onClick={handleLogout}>
              Clear saved session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
