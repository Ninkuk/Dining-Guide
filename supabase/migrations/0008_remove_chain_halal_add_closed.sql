-- Drop the "chain" and "halal" concepts; add a "permanently closed" flag.
--
-- permanently_closed is orthogonal to status (a place you visited can later
-- close), so it gets its own boolean column rather than a new status value.

drop index if exists restaurants_is_chain_idx;
alter table restaurants drop column if exists is_chain;
alter table restaurants drop column if exists halal;

alter table restaurants
  add column permanently_closed boolean not null default false;

-- upsert_restaurant_with_locations v3 — v2 minus halal/is_chain, plus
-- permanently_closed. Behavior otherwise identical to v2 (slug-suffix retry on
-- insert; single-row id enforce on update; locations diff preserved).

create or replace function upsert_restaurant_with_locations(payload jsonb)
returns bigint
language plpgsql
set search_path = public, pg_temp
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
    _attempt := 1;
    loop
      if _attempt = 1 then
        _try_slug := _base_slug;
      else
        _try_slug := _base_slug || '-' || _attempt;
      end if;

      begin
        insert into restaurants (
          slug, name, cuisine, occasion, wallet, rating,
          vegetarian, permanently_closed, status, visited_at, photo_url,
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
          payload->>'wallet',
          nullif(payload->>'rating', '')::smallint,
          payload->>'vegetarian',
          coalesce((payload->>'permanently_closed')::boolean, false),
          coalesce(payload->>'status', 'visited'),
          nullif(payload->>'visited_at', '')::date,
          payload->>'photo_url',
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
    _restaurant_id := (payload->>'id')::bigint;

    update restaurants
       set slug               = _base_slug,
           name               = payload->>'name',
           cuisine            = coalesce(
             (select array_agg(value::text) from jsonb_array_elements_text(payload->'cuisine')),
             '{}'::text[]
           ),
           occasion           = payload->>'occasion',
           wallet             = payload->>'wallet',
           rating             = nullif(payload->>'rating', '')::smallint,
           vegetarian         = payload->>'vegetarian',
           permanently_closed = coalesce((payload->>'permanently_closed')::boolean, permanently_closed),
           status             = coalesce(payload->>'status', status),
           visited_at         = nullif(payload->>'visited_at', '')::date,
           photo_url          = payload->>'photo_url',
           notes              = payload->>'notes',
           pros               = payload->>'pros',
           cons               = payload->>'cons',
           recommendations    = payload->>'recommendations'
     where id = _restaurant_id;

    if not found then
      raise exception 'Restaurant id % not found', _restaurant_id;
    end if;
  end if;

  -- Locations diff (unchanged from v1).
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
