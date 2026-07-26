import type { Creator, CreatorStatus } from '../types';

const RANK: Record<CreatorStatus, number> = {
  active: 0,
  onboarding: 1,
  prospect: 2,
  paused: 3,
  ended: 4,
};

/** Working creators first, wound-down ones last, alphabetical within each. */
export function sortCreators(creators: Creator[]): Creator[] {
  return [...creators].sort((a, b) => {
    const rank = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
    return rank !== 0 ? rank : a.name.localeCompare(b.name);
  });
}
