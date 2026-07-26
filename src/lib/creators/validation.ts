import type { CreatorKind, PayoutMethod } from '../types';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateRevenueShare(value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Revenue share must be a number.';
  if (value < 0 || value > 100) return 'Revenue share must be between 0 and 100.';
  return null;
}

export function validatePayout(
  method: PayoutMethod | null,
  details: string | null,
): string | null {
  if (!method) return null;
  if (!details || !details.trim()) return 'Add the payout details for this method.';
  return null;
}

export function validateDocument(doc: {
  url?: string | null;
  storagePath?: string | null;
  sizeBytes?: number | null;
}): string | null {
  const hasUrl = !!doc.url?.trim();
  const hasFile = !!doc.storagePath?.trim();
  if (hasUrl && hasFile) return 'A document is a link or a file, not both.';
  if (!hasUrl && !hasFile) return 'Add a link or a file.';
  if (hasFile && (doc.sizeBytes ?? 0) > MAX_UPLOAD_BYTES) {
    return 'Files over 10 MB belong in Drive — link them instead.';
  }
  return null;
}

/** The Agency row has no birthday, contract or bank account. */
export function showsPersonalFields(kind: CreatorKind): boolean {
  return kind === 'creator';
}
