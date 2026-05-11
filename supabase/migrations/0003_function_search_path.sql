-- Pin search_path on our plpgsql functions.
--
-- Why: Postgres functions inherit the caller's search_path. A malicious user (or
-- accidentally-shadowed object in another schema) could trick the function into
-- resolving `restaurants` / `locations` to the wrong table. Setting an explicit
-- search_path eliminates that class of bug. Flagged by Supabase advisor
-- `function_search_path_mutable`.
--
-- We choose `public, pg_temp` (instead of empty + fully qualifying everything)
-- because it keeps the function bodies readable. The risk model — single admin,
-- signups disabled — does not warrant the noise of schema-qualifying every table.

alter function public.set_updated_at()                                      set search_path = public, pg_temp;
alter function public.upsert_restaurant_with_locations(payload jsonb)       set search_path = public, pg_temp;
