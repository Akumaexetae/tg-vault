import { useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '../../lib/analytics';
import type { Creator } from '../../lib/types';

/**
 * Series colours come from the validated categorical palette (dataviz skill,
 * `node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light`):
 * all checks pass, with a contrast warning on the aqua that the table view and
 * direct labels answer.
 *
 * The app's brand blue (#00AFF0) stays on chrome — it sits too light on white
 * to carry data.
 */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const;
const OTHER = '#8aa1ae';
const CONTEXT = '#c9d9e3'; // gross, de-emphasised behind the cut
const ACCENT = '#2a78d6'; // your cut — the series that is the point

const PAD = { top: 16, right: 18, bottom: 30, left: 62 };
const HEIGHT = 300;
const MAX_BAR = 56;

interface Props {
  points: Point[];
  creators: Creator[];
  currency: string;
  mode: 'total' | 'creator';
}

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

/** Round axis maximum, so ticks land on readable numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function RevenueChart({ points, creators, currency, mode }: Props) {
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
  // "Other" — a generated ninth hue would be indistinguishable under CVD.
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
  const nameOf = (id: string) =>
    creators.find((c) => c.id === id)?.name ?? 'Unknown';

  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...points.map((p) => p.gross), 0));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : i * step);

  // Bars need slots rather than points on a line. Capped so a handful of
  // buckets don't become absurd slabs across the whole plot.
  const bandW = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(bandW * 0.62, MAX_BAR));
  const barX = (i: number) => PAD.left + i * bandW + (bandW - barW) / 2;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  // Label every Nth bucket so they never collide.
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.floor(plotW / 64)));

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const areaPath = (values: number[]) =>
    `${path(values)} L ${x(values.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  if (points.length === 0) {
    return (
      <div className="card chart-card chart-blank">
        <p className="tile-empty">Nothing recorded in this range.</p>
      </div>
    );
  }

  /*
   * One period is a number, not a chart — plotting it draws a single slab that
   * says nothing the stat cards above haven't already said. Tell the reader
   * what would make a chart possible instead.
   */
  if (points.length === 1) {
    return (
      <div className="card chart-card chart-blank">
        <p className="tile-empty">
          Only <strong>{points[0].label}</strong> falls in this range — a chart
          needs at least two periods to show anything a number can't.
        </p>
        <p className="muted chart-blank-hint">
          Widen the range, switch to a coarser or finer bucket, or record
          another month.
        </p>
      </div>
    );
  }

  const active = hover !== null ? points[hover] : null;
  // Fewer than three buckets is not a trend; draw it as bars.
  const sparse = points.length < 3;

  return (
    <div className="card chart-card" ref={wrap}>
      <div className="chart-legend">
        {mode === 'total' ? (
          <>
            <span className="chart-key">
              <i style={{ background: ACCENT }} /> Your cut
            </span>
            <span className="chart-key">
              <i style={{ background: CONTEXT }} /> Gross
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

      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Revenue over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left - PAD.left;
          const i =
            mode === 'total' && !sparse
              ? Math.round(px / (step || plotW))
              : Math.floor(px / bandW);
          setHover(i >= 0 && i < points.length ? i : null);
        }}
      >
        {/* Recessive grid — present, never competing with the data. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
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

        {mode === 'total' ? (
          sparse ? (
            /*
             * One or two buckets can't describe a trend — a line through a
             * single point is just a dot. Bars state the values plainly, and
             * the cut sits in front of the gross because it is part of it.
             */
            points.map((p, i) => (
              <g key={p.key}>
                <rect
                  x={barX(i)}
                  y={y(p.gross)}
                  width={barW}
                  height={Math.max(1, plotH - (y(p.gross) - PAD.top))}
                  rx="4"
                  fill={CONTEXT}
                />
                <rect
                  x={barX(i) + barW * 0.18}
                  y={y(p.agency)}
                  width={barW * 0.64}
                  height={Math.max(1, plotH - (y(p.agency) - PAD.top))}
                  rx="4"
                  fill={ACCENT}
                />
              </g>
            ))
          ) : (
            <>
              <path d={areaPath(points.map((p) => p.gross))} fill={CONTEXT} opacity="0.5" />
              <path
                d={path(points.map((p) => p.gross))}
                fill="none"
                stroke={CONTEXT}
                strokeWidth="2"
              />
              <path
                d={path(points.map((p) => p.agency))}
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.length <= 40 &&
                points.map((p, i) => (
                  <circle key={p.key} cx={x(i)} cy={y(p.agency)} r="3" fill={ACCENT} />
                ))}
            </>
          )
        ) : (
          points.map((p, i) => {
            let acc = 0;
            const segments = [
              ...named.map((id, s) => ({ id, value: p.byCreator[id] ?? 0, fill: SERIES[s] })),
              {
                id: 'other',
                value: ranked
                  .slice(SERIES.length)
                  .reduce((n, id) => n + (p.byCreator[id] ?? 0), 0),
                fill: OTHER,
              },
            ].filter((s) => s.value > 0);

            return (
              <g key={p.key}>
                {segments.map((s) => {
                  const h = (s.value / max) * plotH;
                  const top = y(acc + s.value);
                  acc += s.value;
                  return (
                    <rect
                      key={s.id}
                      x={barX(i)}
                      // 2px surface gap between stacked segments.
                      y={top}
                      width={barW}
                      height={Math.max(1, h - 2)}
                      rx="3"
                      fill={s.fill}
                    />
                  );
                })}
              </g>
            );
          })
        )}

        {/* Crosshair */}
        {active && (
          <line
            x1={mode === 'total' && !sparse ? x(hover as number) : barX(hover as number) + barW / 2}
            x2={mode === 'total' && !sparse ? x(hover as number) : barX(hover as number) + barW / 2}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="rgba(0,100,150,0.35)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.key}
              x={mode === 'total' && !sparse ? x(i) : barX(i) + barW / 2}
              y={HEIGHT - 10}
              className="chart-axis"
              textAnchor="middle"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

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
                <i style={{ background: CONTEXT }} /> Gross{' '}
                <b>{money(active.gross, currency)}</b>
              </span>
            </>
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
