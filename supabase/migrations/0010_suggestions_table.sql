-- Suggestion mode foundation: the `suggestions` table + RLS + queue index.
--
-- Domain language is fixed in CONTEXT.md. The load-bearing trade-offs are in
-- docs/adr/0001 (Correction whitelist), 0002 (accept via pre-filled form), and
-- 0003 (anonymous write path defenses).
--
-- Anon can INSERT only (the only anonymous write path in this codebase).
-- Authenticated admin can do anything. Reads are intentionally NOT public —
-- pending Suggestions stay private to the admin.
--
-- Two integrity CHECKs encode the kind/target relationship:
--   - Correction MUST have target_restaurant_id
--   - Tip MUST NOT have target_restaurant_id
-- Field-level shape inside `payload` is enforced by the Zod parse in the
-- server action; the DB only owns the structural invariant.
--
-- The forbidden-slug update keeps lib/slug.ts FORBIDDEN_SLUGS in sync per the
-- pattern established by 0001_init.sql.

create table suggestions (
  id                    bigint primary key generated always as identity,
  kind                  text not null check (kind in ('correction', 'tip')),
  target_restaurant_id  bigint references restaurants(id) on delete cascade,
  submitter_name        text not null,
  payload               jsonb not null default '{}'::jsonb,
  anything_else         text,
  photo_path            text,
  status                text not null default 'pending'
                        check (status in ('pending', 'accepted', 'rejected')),
  admin_note            text,
  base_updated_at       timestamptz,
  created_at            timestamptz not null default now(),
  decided_at            timestamptz,

  constraint suggestions_submitter_name_not_blank
    check (length(btrim(submitter_name)) > 0),

  constraint suggestions_correction_has_target
    check (kind <> 'correction' or target_restaurant_id is not null),

  constraint suggestions_tip_has_no_target
    check (kind <> 'tip' or target_restaurant_id is null)
);

-- Queue: most reads filter by status (default 'pending') ordered newest-first.
create index suggestions_queue_idx on suggestions (status, created_at desc);

-- RLS: anon may only INSERT — never read other people's pending Suggestions,
-- never update or delete. Admin has full access.
alter table suggestions enable row level security;

create policy suggestions_anon_insert on suggestions
  for insert to anon
  with check (true);

create policy suggestions_admin_all on suggestions
  for all to authenticated
  using (true)
  with check (true);

-- Forbidden slug list — keep parity with lib/slug.ts FORBIDDEN_SLUGS.
-- The single CHECK constraint is rebuilt from the full list each time so the
-- two sides stay obviously in sync (one source of truth is the file; the SQL
-- mirrors it).
alter table restaurants
  drop constraint if exists restaurants_slug_not_reserved;

alter table restaurants
  add constraint restaurants_slug_not_reserved
    check (slug not in ('map', 'stats', 'new', 'api', 'auth', 'suggest', 'suggestions'));
