export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function validateCanvasImage(file: {
  type: string;
  size: number;
}): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Only PNG, JPEG, WebP or GIF images.';
  if (file.size > MAX_IMAGE_BYTES) return 'That image is over 5 MB.';
  return null;
}

/** Fits within MAX_IMAGE_EDGE while keeping the aspect ratio. */
export function scaleToFit(
  width: number,
  height: number,
  max = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const ratio = Math.min(max / width, max / height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** On-canvas display size — big enough to read, small enough not to swamp the board. */
export function displaySize(
  width: number,
  height: number,
  target = 320,
): { w: number; h: number } {
  const ratio = Math.min(target / width, target / height, 1);
  return { w: Math.round(width * ratio), h: Math.round(height * ratio) };
}

/**
 * Re-encodes a pasted or dropped image so a 12 MP screenshot doesn't become a
 * multi-megabyte row fetched on every board load.
 */
export async function prepareCanvasImage(
  file: File | Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = scaleToFit(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('Could not process that image.');
  return { blob, width: size.width, height: size.height };
}
