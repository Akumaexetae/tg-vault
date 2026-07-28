import { useEffect, useMemo, useRef, useState } from 'react';
import type { Granularity, Point } from '../../lib/analytics';
import type { Creator } from '../../lib/types';

/**
 * Series colours come from the validated categorical palette (dataviz skill,
 * `node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light`):
 * all checks pass, with a contrast warning on the aqua that the table view
 * answers.
 *
 * The app's brand blue (#00AFF0) stays on chrome — it sits too light on white
 * to carry data.
 */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const;
const OTHER = '#8aa1ae';
const CONTEXT = '#c9d9e3'; // the creators' share, above the agency cut
const ACCENT = '#2a78d6'; // your cut — the part that is the point

const PAD = { top: 16, right: 18, bottom: 30, left: 62 };
const HEIGHT = 300;
const MAX_BAR = 56;

interface Props {
  points: Point[];
  creators: Creator[];
  currency: string;
  mode: 'total' | 'creator';
  granularity: Granularity;
}

/**
 * Day view gets a fixed width per point and scrolls sideways, so every date
 * is labelled rather than thinned out. Wide enough for a two-digit day.
 */
const DAY_SLOT = 34;

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

/** Round axis maximum, so ticks land on readable numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function RevenueChart({
  points,
  creators,
  currency,
  mode,
  granularity,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The three biggest creators get their own colour; the rest fold into
  // "Other" — a generated fourth hue would be indistinguishable under CVD.
  const ranked = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of points) {
      for (const [id, gross] of Object.entries(p.byCreator)) {
        totals.set(id, (totals.get(id) ?? 0) + gross);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [points]);

  const named = ranked.slice(0, SERIES.length);
  const nameOf = (id: string) => creators.find((c) => c.id === id)?.name ?? 'Unknown';

  // Daily data is dense enough to read as a trend, so it gets an area and its
  // own scrollable width; coarser buckets stay discrete bars.
  const daily = granularity === 'day';
  const naturalW = Math.max(10, width - PAD.left - PAD.right);
  const plotW = daily
    ? Math.max(naturalW, points.length * DAY_SLOT)
    : naturalW;
  const svgW = plotW + PAD.left + PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...points.map((p) => p.gross), 0));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  // Bars sit in equal bands, capped so a few buckets don't become slabs.
  const bandW = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(bandW * 0.62, MAX_BAR));
  const barX = (i: number) => PAD.left + i * bandW + (bandW - barW) / 2;
  const barMid = (i: number) => barX(i) + barW / 2;

  // A point per day for the area path.
  const pointX = (i: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${pointX(i)} ${y(p.agency)}`)
    .join(' ');
  const areaPath = points.length
    ? `${linePath} L ${pointX(points.length - 1)} ${y(0)} L ${pointX(0)} ${y(0)} Z`
    : '';

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  // Every day is labelled in day view; coarser views thin labels to fit.
  const labelEvery = daily
    ? 1
    : Math.max(1, Math.ceil(points.length / Math.floor(plotW / 64)));

  if (points.length === 0) {
    return (
      <div className="card chart-card chart-blank">
        <p className="tile-empty">Nothing recorded in this range.</p>
      </div>
    );
  }

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="card chart-card" ref={wrap}>
      <div className="chart-legend">
        {mode === 'total' ? (
          <>
            <span className="chart-key">
              <i style={{ background: ACCENT }} /> Your cut
            </span>
            <span className="chart-key">
              <i style={{ background: CONTEXT }} /> To creators
            </span>
          </>
        ) : (
          <>
            {named.map((id, i) => (
              <span key={id} className="chart-key">
                <i style={{ background: SERIES[i] }} /> {nameOf(id)}
              </span>
            ))}
            {ranked.length > named.length && (
              <span className="chart-key">
                <i style={{ background: OTHER }} /> Other
              </span>
            )}
          </>
        )}
      </div>

      <div className={daily ? 'chart-scroll' : undefined}>
      <svg
        width={svgW}
        height={HEIGHT}
        role="img"
        aria-label="Revenue by period"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left - PAD.left;
          const i = daily
            ? Math.round((px / plotW) * (points.length - 1))
            : Math.floor(px / bandW);
          setHover(i >= 0 && i < points.length ? i : null);
        }}
      >
        {/* Recessive grid — present, never competing with the data. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={svgW - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="rgba(0,100,150,0.12)"
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={y(t) + 4} className="chart-axis" textAnchor="end">
              {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
            </text>
          </g>
        ))}

        {/* Hovered band, behind the bars. */}
        {hover !== null && (
          <rect
            x={PAD.left + hover * bandW}
            y={PAD.top}
            width={bandW}
            height={plotH}
            fill="rgba(0,175,240,0.07)"
          />
        )}

        {daily ? (
          /*
           * Dense daily data reads as a trend, so it gets an area under the
           * agency cut. Coarse buckets stay bars — see below.
           */
          <>
            <path d={areaPath} fill={ACCENT} opacity="0.16" />
            <path
              d={linePath}
              fill="none"
              stroke={ACCENT}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) =>
              p.gross > 0 ? (
                <circle key={p.key} cx={pointX(i)} cy={y(p.agency)} r="3" fill={ACCENT} />
              ) : null,
            )}
          </>
        ) : (
          /*
           * Bars for coarse buckets. Revenue per month is a discrete quantity,
           * not a continuous signal — a line between months implies a path
           * through values that never existed.
           */
          points.map((p, i) => {
            const segments =
              mode === 'total'
                ? [
                    { id: 'cut', value: p.agency, fill: ACCENT },
                    { id: 'rest', value: p.creators, fill: CONTEXT },
                  ]
                : [
                    ...named.map((id, sIdx) => ({
                      id,
                      value: p.byCreator[id] ?? 0,
                      fill: SERIES[sIdx] as string,
                    })),
                    {
                      id: 'other',
                      value: ranked
                        .slice(SERIES.length)
                        .reduce((n, id) => n + (p.byCreator[id] ?? 0), 0),
                      fill: OTHER,
                    },
                  ];

            let acc = 0;
            return (
              <g key={p.key}>
                {segments
                  .filter((seg) => seg.value > 0)
                  .map((seg) => {
                    const h = (seg.value / max) * plotH;
                    const top = y(acc + seg.value);
                    acc += seg.value;
                    return (
                      <rect
                        key={seg.id}
                        x={barX(i)}
                        y={top}
                        width={barW}
                        /* 2px surface gap between stacked segments. */
                        height={Math.max(1, h - 2)}
                        rx="3"
                        fill={seg.fill}
                      />
                    );
                  })}
              </g>
            );
          })
        )}

        {points.map((p, i) => {
          if (i % labelEvery !== 0) return null;
          const dayNo = Number(p.key.slice(8, 10));
          // In day view the label is just the number, with the month named on
          // the 1st and at the start — otherwise 30 dates collide.
          const text = daily
            ? dayNo === 1 || i === 0
              ? p.label
              : String(dayNo)
            : p.label;
          return (
            <text
              key={p.key}
              x={daily ? pointX(i) : barMid(i)}
              y={HEIGHT - 10}
              className={`chart-axis ${daily && dayNo === 1 ? 'chart-axis-strong' : ''}`}
              textAnchor="middle"
            >
              {text}
            </text>
          );
        })}
      </svg>
      </div>

      {active && (
        <div className="chart-tooltip">
          <strong>{active.label}</strong>
          {mode === 'total' ? (
            <>
              <span>
                <i style={{ background: ACCENT }} /> Your cut{' '}
                <b>{money(active.agency, currency)}</b>
              </span>
              <span>
                <i style={{ background: CONTEXT }} /> To creators{' '}
                <b>{money(active.creators, currency)}</b>
              </span>
              <span className="chart-total">
                Gross <b>{money(active.gross, currency)}</b>
              </span>
            </>
          ) : named.filter((id) => (active.byCreator[id] ?? 0) > 0).length === 0 ? (
            <span>Nothing recorded</span>
          ) : (
            named
              .filter((id) => (active.byCreator[id] ?? 0) > 0)
              .map((id, i) => (
                <span key={id}>
                  <i style={{ background: SERIES[i] }} /> {nameOf(id)}{' '}
                  <b>{money(active.byCreator[id] ?? 0, currency)}</b>
                </span>
              ))
          )}
          {active.approximate && (
            <em className="chart-approx">from a monthly figure — no daily detail</em>
          )}
        </div>
      )}
    </div>
  );
}
