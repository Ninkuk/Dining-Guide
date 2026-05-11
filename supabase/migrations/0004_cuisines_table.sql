-- Cuisines lookup table (Decision 26).
--
-- The DB becomes source of truth for the cuisine vocabulary. lib/cuisines.ts
-- ships the seed list; once this migration runs, the form's Combobox queries
-- this table. New cuisines added inline through the create dialog (Decision 26c).
--
-- restaurants.cuisine remains text[] for query ergonomics — a trigger enforces
-- that every value exists in cuisines.name.

create table cuisines (
  name  text primary key,
  emoji text not null default '🍽️'
);

-- Seed: matches lib/cuisines.ts CUISINE_EMOJI exactly. Keep in sync if you add
-- cuisines through SQL — the seed file gets re-read only on a fresh migrate.
insert into cuisines (name, emoji) values
  ('American', '🇺🇸'),
  ('BBQ', '🍖'),
  ('Bakery', '🥐'),
  ('Bar', '🍸'),
  ('Boba', '🧋'),
  ('Brazilian', '🇧🇷'),
  ('Breakfast', '🥞'),
  ('Brewery', '🍺'),
  ('British', '🫖'),
  ('Brunch', '🥂'),
  ('Burger', '🍔'),
  ('Cafe', '🥯'),
  ('Cajun', '🦐'),
  ('Caribbean', '🏝️'),
  ('Chinese', '🥡'),
  ('Coffee', '☕'),
  ('Cuban', '🇨🇺'),
  ('Desserts', '🍰'),
  ('Diner', '🍳'),
  ('Donuts', '🍩'),
  ('Ethiopian', '🇪🇹'),
  ('Filipino', '🇵🇭'),
  ('French', '🥖'),
  ('German', '🥨'),
  ('Greek', '🇬🇷'),
  ('Hawaiian', '🌺'),
  ('Ice Cream', '🍦'),
  ('Indian', '🍛'),
  ('Irish', '☘️'),
  ('Italian', '🍝'),
  ('Japanese', '🍣'),
  ('Korean', '🥢'),
  ('Lebanese', '🥙'),
  ('Mediterranean', '🫒'),
  ('Mexican', '🌮'),
  ('Middle Eastern', '🧆'),
  ('Mongolian', '🍲'),
  ('Persian', '🍆'),
  ('Peruvian', '🦙'),
  ('Pizza', '🍕'),
  ('Polish', '🥟'),
  ('Ramen', '🍜'),
  ('Salads', '🥗'),
  ('Sandwiches', '🥪'),
  ('Seafood', '🦞'),
  ('Soul', '🍗'),
  ('Spanish', '🇪🇸'),
  ('Steakhouse', '🥩'),
  ('Sushi', '🍣'),
  ('Tapas', '🍢'),
  ('Tex-Mex', '🌶️'),
  ('Thai', '🥥'),
  ('Vegan', '🌱'),
  ('Vegetarian', '🥦'),
  ('Vietnamese', '🍜');

-- RLS: anon read, authenticated write — matches restaurants/locations.
alter table cuisines enable row level security;

create policy cuisines_public_read on cuisines
  for select to anon, authenticated
  using (true);

create policy cuisines_admin_write on cuisines
  for all to authenticated
  using (true)
  with check (true);

-- Integrity trigger: every value in restaurants.cuisine[] must exist in cuisines.name.
create or replace function check_cuisines_exist()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  missing text;
begin
  if new.cuisine is null or array_length(new.cuisine, 1) is null then
    return new;
  end if;
  select c into missing
    from unnest(new.cuisine) c
   where c not in (select name from cuisines)
   limit 1;
  if missing is not null then
    raise exception 'Unknown cuisine: %. Insert into cuisines first.', missing;
  end if;
  return new;
end
$$;

create trigger restaurants_check_cuisines
  before insert or update of cuisine on restaurants
  for each row execute function check_cuisines_exist();
