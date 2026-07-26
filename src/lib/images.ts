export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const AVATAR_SIZE = 512;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** Returns an error message for an unusable file, or null if it's fine. */
export function validateImage(file: {
  type: string;
  size: number;
}): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return 'Use a PNG, JPEG or WebP image.';
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return 'That image is over 2 MB — pick a smaller one.';
  }
  return null;
}

/**
 * Square-crop and shrink to AVATAR_SIZE, re-encoded as JPEG.
 *
 * Done before upload so a 6 MP phone photo becomes ~50 KB: the bucket stays
 * trivial and the roster grid doesn't pull megabytes to draw thumbnails.
 */
export async function resizeAvatar(file: File): Promise<Blob> {
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not process that image.')),
      'image/jpeg',
      0.85,
    );
  });
}
