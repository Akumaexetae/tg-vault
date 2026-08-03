import { describe, expect, it } from 'vitest';
import { createOverlayDismiss } from './overlay';

/**
 * A `click` fires on the nearest common ancestor of where the mouse went down
 * and where it came up. Press inside a modal, release on the overlay, and the
 * overlay is that ancestor — so a naive `onClick={onClose}` closes the modal
 * mid-drag. These cases pin down that only a press AND release on the overlay
 * itself counts as clicking away.
 */
describe('createOverlayDismiss', () => {
  it('dismisses when the press and the release are both on the overlay', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(true);
    expect(dismiss.release(true)).toBe(true);
  });

  it('does not dismiss when a drag starts inside the modal and ends on the overlay', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(false);
    expect(dismiss.release(true)).toBe(false);
  });

  it('does not dismiss when a drag starts on the overlay and ends inside the modal', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(true);
    expect(dismiss.release(false)).toBe(false);
  });

  it('does not dismiss when the whole click happens inside the modal', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(false);
    expect(dismiss.release(false)).toBe(false);
  });

  it('does not dismiss on a release that had no press at all', () => {
    const dismiss = createOverlayDismiss();
    expect(dismiss.release(true)).toBe(false);
  });

  it('consumes the press, so a second release cannot dismiss again', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(true);
    expect(dismiss.release(true)).toBe(true);
    expect(dismiss.release(true)).toBe(false);
  });

  it('lets a genuine click away still work after an aborted drag', () => {
    const dismiss = createOverlayDismiss();
    dismiss.press(false);
    expect(dismiss.release(true)).toBe(false);

    dismiss.press(true);
    expect(dismiss.release(true)).toBe(true);
  });
});
