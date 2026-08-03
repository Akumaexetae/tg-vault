/**
 * Decides whether a click on a modal overlay is a real "click away".
 *
 * A `click` event fires on the nearest common ancestor of the mousedown and
 * mouseup targets. So pressing inside the modal — selecting text in a field,
 * dragging a slider — and releasing over the overlay fires the click on the
 * overlay itself, and a plain `onClick={onClose}` throws the modal away
 * mid-drag. Stopping propagation on the modal doesn't help: the event never
 * travelled through the modal to be stopped.
 *
 * The press must therefore be remembered. Only a press *and* a release on the
 * overlay dismisses.
 */
export function createOverlayDismiss() {
  let pressedOnOverlay = false;

  return {
    /** Call on mousedown. `onOverlay` is true when the overlay itself was hit. */
    press(onOverlay: boolean): void {
      pressedOnOverlay = onOverlay;
    },

    /** Call on click. Returns whether the modal should close. */
    release(onOverlay: boolean): boolean {
      const dismiss = pressedOnOverlay && onOverlay;
      pressedOnOverlay = false;
      return dismiss;
    },
  };
}
