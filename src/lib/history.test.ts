import { describe, expect, it } from 'vitest';
import {
  LIMIT,
  canRedo,
  canUndo,
  emptyHistory,
  invert,
  push,
  pushCoalesced,
  redo,
  undo,
  type Step,
} from './history';
import type { CanvasObject } from './types';

const obj = (id: string, x = 0): CanvasObject => ({
  id,
  canvas_id: 'c1',
  kind: 'note',
  x,
  y: 0,
  w: 180,
  h: 120,
  x2: null,
  y2: null,
  text: '',
  color: '#ffd97a',
  z: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
});

describe('invert', () => {
  it('turns a create into a delete and back', () => {
    const step: Step = { kind: 'create', objects: [obj('a')] };
    expect(invert(step).kind).toBe('delete');
    expect(invert(invert(step))).toEqual(step);
  });

  it('swaps before and after on an update', () => {
    const step: Step = { kind: 'update', before: [obj('a', 0)], after: [obj('a', 50)] };
    const back = invert(step) as Extract<Step, { kind: 'update' }>;
    expect(back.before[0].x).toBe(50);
    expect(back.after[0].x).toBe(0);
  });
});

describe('undo / redo', () => {
  it('returns null on an empty history', () => {
    expect(undo(emptyHistory())).toBeNull();
    expect(redo(emptyHistory())).toBeNull();
  });

  it('walks backwards and forwards through steps', () => {
    let h = push(emptyHistory(), { kind: 'create', objects: [obj('a')] });
    h = push(h, { kind: 'create', objects: [obj('b')] });
    expect(canUndo(h)).toBe(true);

    const first = undo(h)!;
    expect(first.step.kind).toBe('delete');
    expect((first.step as Extract<Step, { kind: 'delete' }>).objects[0].id).toBe('b');

    const second = redo(first.history)!;
    expect(second.step.kind).toBe('create');
    expect(canRedo(second.history)).toBe(false);
  });

  it('discards the redo branch once a new step is recorded', () => {
    let h = push(emptyHistory(), { kind: 'create', objects: [obj('a')] });
    h = undo(h)!.history;
    expect(canRedo(h)).toBe(true);
    h = push(h, { kind: 'create', objects: [obj('c')] });
    expect(canRedo(h)).toBe(false);
  });

  it('caps the history so a long session cannot grow without bound', () => {
    let h = emptyHistory();
    for (let i = 0; i < LIMIT + 20; i++) {
      h = push(h, { kind: 'create', objects: [obj(`o${i}`)] });
    }
    expect(h.past).toHaveLength(LIMIT);
    // The oldest were dropped, the newest kept.
    const last = h.past[h.past.length - 1] as Extract<Step, { kind: 'create' }>;
    expect(last.objects[0].id).toBe(`o${LIMIT + 19}`);
  });
});

describe('pushCoalesced', () => {
  it('merges rapid updates to the same object into one step', () => {
    let h = pushCoalesced(
      emptyHistory(),
      { kind: 'update', before: [obj('a', 0)], after: [obj('a', 10)] },
      800,
      1000,
      0,
    );
    h = pushCoalesced(
      h,
      { kind: 'update', before: [obj('a', 10)], after: [obj('a', 20)] },
      800,
      1200,
      1000,
    );
    expect(h.past).toHaveLength(1);
    const step = h.past[0] as Extract<Step, { kind: 'update' }>;
    // Merged span runs from the original position to the latest.
    expect(step.before[0].x).toBe(0);
    expect(step.after[0].x).toBe(20);
  });

  it('does not merge once the pause is long enough', () => {
    let h = pushCoalesced(
      emptyHistory(),
      { kind: 'update', before: [obj('a', 0)], after: [obj('a', 10)] },
      800,
      1000,
      0,
    );
    h = pushCoalesced(
      h,
      { kind: 'update', before: [obj('a', 10)], after: [obj('a', 20)] },
      800,
      5000,
      1000,
    );
    expect(h.past).toHaveLength(2);
  });

  it('does not merge updates to a different object', () => {
    let h = pushCoalesced(
      emptyHistory(),
      { kind: 'update', before: [obj('a', 0)], after: [obj('a', 10)] },
      800,
      1000,
      0,
    );
    h = pushCoalesced(
      h,
      { kind: 'update', before: [obj('b', 0)], after: [obj('b', 10)] },
      800,
      1100,
      1000,
    );
    expect(h.past).toHaveLength(2);
  });

  it('never merges across a create', () => {
    let h = push(emptyHistory(), { kind: 'create', objects: [obj('a')] });
    h = pushCoalesced(
      h,
      { kind: 'update', before: [obj('a', 0)], after: [obj('a', 10)] },
      800,
      1100,
      1000,
    );
    expect(h.past).toHaveLength(2);
  });
});
