import { ImageResponse } from 'next/og'
import { SITE_DESCRIPTION, SITE_TAGLINE, SITE_URL } from '@/lib/seo'

export const alt = `${SITE_TAGLINE} — ${SITE_DESCRIPTION}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PAPER = '#fafafa'
const INK = '#0a0a0a'
const MUTED = '#737373'

export default function OpengraphImage() {
  const host = SITE_URL.replace(/^https?:\/\//, '')

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 80,
          background: PAPER,
          color: INK,
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            fontSize: 24,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: MUTED,
          }}
        >
          {host}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              width: '100%',
              fontSize: 124,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -3,
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div style={{ display: 'flex', width: '100%', fontSize: 40, color: MUTED }}>
            {SITE_DESCRIPTION}
          </div>
        </div>
        <div style={{ display: 'flex', height: 6, width: 120, background: INK, borderRadius: 3 }} />
      </div>
    ),
    size,
  )
}
