# Design Memory

Patterns that govern UI work in this repo, captured from the public-list-page Design Lab on 2026-05-10. Update this file when a future session changes any of these decisions.

## Brand tone

- **Adjectives:** playful / personal · editorial / warm · minimal / refined.
- **Synthesis:** a hand-curated personal dining journal that still feels typographically refined. Not a SaaS dashboard.
- **Avoid:** generic shadcn neutrality. Avoid product-y status bars, dashboard-looking hero stats, default Tailwind gray cards with no rhythm.

## Hard rules (non-negotiable)

1. **Photo-agnostic.** Never make any UI surface depend on photos. There is no guarantee a given restaurant has one. Photos are supplementary, never structural.
2. **No horizontal scrolls.** Anywhere. Filter rails, chip strips, cuisine pills — all wrap with `flex-wrap`. No `overflow-x-auto` on user-facing rows.
3. **Mobile-first.** The primary platform is a phone. Any split layout must put the most context-rich element first on small screens and reflow side-by-side only at `lg+`.
4. **Token-only color.** Always use `bg-card`, `text-muted-foreground`, `ring-foreground/{n}`, etc. Never hard-code Tailwind palette colors or hex. Accent colors are amber (rating), emerald (visited), amber-dashed (want-to-try) — keep those three and add no more without a deliberate decision.

## Typography

- **Headings:** `font-heading` (aliased to `--font-sans`). Use generous sizes for editorial moments (`text-4xl`–`text-5xl` for page titles) and `text-2xl` for entity names (restaurant cards). `tracking-tight`, `leading-[1.05]`–`leading-[1.1]`.
- **Body:** default `font-sans` at `text-sm`. Muted via `text-muted-foreground` for secondary info.
- **Mono:** `font-mono` reserved for numerics, kbd hints, and tracking-wide uppercase labels.
- **Editorial kicker:** `text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground` — used above big titles and above section headings.
- **Tabular nums:** any rating, count, or rank uses `tabular-nums`.

## Layout & spacing

