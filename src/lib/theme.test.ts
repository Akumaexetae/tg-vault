import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, isTheme, resolveTheme } from './theme';

/**
 * The suite runs in the `node` environment, so there is no DOM. Rather than
 * pull in jsdom for one module, stub the single element applyTheme touches.
 */
let attributes: Record<string, string>;

function stubDocument() {
  attributes = {};
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
      getAttribute: (name: string) => attributes[name] ?? null,
      removeAttribute: (name: string) => {
        delete attributes[name];
      },
    },
  });
}

/** Stands in for the OS preference. */
function mockPrefersDark(dark: boolean) {
  // theme.ts reads window.matchMedia, not the bare global.
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({
      matches: dark && query.includes('dark'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

beforeEach(stubDocument);
afterEach(() => vi.unstubAllGlobals());

describe('isTheme', () => {
  it('accepts the three valid values', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
  });

  it('rejects anything else, so a corrupt settings file falls back', () => {
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(1)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('passes explicit choices through regardless of the OS', () => {
    mockPrefersDark(true);
    expect(resolveTheme('light')).toBe('light');
    mockPrefersDark(false);
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('follows the OS when set to system', () => {
    mockPrefersDark(true);
    expect(resolveTheme('system')).toBe('dark');
    mockPrefersDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('unsupported');
      },
    });
    expect(resolveTheme('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  it('writes the resolved theme to the document, never "system"', () => {
    mockPrefersDark(true);
    expect(applyTheme('system')).toBe('dark');
    expect(attributes['data-theme']).toBe('dark');
  });

  it('switches the attribute when the choice changes', () => {
    mockPrefersDark(false);
    applyTheme('dark');
    expect(attributes['data-theme']).toBe('dark');
    applyTheme('light');
    expect(attributes['data-theme']).toBe('light');
  });
});
