import { describe, expect, it } from 'vitest';
import { arrowEnds, attachTarget, edgePoint } from './connect';
import type { CanvasObject } from './types';

const obj = (over: Partial<CanvasObject> & { id: string }): CanvasObject => ({
  canvas_id: 'c1',
  kind: 'box',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  x2: null,
  y2: null,
  from_id: null,
  to_id: null,
  text: '',
  color: '#00aff0',
  z: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

describe('edgePoint', () => {
  // A 100×100 box at the origin: centre (50,50), edges at 0 and 100.
  const box = obj({ id: 'b' });

  it('meets the right edge when the target is due right', () => {
    expect(edgePoint(box, { x: 500, y: 50 })).toEqual({ x: 100, y: 50 });
  });

  it('meets the top edge when the target is directly above', () => {
    expect(edgePoint(box, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
  });

  it('meets a corner on the diagonal', () => {
    const p = edgePoint(box, { x: 1050, y: 1050 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100);
  });

  it('falls back to the centre when the target is the centre', () => {
    expect(edgePoint(box, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it('follows the curve for an ellipse rather than a corner', () => {
    const ellipse = obj({ id: 'e', kind: 'ellipse' });
    const p = edgePoint(ellipse, { x: 1050, y: 1050 });
    // On a circle of radius 50, the 45° point is 50/√2 ≈ 35.36 from centre.
    expect(p.x).toBeCloseTo(50 + 35.355, 2);
    expect(p.y).toBeCloseTo(50 + 35.355, 2);
  });
});

describe('arrowEnds', () => {
  const a = obj({ id: 'a', x: 0, y: 0, w: 100, h: 100 });
  const b = obj({ id: 'b', x: 300, y: 0, w: 100, h: 100 });

  it('uses its own coordinates when unattached', () => {
    const arrow = obj({ id: 'ar', kind: 'arrow', x: 5, y: 6, x2: 70, y2: 80 });
    expect(arrowEnds(arrow, [])).toEqual({
      start: { x: 5, y: 6 },
      end: { x: 70, y: 80 },
    });
  });

  it('snaps both ends to the shapes it connects', () => {
    const arrow = obj({ id: 'ar', kind: 'arrow', from_id: 'a', to_id: 'b' });
    const ends = arrowEnds(arrow, [a, b]);
    // Right edge of a, left edge of b, both at mid-height.
    expect(ends.start).toEqual({ x: 100, y: 50 });
    expect(ends.end).toEqual({ x: 300, y: 50 });
  });

  it('follows a shape after it moves', () => {
    const arrow = obj({ id: 'ar', kind: 'arrow', from_id: 'a', to_id: 'b' });
    const movedB = { ...b, x: 0, y: 400 };
    const ends = arrowEnds(arrow, [a, movedB]);
    expect(ends.start).toEqual({ x: 50, y: 100 });
    expect(ends.end).toEqual({ x: 50, y: 400 });
  });

  it('keeps a loose end loose when only one side is attached', () => {
    const arrow = obj({
      id: 'ar',
      kind: 'arrow',
      from_id: 'a',
      x2: 600,
      y2: 50,
    });
    const ends = arrowEnds(arrow, [a]);
    expect(ends.start).toEqual({ x: 100, y: 50 });
    expect(ends.end).toEqual({ x: 600, y: 50 });
  });

  it('degrades to its own coordinates if the shape was deleted', () => {
    const arrow = obj({
      id: 'ar',
      kind: 'arrow',
      from_id: 'gone',
      x: 10,
      y: 20,
      x2: 90,
      y2: 100,
    });
    expect(arrowEnds(arrow, []).start).toEqual({ x: 10, y: 20 });
  });
});

describe('attachTarget', () => {
  const a = obj({ id: 'a', x: 0, y: 0, z: 1 });
  const b = obj({ id: 'b', x: 50, y: 50, z: 5 });
  const arrow = obj({ id: 'ar', kind: 'arrow', x: 0, y: 0, x2: 100, y2: 100 });

  it('finds the topmost shape under the point', () => {
    expect(attachTarget([a, b], { x: 70, y: 70 }, 'ar')?.id).toBe('b');
  });

  it('never attaches to another arrow', () => {
    expect(attachTarget([arrow], { x: 20, y: 20 }, 'other')).toBeNull();
  });

  it('never attaches an object to itself', () => {
    expect(attachTarget([a], { x: 20, y: 20 }, 'a')).toBeNull();
  });

  it('returns null over empty space', () => {
    expect(attachTarget([a, b], { x: 900, y: 900 }, 'ar')).toBeNull();
  });
});
