-- Quarantine bucket for anonymous Suggestion photo uploads (ADR-0003).
--
-- The public `restaurant-photos` bucket is reserved for accepted images
-- (owner-uploaded or promoted from a Suggestion). Anonymous reader uploads
-- land here first and are only ever promoted by the admin's accept flow, or
-- discarded by reject / 30-day auto-expiry.
--
-- Trust model:
--   - anon INSERT only, gated to paths matching `<uuid>/<...>`.
--   - no anon SELECT / UPDATE / DELETE — anonymous callers cannot enumerate,
--     replace, or remove objects in the bucket.
--   - authenticated (= admin) has full access for promotion + discard.
--
-- The UUID-prefix pattern is the path namespace the QuarantinePhotoUpload
-- component generates client-side (`crypto.randomUUID() + '/' + filename`),
-- and it's the canonical shape the photo-quarantine module's
-- `isValidQuarantinePath` validates against on the server.

insert into storage.buckets (id, name, public)
values ('suggestion-photos', 'suggestion-photos', false)
on conflict (id) do nothing;

-- Anon INSERT — path MUST start with a v4-shaped UUID followed by '/'.
create policy "suggestion_photos_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'suggestion-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

-- Admin full access — promote / discard / inspect.
create policy "suggestion_photos_admin_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'suggestion-photos');

create policy "suggestion_photos_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'suggestion-photos');

create policy "suggestion_photos_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'suggestion-photos')
  with check (bucket_id = 'suggestion-photos');

create policy "suggestion_photos_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'suggestion-photos');
