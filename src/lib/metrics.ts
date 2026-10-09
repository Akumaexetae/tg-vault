import { instagramHandle } from './instagram';

/**
 * Daily history for the account sparklines.
 *
 * Recorded nightly on the VPS into `account_metrics`, because Bundle keeps
 * only a short window and the CRM stores nothing — so this table is the only
 * long-term record these numbers have.
 *
 * Read through the `account_metrics_recent` function rather than the table:
 * 111 accounts over 30 days is more rows than Supabase returns by default, and
 * a truncated answer would quietly draw graphs for part of the roster.
 */

/** One night's reading. Short keys: this travels per account, per day. */
export interface MetricPoint {
  /** YYYY-MM-DD */
  d: string;
  /** Impressions — what the operators call reel views. Climbs. */
  i: number | null;
  f: number | null;
}

export interface MetricSeries {
  handle: string;
  series: MetricPoint[];
}

/** What a row needs to draw itself. */
export interface AccountTrend {
  points: MetricPoint[];
  /** Newest recorded total, or null when nothing usable was recorded. */
  total: number | null;
  /** Gain over the previous recorded day. Null when there is no day before. */
  gain: number | null;
  /** The day `total` came from. */
  lastDay: string | null;
}

export function indexSeries(rows: readonly MetricSeries[] | null): Map<string, MetricPoint[]> {
  const index = new Map<string, MetricPoint[]>();
  for (const row of rows ?? []) {
    if (!row?.handle) continue;
    const points = (row.series ?? []).filter((p) => p && typeof p.d === 'string');
    points.sort((a, b) => a.d.localeCompare(b.d));
    index.set(row.handle.trim().toLowerCase(), points);
  }
  return index;
}

/**
 * The trend for one entry.
 *
 * The gain compares the two most recent days that actually hold a number. A
 * night the recorder missed is skipped rather than treated as zero, because an
 * unrecorded night is not a day without views — and differencing against a
 * zero would invent a huge gain the next day.
 */
export function trendFor(
  username: string,
  index: Map<string, MetricPoint[]>,
): AccountTrend | null {
  const handle = instagramHandle(username);
  if (!handle) return null;
  const points = index.get(handle.toLowerCase());
  if (!points || !points.length) return null;

  const withValue = points.filter((p) => typeof p.i === 'number');
  const last = withValue[withValue.length - 1] ?? null;
  const prev = withValue[withValue.length - 2] ?? null;

  return {
    points,
    total: last ? (last.i as number) : null,
    gain: last && prev ? (last.i as number) - (prev.i as number) : null,
    lastDay: last ? last.d : null,
  };
}

/**
 * Points for a 64x20 sparkline, as "x,y" pairs.
 *
 * Days with no reading are dropped rather than plotted at zero, and the line
 * is drawn across the gap — the alternative is a cliff to the floor and back,
 * which reads as catastrophe rather than a missed night.
 *
 * A flat series is drawn along the middle instead of dividing by a zero range.
 */
export function sparkPoints(points: readonly MetricPoint[], w = 64, h = 20): string {
  const vals = points.filter((p) => typeof p.i === 'number') as { d: string; i: number }[];
  if (vals.length < 2) return '';

  const first = Date.parse(vals[0].d);
  const last = Date.parse(vals[vals.length - 1].d);
  const span = last - first || 1;

  const nums = vals.map((v) => v.i);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;

  return vals
    .map((v) => {
      const x = ((Date.parse(v.d) - first) / span) * w;
      const y = range === 0 ? h / 2 : h - ((v.i - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** "+2,140" / "+0" / '' when there is nothing to compare against. */
export function formatGain(gain: number | null): string {
  if (gain === null) return '';
  return `${gain >= 0 ? '+' : '−'}${Math.abs(gain).toLocaleString('en-GB')}`;
}

/** One plotted reading, positioned in a 0–100 box. */
export interface ChartPoint {
  x: number;
  y: number;
  day: string;
  total: number;
  /** Gain over the previous reading that had a number. */
  gain: number | null;
  /** Followers that night. Recorded alongside views, shown on hover. */
  followers: number | null;
}

export interface ChartGeometry {
  points: ChartPoint[];
  /** `x,y` pairs for the line. */
  line: string;
  /** The same, closed along the bottom, for the area fill. */
  area: string;
  min: number;
  max: number;
}

/**
 * Lays the series out in a 0–100 by 0–100 box, so the SVG can be stretched to
 * any width with `preserveAspectRatio="none"` and a non-scaling stroke.
 *
 * Points are spaced by DATE, not by index: a gap in recording should show as a
 * gap, and evenly spacing the readings would hide that a week is missing.
 */
export function chartGeometry(points: readonly MetricPoint[]): ChartGeometry | null {
  const vals = points.filter((p) => typeof p.i === 'number') as {
    d: string;
    i: number;
    f: number | null;
  }[];
  if (vals.length < 2) return null;

  const first = Date.parse(vals[0].d);
  const span = Date.parse(vals[vals.length - 1].d) - first || 1;
  const nums = vals.map((v) => v.i);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;

  const plotted: ChartPoint[] = vals.map((v, i) => ({
    x: ((Date.parse(v.d) - first) / span) * 100,
    // 4% of headroom top and bottom so the extremes are not clipped by the frame.
    y: 96 - ((v.i - min) / range) * 92,
    day: v.d,
    total: v.i,
    gain: i === 0 ? null : v.i - vals[i - 1].i,
    followers: typeof v.f === 'number' ? v.f : null,
  }));

  const line = plotted.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${plotted[0].x.toFixed(2)},100 ${line} ${plotted[plotted.length - 1].x.toFixed(2)},100`;
  return { points: plotted, line, area, min, max };
}

/** "48.3k", "931", "1.2M" — a number for an axis label. */
export function axisLabel(value: number): string {
  if (Math.abs(value) < 1000) return String(Math.round(value));
  if (Math.abs(value) < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  const m = value / 1_000_000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}
