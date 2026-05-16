/**
 * In-memory trail of client-side pathnames for the current page-load session,
 * used so a "Back" control can decide between `router.back()` and a plain link.
 *
 * Why a trail rather than a boolean: a leaf page's "Back" should `router.back()`
 * *only when the previous entry is the place the Back link points to* — then
 * back() lands on the same page but with scroll position, `?view=`, and filters
 * restored. If the user arrived sideways (list → /new → new restaurant detail,
 * or restaurant → /edit → restaurant), the previous entry is the admin page,
 * not the parent, so back() would land in the wrong place — there we want a
 * normal navigation to the `href` instead.
 *
 * `recordNavigation` treats a path matching the second-to-last entry as a *back*
 * navigation (pop) instead of a push, so the trail stays accurate across
 * `router.back()` / browser-back round-trips. Module-level state is the right
 * scope: it survives client-side navigations and resets on a full reload —
 * exactly the "fresh, foreign history stack" signal we want.
 */

const trail: string[] = [];

export function recordNavigation(path: string): void {
  if (trail[trail.length - 1] === path) return; // re-render / no-op
  if (trail[trail.length - 2] === path) {
    trail.pop(); // user went back
  } else {
    trail.push(path);
  }
}

/** The pathname the user was on immediately before the current one, if any. */
export function getPreviousPath(): string | undefined {
  return trail[trail.length - 2];
}
