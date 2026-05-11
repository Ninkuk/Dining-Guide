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
- **Account menu contents:** Stats · Add restaurant (admin only) · Theme (Light / Dark / System) · — · Sign in *(signed out)* / Sign out *(signed in)*. "Sign out" is a `<button type="submit">` inside a `<form action="/auth/logout" method="post">`. Admin state via `supabase.auth.getClaims()` in a small async server component (`AccountMenuSlot`) wrapped in `<Suspense>`; the menu itself (`AccountMenu`) is `'use client'` and takes a `signedIn` boolean.
- **Non-home pages carry a "← Restaurants" back-link** (`components/BackLink.tsx`) at the top-left of their content — `/stats`, `/[slug]`, `/[slug]/edit`, `/new`, `/auth/login`, `not-found.tsx`. Nothing is orphaned.
- **No `/map` route.** The Map view lives in the `?view=map` tab on `/` (`RestaurantMapView`). `getForMap()`, `RestaurantMap`, `RestaurantMapInner` are shared by that tab and the `/[slug]` mini-map — keep them.

## Information architecture

- Header subtitle should anchor on actionable counts, not total inventory. Use `{visited} visited · {cities} cities · {cuisines} cuisines` rather than "N places · M visited · K bookmarked". The breakdown reads as a math puzzle.
- The dominant signal on each restaurant is **rating + status**, in that order. Photo (if any) is supplementary.
- Cuisine is the primary filter dimension. City is the second.

## Repo conventions (load-bearing)

- **Framework:** Next.js 16 App Router, `cacheComponents: true` in `next.config.ts`. Read `node_modules/next/dist/docs/` before assuming any cache, routing, or middleware behavior — this is not the Next.js most code samples are written against.
- **Folders prefixed with `_` are private** and not routed. Use plain names for any new route segments.
- **Image whitelist:** `images.remotePatterns` in `next.config.ts` permits only the project's Supabase storage host. Do not add Unsplash or other external hosts without a deliberate decision.
- **Filter state lives in URL** via `nuqs` (`useQueryState` + parsers). Any new filter dimension must register a parser alongside `q`, `cuisine`, `city`, `rating`, `occasion`, `wallet`, `veg`, `halal`, `status`, `hideChains`, `sort`, and now `view`.
- **Existing primitives** to reach for first: `Button`, `Badge`, `Card`, `DropdownMenu` (shadcn/ui in `components/ui/`), `CuisineBadge`, `StarRating`, `StatusIndicator`, `AccountMenu` / `BackLink` (project-level in `components/`).
- **Photo policy:** `next/image` is only viable for Supabase-hosted assets. Anywhere else, use plain `<img>` — but per the photo-agnostic rule, prefer no `<img>` at all on list/index surfaces.

---

*Last updated 2026-05-10 (app-shell redesign — navbar removed; see `DESIGN_PLAN.md`).*
