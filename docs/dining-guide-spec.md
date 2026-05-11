# Dining Guide — Project Spec

A personal CRUD web app to replace a Google Sheet of restaurants I've visited and want to try. Includes list, detail, map, and stats views. Production domain: `dining.ninkuk.com`.

> This document is the source of truth. Sections below reflect all decisions made during the design grilling. The full Decision Log is appended at the end.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Cache Components on)
- **DB + Backend:** Supabase (Postgres + JS client + RLS + Supabase Auth)
- **Auth:** Supabase Auth, magic link to a single admin user
- **Hosting:** Vercel (Hobby tier)
- **Map:** `react-leaflet` v5 + Leaflet 1.x + OpenStreetMap tiles (no API key)
- **Geocoding:** Nominatim (free; called from a server-side proxy at write time only; respects 1 req/sec)
- **Styling:** Tailwind CSS v4 + shadcn/ui (style: `radix-maia`, icons: `hugeicons`)
- **Forms:** React Hook Form + Zod, via shadcn's `<Form>` components
- **URL state:** `nuqs` for filter/sort/search synced to query params
- **Charts:** shadcn Charts (Recharts under the hood)
- **Theme:** `next-themes` (system default + toggle)
- **Toasts:** `sonner`
- **Testing:** Vitest (unit) + Playwright (one smoke flow, via the Playwright MCP)

Everything stays on free tiers. No paid APIs.

## Data Model

```sql
create table cuisines (
  name  text primary key,
  emoji text not null default '🍽️'
);
-- Seeded with ~55 entries (lib/cuisines.ts CUISINE_EMOJI). Source of truth for
-- the cuisine vocabulary (Decision 26). Emojis editable per row.

create table restaurants (
  id          bigint primary key generated always as identity,
  slug        text unique not null,
  name        text not null,
  cuisine     text[] not null default '{}',   -- canonical names only, no emojis
  occasion    text check (occasion in ('Quick','Casual','Elevated','Fine Dine')),
  wallet      text check (wallet in ('Cheap','Normal','Splurge','Big night')),
  rating      smallint check (rating between 1 and 5),
  vegetarian  text check (vegetarian in ('yes','no')),
  halal       text check (halal in ('yes','no')),
  is_chain    boolean not null default false,
  status      text not null default 'visited'
              check (status in ('visited','want_to_try')),
  visited_at  date,
  photo_url   text,
  notes       text,
  pros        text,
  cons        text,
  recommendations text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- integrity constraints (Decisions 16, 31a, 31b):
  check (length(btrim(name)) > 0),
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  check (slug not in ('map','stats','new','api','auth')),
  check (array_position(cuisine, '') is null)
);

create table locations (
  id            bigint primary key generated always as identity,
  restaurant_id bigint not null references restaurants(id) on delete cascade,
  city          text,
  locality      text,
  address       text,        -- Nominatim display_name, populated on autocomplete pick
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on locations(restaurant_id);
create index on restaurants(status);
create index on restaurants(is_chain) where is_chain;

-- updated_at auto-update trigger (applied to both tables)
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger restaurants_set_updated_at before update on restaurants
  for each row execute function set_updated_at();
create trigger locations_set_updated_at before update on locations
  for each row execute function set_updated_at();

-- Cuisine integrity trigger (Decision 26): every value in restaurants.cuisine[]
-- must exist in cuisines.name. Lighter than per-element FK, plays nicely with text[].
create or replace function check_cuisines_exist() returns trigger language plpgsql as $$
declare missing text;
begin
  if new.cuisine is null or array_length(new.cuisine, 1) is null then return new; end if;
  select c into missing from unnest(new.cuisine) c
   where c not in (select name from cuisines) limit 1;
  if missing is not null then
    raise exception 'Unknown cuisine: %. Insert into cuisines first.', missing;
  end if;
  return new;
end $$;

create trigger restaurants_check_cuisines
  before insert or update of cuisine on restaurants
  for each row execute function check_cuisines_exist();
```

**Model rules:**

