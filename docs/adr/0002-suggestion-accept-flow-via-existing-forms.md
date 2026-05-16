# Accepting a Suggestion opens the existing edit/new form pre-filled

Accepting a Suggestion is not a one-click button on the moderation queue. Instead, the queue's `Open` button navigates the admin to the existing `/new` (for a Tip) or `/[slug]/edit` (for a Correction) route, with a `?from_suggestion=<id>` query param. The form is pre-filled — for Tips, from the Suggestion's payload directly; for Corrections, from the live Restaurant row overlaid with the Suggestion's proposed fields. Saving the form persists the change _and_ marks the Suggestion `accepted` in the same server action. `Reject` remains a quiet button on the queue item — no form involved.

A small banner at the top of the pre-filled form identifies the Suggestion (`Reviewing a Suggestion from {name}`), summarises the proposed changes as diff chips, and surfaces a stale-base warning (per ADR-0003 / `base_updated_at` snapshot) when applicable. `Discard suggestion` and `Reject this` are both available from the banner.

## Considered options

- **One-click `Accept` on the queue.** Rejected. Tips never arrive with the personal-context fields (`occasion`, `wallet`, `status`, `visited_at`) populated, since those are off the whitelist (ADR-0001). One-click acceptance would mean _every_ Tip lands with empty personal context, and the owner would immediately have to re-edit it — doubling the click cost in the common case. The same applies, less severely, to Corrections where the owner wants to canonicalise a freeform input (e.g., a cuisine name typed by the suggester before constraining the form fixed this — but other inline polish still applies).
- **Per-field accept/reject in the queue.** Rejected. Over-engineered for the expected volume (≤10/month). The pre-filled form gives the admin exactly this affordance — pick what to keep, edit what needs canonicalising, save.

## Consequences

- The existing `createRestaurant` and `updateRestaurant` server actions extend to read an optional `from_suggestion_id` parameter. When present, on success they also `update suggestions set status='accepted', decided_at=now() where id=$1`. No new RPC. Atomicity is best-effort — if the restaurant write succeeds but the suggestion mark fails, the worst case is a pending Suggestion the admin can manually reject, with no data loss.
- The forms gain a third "mode": `new` | `edit` | `reviewing-suggestion`. The third mode is implemented as a hidden form field plus a banner; no new route, no new schema, no new component shells.
- The queue's `Open` action is just a `<Link>` with the right `?from_suggestion=<id>` query param. The page reads `searchParams`, fetches the Suggestion, computes the pre-fill, renders the form. No new server action for "accept" itself.
- This decision cascades into route design: anonymous submit routes are `/suggest` (Tip) and `/[slug]/suggest` (Correction); the admin queue is `/suggestions` (auth-gated). `suggest` and `suggestions` are added to `FORBIDDEN_SLUGS` (`lib/slug.ts` + the matching SQL CHECK on `restaurants`).
