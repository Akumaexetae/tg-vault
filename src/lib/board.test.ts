import { describe, expect, it } from 'vitest';
import {
  cardsInLane,
  needsRebalance,
  overdueCards,
  positionBetween,
  positionForDrop,
  rebalance,
} from './board';
import type { BoardCard, Lane } from './types';

const card = (over: Partial<BoardCard> & { id: string }): BoardCard => ({
  title: 'Card',
  notes: null,
  lane: 'todo' as Lane,
  position: 1024,
  assignee: null,
  creator_id: null,
  due_date: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

describe('positionBetween', () => {
  it('places the first card in an empty column', () => {
    expect(positionBetween(null, null)).toBe(1024);
  });

  it('places before the first and after the last', () => {
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(1024, null)).toBe(2048);
  });

  it('takes the midpoint between two cards', () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it('keeps ordering strict when the gap is tiny', () => {
    const mid = positionBetween(1, 1.0001);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(1.0001);
  });
});

describe('cardsInLane', () => {
  it('filters by lane and sorts by position', () => {
    const cards = [
      card({ id: 'c', position: 3000 }),
      card({ id: 'a', position: 1000 }),
      card({ id: 'x', position: 500, lane: 'done' }),
      card({ id: 'b', position: 2000 }),
    ];
    expect(cardsInLane(cards, 'todo').map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(cardsInLane(cards, 'done').map((c) => c.id)).toEqual(['x']);
  });

  it('breaks position ties by creation time so order never flickers', () => {
    const cards = [
      card({ id: 'later', position: 1000, created_at: '2026-07-02T00:00:00Z' }),
      card({ id: 'earlier', position: 1000, created_at: '2026-07-01T00:00:00Z' }),
    ];
    expect(cardsInLane(cards, 'todo').map((c) => c.id)).toEqual(['earlier', 'later']);
  });
});

describe('positionForDrop', () => {
  const cards = [
    card({ id: 'a', position: 1000 }),
    card({ id: 'b', position: 2000 }),
    card({ id: 'c', position: 3000 }),
  ];

  it('drops at the top, middle and bottom', () => {
    // Top goes a full step above the current first card — negative is fine,
    // only the ordering matters.
    expect(positionForDrop(cards, 'todo', 0, 'new')).toBe(-24);
    expect(positionForDrop(cards, 'todo', 1, 'new')).toBe(1500);
    expect(positionForDrop(cards, 'todo', 3, 'new')).toBe(4024);
  });

  it('keeps strict ordering when repeatedly dropped at the top', () => {
    const first = positionForDrop(cards, 'todo', 0, 'new');
    const withNew = [...cards, card({ id: 'new', position: first })];
    expect(positionForDrop(withNew, 'todo', 0, 'other')).toBeLessThan(first);
  });

  it('ignores the card being moved, so it never measures against itself', () => {
    // Moving 'b' to the top: measured against 'a', not against itself.
    expect(positionForDrop(cards, 'todo', 0, 'b')).toBe(-24);
    // Moving 'a' to the end: after 'c', not after itself.
    expect(positionForDrop(cards, 'todo', 2, 'a')).toBe(4024);
  });

  it('handles dropping into an empty lane', () => {
    expect(positionForDrop(cards, 'doing', 0, 'a')).toBe(1024);
  });
});

describe('needsRebalance', () => {
  it('is false for a normally spaced column', () => {
    expect(
      needsRebalance([card({ id: 'a', position: 1000 }), card({ id: 'b', position: 2000 })], 'todo'),
    ).toBe(false);
  });

  it('is true once positions collapse beyond subdividing', () => {
    expect(
      needsRebalance(
        [card({ id: 'a', position: 1 }), card({ id: 'b', position: 1.00001 })],
        'todo',
      ),
    ).toBe(true);
  });
});

describe('rebalance', () => {
  it('spaces a column evenly while preserving order', () => {
    const cards = [
      card({ id: 'b', position: 1.00001 }),
      card({ id: 'a', position: 1 }),
    ];
    expect(rebalance(cards, 'todo')).toEqual([
      { id: 'a', position: 1024 },
      { id: 'b', position: 2048 },
    ]);
  });
});

describe('overdueCards', () => {
  it('flags past-due cards that are not done', () => {
    const cards = [
      card({ id: 'late', due_date: '2026-07-01' }),
      card({ id: 'future', due_date: '2026-08-01' }),
      card({ id: 'finished', due_date: '2026-07-01', lane: 'done' }),
      card({ id: 'nodate' }),
    ];
    expect(overdueCards(cards, '2026-07-27').map((c) => c.id)).toEqual(['late']);
  });
});
