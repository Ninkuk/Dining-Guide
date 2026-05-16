/**
 * In-memory trail of client-side pathnames for the current page-load session,
 * used so a "Back" control can decide between `router.back()` and a plain link.
 *
 * Pop detection is driven by `popstate` (signalled via `notePop`) — never by
 * path equality with `trail[-2]`, because two distinct entries can share a
 * pathname (e.g. a server-action redirect after save lands on a URL the user
 * already visited). Only `popstate` distinguishes that from a real back/forward.
 */

const TRAIL_CAP = 20;
const trail: string[] = [];
let popPending = false;

export function notePop(): void {
  popPending = true;
}

export function recordNavigation(path: string): void {
  if (trail[trail.length - 1] === path) return;

  if (popPending) {
    popPending = false;
    if (trail[trail.length - 2] === path) {
      trail.pop();
      return;
    }
    // Browser-forwarded to an entry we'd already dropped — restart from here.
    trail.length = 0;
    trail.push(path);
    return;
  }

  trail.push(path);
  if (trail.length > TRAIL_CAP) trail.splice(0, trail.length - TRAIL_CAP);
}

/** The pathname the user was on immediately before the current one, if any. */
export function getPreviousPath(): string | undefined {
  return trail[trail.length - 2];
}
