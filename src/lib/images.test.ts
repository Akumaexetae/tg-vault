import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES, validateImage } from './images';

describe('validateImage', () => {
  it('accepts the formats we can re-encode', () => {
    expect(validateImage({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImage({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateImage({ type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('rejects anything that is not one of those images', () => {
    expect(validateImage({ type: 'application/pdf', size: 1000 })).toMatch(/PNG/);
    expect(validateImage({ type: 'image/gif', size: 1000 })).toMatch(/PNG/);
    expect(validateImage({ type: '', size: 1000 })).toMatch(/PNG/);
  });

  it('rejects sources over 2 MB but allows the boundary', () => {
    expect(validateImage({ type: 'image/png', size: MAX_SOURCE_BYTES })).toBeNull();
    expect(
      validateImage({ type: 'image/png', size: MAX_SOURCE_BYTES + 1 }),
    ).toMatch(/2 MB/);
  });
});