- **Density:** comfortable (the user-confirmed default). Card padding `p-5`, gap `gap-4`, ring `ring-1 ring-foreground/10`.
- **Card system:** `rounded-2xl bg-card ring-1 ring-foreground/10 hover:ring-foreground/20`. 5★ items optionally bump to `ring-foreground/25 hover:ring-foreground/40` to telegraph importance without leaning on color.
- **Don't say the same thing twice on a card.** On `RestaurantCardCompact`, cuisine appears once — as the uppercase kicker line above the title, with each cuisine's emoji prefixed (`{emoji} {NAME} · {emoji} {NAME}`). No separate `CuisineBadge` row. (The table row uses cuisine differently — emoji avatar + names on a muted second line — that's fine; the rule is "no redundant repetition within one component".)
- **Section dividers:** `border-b border-border/60 pb-3`. Editorial sections use a kicker + title pattern.
- **Grid breakpoints:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for card grids.
- **Map split:** mobile = map on top (`h-[50vh]`) then list; desktop = list left (`order-1`), sticky map right (`lg:order-2 lg:sticky lg:top-4 lg:h-[calc(100vh-3rem)]`).

## Color

Today's tokens are fully achromatic (`oklch(... 0 0)`). The only chromatic accents are:

- `fill-amber-400 text-amber-400` — star ratings (light + dark).
- `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400` — visited.
- `border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400` — want to try.

Do not introduce new chromatic accents without revisiting this file.

## Interaction patterns

- **View modes:** any list surface that earns it should support a `Cards / Table / Map` toggle, with the active mode persisted to the URL via `nuqs` (`?view=cards|table|map`).
- **Toggle placement:** centered above the content, segmented-control style on `bg-card`, with `bg-foreground text-background` for the active pill.
- **Filter chips:** wrap, never scroll. Active chips read `border-foreground/30 bg-input/60`. Inactive read `bg-card text-muted-foreground`.
- **Sort:** lives at the right end of the filter row as a chip dropdown.
- **Status + rating pairing:** always render rating and status indicator on the same Y axis on the same row — they read together as "what is it · how was it".
- **Keyboard shortcuts:** not appropriate for this product (personal restaurant guide). Do not add kbd hints, command palettes, or `⌘K`-style affordances.
- **Map pins:** numbered, tied to list order. Stable across views — list item N corresponds to pin N.

## App shell / chrome

- **No global navbar.** There is no sticky header. Each page owns its own header (editorial on `/`, a plain `<h1>` on `/stats`, the restaurant title block on `/[slug]`, etc.).
- **No brand wordmark or logo on any rendered surface** — not in a header, not in a footer, not on detail pages. Brand presence is the `<title>` tag plus the lowercase **"A dining journal"** editorial kicker on `/` only. (No `UtensilsCrossed` icon, no "Dining Guide" text, anywhere visible.)
- **One persistent control: an account-menu icon button anchored to the top-right gutter of the page content, in the document flow** — it scrolls away with the page; it is **not** `position: fixed` and **not** sticky. Rendered once by `app/layout.tsx` (absolutely positioned inside a `relative` `<main>`, in the empty right gutter — page titles are always left-aligned, so it never overlaps content). Trigger = plain ghost icon button (`CircleUser`), achromatic.
- **Account menu contents:** Stats · Add restaurant (admin only) · Theme (Light / Dark / System) · — · Sign in _(signed out)_ / Sign out _(signed in)_. "Sign out" is a `<button type="submit">` inside a `<form action="/auth/logout" method="post">`. Admin state via `supabase.auth.getClaims()` in a small async server component (`AccountMenuSlot`) wrapped in `<Suspense>`; the menu itself (`AccountMenu`) is `'use client'` and takes a `signedIn` boolean.
- **Non-home pages carry a "← Restaurants" back-link** (`components/BackLink.tsx`) at the top-left of their content — `/stats`, `/[slug]`, `/[slug]/edit`, `/new`, `/auth/login`, `not-found.tsx`. Nothing is orphaned.
- **No `/map` route.** The Map view lives in the `?view=map` tab on `/` (`RestaurantMapView`). `getForMap()`, `RestaurantMap`, `RestaurantMapInner` are shared by that tab and the `/[slug]` mini-map — keep them.

## Information architecture

- Header subtitle should anchor on actionable counts, not total inventory. Use `{visited} visited · {cities} cities · {cuisines} cuisines` rather than "N places · M visited · K bookmarked". The breakdown reads as a math puzzle.
- The dominant signal on each restaurant is **rating + status**, in that order. Photo (if any) is supplementary.
- Cuisine is the primary filter dimension. City is the second.

## Restaurant detail page (`/[slug]`)

Redesigned via Design Lab on 2026-05-10 ("Variant F — editorial column, facts up top"; shipped — commits `973362b`/`536db4d`). The page is an **editorial single column**, `max-w-2xl`, same token vocabulary as `/`.

- **Header order, top to bottom:** `← Restaurants` back-link → cuisine kicker line → `font-heading` H1 name → verdict row (`StarRating` · `StatusIndicator` · visited date in mono · `· chain` in mono — rating and status on the same Y axis) → **attribute pill row** → actions row (`ShareButton` + auth-gated `EditButton`).
- **Cuisine appears once** — as the uppercase `tracking-[0.18em]` kicker line above the title, each cuisine prefixed with its emoji (`{emoji} {NAME}  ·  {emoji} {NAME}`), exactly like `RestaurantCardCompact`. No `CuisineBadge` row on the detail page.
- **Photo is supplementary and comes _after_ the header**, not as a hero crown — an `aspect-[3/1]` band, `rounded-2xl ring-1 ring-foreground/10`, rendered only when `photo_url` exists. The page must look composed with no photo.
- **The note (`notes`) is the centrepiece**, rendered as plain prose: `text-lg leading-relaxed whitespace-pre-wrap`, unlabeled. `pros` / `cons` / `recommendations` follow as **borderless** blocks (`border-b border-border/60 py-5`), each with a kicker label — and the labels are **"What's good" / "What's not" / "When you go"**, not "Pros/Cons/Recommendations". No card chrome anywhere in the writing section.
- **`Where` section:** kicker + hairline (`border-b border-border/60 pb-3`), a locations list (`MapPin` + city · locality / address line), then a `h-[300px]` mini-map (`RestaurantMap`, `gestureHandling`, `ring-1 ring-foreground/10`). When nothing is geocoded, show a one-line note instead of an empty Leaflet. When there are no locations at all, just the "No specific locations recorded yet." line.

### Attribute pills pattern

The five attributes (Occasion 🍽️ · Wallet 💸 · Vegetarian 🥦 · Halal 🕌 · Visited/Status 📅) **always all render**, as a wrapping row of pills (`flex flex-wrap gap-2`). Each pill: `rounded-full px-3 py-1 text-sm ring-1`, emoji (`aria-hidden`) + muted label + value.

- **Known** value → `bg-card text-foreground ring-foreground/10`, label `text-muted-foreground`, value `font-medium`. Yes/no fields render "Yes" / "No".
- **Missing** value → render the pill grayed out (`bg-muted/60 text-muted-foreground/60 ring-foreground/5`) with the text "Unknown". The fade is a **data-completeness** signal, never a hierarchy one — no attribute is de-emphasised by identity (the old "de-emphasise Occasion" idea is dead). Lives in `components/RestaurantAttributePills.tsx`.

### Sharing

`components/ShareButton.tsx` (`'use client'`): one quiet affordance — `navigator.share({ title, url })` when available, else copy the URL to the clipboard and `toast.success('Link copied')` (`sonner`; the layout already mounts `<Toaster />`). `Share2` icon. URL is `https://dining.ninkuk.com/{slug}`.

## Admin forms (`/new`, `/[slug]/edit` — the `RestaurantForm`)

Redesigned via Design Lab on 2026-05-11 ("Variant A — Editorial column"; shipped). The form is an **editorial single-column compose view**, `max-w-2xl`, same vocabulary as `/` and `/[slug]` — **not** a stock shadcn form. It is a re-skin + re-grouping only: `restaurantSchema`, the server actions, every field name, and the sub-components' logic are untouched.

- **No `<Separator />` between sections.** Sections are "movements" with the kicker + hairline header pattern (`text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground` over `border-b border-border/60 pb-2.5`), optionally with a right-aligned `text-[11px] text-muted-foreground/70` hint. Order is fixed: **The basics → The write-up → Details → Where → Photo.** (A small local `Movement` helper inside `RestaurantForm.tsx` is fine — but no shared `<Kicker>`/`<SectionHeading>` primitive; see "Don't abstract the kicker".)
- **Page header** (lives in the page wrappers, not the form): `BackLink` → kicker (`New entry` / `Editing`) → `font-heading text-4xl sm:text-5xl` H1 (`Add a restaurant` / the restaurant's name) → one muted intro line. Container `max-w-2xl` + `pb-24` (so the sticky bar can't cover content).
- **Hierarchy: Name is the loud field** — `<Input className="h-11 text-lg font-medium">`. Everything else sits below it in normal weight.
- **Slug is derived & read-only** (TODO item shipped): no slug input; shown as a `font-mono text-xs text-muted-foreground` `/{slug} · derived from the name` line under the name. Still in form state via a hidden input; auto-derived from name in `create` mode only (in `edit` mode the slug = the live URL, never re-derived on rename). The schema's slug regex/reserved errors surface under the **name** input.
- **The write-up is the centre.** `notes` is the hero — labelled **"The note"** (never "Notes"), a generous `rows={6}`+ `resize-y` `text-base leading-relaxed` textarea, full width, second in the form (right after The basics, before Details). `pros`/`cons`/`recommendations` follow as smaller `rows={2}` stacked siblings (not a 2-col grid) labelled **"What's good" / "What's not" / "When you go"** — the exact `/[slug]` labels; never "Pros/Cons/Recommendations" in the UI. (DB columns keep their names.)
- **Star input has hover-fill** (TODO item shipped): on hover, dim-fill (`fill-amber-400/35 stroke-amber-500/60`) the stars up to the hovered one; already-set stars stay solid amber.
- **Sticky save bar** — `sticky bottom-0 z-10`, `border-t border-border bg-background/85 backdrop-blur` (the band may use `-mx-5 px-5` to span the gutter), Cancel + Save right-aligned, "Editing {name}" / "New entry" muted on the left (`sm:` and up). Save stays `type="submit"`. **Delete (edit mode only) is a quiet `text-destructive` "Delete this entry" button at the very bottom, outside the sticky bar** — it opens the existing `AlertDialog` confirm (with the location-count copy). It is _not_ a primary affordance.
- **Locations:** light rows — `rounded-xl bg-card p-4 ring-1 ring-foreground/10`, **no per-row uppercase "LOCATION n" header**; "Add location" is a small `variant="outline" size="sm"` button. Keep the editable city/locality inputs + `AddressAutocomplete`. **No map inside the form** (geocoding happens on save).
- **Photo is last and clearly optional** — its own movement with the hint "optional — the page works without one"; the form must look composed with zero photo.
- **Do not add:** a live preview pane (rejected — weak on mobile, which is the primary platform), a multi-step wizard, a dense two-column layout, a bottom attribute-pill strip (the lab mockup showed one; it was explicitly cut), keyboard shortcuts.

## Map popup (`RestaurantMapInner` → `MarkerCard`)

Redesigned 2026-05-11. The Leaflet marker popup **reads like a small `RestaurantCardCompact`** — same vocabulary, no Leaflet defaults.

- **Bubble chrome lives in `globals.css`** (a `.leaflet-popup-*` block, placed _after_ the Leaflet CSS imports so it wins — Leaflet's CSS is unlayered, so it beats `@layer utilities`; that's also why popup link colors are set there, not via Tailwind classes on the `<a>`). The bubble is `background: var(--popover)` + `color: var(--popover-foreground)` (so it flips in dark mode), `border-radius: calc(var(--radius) * 1.8)` (the app's `rounded-2xl`), a hairline ring via `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent)`, and **one** soft `filter: drop-shadow()` on `.leaflet-popup` covering bubble + pointer tip. `.leaflet-popup-content { margin: 0 }` and `.leaflet-popup-content p { margin: 0 }` are **required** — Leaflet otherwise injects `13px/24px` content margins and `18px 0` on every `<p>`, which silently wrecks any internal spacing.
- **`MarkerCard` contents** (`w-72`, `p-4`, `gap-2.5`): rating ←→ status row (`StarRating` · `ClosedBadge?` · `StatusIndicator`, same as the card's top row) → `gap-1` block of cuisine kicker (`text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground`, each cuisine `{emoji} {NAME}` joined by `·`) + `font-heading text-2xl font-medium leading-[1.1] tracking-tight` name → italic 2-line notes snippet (`line-clamp-2 text-sm italic text-muted-foreground`, only if `notes`) → `📍 City · {wallet}` row (`MapPin` + city, `Badge variant="outline" rounded-full` wallet) → then, _outside_ the wrapping `<Link>`, a quiet "Open in Google Maps" + `ArrowUpRight` link (the one thing the list card doesn't have). The whole upper block (rating through city row) is one `<Link href={/${slug}}>` — no separate "View details" line. The bubble surface _is_ the card surface, so `MarkerCard` adds no `bg-card`/`ring`/`rounded` of its own.
- **`MapMarker` carries the rich fields** (`cuisine?: string[]`, `notes?`, `wallet?`, `permanently_closed?`) — all optional; absent ones just don't render. They're filled in **client-side** by joining the map `points` against the full `RestaurantWithLocations[]` already loaded (in `RestaurantMapView`, and on the `/[slug]` mini-map from the loaded `r`) — `getForMap()` / `MapPoint` were **not** changed, so the one-pin-per-geocoded-location model is intact.

## Repo conventions (load-bearing)

- **Framework:** Next.js 16 App Router, `cacheComponents: true` in `next.config.ts`. Read `node_modules/next/dist/docs/` before assuming any cache, routing, or middleware behavior — this is not the Next.js most code samples are written against.
- **Folders prefixed with `_` are private** and not routed. Use plain names for any new route segments.
- **Image whitelist:** `images.remotePatterns` in `next.config.ts` permits only the project's Supabase storage host. Do not add Unsplash or other external hosts without a deliberate decision.
- **Filter state lives in URL** via `nuqs` (`useQueryState` + parsers). Any new filter dimension must register a parser alongside `q`, `cuisine`, `city`, `rating`, `occasion`, `wallet`, `veg`, `halal`, `status`, `hideChains`, `sort`, and now `view`.
- **Existing primitives** to reach for first: `Button`, `Badge`, `Card`, `DropdownMenu` (shadcn/ui in `components/ui/`), `CuisineBadge`, `StarRating`, `StatusIndicator`, `AccountMenu` / `BackLink` / `ShareButton` / `RestaurantAttributePills` (project-level in `components/`).
- **Photo policy:** `next/image` is only viable for Supabase-hosted assets. Anywhere else, use plain `<img>` — but per the photo-agnostic rule, prefer no `<img>` at all on list/index surfaces.
- **Don't abstract the kicker.** The editorial kicker (`text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground`) is inlined wherever it's used (`EditorialHeader`, `RestaurantCardCompact`, the `/[slug]` header) — there is no `<Kicker>` primitive, and adding one would break with the existing components.

---

_Last updated 2026-05-11 (map popup redesign — popup = mini RestaurantCardCompact)._
