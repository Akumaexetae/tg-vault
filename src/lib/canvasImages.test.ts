import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  displaySize,
  scaleToFit,
  validateCanvasImage,
} from './canvasImages';

describe('validateCanvasImage', () => {
  it('accepts the usual screenshot formats', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(validateCanvasImage({ type, size: 1000 })).toBeNull();
    }
  });

  it('rejects other file types', () => {
    expect(validateCanvasImage({ type: 'application/pdf', size: 10 })).toMatch(/PNG/);
  });

  it('rejects oversized files at the boundary', () => {
    expect(validateCanvasImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(
      validateCanvasImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }),
    ).toMatch(/5 MB/);
  });
});

describe('scaleToFit', () => {
  it('leaves small images alone', () => {
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('caps the long edge while keeping the ratio', () => {
    const r = scaleToFit(4000, 2000);
    expect(r.width).toBe(MAX_IMAGE_EDGE);
    expect(r.height).toBe(MAX_IMAGE_EDGE / 2);
  });

  it('caps a tall image by its height', () => {
    const r = scaleToFit(1000, 5000);
    expect(r.height).toBe(MAX_IMAGE_EDGE);
    expect(r.width).toBe(320);
  });
});

describe('displaySize', () => {
  it('shrinks a large image to the target box', () => {
    expect(displaySize(1600, 800, 320)).toEqual({ w: 320, h: 160 });
  });

  it('never enlarges something already small', () => {
    expect(displaySize(120, 90, 320)).toEqual({ w: 120, h: 90 });
  });
});
