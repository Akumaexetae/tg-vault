import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  showsPersonalFields,
  validateDocument,
  validatePayout,
  validateRevenueShare,
} from './validation';

describe('validateRevenueShare', () => {
  it('accepts 0 to 100 inclusive', () => {
    expect(validateRevenueShare(0)).toBeNull();
    expect(validateRevenueShare(45)).toBeNull();
    expect(validateRevenueShare(100)).toBeNull();
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(validateRevenueShare(-1)).toMatch(/between 0 and 100/);
    expect(validateRevenueShare(101)).toMatch(/between 0 and 100/);
    expect(validateRevenueShare(Number.NaN)).toMatch(/number/);
  });

  it('allows an unset share', () => {
    expect(validateRevenueShare(null)).toBeNull();
  });
});

describe('validatePayout', () => {
  it('requires details once a method is chosen', () => {
    expect(validatePayout('iban', '')).toMatch(/details/);
    expect(validatePayout('iban', 'FR76 3000 6000 0112 3456 7890 189')).toBeNull();
  });

  it('is satisfied when no method is set', () => {
    expect(validatePayout(null, '')).toBeNull();
  });
});

describe('validateDocument', () => {
  it('requires exactly one of url or storagePath', () => {
    expect(validateDocument({})).toMatch(/link or a file/);
    expect(validateDocument({ url: 'https://x', storagePath: 'a/b' })).toMatch(/not both/);
    expect(validateDocument({ url: 'https://drive.google.com/x' })).toBeNull();
  });

  it('rejects uploads over the cap but allows the boundary', () => {
    expect(validateDocument({ storagePath: 'a/b', sizeBytes: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateDocument({ storagePath: 'a/b', sizeBytes: MAX_UPLOAD_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe('showsPersonalFields', () => {
  it('hides personal fields for the agency row', () => {
    expect(showsPersonalFields('creator')).toBe(true);
    expect(showsPersonalFields('agency')).toBe(false);
  });
});
