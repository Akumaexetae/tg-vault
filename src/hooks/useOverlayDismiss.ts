import { useRef, type MouseEvent } from 'react';
import { createOverlayDismiss } from '../lib/overlay';

/**
 * Props for a modal overlay that closes on a click away but survives a drag
 * that merely *ends* on it — see `lib/overlay.ts` for why that distinction
 * needs the mousedown remembered.
 *
 * Spread onto the overlay element. `ModalOverlay` is the usual caller — reach
 * for this directly only for a backdrop that isn't a standard modal.
 */
export function useOverlayDismiss(onDismiss: () => void) {
  // The press has to outlive re-renders: a hover or validation update between
  // mousedown and mouseup would otherwise forget it and stop the modal closing.
  const tracker = useRef(createOverlayDismiss()).current;

  return {
    onMouseDown: (e: MouseEvent) => {
      tracker.press(e.target === e.currentTarget);
    },
    onClick: (e: MouseEvent) => {
      if (tracker.release(e.target === e.currentTarget)) onDismiss();
    },
  };
}
