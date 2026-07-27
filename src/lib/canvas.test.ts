import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  fitToObjects,
  nextZ,
  objectAt,
  objectBounds,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './canvas';
import type { CanvasObject } from './types';

const obj = (over: Partial<CanvasObject> & { id: string }): CanvasObject => ({
  canvas_id: 'c1',
  kind: 'note',
  x: 0,
  y: 0,
  w: 180,
  h: 120,
  x2: null,
  y2: null,
  from_id: null,
  to_id: null,
  text: '',
  color: '#ffd97a',
  z: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

describe('clampZoom', () => {
  it('holds zoom inside usable limits', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(50)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('screenToWorld / worldToScreen', () => {
  const view = { x: 100, y: 50, zoom: 2 };

  it('round-trips a point', () => {
    const world = screenToWorld(300, 200, view);
    const screen = worldToScreen(world.x, world.y, view);
    expect(screen.x).toBeCloseTo(300);
    expect(screen.y).toBeCloseTo(200);
  });

  it('accounts for pan and zoom', () => {
    expect(screenToWorld(0, 0, view)).toEqual({ x: 100, y: 50 });
    expect(screenToWorld(200, 100, view)).toEqual({ x: 200, y: 100 });
  });
});

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const view = { x: 0, y: 0, zoom: 1 };
    const before = screenToWorld(400, 300, view);
    const zoomed = zoomAt(view, 400, 300, 1.5);
    const after = screenToWorld(400, 300, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.zoom).toBeCloseTo(1.5);
  });

  it('does nothing once the limit is reached', () => {
    const view = { x: 10, y: 10, zoom: MAX_ZOOM };
    expect(zoomAt(view, 100, 100, 2)).toBe(view);
  });
});

describe('objectBounds', () => {
  it('uses w/h for boxes and notes', () => {
    expect(objectBounds(obj({ id: 'a', x: 10, y: 20 }))).toEqual({
      x: 10,
      y: 20,
      w: 180,
      h: 120,
    });
  });

  it('normalises an arrow drawn right-to-left', () => {
    const arrow = obj({ id: 'b', kind: 'arrow', x: 100, y: 100, x2: 40, y2: 60 });
    expect(objectBounds(arrow)).toEqual({ x: 40, y: 60, w: 60, h: 40 });
  });
});

describe('objectAt', () => {
  const objects = [
    obj({ id: 'back', x: 0, y: 0, z: 1 }),
    obj({ id: 'front', x: 50, y: 50, z: 5 }),
  ];

  it('returns the topmost object under the point', () => {
    expect(objectAt(objects, 100, 100)?.id).toBe('front');
  });

  it('returns the only object when they do not overlap', () => {
    expect(objectAt(objects, 10, 10)?.id).toBe('back');
  });

  it('returns null on empty space', () => {
    expect(objectAt(objects, 900, 900)).toBeNull();
  });

  it('gives thin arrows a grab margin', () => {
    const arrow = [obj({ id: 'a', kind: 'arrow', x: 0, y: 0, x2: 100, y2: 0 })];
    expect(objectAt(arrow, 50, 4)?.id).toBe('a');
    expect(objectAt(arrow, 50, 40)).toBeNull();
  });
});

describe('fitToObjects', () => {
  it('centres a single object without exceeding max zoom', () => {
    const view = fitToObjects([obj({ id: 'a', x: 0, y: 0 })], 800, 600);
    expect(view.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    expect(view.zoom).toBeGreaterThan(0);
  });

  it('zooms out far enough to include distant objects', () => {
    const spread = [
      obj({ id: 'a', x: 0, y: 0 }),
      obj({ id: 'b', x: 4000, y: 3000 }),
    ];
    const view = fitToObjects(spread, 800, 600);
    expect(view.zoom).toBeLessThan(1);
    // Both corners land inside the viewport.
    const topLeft = worldToScreen(0, 0, view);
    const bottomRight = worldToScreen(4180, 3120, view);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(800);
  });

  it('centres rather than corner-pins when even MIN_ZOOM cannot contain it', () => {
    // 60,000 units wide — no zoom we allow fits that on an 800px viewport.
    const enormous = [
      obj({ id: 'a', x: 0, y: 0 }),
      obj({ id: 'b', x: 60000, y: 0 }),
    ];
    const view = fitToObjects(enormous, 800, 600);
    expect(view.zoom).toBe(MIN_ZOOM);
    const left = worldToScreen(0, 0, view).x;
    const right = worldToScreen(60180, 0, view).x;
    // Equal overflow either side, so the content is still centred.
    expect(left).toBeCloseTo(800 - right, 6);
  });

  it('falls back to a default view for an empty canvas', () => {
    expect(fitToObjects([], 800, 600)).toEqual({ x: -400, y: -300, zoom: 1 });
  });
});

describe('nextZ', () => {
  it('returns one above the highest', () => {
    expect(nextZ([obj({ id: 'a', z: 3 }), obj({ id: 'b', z: 7 })])).toBe(8);
  });

  it('starts at 1 on an empty canvas', () => {
    expect(nextZ([])).toBe(1);
  });
});