- One row per restaurant. A chain (e.g., Chick-fil-A) is **one** restaurant with **many** locations. The `is_chain` boolean (Decision 28) preserves the explicit "this is a chain" classification from the source sheet and enables a future "hide chains" filter; it is independent of the location count (a chain you've never been to a specific branch of has 0 locations).
- Ratings and notes live at the restaurant level, not per location.
- `cuisine` is an array of canonical strings. **Emojis are NOT stored on `restaurants`** — the `cuisines` lookup table holds them per-row (Decision 26). The integrity trigger rejects writes to `restaurants.cuisine[]` containing values not present in `cuisines.name`.
- `lib/cuisines.ts` ships the seed list and a fallback emoji helper; once the migration runs, the DB is canonical and the form's Combobox queries `cuisines` directly.
- `vegetarian` and `halal` are 3-state fields encoded as 2 + NULL: `'yes'`, `'no'`, or `NULL` ("unknown"). There is no `'not_sure'` literal (Decision 31a) — NULL means the same thing.
- `occasion` is a personal-context vibe tag: `Quick` (counter service), `Casual` (sit-down), `Elevated` (nice but informal), `Fine Dine` (special occasion). Single-valued, nullable (Decision 30).
- `wallet` is a personal-relative spend tier: `Cheap`, `Normal`, `Splurge`, `Big night`. Inflation-proof by construction — anchors are *your* habits, not absolute dollars (Decision 30). Independent of `occasion`: the gap between vibe and wallet is the interesting signal (Elevated + Normal = rare gem; Casual + Splurge = trap).
- `rating` is `1..5` smallint, nullable. NULL = unrated (Decision 31b). The migration sets NULL for `☆☆☆☆☆` (zero filled stars) — these are visited-but-the-user-hadn't-rated-yet, not wishlist (Decision 24).
- `visited_at` is nullable; new rows default to `current_date` in the form (Decision 23). Migrated rows stay NULL — the source sheet has no chronology and no row-order inference is performed.
- `photo_url` is a single hero image (Decision 32); gallery deferred to a future phase. List card uses photo when present, falls back to a tinted block + cuisine emoji.
- `slug` is auto-generated from `name` (kebab-case via manual unicode-normalizing regex, no `slugify` dep) but editable. Forbidden values: `map`, `stats`, `new`, `api`, `auth` — enforced both in `lib/slug.ts` and as a Postgres CHECK constraint (kept in sync; comment on each pointing at the other).
- Slug uniqueness collision: handled inside the upsert RPC by appending `-2`, `-3`, ... in a retry loop (single round-trip, no race).
- Slug edits do NOT redirect from old slug — accept 404s. Single user, you control bookmarks.
- `locations.address` stores the full formatted address from Nominatim's `display_name` (Decision 31c); populated only when the user picks an autocomplete suggestion. Migrated rows have `address = NULL` and display city/locality only.
- `locations.locality` is descriptive free text (Decision 29) — `"Apache Blvd"`, `"close to friend X's house"`, both valid. Not normalized; not split on commas during migration.

### Atomicity

Restaurant + locations writes go through a Postgres function for true transaction safety:

```sql
create or replace function upsert_restaurant_with_locations(payload jsonb)
returns bigint language plpgsql as $$
-- handles create (no id) and update (with id) in a single transaction:
-- 1. insert/update restaurants row
-- 2. on insert: retry slug with -2/-3 suffix on unique_violation
-- 3. on update: diff existing locations vs payload — delete removed, update kept, insert new
-- returns the restaurant id
$$;
```

Server actions call `supabase.rpc('upsert_restaurant_with_locations', { payload })`. One call, atomic.

## Routes

| Path             | Purpose                                                               | Access                |
| ---------------- | --------------------------------------------------------------------- | --------------------- |
| `/`              | List view with filters, search, sort                                  | Public read           |
| `/map`           | Global map of all locations                                           | Public read           |
| `/stats`         | Aggregate analytics                                                   | Public read           |
| `/[slug]`        | Restaurant detail + mini-map of its locations                         | Public read           |
| `/new`           | Create restaurant                                                     | Auth-required (admin) |
| `/[slug]/edit`   | Edit restaurant + its locations                                       | Auth-required (admin) |
| `/auth/login`    | Magic-link request form                                               | —                     |
| `/auth/callback` | Supabase auth code → session exchange                                 | —                     |
| `/auth/logout`   | `signOut` then redirect                                               | —                     |
| `/api/geocode`   | Nominatim proxy (search + reverse), with 1.1s queue and Runtime Cache | —                     |

Note: paths use `/auth/*` (not the spec's original `/login`) to match the existing `@supabase/ssr` scaffolding.

## Auth Model

- **Supabase Auth** with magic link (`signInWithOtp({ email })`). One admin user provisioned manually via Supabase dashboard.
- **Signups disabled** in Supabase project settings → without this, anyone could `signInWithOtp` from any email and become "authenticated" with write access via RLS policy.
- `lib/supabase/proxy.ts` (Next 16 renamed middleware → proxy) calls `supabase.auth.getClaims()` on **every** request to refresh the session cookie, but only **redirects to `/auth/login`** when the path matches `/new`, `/(\w+)/edit`, or write API routes. Public pages remain public for unauthenticated visitors.
- **No `SUPABASE_SERVICE_ROLE_KEY` in app code.** Auth + RLS handle all runtime writes. The service role key is only used by the local CSV migration script.

### RLS

```sql
alter table restaurants enable row level security;
alter table locations   enable row level security;

create policy "public_read"  on restaurants for select to anon, authenticated using (true);
create policy "admin_write"  on restaurants for all     to authenticated using (true) with check (true);

create policy "public_read"  on locations   for select to anon, authenticated using (true);
create policy "admin_write"  on locations   for all     to authenticated using (true) with check (true);

alter table cuisines       enable row level security;
create policy "public_read"  on cuisines    for select to anon, authenticated using (true);
create policy "admin_write"  on cuisines    for all     to authenticated using (true) with check (true);
```

Anyone can read; any authenticated user can write. With signups off, only the manually-provisioned admin user is ever authenticated.

A `restaurant-photos` Supabase Storage bucket (Decision 32) follows the same shape: public read, authenticated write. Created in Phase 6 alongside the photo upload UI.

### Preview-deploy write block

Vercel preview deploys run against the same Supabase project as production (single-project topology — see "Environment Variables"). To prevent buggy preview server actions from corrupting prod data, every write action begins with:

```ts
if (process.env.VERCEL_ENV === "preview") {
  throw new Error("Writes are disabled on preview deployments.");
}
```

Previews are read-only "look at the change" deploys.

## Caching & Rendering

`cacheComponents: true` in `next.config.ts` (Next 16 Cache Components model).

- **Two tags — `restaurants` and `cuisines`**. Restaurant queries tag `restaurants`; the cuisines lookup query tags `cuisines` (changes only when you edit the vocabulary). Mutations to restaurants call `updateTag('restaurants')`; mutations to cuisines (rename, emoji edit, new entry) call `updateTag('cuisines')`. Every cacheable data fetcher in `lib/queries/` starts with:

  ```ts
  "use cache";
  cacheTag("restaurants");
  cacheLife("weeks");
  ```

- **Mutation actions** end with `updateTag('restaurants')` then `redirect(...)`. `updateTag` (not `revalidateTag`) because the admin needs read-your-own-writes — they should see their edit immediately on the next page render, not after a stale-while-revalidate window.
- **Auth-aware components are NOT inside `'use cache'` boundaries.** The "Edit" button rendered next to a restaurant when admin is logged in lives in a separate small dynamic Server Component that calls `getClaims()`. Co-located as a sibling to the cached page content.

## Feature Set (Locked)

### List view (`/`)

- Server Component fetches **all** restaurants once via `getAllRestaurants()` (cached); passes the array to a `<RestaurantList>` client island.
- Client island holds filter / sort / search state in `useState` + URL-synced via **nuqs** (multi-select arrays via `useQueryState('cuisine', { parse: parseAsArrayOf(parseAsString) })`).
- **Filter logic:** AND across categories, OR within a category. Filters: cuisine, city, rating, occasion, wallet, vegetarian, halal, status, plus a "Hide chains" toggle backed by `is_chain`.
- **Search:** case-insensitive substring on `name`. URL update debounced 300ms; in-memory filter immediate.
- **Sort:** name | rating desc | recently added (uses `created_at`) | recently visited (uses `visited_at desc nulls last`).
- **Layout:** responsive card grid — 1 col mobile, 2 cols `sm`, 3 cols `lg`. Each card shows: photo thumbnail (when `photo_url` is set; otherwise a tinted block in a cuisine-derived hue with the cuisine emoji), name, star rating, cuisine badges (emoji joined from the `cuisines` table), city pill, wallet pill (only when set), and a filled/outlined status indicator.
- **Empty states:**
  - No filter results: "No restaurants match these filters" + clear-all button (resets nuqs state).
  - No data at all: "No restaurants yet" + "Add your first" link (visible only when authed).

### Detail view (`/[slug]`)

- Full record: cuisine (with emojis from `cuisines` table), occasion, wallet, rating, vegetarian, halal, visited date, notes, pros, cons, recommendations. Photo (when present) renders as a hero image at the top.
- All locations listed with city/locality/address (address shown when populated; otherwise just city + locality).
- **Mini-map** showing the restaurant's pins. Uses `<RestaurantMap>` with `gestureHandling: true` (via `leaflet-gesture-handling` plugin) so vertical page scroll works on mobile — pan requires two fingers / cmd+scroll.
- Mini-map zoom: single location → center on it at zoom 14; multiple → `fitBounds` with padding.
- **Edit button** (auth-gated, dynamic Server Component sibling to the cached page body).

### Map view (`/map`)

- Full-bleed `<RestaurantMap>` with all locations as pins. `gestureHandling: false` here — single-finger pan is fine when the map is the whole page.
- Pin popup: restaurant name, star count, link to `/[slug]`.
- Visited vs `want_to_try` distinction: **two custom `L.divIcon` SVG markers** — filled (visited) vs outlined (want_to_try). Using divIcons sidesteps Leaflet's bundler issue with `marker-icon.png` defaults.
- OSM tile attribution rendered (`'© OpenStreetMap contributors'`) — required by OSM's terms.
- **Empty state:** map centered on Phoenix/Tempe at zoom 10 with a small overlay card "No locations to show."

### Stats view (`/stats`)

- Server Component pre-aggregates via `getStatsData()` (also tagged `restaurants`, `cacheLife('weeks')`).
- Returns `{ cuisineCounts, ratingDistribution, cityCounts, statusTotals, occasionCounts, walletCounts, dietaryCounts }` to a `<StatsCharts>` client component.
- **Charts:**
  - **Horizontal bar** (was "pie" in the original spec — changed; pies underperform bars beyond ~5 slices) for cuisine counts. Top N + "Other" if the long tail gets noisy.
  - **Bar** for rating distribution: discrete x-axis `1–5` plus an `unrated` bucket (covers rows with `rating IS NULL`).
  - **Horizontal bar** for city counts, sorted desc.
  - **Donut** (small) for the visited vs want_to_try split — pie's appropriate for a 2-slice ratio.
  - **Bar** for occasion distribution (Quick / Casual / Elevated / Fine Dine).
  - **Bar** for wallet distribution (Cheap / Normal / Splurge / Big night), with an `unset` bucket.
  - **Stacked bar** for dietary marker mix (vegetarian + halal yes/no/unknown).
  - **Stat cards** above the charts: "Visited: N" / "Want to try: N" / "Chains: N" / "Independents: N".
- **Empty state:** if fewer than ~3 restaurants, hide charts and show "Add a few restaurants to see stats."
- All charts use `npx shadcn add chart` (Recharts under the hood, themed by shadcn CSS vars).

### CRUD

- **Forms:** React Hook Form + Zod via shadcn `<Form>`. `useFieldArray` powers the dynamic locations editor (add/remove rows). Zod schemas in `lib/schemas/restaurant.ts`, **shared between client validation and server-action re-validation** — single source of truth.
- **Server actions** in `app/(admin)/_actions/restaurants.ts`: `createRestaurant`, `updateRestaurant`, `deleteRestaurant`. Each calls the upsert RPC (or `delete from restaurants where id = ?`), then `updateTag('restaurants')`, then `redirect(...)`. Each action begins with the preview-env write block.
- **Server-side validation errors** flow back to RHF via `setError(fieldName, ...)` from a typed `{ ok: false, errors: { … } }` response.
- **Delete:** shadcn `<AlertDialog>` modal — "Delete `Pizzeria Bianco`? This removes the restaurant and all 3 locations. Cannot be undone." `Cancel` / `Delete` (destructive variant). Posts to delete server action via a `<form>` inside the dialog.
- **Cuisine input:** shadcn `<Combobox>` + `<Command>`. Options sourced from the `cuisines` table (cached, tagged `cuisines`). Typing an unknown value surfaces a "Create '<typed>'" command at the bottom of the dropdown — clicking opens a small dialog (Decision 26c) with two `<Input>`s: name (prefilled) + emoji (single character, defaults to 🍽️ if blank). Confirming inserts a row into `cuisines` and selects it. Display labels show `{emoji} {name}`; stored values are bare canonical names. Zod rejects values containing `\p{Extended_Pictographic}` in the name field (separate from the emoji field).
- **Occasion / wallet inputs:** plain shadcn `<Select>` with the four CHECK-constrained values plus a "None" option for nullable.
- **Vegetarian / halal inputs:** three radio buttons each (Yes / No / Unknown). "Unknown" stores NULL.
- **Star input:** custom 5-button `<StarRating>` built on `lucide-react` `Star` (filled / outlined). ~30 lines, no library dep. Value range 1–5; clicking the lit star clears to NULL.
- **Visited-at input:** shadcn `<Calendar>` date picker; defaults to `current_date` for new restaurants, blank for migrated ones until edited.
- **Photo upload:** file `<Input>` (accept `image/*`), client-side resize to ≤1200px wide via canvas (JPEG quality 0.8, ≤200KB target), upload to `restaurant-photos` bucket via `supabase.storage`, store the public URL in `photo_url`. Single photo per restaurant; replacing uploads a new file and deletes the old one in the same server action.

### Geocoding

- **Server-side proxy at `/api/geocode`** wraps Nominatim's `/search` endpoint. Browser hits the proxy; the proxy adds the User-Agent header (`NOMINATIM_USER_AGENT` — server-only env var, no `NEXT_PUBLIC_` prefix) and calls Nominatim.
- **Rate limit:** in-memory token-bucket / delay-queue inside the route handler enforces ≥1.1s between Nominatim calls per Vercel function instance. Combined with client-side 300ms debounce, you cannot outrun OSM's policy.
- **Caching:** Vercel Runtime Cache wraps the Nominatim call, keyed by query string, TTL 7 days. Repeat queries (autocomplete partial overlaps; migration re-runs) become free.
- **Autocomplete UX:** address input on the create/edit form is a debounced (300ms, ≥3 chars) combobox calling `/api/geocode`. User picks a result; the response's `lat`, `lon`, and `display_name` populate the location row's hidden fields (`latitude`, `longitude`, `address` per Decision 31c).
- **Server-action safety net:** if a location row arrives at the server action with `latitude/longitude` already set (user picked from autocomplete), trust them. If null (user typed but didn't pick), the action calls `/api/geocode` itself once and fills them. Two paths, same proxy.
- **Geocoding never happens at page-load time.** The `/map` view reads stored lat/lng only.

## Environment Variables

| Var                                    | Local `.env.local`                                      | Vercel Production | Vercel Preview | Vercel Development |
| -------------------------------------- | ------------------------------------------------------- | ----------------- | -------------- | ------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | ✓                                                       | ✓                 | ✓              | ✓                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓                                                       | ✓                 | ✓              | ✓                  |
| `SUPABASE_SERVICE_ROLE_KEY`            | ✓ (script use only)                                     | —                 | —              | —                  |
| `NOMINATIM_USER_AGENT`                 | ✓ (e.g. `dining-guide (contact: ninadk.dev@gmail.com)`) | ✓                 | ✓              | ✓                  |

**Notes vs. the original spec:**

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is now `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's renamed key).
- `ADMIN_PASSWORD` and `SESSION_SECRET` removed — replaced by Supabase Auth.
- `NEXT_PUBLIC_NOMINATIM_USER_AGENT` becomes server-only `NOMINATIM_USER_AGENT` since the geocoding proxy is server-side; your contact email no longer ships in the client bundle.

## Data Migration

The existing data is a CSV (`Dining_Guide_-_List.csv`) with columns: `Name, Cuisine, Occasion, City, Locality, Rating, Vegetarian Friendly?, Notes, Cons, Pros, Recommendations`.

**Runtime:** `npx tsx scripts/migrate-csv.ts` (devDep `tsx`).

**Location:** CSV at `scripts/data/Dining_Guide_-_List.csv` — **gitignored** (your private data, do not commit). Script reads `--csv <path>` flag, defaulting to that location.

**Idempotency / safety guards:**

- Default behavior: refuse to run if `restaurants` table is non-empty. Prints "table has rows; pass --clean to wipe & re-import or --append to add only new."
- `--clean`: `delete from restaurants` (cascades to locations) then full insert.
- Top-of-script confirmation: prints `SUPABASE_URL` and prompts for `yes` typed in the terminal before proceeding. Defense against accidentally pointing at prod with `--clean`.

**Pre-migration CSV cleanup (minimal):** for rows where `City` was just `"Chain"` with no actual cities listed, edit `City` to include the actual cities you visited (comma-separated). The locality column stays as freeform prose — no editing needed there. Example: `City="Chain"` / `Locality="Arrowhead, Chandler"` → `City="Chain, Glendale, Chandler"` / `Locality="Arrowhead, Chandler"` (locality preserved verbatim as a note; cities drive the location split).

**Migration rules:**

1. **Skip empty rows** where `Name` is empty.
2. **Parse rating from star characters:** count `★` filled stars (1..5). `☆☆☆☆☆` → `rating = null`. All migrated rows get `status = 'visited'` regardless of star count (Decision 24) — `☆☆☆☆☆` rows are visited-but-unrated, not wishlist.
3. **De-duplicate by name** — same `Name` becomes **one restaurant with N locations**.
4. **Cuisine seeding (Decision 26):** before inserting any restaurant, gather all distinct cuisines from the CSV (after stripping emojis with `value.replace(/\p{Extended_Pictographic}/gu, '').trim()`). Upsert each into the `cuisines` table — emoji defaults to the value in the seed table if it exists, else `🍽️`. Then insert restaurants normally. The integrity trigger now allows `cuisine[]` writes because every value exists in `cuisines.name`.
5. **Cuisine canonicalization:** the source CSV uses `Burger` (singular) — that is the canonical form (Decision 26b). The seed list aligns.
6. **Vegetarian mapping (Decision 31a):** `Yes` → `'yes'`, `No` → `'no'`, anything else (including `Not sure` and blank) → `NULL`. `halal` stays `NULL` for all migrated rows; you fill in over time.
7. **Occasion mapping (Decision 30):** strip emoji, then map `Everyday → 'Quick'`, `Casual → 'Casual'`, `Nice-Casual → 'Elevated'`, `Upscale → 'Fine Dine'`. Blank stays NULL. `wallet` stays NULL on import.
8. **Chain detection (Decision 28):** if any of the row's `City` or `Locality` cells (post-comma-split) contain the literal `Chain`, set `is_chain = true`. The "Chain" token itself is dropped from the city/locality values written to `locations`.
9. **Locations from City + Locality (Decision 29 — simplified):**
   - **City drives location count.** Strip the literal `Chain` token from city values; split the remainder on commas; trim. Each surviving city becomes one location row.
   - **Locality is freeform prose, never split.** It's preserved verbatim and shared across all locations the row produces (acceptable lossy duplication — the user can clean up post-import via the admin UI if a specific locality should only attach to one location).
   - When the only city value was `Chain` (no other cities) AND `Locality` is non-empty, create **one** location with `city = NULL` and the locality verbatim — preserves the user's note. When both are empty, **zero** locations (`is_chain = true` with no specific branch known) — that's a valid state.
10. **Slug generation:** kebab-case via `lib/slug.ts`. Collision handled by the upsert RPC's retry loop (script uses the same RPC).
11. **Geocoding:** for each location, build a query like `"{locality}, {city}, AZ, USA"` and call Nominatim's `/search` endpoint **directly from the script** (not via the `/api/geocode` proxy — the proxy needs the app deployed; the script must run standalone). Use the same User-Agent header. Sleep 1.1s between requests. On success, store `lat`, `lon`, **and** the response's `display_name` into `locations.address` (Decision 31c). On failure: insert location with `latitude/longitude/address = null`, append the row to `scripts/migration-failures.json`.
12. **Visited_at:** stays NULL for all migrated rows (Decision 23) — no row-order inference performed.
13. **Photo URL:** stays NULL for all migrated rows; the source sheet has no photos.
14. **Cuisine emoji audit:** at the end of the script, log any cuisines that were inserted into the `cuisines` table with the fallback `🍽️` emoji — so you can edit them before they show up as fallbacks in the UI.
15. **Final summary:** print restaurant count, location count, chain count, geocode-success / geocode-fail counts, and the cuisines-with-fallback-emoji list.

All migrated entries get `status = 'visited'`; `want_to_try` is reserved for new wishlist additions going forward.

## Project Structure

```
/app
  /(public)
    page.tsx                  # list view
    /map/page.tsx
    /stats/page.tsx
    /[slug]/page.tsx          # detail view
  /(admin)
    /new/page.tsx
    /[slug]/edit/page.tsx
    /_actions/restaurants.ts  # createRestaurant, updateRestaurant, deleteRestaurant
  /auth
    /login/page.tsx
    /callback/route.ts
    /logout/route.ts
  /api
    /geocode/route.ts         # server-side Nominatim proxy with queue + Runtime Cache
  layout.tsx                  # ThemeProvider, Header, sonner Toaster, metadata
  error.tsx                   # global error boundary
  loading.tsx                 # default page skeleton

/components
  Header.tsx
  ThemeToggle.tsx
  RestaurantCard.tsx
  RestaurantList.tsx          # client island for list page
  FilterPanel.tsx
  RestaurantMap.tsx           # react-leaflet wrapper, props: { markers, fitBounds?, center?, zoom?, gestureHandling? }
  StarRating.tsx              # display + input variants
  CuisineBadge.tsx
  StatusIndicator.tsx
  AddressAutocomplete.tsx     # combobox driving /api/geocode
  CuisineCombobox.tsx
  LocationsFieldArray.tsx     # RHF useFieldArray editor
  StatsCharts.tsx             # client component, takes pre-aggregated data
  DeleteRestaurantDialog.tsx  # AlertDialog wrapper
  ui/                         # shadcn components

/lib
  supabase/
    client.ts                 # browser client
    server.ts                 # SSR client
    proxy.ts                  # session refresh + write-route guard (Next 16 rename)
    database.types.ts         # generated by `supabase gen types typescript`
  queries/
    restaurants.ts            # cacheable getters: getAllRestaurants, getBySlug, getForMap, getStatsData
    cuisines.ts               # cacheable getter: getCuisines (tagged 'cuisines')
  schemas/
    restaurant.ts             # Zod schemas (shared client + server)
    cuisine.ts                # Zod schema for the create-cuisine dialog
  cuisines.ts                 # seed CUISINE_EMOJI map + fallback helper (DB-canonical post-migration)
  slug.ts                     # kebab-case + forbidden-list (kept in sync with DB CHECK)
  rating.ts                   # star characters <-> int
  geocode.ts                  # low-level Nominatim wrapper with 1.1s queue (used by proxy + migration)
  utils.ts                    # cn() etc.

/scripts
  migrate-csv.ts              # one-time CSV importer
  data/
    Dining_Guide_-_List.csv   # gitignored

/supabase
  migrations/
    0001_init.sql             # tables, indexes, constraints, triggers, RLS policies
    0002_upsert_rpc.sql       # upsert_restaurant_with_locations function
  config.toml                 # generated by `supabase init`

proxy.ts                      # Next 16 file convention; imports updateSession from lib/supabase/proxy
next.config.ts                # cacheComponents: true
```

## Loading, Error, and Empty States

- **Loading:** `app/loading.tsx` (generic page skeleton — rarely seen due to caching). `app/map/loading.tsx` (full-bleed gray rectangle for the map). Form buttons use RHF `formState.isSubmitting` for spinner + disable. Autocomplete dropdown shows inline spinner during `isPending`.
- **Errors:** `app/error.tsx` (client component) for unexpected RSC/render errors. Server-action failures surface via `sonner` `toast.error(...)`. Network failures in autocomplete: show "Couldn't load suggestions" inline with retry.
- **Empty states:** see per-view sections above.

## Testing

- **Vitest** unit tests in `lib/__tests__/`:
  - `slug.test.ts` — kebab-case from various names, forbidden-list rejects, collision suffix
  - `rating.test.ts` — star chars → int, including `null` cases
  - `cuisines.test.ts` — emoji strip, split, dedup
  - `migration-csv.test.ts` — sample CSV row → expected payload
- **Playwright** (one smoke flow via the MCP): public visitor loads `/`, sees a card, clicks into a detail page, sees the mini-map.
- **Skip:** component tests, server-action integration tests. TypeScript + Zod cover most of what they would.

## Observability

- **Vercel function logs** capture `console.error` from server actions and route handlers.
- **Sonner toasts** surface client-side errors to the user.
- **Vercel Web Analytics** (free, GDPR-friendly) for traffic visibility.
- **No Sentry initially.** Single user, you'll see your own errors.

## Write Protection (summary)

Reads are public. Writes are protected by:

1. RLS policies (anon SELECT only; authenticated ALL)
2. Supabase Auth (one admin user; signups disabled at the project level)
3. Middleware redirect to `/auth/login` for unauthenticated requests to `/new`, `/[slug]/edit`, write API routes
4. Preview-env write block in every server action (`if (VERCEL_ENV === 'preview') throw`)

## Acceptance Criteria

- [ ] All non-empty CSV rows imported with correct ratings, cuisines, statuses, occasions, and locations.
- [ ] `is_chain` is `true` for every restaurant whose CSV row mentioned "Chain"; chain rows with no specific branch listed have zero locations.
- [ ] All migrated `vegetarian` values are `'yes'`, `'no'`, or NULL — no `'not_sure'` literal anywhere; same for `halal`.
- [ ] Migrated `occasion` values are exactly `Quick`, `Casual`, `Elevated`, `Fine Dine`, or NULL.
- [ ] Cuisines table is seeded; every restaurant's `cuisine[]` values exist in `cuisines.name`; the integrity trigger rejects writes with unknown cuisines.
- [ ] `Burger` (singular) is the canonical form; no `Burgers` rows exist anywhere.
- [ ] Cuisine values stored without emoji characters; UI joins emoji from `cuisines.emoji` at render time.
- [ ] Migration script's "fallback emoji" report is empty (or the gaps are resolved before deploy).
- [ ] List view filters and search work and combine correctly (multi-select filters AND across categories, OR within); the new filters (occasion, wallet, halal, hide-chains) are functional.
- [ ] List filter/sort/search state synced to URL via nuqs; refresh preserves state; back button undoes filter changes.
- [ ] List sort by "Recently visited" orders by `visited_at desc nulls last`.
- [ ] Map view renders every location with the right popup; `want_to_try` pins are visually distinct from visited pins.
- [ ] Mini-map on detail page does not trap mobile vertical scroll (gesture-handling enabled).
- [ ] Stats page renders cuisine bar, rating bar (1–5 + unrated), city bar, status donut, occasion bar, wallet bar, dietary stacked bar, and four stat cards from live data.
- [ ] CRUD works end-to-end including dynamic add/remove of locations during edit, photo upload/replace, and the create-new-cuisine inline dialog.
- [ ] Photo upload resizes images client-side to ≤1200px wide and ≤200KB before upload; replacing a photo deletes the old object from Storage in the same server action.
- [ ] Address autocomplete returns suggestions; selecting one prefills `latitude`, `longitude`, **and** `address` (from `display_name`); the form's server action does not re-geocode when lat/lng are already provided.
- [ ] Public visitors can read everything; visiting `/new` or `/[slug]/edit` while unauthenticated redirects to `/auth/login`.
- [ ] Magic-link login works; logout returns to `/`.
- [ ] Geocoding only happens at write-time. `/map` view makes zero Nominatim calls.
- [ ] `/api/geocode` enforces the 1.1s rate limit even under rapid autocomplete typing.
- [ ] Server actions throw on `VERCEL_ENV === 'preview'`.
- [ ] Site is responsive on phone, dark mode toggleable, default respects system preference.
- [ ] Vitest unit tests pass; Playwright smoke test passes.
- [ ] Deployed on Vercel with custom domain `dining.ninkuk.com`.

---

## Build Sequence

Eight phases. Don't start the next until the current is green.

### Phase 0 — Foundation — ✅ Complete

- ✅ Vercel CLI installed globally (`npm i -g vercel`)
- ✅ Project linked (`vercel link` → `ninadkdev-9482s-projects/dining-guide`); `.vercel/` present
- ✅ GitHub repo connected to Vercel project (auto-deploys + preview URLs configured)
- ✅ Supabase project exists (ref `ywnuavooexnxmaonskfh`); MCP wired in `.mcp.json`
- ✅ `.env.local` contains all 4 vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NOMINATIM_USER_AGENT`
- ✅ Vercel envs set across Development/Preview/Production for the 3 public-side vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NOMINATIM_USER_AGENT`). Service-role correctly absent.
- ✅ `npx supabase init` ran; `supabase/config.toml` + `supabase/migrations/` directory exist
- ⏭️ `supabase login` + `supabase link` skipped — replaced by Supabase MCP for migrations & type generation (Decision 16 + MCP availability)
- ✅ Runtime deps installed: `next-themes nuqs react-leaflet leaflet leaflet-gesture-handling react-hook-form zod @hookform/resolvers papaparse sonner`
- ✅ Dev deps installed: `tsx vitest @vitest/ui dotenv @types/leaflet @types/papaparse`
- ✅ shadcn components added: `input form select badge card popover dropdown-menu chart sonner skeleton separator label textarea alert-dialog dialog command` + `input-group` (bonus from CLI). `form.tsx` written manually because the `radix-maia` style's registry entry was incomplete.
- ✅ `cacheComponents: true` in `next.config.ts`
- ✅ `.gitignore` extended with `/scripts/data/`, `/scripts/migration-failures.json`, `/supabase/.branches/`, `/supabase/.temp/`
- ✅ `npx tsc --noEmit` passes clean
- ✅ Admin user created in Supabase (confirmed via MCP `select … from auth.users`): `ninadk.dev@gmail.com`, email confirmed at `2026-05-10 22:43:43+00`
- ⏳ **Pending verification (not MCP-queryable, will live-test):** Authentication → Providers → "Enable email signups" set to OFF. Verification plan: after Phase 1's `/auth/login` is built, attempt `signInWithOtp` with an unrelated email — a 403/disabled response confirms signups are off; a 200 means signups are still on and need to be disabled before any write paths are exposed.

### Phase 1 — Schema, RLS, auth (foundation gate) — ✅ Complete

- ✅ `supabase/migrations/0001_init.sql` — tables, indexes, constraints, `updated_at` trigger, RLS policies. Applied via Supabase MCP `apply_migration` (replaces `supabase db push`).
- ✅ `supabase/migrations/0002_upsert_rpc.sql` — `upsert_restaurant_with_locations`. Smoke-tested end-to-end (insert, slug-collision retry → `pizzeria-bianco-2`, locations diff: keep/delete/insert, then update returning rating change).
- ➕ `supabase/migrations/0003_function_search_path.sql` — added in response to Supabase advisor `function_search_path_mutable`. Pins `search_path = public, pg_temp` on both `set_updated_at()` and `upsert_restaurant_with_locations()` to block search-path injection. Other advisor warnings (`rls_policy_always_true` on the admin write policies, leaked-password protection) are by design — single-admin model, magic-link only.
- ➕ **Phase 1.5 (post-grilling refresh, Decisions 23–32)** — schema overhaul from the data-model grilling. Applied four new migrations:
  - `0004_cuisines_table.sql` — lookup table (~55 seed rows), RLS, and `check_cuisines_exist()` trigger on `restaurants`.
  - `0005_restaurants_v2.sql` — drop `'not_sure'` from vegetarian; add `halal`, `is_chain`, `wallet`, `visited_at`, `photo_url`; tighten `rating` to `1..5`; map `occasion` values (Everyday→Quick / Nice-Casual→Elevated / Upscale→Fine Dine) and add CHECK.
  - `0006_locations_updated_at.sql` — add `updated_at` + trigger.
  - `0007_upsert_rpc_v2.sql` — extend the upsert RPC to accept the new payload keys (`wallet`, `halal`, `is_chain`, `visited_at`, `photo_url`). Smoke-tested end-to-end: insert with all new fields succeeded; cuisine-integrity trigger correctly rejected an unknown cuisine.
  - Types regenerated → `lib/supabase/database.types.ts`.
  - Advisors re-run after the refresh: no new security issues. One new performance note (`multiple_permissive_policies` on the three `*_admin_write` policies due to `FOR ALL` overlapping with `*_public_read` SELECT) — cosmetic at this scale, optional 5-line follow-up migration could split admin policies into explicit INSERT/UPDATE/DELETE.
- ✅ Types generated via Supabase MCP `generate_typescript_types` → `lib/supabase/database.types.ts`. Both `lib/supabase/client.ts` and `server.ts` now type-parameterize as `createBrowserClient<Database>` / `createServerClient<Database>`.
- ✅ Signups confirmed disabled — `POST /auth/v1/otp` with an unrelated email returned `HTTP 422 signup_disabled` ("Signups not allowed for this instance"). Admin user already confirmed in Phase 0.
- 🔄 **Renamed `middleware` → `proxy`** (Next 16 breaking change — `middleware.ts` file convention is deprecated as of v16.0.0). Concretely: root file is `proxy.ts` (not `middleware.ts`); helper module is `lib/supabase/proxy.ts` (not `lib/supabase/middleware.ts`); function exports are `proxy` and `updateSession` respectively. Behavior matches spec: `getClaims()` on every request, redirect to `/auth/login?next=<path>` only when `pathname` matches `/new` or `/[slug]/edit` (write-route patterns are a `readonly RegExp[]`). Public reads stay public.
- ✅ Built `/auth/login` (server-action `requestMagicLink`, success → `?sent=<email>`, failure → `?error=<message>`), `/auth/callback` (PKCE `exchangeCodeForSession`, `next` validated to start with `/`), `/auth/logout` (POST-only, 303 redirect to `/`).
- 🔄 `/auth/login/page.tsx` wraps the dynamic body (the part that awaits `searchParams`) in `<Suspense fallback={<LoginFormSkeleton />}>`. Required by `cacheComponents: true` — uncached data access at the top of a page is treated as a build-blocking error.
- ✅ `npx tsc --noEmit`, `npx eslint`, `npx next build` all clean. Build report shows `/auth/login` as `◐ Partial Prerender`, callback/logout as `ƒ Dynamic`, Proxy listed.

### Phase 2 — Shell + list view — ✅ Complete

- ✅ `cacheComponents: true` in `next.config.ts` (carried from Phase 0)
- ✅ `lib/cuisines.ts` (43-entry seed map + `getCuisineEmoji` / `findUnknownCuisines` / `getKnownCuisines`), `lib/slug.ts` (`FORBIDDEN_SLUGS` + `slugify` + `isValidSlug`), `lib/rating.ts` (`starsToInt` / `intToStars` / `MAX_RATING`).
- ✅ Vitest 4 wired up — `vitest.config.ts` (node env, alias `@`), `npm test` / `test:watch` / `test:ui` scripts. **35 tests / 3 files passing** for slug, rating, cuisines (covers diacritic stripping, reserved-list parity with DB CHECK, unrated convention, fallback emoji, etc.).
- ➕ `lib/supabase/anon.ts` — cookie-free `createAnonClient()` for use inside `'use cache'` boundaries (the cookies-bound `lib/supabase/server.ts` cannot be called from cached functions). Reads are gated by the `*_public_read` RLS policies, so anon is sufficient.
- ✅ `lib/queries/restaurants.ts` — `getAllRestaurants`, `getRestaurantBySlug`, `getForMap`, `getStatsData`. Each starts with `'use cache'` + `cacheTag('restaurants')` + `cacheLife('weeks')`. Stats reuses the cached restaurants payload (composes cleanly across cached functions).
- ✅ `app/layout.tsx` — real metadata (`title.template`, description, `metadataBase = https://dining.ninkuk.com`), `<ThemeProvider>` (system default, `disableTransitionOnChange`), `<NuqsAdapter>` (Next App Router adapter for nuqs URL sync), `<Header>`, `<Toaster richColors position="top-right" />`. `suppressHydrationWarning` on `<html>` because next-themes mutates the class.
- ✅ `<Header>` (Server Component) — sticky, brand + List/Map/Stats nav + `<ThemeToggle>` + auth-aware `<AdminSlot />` wrapped in `<Suspense fallback={Skeleton}>`. AdminSlot reads `getClaims()` to decide between "Sign in" and "+ Add / Sign out". Pattern matches spec §Caching: auth-aware components live OUTSIDE `'use cache'` boundaries.
- ✅ `<ThemeToggle>` — dropdown with Light / Dark / System (next-themes `useTheme`), Sun ↔ Moon icon swap via Tailwind `dark:` variant.
- ✅ Display components — `<StarRating>` (lucide Star, amber-400 fill, "Unrated" pill when `value == null`), `<CuisineBadge>` (shadcn Badge + `getCuisineEmoji`), `<StatusIndicator>` (filled emerald chip for `visited`, dashed amber chip for `want_to_try`), `<RestaurantCard>` (Link wrapper, name + StatusIndicator, StarRating, cuisine badges, primary city + "+N more" hint).
- ✅ List view at `/app/(public)/page.tsx` (route group introduced now) — Server Component fetches `getAllRestaurants()` inside a `<Suspense fallback={ListSkeleton}>` per Cache Components conventions. Empty-state branch when zero rows ("No restaurants yet" → `/auth/login`).
- ✅ `<RestaurantList>` client island — single source of truth for filter/sort/search state via nuqs (`q`, `cuisine`, `city`, `rating`, `occasion`, `veg`, `status`, `sort`). `q` uses `parseAsString.withOptions({ throttleMs: 300 })` so the URL push is debounced 300ms while the in-memory filter updates synchronously (matches spec §List view exactly).
- ✅ `<FilterPanel>` — search input with inline clear, six multi-select dropdowns (cuisine/city/rating/vegetarian/status/occasion) using `DropdownMenuCheckboxItem` with `onSelect={e => e.preventDefault()}` so the menu stays open across multiple toggles, sort dropdown using `DropdownMenuRadioGroup`, "Clear all" only when filters are active, "Showing N of M" count.
- ✅ Browser-verified end to end: header + filter panel + cards render, "City: Phoenix" filter narrows 3→1 with URL sync (`?city=Phoenix`) and Clear-all appearance, dark-mode toggle preserves filter state across re-render. Test data inserted then deleted; sequences reset; DB is empty for Phase 3 CSV import.
- ✅ `npm test` / `npx tsc --noEmit` / `npx eslint` / `npx next build` all clean. Build report: `/` is `◐ Partial Prerender` with `Revalidate 1w` (matching `cacheLife('weeks')`).

### Phase 3 — CSV migration (need data for next views)

- **Manual prework:** open `scripts/data/Dining Guide - List.csv` and clean the 19 multi-location rows per the "Pre-migration CSV cleanup" rules above. Estimated 10 minutes.
- `lib/geocode.ts` (Nominatim wrapper with 1.1s queue)
- `scripts/migrate-csv.ts` — implements rules 1–15 in §Data Migration including: cuisines-table seeding before restaurant inserts, occasion remapping, `is_chain` detection, locality verbatim preservation, `display_name` capture from Nominatim.
- Place CSV at `scripts/data/Dining Guide - List.csv`
- Run `npx tsx scripts/migrate-csv.ts --clean`; review the fallback-emoji report and the failures log; edit any cuisine emojis still showing 🍽️.

### Phase 4 — Map + detail

- `<RestaurantMap>` (react-leaflet, custom divIcons, gesture-handling toggle)
- `/map` (gestureHandling off)
- `/[slug]` detail + mini-map (gestureHandling on)

### Phase 5 — Stats

- `getStatsData()` aggregator
- `/stats` with shadcn Charts

### Phase 6 — CRUD

- `app/api/geocode/route.ts` (proxy + queue + Runtime Cache)
- `lib/schemas/restaurant.ts` (Zod) — covers the new fields: `wallet`, `halal`, `is_chain`, `visited_at`, `photo_url`, plus the cuisine-array and occasion enum constraints.
- `lib/schemas/cuisine.ts` (Zod) — the create-cuisine dialog's name + emoji validation.
- `app/(admin)/_actions/restaurants.ts` (with preview-env write block) — extended to handle photo upload/delete to the `restaurant-photos` Supabase Storage bucket.
- `app/(admin)/_actions/cuisines.ts` — `createCuisine` server action used by the inline dialog; calls `updateTag('cuisines')`.
- Create `restaurant-photos` Supabase Storage bucket (public read, authenticated write).
- `<CuisineCombobox>` (with create-new dialog), `<LocationsFieldArray>`, `<AddressAutocomplete>` (now stores `display_name` into address), `<PhotoUpload>` (resize + upload), `<VisitedAtPicker>`.
- `/new` page
- `/[slug]/edit` page
- `<DeleteRestaurantDialog>` flow

### Phase 7 — Polish & tests

- Empty / loading / error states + skeletons across pages
- Vitest unit tests (most already written in Phases 2–3)
- Playwright smoke flow via MCP
- Mobile pass on phone
- Vercel Web Analytics on

### Phase 8 — Deploy

- Connect GitHub repo → Vercel project
- First prod deploy from `master`
- Add `dining.ninkuk.com` in Vercel → set DNS → verify with `dig`
- Smoke-test the live site

---

## Decision Log

Locked decisions from the design grilling. Each entry: chosen option + one-line rationale.

| #   | Topic                       | Decision                                                                                                                                                                        | Why                                                                               |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Auth model                  | Supabase Auth (not custom password+cookie)                                                                                                                                      | RLS becomes the safety net; less custom code; `@supabase/ssr` already scaffolded. |
| 2   | Login method                | Magic link                                                                                                                                                                      | No credentials to manage; free; great UX for occasional admin login.              |
| 3   | Auth route paths            | `/auth/login`, `/auth/callback`, `/auth/logout`                                                                                                                                 | Matches scaffold; cleaner grouping than spec's flat `/login`.                     |
| 4   | RLS shape                   | Anon SELECT, authenticated ALL; signups disabled; service-role-key script-only                                                                                                  | Simplest correct setup for single admin.                                          |
| 5   | Write dispatch              | Server Actions                                                                                                                                                                  | App Router idiom; pairs with `updateTag` and `redirect`.                          |
| 6   | Atomicity                   | Postgres RPC `upsert_restaurant_with_locations`                                                                                                                                 | True transactions; clean two-table edit logic in SQL.                             |
| 7   | Form architecture           | RHF + Zod via shadcn `<Form>`                                                                                                                                                   | `useFieldArray` for dynamic locations; shared Zod schemas.                        |
| 8   | Geocoding placement         | Server-side `/api/geocode` proxy + client autocomplete                                                                                                                          | Keeps User-Agent server-only; better UX than blur-to-geocode.                     |
| 9   | Geocoding rate-limit        | In-memory 1.1s queue + Vercel Runtime Cache                                                                                                                                     | Honors Nominatim policy; cache helps repeat lookups + migration re-runs.          |
| 10  | Map library                 | `react-leaflet` v5 + dynamic import                                                                                                                                             | Declarative, idiomatic; handles React-lifecycle pitfalls.                         |
| 11  | Slugs                       | Forbidden list `map/stats/new/api/auth`; manual regex slugify; no slug-change redirects; RPC retry loop for collisions                                                          | Zero-dep slug; defense-in-depth via DB CHECK; YAGNI on redirect tables.           |
| 12  | Caching                     | `cacheComponents: true`, single `restaurants` tag, `cacheLife('weeks')`, `updateTag` in actions                                                                                 | Static-render speed for public; instant read-your-own-writes for admin.           |
| 13  | List filters                | Server fetches all rows (cached); client filter island; URL state via nuqs; substring search                                                                                    | Right shape for hundreds-of-rows scale.                                           |
| 14  | Stats                       | Server pre-aggregates; shadcn Charts; cuisine = horizontal bar (not pie); donut for visited/want-to-try                                                                         | Better data viz than the original pie spec; smaller payloads.                     |
| 15  | Migration script            | `tsx`; `--clean` flag with confirmation; direct Nominatim (not via proxy); failures log                                                                                         | Safe-by-default; standalone (no app dependency).                                  |
| 16  | Schema                      | Supabase CLI migrations; +`updated_at` trigger; +slug regex/forbidden CHECK; +name non-empty; +lat/lng range; gen types                                                         | Version-controlled schema; defense in depth.                                      |
| 16b | Cuisine storage (corrected) | Canonical strings only in DB; emoji map in `lib/cuisines.ts`; CSV migration strips emojis                                                                                       | Clean data; no mojibake; emoji map editable in code.                              |
| 17  | UI shell                    | Sticky top header; dark mode w/ toggle (`next-themes`); responsive card grid; custom `<StarRating>`; shadcn Combobox for cuisine; filled/outlined visited/want-to-try indicator | In-grain with shadcn; minimal new deps.                                           |
| 18  | Deployment                  | Single Supabase project for all envs; preview-env write block in actions; server-only `NOMINATIM_USER_AGENT`; install Vercel CLI; GitHub integration                            | Lowest setup cost; preview previews are read-only.                                |
| 19  | Loading/error/empty         | `loading.tsx` + Suspense + RHF `isSubmitting`; `app/error.tsx` + sonner toasts; specific empty states per view                                                                  | Standard Next 16 patterns; sonner mounted once.                                   |
| 20  | Testing & observability     | Vitest for parsing helpers + 1 Playwright smoke; Vercel logs + sonner + Web Analytics; no Sentry initially                                                                      | Cheap targeted tests; minimal observability surface.                              |
| 21  | UX gotchas                  | `leaflet-gesture-handling` plugin (mini-map only); shadcn `<AlertDialog>` for delete confirmation                                                                               | Avoids mobile scroll trap; idiomatic confirm pattern.                             |
| 22  | Build sequence              | Eight phases (above), executed in order, current must be green before next                                                                                                      | Respects dependency graph between schema, data, queries, views, CRUD.             |
| 23  | Visit chronology            | Add `visited_at date NULL` on `restaurants`. New rows default to `current_date`; migrated rows stay NULL (no row-order inference)                                                | Restores temporal axis for new data; honest about historical fidelity loss.       |
| 24  | Migrated row status         | All migrated rows → `status = 'visited'`; `☆☆☆☆☆` → `rating = NULL` (visited-but-unrated, not wishlist)                                                                          | Matches user's actual sheet semantics — stars were skipped, not absent intent.    |
| 25  | Free-text columns           | Keep `notes` + `pros` + `cons` + `recommendations` as four separate columns                                                                                                      | User commits to disciplined per-column usage going forward.                       |
| 26  | Cuisine integrity           | Lookup table `cuisines (name PK, emoji)` as source of truth; trigger enforces `restaurants.cuisine[]` ⊂ `cuisines.name`                                                          | Eliminates typo drift; makes renames safe; centralizes emoji.                     |
| 26b | Cuisine canonicalization    | `Burger` (singular) is canonical; the seed list aligns                                                                                                                           | User preference — matches the source CSV verbatim.                                |
| 26c | Cuisine create UX           | shadcn Combobox with confirm-to-add; inline dialog has name + emoji `<Input>`; emoji defaults to 🍽️ if blank                                                                     | Inline create avoids a separate admin page; emoji-at-create avoids stale defaults. |
| 27  | Halal as dietary marker     | Add `halal text check (halal in ('yes','no')) NULL` mirroring `vegetarian`                                                                                                       | Two markers is YAGNI-appropriate; junction-table refactor deferred to 4+ markers. |
| 28  | Chain flag                  | Add `is_chain boolean not null default false`. Migration sets true when CSV mentions "Chain"                                                                                     | Preserves user's classification work; enables "hide chains" filter.               |
| 29  | Locality semantics          | `locality` is freeform prose, never split. **City drives location count.** Pre-edit only the rows where `City="Chain"` alone (add the actual cities); locality stays verbatim and is shared across the city splits | Honors actual usage; minimizes manual cleanup; lossy locality duplication is cosmetic. |
| 30  | Spend / vibe two-axis       | Replace `occasion` (free text) with two enums: `occasion in ('Quick','Casual','Elevated','Fine Dine')` + `wallet in ('Cheap','Normal','Splurge','Big night')`                    | Avoids inflation-broken $$$ system; separates conflated dimensions.               |
| 31  | Schema cleanups             | (a) drop `'not_sure'` from `vegetarian`, use NULL; (b) tighten `rating` to `1..5`; (c) keep `address` on `locations`, populate from Nominatim `display_name`; (d) `updated_at` on `locations` | Removes redundant states; aligns ranges with reality; provides street-level recall. |
| 32  | Photos                      | Add `photo_url text NULL` on `restaurants` + Supabase Storage bucket `restaurant-photos`. Single hero photo; gallery deferred                                                    | Visual recall is core to a dining guide; opportunistic add as you re-encounter places. |
