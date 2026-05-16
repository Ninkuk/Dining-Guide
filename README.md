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

| Command                | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Start the Next.js dev server                                 |
| `npm run build`        | Production build                                             |
| `npm run start`        | Serve the production build                                   |
| `npm run lint`         | ESLint (Next config + type-aware `@typescript-eslint` rules) |
| `npm run lint:fix`     | ESLint with `--fix`                                          |
| `npm run format`       | Prettier write across the repo                               |
| `npm run format:check` | Prettier check (no writes) — what CI runs                    |
| `npm run typecheck`    | `tsc --noEmit`                                               |
| `npm run preflight`    | Auto-fix + verify everything CI checks — run before commit   |
| `npm test`             | Vitest (single run)                                          |
| `npm run test:watch`   | Vitest watch mode                                            |
| `npm run test:ui`      | Vitest UI                                                    |

One-off CSV importer (was used to seed from the legacy spreadsheet — kept for reference):

```bash
npx tsx scripts/migrate-csv.ts --clean
```

## Code quality

Three layers of enforcement, fastest to slowest:

1. **Pre-commit hook** (`.husky/pre-commit`, via [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)) — runs Prettier + ESLint `--fix` on staged files only, then a full `tsc --noEmit`. Sub-second on small commits.
2. **Preflight** (`scripts/preflight.sh`, aliased as `npm run preflight`) — auto-fixes formatting and lint across the whole repo, then verifies typecheck and tests. Run this when you want a clean slate.
3. **CI** (`.github/workflows/ci.yml`) — read-only mirror of preflight (`format:check`, `lint`, `typecheck`, `test`) on every push to `master` and every PR.

Config:

- **Prettier** — `.prettierrc.json`: 100-col, double-quote, `endOfLine: lf`, `prettier-plugin-tailwindcss` for class sorting.
- **ESLint** — `eslint.config.mjs`: `eslint-config-next` + cherry-picked type-aware rules. `no-floating-promises` is an error; `no-misused-promises` is a warning (async handlers on `onClick`/`onSelect` are idiomatic but technically unsafe — visible without blocking).
- **Knip** — `knip.json`: ignores shadcn UI primitives and the generated Supabase types file. Run `npx knip` periodically for an unused-code audit (not on every commit).
- **Editor / git layer** — `.editorconfig`, `.gitattributes` (LF normalization at the git layer), and `.nvmrc` (pins Node version, also read by Vercel and CI).

## Environment

Three variables. The spec's [Environment Variables table](docs/dining-guide-spec.md#environment-variables) is the source of truth; in summary:

| Var                                    | Where                                      |
| -------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Local + all Vercel envs                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local + all Vercel envs                    |
| `SUPABASE_SERVICE_ROLE_KEY`            | Local only — script use, never in app code |

(Geocoding uses [Photon](https://photon.komoot.io), which needs no API key — no env var.)

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
  supabase/    client.ts, server.ts, anon.ts (cookie-free for public reads), proxy.ts (Next 16 rename of middleware)
  queries/    server-side data fetchers
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
