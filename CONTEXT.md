# Dining Guide — Domain Language

A personal dining journal in the owner's first-person editorial voice. The owner is the sole admin; everyone else is an anonymous reader. Domain terms below; implementation details belong in `docs/dining-guide-spec.md`.

## Language

**Restaurant**:
A place the owner has visited or wants to try. One row per place. A chain (e.g., Chick-fil-A) is one Restaurant with many Locations.

**Location**:
A physical address belonging to a Restaurant. A Restaurant has zero, one, or many Locations.

**Cuisine**:
A canonical food-style label (`Burger`, `Thai`, …) stored in a lookup table that is the source of truth for the vocabulary. Restaurants tag themselves with one or more Cuisines.

**The note** _(field: `notes`)_:
The owner's prose impression of a Restaurant. The centerpiece of the detail page. The owner's voice — never editable by anyone else.
_Avoid_: "Notes" in UI copy.

**What's good / What's not / When you go** _(fields: `pros` / `cons` / `recommendations`)_:
Three short editorial blocks accompanying The note. The owner's voice. Field labels in code keep the short names; UI labels use the editorial phrasing.
_Avoid_: "Pros / Cons / Recommendations" in UI copy.

**Suggestion**:
An incoming proposal from an anonymous reader, sent to a moderation queue for the admin to accept or reject. Two kinds: a **Correction** (edit to an existing Restaurant) or a **Tip** (a new Restaurant the owner hasn't logged). Anonymous reads are public; anonymous writes are not — Suggestions are the one exception, and even then they land in a queue, not in the live data.
_Avoid_: "Submission" (SaaS-y), "Contribution" (over-promises attribution), "Recommendation" (clashes with the `recommendations` column).

The submitter provides a **required name** and nothing else — no email, no account, no verification. The contract is "tell me who you are; I won't write back." Names are self-asserted and not validated beyond non-empty.

**Correction** _(suggestion kind)_:
A proposed change to an existing Restaurant. Bounded by a whitelist (below). Editorial-voice and personal-context fields are off-limits.

The whitelist:

- `name` (rebrands happen)
- `permanently_closed`
- `cuisine[]`
- `vegetarian`
- `locations[]` (city, locality, address, lat/lng)
- `photo_url` (only via a separate moderated upload path — see "Suggested photo")
- A free-text **anything-else note** that lands on the queue item but does not bind to any field

Off-limits (the owner's voice or the owner's personal baseline): `notes`, `pros`, `cons`, `recommendations`, `rating`, `occasion`, `wallet`, `status`, `visited_at`, `slug`.

**Tip** _(suggestion kind)_:
A proposed new Restaurant. Carries the same shape as a new Restaurant payload but is not live until the admin accepts it.

## Relationships

- A **Restaurant** has many **Locations**, many **Cuisines** (via array), at most one of each editorial field.
- A **Suggestion** is either a **Correction** (targets exactly one **Restaurant**) or a **Tip** (targets none — proposes a new one).
- When an admin accepts a **Suggestion**, the proposed payload is applied to the live **Restaurant** table; the **Suggestion** itself is retained as a record of what was accepted.

**Suggested photo**:
A photo proposed by an anonymous user via either a Correction or a Tip. Lives in a moderation-only quarantine path (never the public `restaurant-photos` bucket) until the admin accepts it. On accept, the object is copied into `restaurant-photos` and the quarantine copy is removed; on reject or 30-day expiry, the quarantine copy is deleted. Safeguards in v1: quarantine bucket, MIME/size caps, server-side resize, per-IP rate limit, Vercel BotID. No automated NSFW/CSAM scanning in v1 — the admin queue is the only filter; revisit if volume crosses ~10/week.

## Example dialogue

> **Dev:** "Anonymous user submits a Correction saying the rating should be 3 stars. Do we ever apply that?"
> **Owner:** "No. Rating is my voice — the form shouldn't even offer it. A Correction can update factual fields like the address, whether the place is closed, or the cuisine. Wallet and occasion are also off — those are anchored to my habits, so someone else's value would silently drift the meaning of the field."

## Flagged ambiguities

- **"Edits"** was used loosely in the original ask. Resolved: a bounded whitelist applies — see the **Correction** entry above.
- **"Recommendation"** is overloaded between (a) the `recommendations` column on Restaurant and (b) the colloquial sense of "someone recommends a new place." Resolved: only (a) — for (b), use **Tip**.
- **`occasion` and `wallet`** look like categorization but are personal-context (anchored to the owner's habits per `docs/dining-guide-spec.md`). Resolved: off the Correction whitelist; the meaning would degrade if outsiders set them.
