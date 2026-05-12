// One-time CSV importer for the legacy "Dining Guide - List.csv".
//
// Run: `npx tsx scripts/migrate-csv.ts [--csv <path>] [--clean | --append]`
// Default CSV path: scripts/data/Dining Guide - List.csv
//
// Safety guards (Decision 15):
//   - Refuses to run if `restaurants` is non-empty unless --clean or --append
//   - --clean wipes restaurants first (cascades to locations)
//   - Prints SUPABASE_URL and prompts for `yes` confirmation
//
// Uses SUPABASE_SERVICE_ROLE_KEY (local script only — never in app code).

import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import Papa from 'papaparse'
import { CUISINE_EMOJI } from '../lib/cuisines'
import { slugify } from '../lib/slug'
import { starsToInt } from '../lib/rating'
import { geocodeSearch } from '../lib/geocode'
import {
  parseCuisines,
  mapOccasion,
  mapVegetarian,
  splitCities,
} from '../lib/csv-migrate'
import type { Database } from '../lib/supabase/database.types'

loadEnv({ path: '.env.local' })

type CsvRow = {
  Name: string
  Cuisine: string
  Occasion: string
  City: string
  Locality: string
  Rating: string
  'Vegetarian Friendly?': string
  Notes: string
  Cons: string
  Pros: string
  Recommendations: string
}

type LocationPayload = {
  city: string | null
  locality: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
}

type RestaurantPayload = {
  slug: string
  name: string
  cuisine: string[]
  occasion: string | null
  wallet: string | null
  rating: number | null
  vegetarian: string | null
  permanently_closed: boolean
  status: 'visited' | 'want_to_try'
  visited_at: string | null
  photo_url: string | null
  notes: string | null
  pros: string | null
  cons: string | null
  recommendations: string | null
  locations: LocationPayload[]
}

const FAILURES_PATH = resolve('scripts/migration-failures.json')

// ---------- CLI parsing ----------

function parseArgs(): { csv: string; mode: 'default' | 'clean' | 'append' } {
  const args = process.argv.slice(2)
  let csv = 'scripts/data/Dining Guide - List.csv'
  let mode: 'default' | 'clean' | 'append' = 'default'
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--csv') csv = args[++i]
    else if (a === '--clean') mode = 'clean'
    else if (a === '--append') mode = 'append'
    else {
      console.error(`Unknown arg: ${a}`)
      process.exit(2)
    }
  }
  return { csv, mode }
}

function ask(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(q, (a) => (rl.close(), res(a))))
}

// ---------- Value mapping ----------


function buildLocations(city: string, locality: string): { cities: string[]; locality: string | null } {
  const cities = splitCities(city)
  const loc = locality.trim() || null
  return { cities, locality: loc }
}

// ---------- Main ----------

