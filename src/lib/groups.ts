import { SERVICES } from './catalog';
import type { Entry } from './types';

export interface ServiceGroup {
  id: string; // catalog key, or "custom:<name>"
  key: string;
  name: string;
  url: string;
  count: number;
}

export const groupIdOf = (e: Entry): string =>
  e.service_key === 'custom' ? `custom:${e.service_name.toLowerCase()}` : e.service_key;

/** Distinct services present in the vault, catalog order first, then customs A→Z. */
export function serviceGroups(entries: Entry[]): ServiceGroup[] {
  const map = new Map<string, ServiceGroup>();
  for (const e of entries) {
    const id = groupIdOf(e);
    const existing = map.get(id);
    if (existing) {
      existing.count++;
    } else {
      map.set(id, {
        id,
        key: e.service_key,
        name: e.service_name,
        url: e.service_url,
        count: 1,
      });
    }
  }
  const order = new Map(SERVICES.map((s, i) => [s.key, i]));
  return [...map.values()].sort((a, b) => {
    const ai = order.get(a.key) ?? 999;
    const bi = order.get(b.key) ?? 999;
    return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
  });
}
