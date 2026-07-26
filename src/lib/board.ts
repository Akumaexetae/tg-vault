import type { BoardCard, Lane } from './types';

export const LANES: { key: Lane; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
];

const STEP = 1024;

/**
 * A position between two neighbours, using fractional indexing so moving one
 * card never rewrites the rest of the column — important when two people are
 * dragging at once and each write is independent.
 */
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) return STEP;
  if (before === null) return (after as number) - STEP;
  if (after === null) return before + STEP;
  return (before + after) / 2;
}

export function cardsInLane(cards: BoardCard[], lane: Lane): BoardCard[] {
  return cards
    .filter((c) => c.lane === lane)
    .sort((a, b) =>
      a.position !== b.position
        ? a.position - b.position
        : a.created_at.localeCompare(b.created_at),
    );
}

/**
 * Position for a card dropped into `lane` at `index`, ignoring the card being
 * moved so dragging within a column doesn't measure against itself.
 */
export function positionForDrop(
  cards: BoardCard[],
  lane: Lane,
  index: number,
  movingId: string,
): number {
  const column = cardsInLane(cards, lane).filter((c) => c.id !== movingId);
  const before = index > 0 ? (column[index - 1]?.position ?? null) : null;
  const after = index < column.length ? (column[index]?.position ?? null) : null;
  return positionBetween(before, after);
}

/**
 * True when neighbouring positions have collapsed too close to subdivide.
 * Repeated drops between the same pair halve the gap each time; past this
 * point the column needs renumbering rather than another midpoint.
 */
export function needsRebalance(cards: BoardCard[], lane: Lane): boolean {
  const column = cardsInLane(cards, lane);
  for (let i = 1; i < column.length; i++) {
    if (Math.abs(column[i].position - column[i - 1].position) < 0.0001) return true;
  }
  return false;
}

/** Evenly spaced positions for a column, used after a rebalance is needed. */
export function rebalance(
  cards: BoardCard[],
  lane: Lane,
): { id: string; position: number }[] {
  return cardsInLane(cards, lane).map((c, i) => ({
    id: c.id,
    position: (i + 1) * STEP,
  }));
}

/** Cards past their due date and not yet done. */
export function overdueCards(cards: BoardCard[], today: string): BoardCard[] {
  return cards.filter(
    (c) => c.lane !== 'done' && c.due_date !== null && c.due_date < today,
  );
}
