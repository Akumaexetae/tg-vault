import type { CanvasObject } from './types';

/**
 * An undoable step, stored as the before/after of the objects it touched.
 *
 * Deliberately not a snapshot of the whole canvas: a board with 200 objects
 * would copy all of them on every keystroke. Storing only what changed keeps
 * a long history cheap, and makes each step replayable in either direction.
 */
export type Step =
  | { kind: 'create'; objects: CanvasObject[] }
  | { kind: 'delete'; objects: CanvasObject[] }
  | { kind: 'update'; before: CanvasObject[]; after: CanvasObject[] };

export interface History {
  past: Step[];
  future: Step[];
}

export const LIMIT = 60;

export const emptyHistory = (): History => ({ past: [], future: [] });

/** Records a step. Any redo branch is discarded, as in every editor. */
export function push(history: History, step: Step): History {
  return { past: [...history.past, step].slice(-LIMIT), future: [] };
}

/** The same step seen from the other direction. */
export function invert(step: Step): Step {
  if (step.kind === 'create') return { kind: 'delete', objects: step.objects };
  if (step.kind === 'delete') return { kind: 'create', objects: step.objects };
  return { kind: 'update', before: step.after, after: step.before };
}

export function undo(history: History): { history: History; step: Step } | null {
  const step = history.past[history.past.length - 1];
  if (!step) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [step, ...history.future] },
    step: invert(step),
  };
}

export function redo(history: History): { history: History; step: Step } | null {
  const [step, ...rest] = history.future;
  if (!step) return null;
  return { history: { past: [...history.past, step], future: rest }, step };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;

/**
 * Merges consecutive updates to the same objects, so dragging one note across
 * the board is a single undo rather than sixty.
 */
export function pushCoalesced(
  history: History,
  step: Step,
  withinMs: number,
  now: number,
  lastAt: number,
): History {
  const previous = history.past[history.past.length - 1];
  const mergeable =
    previous &&
    previous.kind === 'update' &&
    step.kind === 'update' &&
    now - lastAt < withinMs &&
    sameIds(previous.after, step.before);

  if (!mergeable) return push(history, step);

  const merged: Step = {
    kind: 'update',
    before: (previous as Extract<Step, { kind: 'update' }>).before,
    after: step.after,
  };
  return { past: [...history.past.slice(0, -1), merged], future: [] };
}

function sameIds(a: CanvasObject[], b: CanvasObject[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((o) => o.id));
  return b.every((o) => ids.has(o.id));
}