async function main() {
  const { csv, mode } = parseArgs()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(2)
  }

  console.log(`\nMigration target: ${url}`)
  console.log(`CSV path:         ${csv}`)
  console.log(`Mode:             ${mode}`)
  const answer = (await ask("\nType 'yes' to proceed: ")).trim().toLowerCase()
  if (answer !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Pre-flight: refuse on non-empty unless --clean/--append.
  const { count, error: countErr } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`count failed: ${countErr.message}`)
  if ((count ?? 0) > 0) {
    if (mode === 'default') {
      console.error(
        `restaurants has ${count} rows; pass --clean to wipe & re-import or --append to add only new.`
      )
      process.exit(2)
    }
    if (mode === 'clean') {
      console.log(`Wiping ${count} existing restaurants…`)
      const { error } = await supabase.from('restaurants').delete().gt('id', 0)
      if (error) throw new Error(`delete failed: ${error.message}`)
    }
  }

  // Reset failures log.
  writeFileSync(FAILURES_PATH, '[]\n', 'utf8')

  const csvText = readFileSync(csv, 'utf8')
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    console.warn(`CSV parse warnings (${parsed.errors.length}): first: ${parsed.errors[0].message}`)
  }
  const rawRows = parsed.data.filter((r) => r.Name && r.Name.trim().length > 0)

  // De-dupe by name → first occurrence wins, subsequent rows extend locations
  // if structure ever supported it (current CSV has 1 row per name).
  const byName = new Map<string, CsvRow>()
  for (const row of rawRows) {
    const key = row.Name.trim()
    if (!byName.has(key)) byName.set(key, row)
  }
  const rows = Array.from(byName.values())
  console.log(`\nParsed ${rawRows.length} rows; ${rows.length} unique restaurants.`)

  // ---------- Cuisine seeding ----------
  const allCuisines = new Set<string>()
  for (const r of rows) {
    for (const c of parseCuisines(r.Cuisine)) allCuisines.add(c)
  }

  const cuisinesToUpsert = Array.from(allCuisines).map((name) => ({
    name,
    emoji: CUISINE_EMOJI[name] ?? '🍽️',
  }))
  if (cuisinesToUpsert.length) {
    const { error } = await supabase.from('cuisines').upsert(cuisinesToUpsert, { onConflict: 'name' })
    if (error) throw new Error(`cuisines upsert failed: ${error.message}`)
  }
  const fallbackCuisines = cuisinesToUpsert.filter((c) => c.emoji === '🍽️').map((c) => c.name)
  console.log(`Seeded ${cuisinesToUpsert.length} cuisines; ${fallbackCuisines.length} use fallback emoji.`)

  // ---------- Build payloads ----------
  const payloads: { row: CsvRow; payload: RestaurantPayload }[] = []
  const skipReasons: string[] = []

  for (const row of rows) {
    const name = row.Name.trim()
    const cuisine = parseCuisines(row.Cuisine)
    const occasion = mapOccasion(row.Occasion)
    const vegetarian = mapVegetarian(row['Vegetarian Friendly?'])
    const rating = starsToInt(row.Rating || '')
    const { cities, locality } = buildLocations(row.City || '', row.Locality || '')

    const locations: LocationPayload[] = []
    if (cities.length > 0) {
      for (const city of cities) {
        locations.push({
          city,
          locality,
          address: null,
          latitude: null,
          longitude: null,
        })
      }
    } else if (locality) {
      locations.push({
        city: null,
        locality,
        address: null,
        latitude: null,
        longitude: null,
      })
    }
    // Otherwise: zero locations (valid for a place with no recorded address).

    payloads.push({
      row,
      payload: {
        slug: slugify(name),
        name,
        cuisine,
        occasion,
        wallet: null,
        rating,
        vegetarian,
        permanently_closed: false,
        status: 'visited',
        visited_at: null,
        photo_url: null,
        notes: (row.Notes || '').trim() || null,
        pros: (row.Pros || '').trim() || null,
        cons: (row.Cons || '').trim() || null,
        recommendations: (row.Recommendations || '').trim() || null,
        locations,
      },
    })
  }

  // ---------- Geocode locations ----------
  console.log(`\nGeocoding (1.1s between calls)…`)
  const failures: Array<{ name: string; city: string | null; locality: string | null; reason: string }> = []
  let geoSuccess = 0
  let geoFail = 0
  let geoSkipped = 0

  for (const { payload } of payloads) {
    for (const loc of payload.locations) {
      const parts = [loc.locality, loc.city, 'AZ', 'USA'].filter(Boolean).join(', ')
      if (!parts || parts === 'AZ, USA') {
        geoSkipped++
        continue
      }
      try {
        const hit = await geocodeSearch(parts)
        if (hit) {
          loc.latitude = hit.latitude
          loc.longitude = hit.longitude
          loc.address = hit.display_name
          geoSuccess++
        } else {
          failures.push({ name: payload.name, city: loc.city, locality: loc.locality, reason: 'no result' })
          geoFail++
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        failures.push({ name: payload.name, city: loc.city, locality: loc.locality, reason })
        geoFail++
      }
    }
  }

  if (failures.length) {
    appendFileSync(FAILURES_PATH, '')
    writeFileSync(FAILURES_PATH, JSON.stringify(failures, null, 2) + '\n', 'utf8')
  }

  // ---------- Insert via RPC ----------
  console.log(`\nInserting ${payloads.length} restaurants via upsert RPC…`)
  let inserted = 0
  let rpcFail = 0

  // In --append mode, fetch existing slugs to skip duplicates.
  const existingSlugs = new Set<string>()
  if (mode === 'append') {
    const { data, error } = await supabase.from('restaurants').select('slug')
    if (error) throw new Error(`slug fetch failed: ${error.message}`)
    for (const r of data ?? []) existingSlugs.add(r.slug)
  }

  for (const { payload } of payloads) {
    if (mode === 'append' && existingSlugs.has(payload.slug)) {
      skipReasons.push(`${payload.name}: slug exists`)
      continue
    }
    const { error } = await supabase.rpc('upsert_restaurant_with_locations', {
      payload: payload as unknown as Database['public']['Functions']['upsert_restaurant_with_locations']['Args']['payload'],
    })
    if (error) {
      console.error(`✗ ${payload.name}: ${error.message}`)
      rpcFail++
    } else {
      inserted++
    }
  }

  // ---------- Summary ----------
  const totalLocations = payloads.reduce((s, p) => s + p.payload.locations.length, 0)

  console.log('\n=== Migration summary ===')
  console.log(`Restaurants inserted: ${inserted}`)
  console.log(`Restaurants failed:   ${rpcFail}`)
  console.log(`Locations total:      ${totalLocations}`)
  console.log(`Geocode success:      ${geoSuccess}`)
  console.log(`Geocode fail:         ${geoFail}`)
  console.log(`Geocode skipped (no input): ${geoSkipped}`)
  if (skipReasons.length) {
    console.log(`Skipped (append mode):  ${skipReasons.length}`)
  }
  if (fallbackCuisines.length) {
    console.log(`\nCuisines using fallback 🍽️ emoji — edit before deploy:`)
    for (const c of fallbackCuisines) console.log(`  - ${c}`)
  }
  if (failures.length) {
    console.log(`\nGeocode failures logged to ${FAILURES_PATH}`)
  }
  if (!existsSync(FAILURES_PATH)) {
    writeFileSync(FAILURES_PATH, '[]\n', 'utf8')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
