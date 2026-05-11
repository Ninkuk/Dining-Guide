-- Restaurants schema refresh (Decisions 23, 27, 28, 30, 31a, 31b, 32).
--
-- Tightens existing constraints and adds new fields. Safe to run on the empty
-- table; backfill statements are idempotent no-ops when there are zero rows.

-- 31a — vegetarian: drop 'not_sure', use NULL for unknown.
alter table restaurants
  drop constraint if exists restaurants_vegetarian_check;
update restaurants set vegetarian = null where vegetarian = 'not_sure';
alter table restaurants
  add constraint restaurants_vegetarian_check
  check (vegetarian in ('yes', 'no'));

-- 27 — halal: same shape as vegetarian.
alter table restaurants
  add column halal text check (halal in ('yes', 'no'));

-- 28 — is_chain: first-class flag (CSV "Chain" marker becomes structured).
alter table restaurants
  add column is_chain boolean not null default false;
create index restaurants_is_chain_idx on restaurants(is_chain) where is_chain;

-- 30 — occasion: free text → bounded enum (Quick / Casual / Elevated / Fine Dine).
alter table restaurants
  drop constraint if exists restaurants_occasion_check;
update restaurants
   set occasion = case occasion
     when 'Everyday'    then 'Quick'
     when 'Nice-Casual' then 'Elevated'
     when 'Upscale'     then 'Fine Dine'
     else occasion
   end
 where occasion in ('Everyday', 'Nice-Casual', 'Upscale');
alter table restaurants
  add constraint restaurants_occasion_check
  check (occasion in ('Quick', 'Casual', 'Elevated', 'Fine Dine'));

-- 30 — wallet: personal-relative spend tier (inflation-proof by design).
alter table restaurants
  add column wallet text check (wallet in ('Cheap', 'Normal', 'Splurge', 'Big night'));

-- 31b — rating: tighten 0..5 to 1..5; NULL remains the unrated state.
alter table restaurants
  drop constraint if exists restaurants_rating_check;
update restaurants set rating = null where rating = 0;
alter table restaurants
  add constraint restaurants_rating_check
  check (rating between 1 and 5);

-- 23 — visited_at: when did I actually go (vs. when was the row created).
alter table restaurants
  add column visited_at date;

-- 32 — photo_url: single hero image; gallery deferred.
alter table restaurants
  add column photo_url text;
