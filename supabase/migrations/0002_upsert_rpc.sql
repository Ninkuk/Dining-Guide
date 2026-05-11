-- upsert_restaurant_with_locations
--
-- Creates or updates a restaurant + its locations in a single transaction.
-- Caller permissions apply (RLS gates anon vs authenticated). Not `security definer`.
--
-- payload shape:
-- {
--   "id":            null | number,                 -- null = insert, present = update
--   "name":          string,
--   "slug":          string (kebab-case),
--   "cuisine":       string[],
--   "occasion":      string | null,
--   "rating":        0..5 | null,
--   "vegetarian":    "yes" | "no" | "not_sure" | null,
--   "status":        "visited" | "want_to_try",
--   "notes":         string | null,
--   "pros":          string | null,
--   "cons":          string | null,
--   "recommendations": string | null,
--   "locations": [
--     {
--       "id":        null | number,                 -- null = insert; present = update existing
--       "city":      string | null,
--       "locality":  string | null,
--       "address":   string | null,
--       "latitude":  number | null,
--       "longitude": number | null
--     }
--   ]
-- }
--
-- Returns the restaurant id.

create or replace function upsert_restaurant_with_locations(payload jsonb)
returns bigint
language plpgsql
as $$
declare
  _restaurant_id bigint;
  _base_slug     text;
  _try_slug      text;
  _attempt       int;
  _kept_ids      bigint[];
begin
  _base_slug := payload->>'slug';

  if (payload->>'id') is null then
    -- INSERT path: retry slug with -2, -3, ... on unique_violation
    _attempt := 1;
    loop
      if _attempt = 1 then
        _try_slug := _base_slug;
      else
        _try_slug := _base_slug || '-' || _attempt;
      end if;

      begin
        insert into restaurants (
          slug, name, cuisine, occasion, rating, vegetarian, status,
          notes, pros, cons, recommendations
        )
        values (
          _try_slug,
          payload->>'name',
          coalesce(
            (select array_agg(value::text) from jsonb_array_elements_text(payload->'cuisine')),
            '{}'::text[]
          ),
          payload->>'occasion',
          nullif(payload->>'rating', '')::smallint,
          payload->>'vegetarian',
          coalesce(payload->>'status', 'visited'),
          payload->>'notes',
          payload->>'pros',
          payload->>'cons',
          payload->>'recommendations'
        )
        returning id into _restaurant_id;
        exit;
      exception when unique_violation then
        _attempt := _attempt + 1;
        if _attempt > 100 then
          raise exception 'Could not generate a unique slug for base "%"', _base_slug;
        end if;
      end;
    end loop;
  else
    -- UPDATE path: slug edits surface as constraint errors (no auto-suffix on update).
    _restaurant_id := (payload->>'id')::bigint;

    update restaurants
       set slug            = _base_slug,
           name            = payload->>'name',
           cuisine         = coalesce(
             (select array_agg(value::text) from jsonb_array_elements_text(payload->'cuisine')),
             '{}'::text[]
           ),
           occasion        = payload->>'occasion',
           rating          = nullif(payload->>'rating', '')::smallint,
           vegetarian      = payload->>'vegetarian',
           status          = coalesce(payload->>'status', status),
           notes           = payload->>'notes',
           pros            = payload->>'pros',
           cons            = payload->>'cons',
           recommendations = payload->>'recommendations'
     where id = _restaurant_id;

    if not found then
      raise exception 'Restaurant id % not found', _restaurant_id;
    end if;
  end if;

  -- Locations diff: gather kept ids, delete the rest, update kept rows, insert new rows.
  select coalesce(
           array_agg((loc->>'id')::bigint),
           '{}'::bigint[]
         )
    into _kept_ids
    from jsonb_array_elements(coalesce(payload->'locations', '[]'::jsonb)) loc
   where (loc->>'id') is not null;

  delete from locations
   where restaurant_id = _restaurant_id
     and id <> all (_kept_ids);

  update locations
     set city      = loc->>'city',
         locality  = loc->>'locality',
         address   = loc->>'address',
         latitude  = nullif(loc->>'latitude',  '')::double precision,
         longitude = nullif(loc->>'longitude', '')::double precision
    from jsonb_array_elements(coalesce(payload->'locations', '[]'::jsonb)) loc
   where locations.restaurant_id = _restaurant_id
     and (loc->>'id') is not null
     and locations.id = (loc->>'id')::bigint;

  insert into locations (restaurant_id, city, locality, address, latitude, longitude)
  select _restaurant_id,
         loc->>'city',
         loc->>'locality',
         loc->>'address',
         nullif(loc->>'latitude',  '')::double precision,
         nullif(loc->>'longitude', '')::double precision
    from jsonb_array_elements(coalesce(payload->'locations', '[]'::jsonb)) loc
   where (loc->>'id') is null;

  return _restaurant_id;
end
$$;
