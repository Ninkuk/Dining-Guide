-- Dining Guide initial schema
--
-- Tables: restaurants (one per logical restaurant) + locations (1..N per restaurant).
-- Cuisine is canonical strings only; emojis live in lib/cuisines.ts (Decision 16b).
-- Slug forbidden values mirror lib/slug.ts FORBIDDEN_SLUGS — keep in sync if either side changes.

create table restaurants (
  id          bigint primary key generated always as identity,
  slug        text unique not null,
  name        text not null,
  cuisine     text[] not null default '{}',
  occasion    text,
  rating      smallint check (rating between 0 and 5),
  vegetarian  text check (vegetarian in ('yes', 'no', 'not_sure')),
  status      text not null default 'visited'
              check (status in ('visited', 'want_to_try')),
  notes       text,
  pros        text,
  cons        text,
  recommendations text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint restaurants_name_not_blank      check (length(btrim(name)) > 0),
  constraint restaurants_slug_kebab          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint restaurants_slug_not_reserved   check (slug not in ('map', 'stats', 'new', 'api', 'auth')),
  constraint restaurants_cuisine_no_empties  check (array_position(cuisine, '') is null)
);

create table locations (
  id            bigint primary key generated always as identity,
  restaurant_id bigint not null references restaurants(id) on delete cascade,
  city          text,
  locality      text,
  address       text,
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  created_at    timestamptz not null default now()
);

create index locations_restaurant_id_idx on locations(restaurant_id);
create index restaurants_status_idx      on restaurants(status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger restaurants_set_updated_at
  before update on restaurants
  for each row
  execute function set_updated_at();

-- RLS: anonymous can read; authenticated admin can do anything.
-- Signups are disabled at the project level, so only the manually-provisioned admin
-- ever ends up in the `authenticated` role (Decision 4).
alter table restaurants enable row level security;
alter table locations   enable row level security;

create policy restaurants_public_read on restaurants
  for select to anon, authenticated
  using (true);

create policy restaurants_admin_write on restaurants
  for all to authenticated
  using (true)
  with check (true);

create policy locations_public_read on locations
  for select to anon, authenticated
  using (true);

create policy locations_admin_write on locations
  for all to authenticated
  using (true)
  with check (true);
