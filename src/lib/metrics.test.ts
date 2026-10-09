import { describe, expect, it } from 'vitest';
import { axisLabel, chartGeometry, formatGain, indexSeries, sparkPoints, trendFor } from './metrics';

const rows = [
  {
    handle: 'lolavrn07',
    series: [
      { d: '2026-10-05', i: 24, f: 3 },
      { d: '2026-10-03', i: 12, f: 3 },
      { d: '2026-10-08', i: 68, f: 4 },
      { d: '2026-10-07', i: 28, f: 4 },
    ],
  },
  { handle: 'Gappy', series: [{ d: '2026-10-05', i: 10, f: 1 }, { d: '2026-10-06', i: null, f: 1 }, { d: '2026-10-07', i: 30, f: 2 }] },
  { handle: 'onlyone', series: [{ d: '2026-10-08', i: 5, f: 0 }] },
];

describe('indexSeries', () => {
  it('sorts each series oldest first, whatever order it arrived in', () => {
    const idx = indexSeries(rows);
    expect(idx.get('lolavrn07')!.map((p) => p.d)).toEqual([
      '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-08',
    ]);
  });

  it('lowercases handles, since the vault stores whatever was typed', () => {
    expect(indexSeries(rows).has('gappy')).toBe(true);
  });

  it('survives a null payload', () => {
    expect(indexSeries(null).size).toBe(0);
  });
});

describe('trendFor', () => {
  const idx = indexSeries(rows);

  it('reports the newest total and the gain over the day before', () => {
    const t = trendFor('lolavrn07', idx)!;
    expect(t.total).toBe(68);
    expect(t.gain).toBe(40);
    expect(t.lastDay).toBe('2026-10-08');
  });

  it('matches a username with a label, like the preview button does', () => {
    expect(trendFor('lolavrn07 FLASH', idx)?.total).toBe(68);
  });

  it('skips an unrecorded night rather than treating it as zero', () => {
    // 10-06 has no number: the gain is 30 - 10, not 30 - 0.
    expect(trendFor('gappy', idx)!.gain).toBe(20);
  });

  it('gives no gain when there is only one reading', () => {
    const t = trendFor('onlyone', idx)!;
    expect(t.total).toBe(5);
    expect(t.gain).toBeNull();
  });

  it('is null for an account with no history', () => {
    expect(trendFor('nothing.here', idx)).toBeNull();
  });
});

describe('sparkPoints', () => {
  it('spans the full width and inverts y so bigger is higher', () => {
    const pts = sparkPoints([
      { d: '2026-10-01', i: 0, f: 0 },
      { d: '2026-10-03', i: 100, f: 0 },
    ], 64, 20).split(' ');
    expect(pts[0].startsWith('0.0,')).toBe(true);
    expect(pts[1].startsWith('64.0,')).toBe(true);
    expect(Number(pts[0].split(',')[1])).toBeGreaterThan(Number(pts[1].split(',')[1]));
  });

  it('draws a flat series down the middle instead of dividing by zero', () => {
    const pts = sparkPoints([
      { d: '2026-10-01', i: 7, f: 0 },
      { d: '2026-10-02', i: 7, f: 0 },
    ], 64, 20).split(' ');
    expect(pts.every((p) => p.endsWith(',10.0'))).toBe(true);
  });

  it('needs two readings to draw anything', () => {
    expect(sparkPoints([{ d: '2026-10-01', i: 7, f: 0 }])).toBe('');
    expect(sparkPoints([])).toBe('');
  });
});

describe('formatGain', () => {
  it('signs and groups the number', () => {
    expect(formatGain(2140)).toBe('+2,140');
    expect(formatGain(0)).toBe('+0');
    expect(formatGain(-50)).toBe('−50');
  });

  it('is empty when there is nothing to compare', () => {
    expect(formatGain(null)).toBe('');
  });
});

describe('chartGeometry', () => {
  const pts = [
    { d: '2026-10-01', i: 100, f: 0 },
    { d: '2026-10-02', i: 200, f: 0 },
    { d: '2026-10-05', i: 500, f: 0 },
  ];

  it('spans the full box and inverts y', () => {
    const g = chartGeometry(pts)!;
    expect(g.points[0].x).toBe(0);
    expect(g.points[2].x).toBe(100);
    expect(g.points[0].y).toBeGreaterThan(g.points[2].y);
  });

  it('spaces points by date, not by index, so a gap stays visible', () => {
    const g = chartGeometry(pts)!;
    // 1 Oct → 2 Oct is one day of a four-day span: a quarter of the way.
    expect(g.points[1].x).toBeCloseTo(25, 1);
  });

  it('carries the gain over the previous reading', () => {
    const g = chartGeometry(pts)!;
    expect(g.points.map((p) => p.gain)).toEqual([null, 100, 300]);
  });

  it('closes the area along the bottom', () => {
    const g = chartGeometry(pts)!;
    expect(g.area.startsWith('0.00,100')).toBe(true);
    expect(g.area.endsWith('100.00,100')).toBe(true);
  });

  it('needs two readings', () => {
    expect(chartGeometry([{ d: '2026-10-01', i: 5, f: 0 }])).toBeNull();
  });

  it('does not divide by zero on a flat series', () => {
    const g = chartGeometry([
      { d: '2026-10-01', i: 7, f: 0 },
      { d: '2026-10-02', i: 7, f: 0 },
    ])!;
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});

describe('axisLabel', () => {
  it('shortens for an axis', () => {
    expect(axisLabel(931)).toBe('931');
    expect(axisLabel(48289)).toBe('48k');
    expect(axisLabel(1234)).toBe('1.2k');
  });
});
