import { describe, expect, it } from 'vitest';
import { faviconUrl, SERVICES, serviceDef } from './catalog';

describe('SERVICES catalog', () => {
  it('has 15 services with unique keys', () => {
    expect(SERVICES).toHaveLength(15);
    expect(new Set(SERVICES.map((s) => s.key)).size).toBe(15);
  });

  it('brand icons carry an SVG path and hex color', () => {
    for (const s of SERVICES) {
      if (s.icon.type === 'brand') {
        expect(s.icon.path.length).toBeGreaterThan(10);
        expect(s.icon.hex).toMatch(/^[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('every service has a valid https URL (favicon source)', () => {
    for (const s of SERVICES) {
      expect(faviconUrl(s.url)).toContain('google.com/s2/favicons');
    }
  });

  it('looks up services by key', () => {
    expect(serviceDef('onlyfans')?.name).toBe('OnlyFans');
    expect(serviceDef('nope')).toBeUndefined();
  });
});

describe('faviconUrl', () => {
  it('returns null for garbage URLs', () => {
    expect(faviconUrl('not a url')).toBeNull();
  });
});
