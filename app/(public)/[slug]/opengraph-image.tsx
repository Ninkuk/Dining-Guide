import { ImageResponse } from 'next/og'
import { getRestaurantBySlug } from '@/lib/queries/restaurants'
import { clampText, cuisineLine, primaryCity, SITE_TAGLINE, SITE_URL } from '@/lib/seo'
import { MAX_RATING } from '@/lib/rating'

export const alt = SITE_TAGLINE
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Token-ish palette, mirroring components/RestaurantCardCompact.tsx.
const PAPER = '#fafafa' // bg-card on a light surface
const INK = '#0a0a0a' // text-foreground
const MUTED = '#737373' // text-muted-foreground
const HAIRLINE = '#d4d4d4' // ring-foreground/10-ish
const EMERALD_BG = 'rgba(16,185,129,0.15)' // bg-emerald-500/15
const EMERALD_INK = '#047857' // text-emerald-700
const AMBER_INK = '#b45309' // text-amber-700
const AMBER_BORDER = 'rgba(245,158,11,0.5)' // border-amber-500/50
const HOST = SITE_URL.replace(/^https?:\/\//, '')

const STATUS_LABEL: Record<string, string> = {
  visited: 'Visited',
  want_to_try: 'Want to try',
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 36,
        width: '100%',
        height: '100%',
        padding: 72,
        background: PAPER,
        color: INK,
        fontFamily: 'sans-serif',
      }}
    >
      {children}
    </div>
  )
}

function Pill({
  children,
  bg = 'transparent',
  color = MUTED,
  border,
}: {
  children: React.ReactNode
  bg?: string
  color?: string
  border?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 22px',
        borderRadius: 9999,
        fontSize: 30,
        fontWeight: 500,
        background: bg,
        color,
        ...(border ? { border } : {}),
      }}
    >
      {children}
    </div>
  )
}

function nameSize(len: number): number {
  if (len <= 18) return 104
  if (len <= 30) return 84
  if (len <= 42) return 66
  return 54
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const r = await getRestaurantBySlug(slug)

  if (!r) {
    return new ImageResponse(
      (
        <Frame>
          <div
            style={{
              display: 'flex',
              width: '100%',
              fontSize: 26,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            {HOST}
          </div>
          <div style={{ display: 'flex', fontSize: 100, fontWeight: 600, letterSpacing: -2 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ display: 'flex', height: 6, width: 120, background: INK, borderRadius: 3 }} />
        </Frame>
      ),
      size,
    )
  }

  const filled =
    r.rating == null ? 0 : Math.max(0, Math.min(MAX_RATING, Math.round(r.rating)))
  const cuisines = cuisineLine(r.cuisine)
  const note = r.notes?.trim() ? clampText(r.notes, 92) : null
  const city = primaryCity(r)
  const extra = r.locations.length > 1 ? r.locations.length - 1 : 0
  const status = STATUS_LABEL[r.status] ?? null
  const visited = r.status === 'visited'

  return new ImageResponse(
    (
      <Frame>
        {/* Top row: rating ←→ status — same axis as the card's top row. */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {filled > 0 ? (
            <div style={{ display: 'flex', fontSize: 46, letterSpacing: 4 }}>
              {'⭐'.repeat(filled)}
            </div>
          ) : (
            <Pill bg="#f0f0f0">Unrated</Pill>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {r.permanently_closed ? <Pill bg="#f0f0f0">Permanently closed</Pill> : null}
            {status ? (
              visited ? (
                <Pill bg={EMERALD_BG} color={EMERALD_INK}>
                  {status}
                </Pill>
              ) : (
                <Pill color={AMBER_INK} border={`2px dashed ${AMBER_BORDER}`}>
                  {status}
                </Pill>
              )
            ) : null}
          </div>
        </div>

        {/* Middle: cuisine kicker → name → note snippet. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 16 }}>
          {cuisines ? (
            <div
              style={{
                display: 'flex',
                width: '100%',
                fontSize: 28,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              {cuisines}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              width: '100%',
              fontSize: nameSize(r.name.length),
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: -2,
              textDecoration: r.permanently_closed ? 'line-through' : 'none',
              textDecorationColor: MUTED,
            }}
          >
            {r.name}
          </div>
          {note ? (
            <div
              style={{
                display: 'flex',
                width: '100%',
                fontSize: 32,
                fontStyle: 'italic',
                color: MUTED,
                lineHeight: 1.3,
              }}
            >
              {note}
            </div>
          ) : null}
        </div>

        {/* Bottom row: city · wallet pill — with a quiet host on the right. */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 20,
            fontSize: 28,
            color: MUTED,
          }}
        >
          {city ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{city}</span>
              {extra > 0 ? <span style={{ color: '#a3a3a3' }}>{`+${extra} more`}</span> : null}
            </div>
          ) : null}
          {r.wallet ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 20px',
                borderRadius: 9999,
                border: `2px solid ${HAIRLINE}`,
                fontSize: 26,
                color: MUTED,
              }}
            >
              {r.wallet}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#a3a3a3',
            }}
          >
            {HOST}
          </div>
        </div>
      </Frame>
    ),
    size,
  )
}
