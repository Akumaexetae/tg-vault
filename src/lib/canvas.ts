import type { CanvasObject } from './types';

export interface Viewport {
  /** World coordinate at the top-left of the visible area. */
  x: number;
  y: number;
  zoom: number;
}

/** Low enough that a wide board still fits on screen when you zoom to fit. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;

export const NOTE_COLORS = [
  '#ffd97a',
  '#a8e6a1',
  '#a5d8ff',
  '#ffb3c6',
  '#d9c2ff',
  '#ffffff',
];

export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export function screenToWorld(
  screenX: number,
  screenY: number,
  view: Viewport,
): { x: number; y: number } {
  return { x: view.x + screenX / view.zoom, y: view.y + screenY / view.zoom };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  view: Viewport,
): { x: number; y: number } {
  return { x: (worldX - view.x) * view.zoom, y: (worldY - view.y) * view.zoom };
}

/**
 * Zoom about a fixed screen point, so the world position under the cursor
 * stays put — without this, zooming drifts the board away from the pointer.
 */
export function zoomAt(
  view: Viewport,
  screenX: number,
  screenY: number,
  factor: number,
): Viewport {
  const zoom = clampZoom(view.zoom * factor);
  if (zoom === view.zoom) return view;
  const before = screenToWorld(screenX, screenY, view);
  const after = screenToWorld(screenX, screenY, { ...view, zoom });
  return { zoom, x: view.x + (before.x - after.x), y: view.y + (before.y - after.y) };
}

/** Bounding box of an object, treating an arrow's two endpoints as corners. */
export function objectBounds(o: CanvasObject): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (o.kind === 'arrow') {
    const x2 = o.x2 ?? o.x;
    const y2 = o.y2 ?? o.y;
    return {
      x: Math.min(o.x, x2),
      y: Math.min(o.y, y2),
      w: Math.abs(x2 - o.x),
      h: Math.abs(y2 - o.y),
    };
  }
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

/** Viewport that fits every object, or a sensible default when there are none. */
export function fitToObjects(
  objects: CanvasObject[],
  viewWidth: number,
  viewHeight: number,
  padding = 60,
): Viewport {
  if (objects.length === 0) return { x: -viewWidth / 2, y: -viewHeight / 2, zoom: 1 };

  const boxes = objects.map(objectBounds);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const zoom = clampZoom(
    Math.min((viewWidth - padding * 2) / width, (viewHeight - padding * 2) / height),
  );

  // Centres the content. If the spread is so wide that MIN_ZOOM still can't
  // contain it, this overflows evenly on both sides rather than pinning to a
  // corner — the least surprising outcome when a perfect fit is impossible.
  return {
    zoom,
    x: minX - (viewWidth / zoom - width) / 2,
    y: minY - (viewHeight / zoom - height) / 2,
  };
}

/** Topmost object under a world point, or null. Later z wins. */
export function objectAt(
  objects: CanvasObject[],
  worldX: number,
  worldY: number,
): CanvasObject | null {
  const hits = objects.filter((o) => {
    const b = objectBounds(o);
    // Arrows are thin; give them a grab margin rather than a zero-height box.
    const margin = o.kind === 'arrow' ? 8 : 0;
    return (
      worldX >= b.x - margin &&
      worldX <= b.x + b.w + margin &&
      worldY >= b.y - margin &&
      worldY <= b.y + b.h + margin
    );
  });
  if (hits.length === 0) return null;
  return hits.reduce((top, o) => (o.z >= top.z ? o : top));
}

/** One above the current highest, so a touched object comes to the front. */
export function nextZ(objects: CanvasObject[]): number {
  return objects.length === 0 ? 1 : Math.max(...objects.map((o) => o.z)) + 1;
}
