import type { ReactNode } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

/**
 * The dimmed backdrop behind every modal. Closes on a click away, but not when
 * a drag that began inside the modal happens to end out here — see
 * `lib/overlay.ts`.
 */
export function ModalOverlay({
  onDismiss,
  className,
  children,
}: {
  onDismiss: () => void;
  className?: string;
  children: ReactNode;
}) {
  const dismiss = useOverlayDismiss(onDismiss);
  return (
    <div className={className ? `modal-overlay ${className}` : 'modal-overlay'} {...dismiss}>
      {children}
    </div>
  );
}
