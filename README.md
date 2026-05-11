# Dining Guide

A personal CRUD web app that replaces a Google Sheet of restaurants visited and worth trying. List, detail, map, and stats views — public read, single-admin write.

Production: [dining.ninkuk.com](https://dining.ninkuk.com)

## Stack

- **Next.js 16** (App Router, Cache Components, TypeScript) — note: this is a breaking version, see `AGENTS.md`
- **Supabase** (Postgres + RLS + Auth) — single admin user, email + password
- **Tailwind CSS v4** + **shadcn/ui** (`radix-maia` style, `hugeicons`)
- **React Leaflet** + OpenStreetMap tiles, **Nominatim** for geocoding (server-proxied at write-time only)
- **React Hook Form** + **Zod**, **nuqs** for URL-synced filter state, **Recharts** via shadcn Charts
- **Vitest** for unit tests
- Hosted on **Vercel** (Hobby tier — everything stays on free tiers)

## Getting started

```bash
npm install
vercel env pull .env.local   # or create .env.local by hand — see "Environment" below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Start the Next.js dev server          |
| `npm run build`    | Production build                      |
| `npm run start`    | Serve the production build            |
| `npm run lint`     | ESLint                                |
| `npm test`         | Vitest (single run)                   |
| `npm run test:watch` | Vitest watch mode                   |
| `npm run test:ui`  | Vitest UI                             |

One-off CSV importer (was used to seed from the legacy spreadsheet — kept for reference):

```bash
npx tsx scripts/migrate-csv.ts --clean
```

## Environment

Four variables. The spec's [Environment Variables table](docs/dining-guide-spec.md#environment-variables) is the source of truth; in summary:

| Var                                    | Where                          |
| -------------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Local + all Vercel envs        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local + all Vercel envs        |
| `SUPABASE_SERVICE_ROLE_KEY`            | Local only — script use, never in app code |
| `NOMINATIM_USER_AGENT`                 | Local + all Vercel envs (server-only, no `NEXT_PUBLIC_`) |

Pull Vercel envs locally with `vercel env pull .env.local`.

## Repo layout

```
app/
  (public)/    list, detail, map, stats — public read
  (admin)/    new, edit, server actions — auth-gated
  api/geocode/    Nominatim proxy (rate-limited + Runtime-Cached)
  auth/    login + logout
components/    UI + shadcn primitives in ui/
lib/
  supabase/    client.ts, server.ts, anon.ts (cache-safe), proxy.ts (Next 16 rename of middleware)
  queries/    cached data fetchers ('use cache' + cacheTag)
  schemas/    Zod schemas shared by RHF + server actions
  cuisines.ts, slug.ts, rating.ts, geocode.ts
scripts/migrate-csv.ts    one-time CSV importer
supabase/migrations/    versioned SQL (applied via Supabase MCP)
proxy.ts    Next 16 file convention (was middleware.ts)
docs/dining-guide-spec.md    the source of truth — read this before changing anything substantive
TODO.md    open work
```

## How writes are protected

Reads are public; writes go through four gates:

1. RLS — anon `SELECT`, authenticated `ALL`
2. Supabase Auth — one admin, signups disabled at the project level
3. `proxy.ts` redirects unauthenticated requests to `/new` and `/[slug]/edit`
4. Every server action throws on `VERCEL_ENV === 'preview'` so preview deploys can't corrupt prod data (single Supabase project across envs)

## Further reading

- **[`docs/dining-guide-spec.md`](docs/dining-guide-spec.md)** — full spec, data model, build phases, and the decision log
- **[`TODO.md`](TODO.md)** — outstanding work
- **[`AGENTS.md`](AGENTS.md)** — note on the Next.js 16 breaking changes
