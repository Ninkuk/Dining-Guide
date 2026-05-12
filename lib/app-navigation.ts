/**
 * Tracks whether the user has navigated *within the app* during the current
 * page-load (client) session.
 *
 * A "Back" control on a leaf page (e.g. the restaurant detail page) wants to do
 * `router.back()` so the previous list view comes back with its scroll position,
 * `?view=`, and filters intact — but only when there genuinely is an in-app
 * entry to go back to. On a cold load (shared link, bookmark, search engine) the
 * history stack is empty/foreign, so the control should fall back to a real href
 * instead. Module-level state is the right scope here: it survives client-side
 * navigations and resets on a full reload, which is exactly the signal we want.
 */

let navigatedWithinApp = false

export function markNavigatedWithinApp(): void {
  navigatedWithinApp = true
}

export function hasNavigatedWithinApp(): boolean {
  return navigatedWithinApp
}
