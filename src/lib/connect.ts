import { objectBounds } from './canvas';
import type { CanvasObject } from './types';

export interface Point {
  x: number;
  y: number;
}

/**
 * Where an arrow should meet a shape: the point on the shape's edge along the
 * line towards the other end, so the arrowhead lands on the border rather than
 * buried in the middle of the box.
 */
export function edgePoint(shape: CanvasObject, towards: Point): Point {
  const b = objectBounds(shape);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = b.w / 2;
  const halfH = b.h / 2;

  if (shape.kind === 'ellipse') {
    // Parametric ellipse intersection.
    const angle = Math.atan2(dy, dx);
    return { x: cx + halfW * Math.cos(angle), y: cy + halfH * Math.sin(angle) };
  }

  // Rectangle: scale the direction until it touches whichever edge it hits first.
  const scaleX = halfW / Math.abs(dx);
  const scaleY = halfH / Math.abs(dy);
  const scale = Math.min(
    Number.isFinite(scaleX) ? scaleX : Infinity,
    Number.isFinite(scaleY) ? scaleY : Infinity,
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * Both ends of an arrow, following whichever shapes it's attached to.
 *
 * An arrow stores `from_id` / `to_id` when connected; its own x/y remain the
 * fallback so a half-connected or dangling arrow still draws somewhere sane
 * rather than collapsing to the origin.
 */
export function arrowEnds(
  arrow: CanvasObject,
  objects: CanvasObject[],
): { start: Point; end: Point } {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const from = arrow.from_id ? byId.get(arrow.from_id) : undefined;
  const to = arrow.to_id ? byId.get(arrow.to_id) : undefined;

  const looseStart = { x: arrow.x, y: arrow.y };
  const looseEnd = { x: arrow.x2 ?? arrow.x, y: arrow.y2 ?? arrow.y };

  const fromCentre = from
    ? centreOf(from)
    : looseStart;
  const toCentre = to ? centreOf(to) : looseEnd;

  return {
    start: from ? edgePoint(from, toCentre) : looseStart,
    end: to ? edgePoint(to, fromCentre) : looseEnd,
  };
}

function centreOf(o: CanvasObject): Point {
  const b = objectBounds(o);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Shape under a point that an arrow end could attach to (never another arrow). */
export function attachTarget(
  objects: CanvasObject[],
  point: Point,
  excludeId: string,
): CanvasObject | null {
  const candidates = objects.filter((o) => {
    if (o.id === excludeId || o.kind === 'arrow') return false;
    const b = objectBounds(o);
    return (
      point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h
    );
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((top, o) => (o.z >= top.z ? o : top));
}
