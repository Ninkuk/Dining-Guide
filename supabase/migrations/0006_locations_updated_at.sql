-- Locations: add updated_at + trigger for parity with restaurants (Decision 31d).
--
-- The address column already exists from 0001 and stays — populated from
-- Nominatim's display_name when the user picks an autocomplete suggestion
-- (Decision 31c, overrode the original drop-the-column proposal).

alter table locations
  add column updated_at timestamptz not null default now();

create trigger locations_set_updated_at
  before update on locations
  for each row
  execute function set_updated_at();
