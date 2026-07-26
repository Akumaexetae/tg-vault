import { describe, expect, it } from 'vitest';
import { sortCreators } from './sort';
import type { Creator, CreatorStatus } from '../types';

const creator = (name: string, status: CreatorStatus): Creator =>
  ({ id: name, name, color: '#000', kind: 'creator', status }) as Creator;

describe('sortCreators', () => {
  it('orders active first, then by status, then by name', () => {
    const sorted = sortCreators([
      creator('Zara', 'active'),
      creator('Lena', 'ended'),
      creator('Mia', 'paused'),
      creator('Bella', 'active'),
      creator('Nina', 'prospect'),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['Bella', 'Zara', 'Nina', 'Mia', 'Lena']);
  });

  it('does not mutate the input', () => {
    const input = [creator('B', 'ended'), creator('A', 'active')];
    sortCreators(input);
    expect(input.map((c) => c.name)).toEqual(['B', 'A']);
  });
});
