# Anonymous Suggestion write path: trust model and safeguards

Suggestions are the first and only anonymous write path in this codebase. Every other server action begins with `assertAuthed()`; the Suggestion submit action does not. This ADR records the deliberate trust posture and the layered defenses, so a future reader doesn't relitigate them from scratch.

## Trust model

- **Submitter identity:** a required, self-asserted `name` field. No email, no account, no verification. The contract is _"tell me who you are; I won't write back."_ Names are validated only for non-empty.
- **No notification back to the submitter, ever.** Without an email field there is no follow-up channel, by design.
- **Suggestions land in a moderation queue** — never in live `restaurants` / `locations` data. The admin's eyes are the only filter that promotes a Suggestion to live state.
- **Photo uploads land in a private quarantine bucket** (`suggestion-photos`), never in the public `restaurant-photos` bucket. The public URL only exists after the admin accepts.

## Layered defenses (server action runs them top-to-bottom, short-circuits on first failure)

1. **`assertNotPreview()`** — public submits throw on `VERCEL_ENV === 'preview'`, preserving the "preview is read-only" invariant.
2. **Honeypot field check** — a hidden form input bots fill, humans don't.
3. **Vercel BotID verification.**
4. **Per-IP rate limit** — 3 submissions per hour, 10 per day. Counters live in Vercel Runtime Cache (ephemeral, self-cleans). Same caps applied to `/api/geocode` since anon Suggestion forms exercise it.
5. **Zod parse** of the Suggestion payload — strips any field outside the Correction whitelist (ADR-0001).
6. **Anon `INSERT` policy** on `suggestions` — RLS gates the write to exactly the Suggestion shape, with no read or update privileges.
7. **Rate counter increment** on success.

Blocked attempts at any layer log a structured `console.warn` (kind, reason, IP, timestamp) to Vercel function logs — no dashboard, just searchable.

## Photo specifics

- Anonymous client uploads directly to `suggestion-photos` via the Supabase JS client and the public publishable key. A Storage policy permits anon `INSERT` only when the object's path matches a UUID-prefix pattern. No anon `SELECT` / `UPDATE` / `DELETE`.
- Client-side resize (canvas, ≤1200px wide, ≤200KB target) before upload bounds bytes without burning function-seconds.
- The server action validates the submitted `photo_path` (UUID prefix, object exists, content-type) before persisting the Suggestion row.
- A daily Vercel Cron Job at `/api/cron/expire-suggestions` (authed via `CRON_SECRET`) hard-deletes any quarantine object older than 30 days and marks the associated Suggestion `rejected` with `admin_note='auto-expired: photo removed after 30 days'`.

## Considered and explicitly rejected

- **Required email (verified or unverified).** Rejected: friction kills legitimate Suggestions on a personal-scale site; BotID + rate limit cover the spam threat that emails would otherwise reduce.
- **Resend or other transactional email back to the submitter.** Rejected for v1: adds a third-party dep and an env var for a notification that, with no submitter email captured anyway, has no recipient. Re-evaluate only if v1.1 changes the identity model.
- **Automated NSFW / CSAM scanning** (Cloudflare, AWS Rekognition, Google Vision, etc.). Rejected for v1: real cost, real complexity. At expected volume (≤10 photos/month), the admin queue is the truthful filter — every photo is reviewed by a human before any public URL exists, and the quarantine bucket has no public read. Revisit if volume crosses ~10/week or the threat model changes.
- **CAPTCHA (hCaptcha, Cloudflare Turnstile).** Rejected: BotID is the modern replacement and is GA on Vercel; layering CAPTCHA on top is friction without commensurate gain.
- **Server-action photo upload** (multipart → server action → Storage with service-role key). Rejected: would reintroduce `SUPABASE_SERVICE_ROLE_KEY` into runtime code, violating the spec's invariant that the service role is local-script-only. Also burns function-seconds on every upload. Client-direct upload with storage policies is the correct trade.
- **An `expired` Suggestion status.** Rejected: the state machine stays binary (`pending | accepted | rejected`); auto-expiry uses `rejected` with an `admin_note`.
- **A "block this IP" admin action.** Rejected for v1: rate limits already cap abuse volume; revisit if persistent abuse from a stable IP becomes observable.
