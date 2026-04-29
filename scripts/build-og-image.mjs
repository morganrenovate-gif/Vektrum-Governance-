/**
 * scripts/build-og-image.mjs
 *
 * Generate public/og-image.png — a 1200×630 branded Open Graph image
 * for Vektrum social previews.
 *
 * Design:
 *   - Dark navy background (#070D18 → #0D1B2A radial)
 *   - Vektrum geometric V-mark (white) + wordmark
 *   - Left: headline + subheadline + support line
 *   - Right: simplified milestone-isolation product diagram
 *     - 4 approved milestone cards continuing forward (blue/emerald)
 *     - 1 disputed milestone card held at the gate (red/orange)
 *
 * The SVG is also written to public/og-image.svg as a fallback.
 *
 * Run: node scripts/build-og-image.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '..')
const PUBLIC    = resolve(ROOT, 'public')

if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true })

// ─── SVG markup ────────────────────────────────────────────────────────────────
// 1200 × 630 — exact OG dimensions. All coordinates in user-space pixels.

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Vektrum — Workflow tools track. Vektrum enforces.">
  <defs>
    <!-- Background gradient: deep navy with a subtle blue glow top-center -->
    <radialGradient id="bgGlow" cx="50%" cy="0%" r="70%">
      <stop offset="0%"  stop-color="#1A3A96" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#0D1B2A" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bgBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0D1B2A" />
      <stop offset="100%" stop-color="#070D18" />
    </linearGradient>

    <!-- Card shadow -->
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.35" />
    </filter>

    <!-- Faint grid pattern -->
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#1A3A96" stroke-width="1" stroke-opacity="0.07" />
    </pattern>
  </defs>

  <!-- ── Background ───────────────────────────────────────────────────────── -->
  <rect width="1200" height="630" fill="url(#bgBase)" />
  <rect width="1200" height="630" fill="url(#grid)" />
  <rect width="1200" height="630" fill="url(#bgGlow)" />

  <!-- Top-left logo lockup (V-mark + wordmark) -->
  <g transform="translate(64, 56)">
    <!-- V-mark, scaled to 56px tall (viewBox 100×90 → scale 0.62) -->
    <g transform="scale(0.62)" stroke="#FFFFFF" fill="none" stroke-linecap="round">
      <line x1="4"  y1="4"  x2="50" y2="82" stroke-width="10" />
      <line x1="21" y1="4"  x2="50" y2="68" stroke-width="7" />
      <line x1="50" y1="82" x2="96" y2="4"  stroke-width="10" />
      <line x1="50" y1="68" x2="79" y2="25" stroke-width="7" />
      <line x1="79" y1="25" x2="91" y2="4"  stroke-width="7" />
    </g>
    <!-- Wordmark -->
    <text x="80" y="42" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700" font-size="32" fill="#FFFFFF" letter-spacing="-0.01em">Vektrum</text>
  </g>

  <!-- Top-right category eyebrow -->
  <g transform="translate(1136, 84)">
    <text text-anchor="end" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="13" fill="#7EA2F0" letter-spacing="0.16em">CONDITIONAL AUTHORIZATION INFRASTRUCTURE</text>
  </g>

  <!-- ── LEFT COLUMN: copy ────────────────────────────────────────────────── -->
  <g transform="translate(64, 200)">
    <!-- Accent rule -->
    <rect x="0" y="0" width="32" height="3" fill="#1A3A96" />

    <!-- Headline line 1 -->
    <text x="0" y="56" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="56" fill="#FFFFFF" letter-spacing="-0.025em">Workflow tools track.</text>

    <!-- Headline line 2 -->
    <text x="0" y="120" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="56" fill="#FFFFFF" letter-spacing="-0.025em">Vektrum <tspan fill="#7EA2F0">enforces.</tspan></text>

    <!-- Subheadline -->
    <text x="0" y="180" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="22" fill="rgba(255,255,255,0.78)" letter-spacing="-0.005em">Construction draw release authorization</text>
    <text x="0" y="212" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="22" fill="rgba(255,255,255,0.78)" letter-spacing="-0.005em">before funds move.</text>

    <!-- Divider -->
    <line x1="0" y1="252" x2="64" y2="252" stroke="#1A3A96" stroke-width="2" />

    <!-- Support line — three crisp, equal clauses -->
    <text x="0" y="284" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="15" fill="rgba(255,255,255,0.62)" letter-spacing="0.01em">AI informs.  The gate decides.  The funder authorizes.  The rail executes.</text>
  </g>

  <!-- ── RIGHT COLUMN: milestone-isolation diagram ───────────────────────── -->
  <!--
    Layout:
      Top: row of 3 approved milestone cards continuing forward (emerald check)
      Middle: vertical "RELEASE GATE" band with 1 disputed card held at gate
      Bottom: 1 more approved card flowing past the gate
  -->
  <g transform="translate(700, 180)">
    <!-- Section label -->
    <text x="0" y="0" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="11" fill="rgba(255,255,255,0.65)" letter-spacing="0.18em">MILESTONE ISOLATION — LIVE</text>

    <!-- Approved milestone card #1 -->
    <g transform="translate(0, 24)" filter="url(#cardShadow)">
      <rect width="200" height="64" rx="10" fill="#111827" stroke="#10B981" stroke-opacity="0.35" />
      <circle cx="22" cy="32" r="9" fill="#10B981" fill-opacity="0.18" stroke="#10B981" stroke-width="1.5" />
      <path d="M 18 32 L 22 36 L 28 28" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="42" y="28" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="13" fill="#FFFFFF">Milestone 1</text>
      <text x="42" y="46" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="11" fill="rgba(255,255,255,0.55)">Approved · <tspan fill="#10B981" font-weight="700">$420K</tspan></text>
    </g>

    <!-- Approved milestone card #2 -->
    <g transform="translate(220, 24)" filter="url(#cardShadow)">
      <rect width="200" height="64" rx="10" fill="#111827" stroke="#10B981" stroke-opacity="0.35" />
      <circle cx="22" cy="32" r="9" fill="#10B981" fill-opacity="0.18" stroke="#10B981" stroke-width="1.5" />
      <path d="M 18 32 L 22 36 L 28 28" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="42" y="28" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="13" fill="#FFFFFF">Milestone 2</text>
      <text x="42" y="46" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="11" fill="rgba(255,255,255,0.55)">Approved · <tspan fill="#10B981" font-weight="700">$680K</tspan></text>
    </g>

    <!-- Flow arrows between top cards and gate -->
    <g stroke="rgba(126,162,240,0.45)" stroke-width="1.5" fill="none" stroke-linecap="round">
      <line x1="100" y1="100" x2="100" y2="120" />
      <line x1="320" y1="100" x2="320" y2="120" />
    </g>

    <!-- ── RELEASE GATE band ─────────────────────────────────────────── -->
    <g transform="translate(0, 124)">
      <!-- Gate background -->
      <rect x="-4" y="0" width="428" height="92" rx="12" fill="#0D1B2A" stroke="#1A3A96" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="4 4" />
      <!-- Gate label -->
      <text x="14" y="22" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="10" fill="#7EA2F0" letter-spacing="0.18em">10-CONDITION RELEASE GATE</text>

      <!-- Approved milestone (passes gate) -->
      <g transform="translate(8, 32)" filter="url(#cardShadow)">
        <rect width="200" height="48" rx="9" fill="#111827" stroke="#3B82F6" stroke-opacity="0.5" />
        <circle cx="20" cy="24" r="8" fill="#3B82F6" fill-opacity="0.18" stroke="#3B82F6" stroke-width="1.5" />
        <path d="M 16 24 L 20 28 L 26 20" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <text x="38" y="22" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="12" fill="#FFFFFF">Milestone 3 · Roof</text>
        <text x="38" y="38" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="10" fill="rgba(255,255,255,0.6)">10 / 10 conditions pass · <tspan fill="#7EA2F0" font-weight="700">$540K</tspan></text>
      </g>

      <!-- DISPUTED milestone (held at gate) -->
      <g transform="translate(220, 32)" filter="url(#cardShadow)">
        <rect width="200" height="48" rx="9" fill="#1A0F0F" stroke="#EF4444" stroke-opacity="0.75" stroke-width="1.5" />
        <!-- Hold/lock icon -->
        <g transform="translate(10, 14)">
          <rect x="2" y="6" width="16" height="14" rx="2" fill="#EF4444" fill-opacity="0.18" stroke="#EF4444" stroke-width="1.5" />
          <path d="M 5 6 V 4 a 5 5 0 0 1 10 0 V 6" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" />
        </g>
        <text x="36" y="22" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="12" fill="#FCA5A5">Milestone 4 · Held</text>
        <text x="36" y="38" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="10" fill="rgba(252,165,165,0.75)">Change order open · <tspan font-weight="700">$15K</tspan></text>
      </g>
    </g>

    <!-- Flow arrows below gate -->
    <g stroke-linecap="round" fill="none">
      <!-- Approved continues -->
      <line x1="108" y1="220" x2="108" y2="240" stroke="#3B82F6" stroke-opacity="0.6" stroke-width="2" />
      <polygon points="103,236 113,236 108,244" fill="#3B82F6" fill-opacity="0.6" />
      <!-- Disputed: blocked X -->
      <g stroke="#EF4444" stroke-opacity="0.85" stroke-width="2.2">
        <line x1="314" y1="220" x2="326" y2="234" />
        <line x1="326" y1="220" x2="314" y2="234" />
      </g>
      <text x="338" y="232" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="11" fill="#FCA5A5" letter-spacing="0.08em">BLOCKED</text>
    </g>

    <!-- Approved milestone continuing past gate (proves isolation) -->
    <g transform="translate(0, 248)" filter="url(#cardShadow)">
      <rect width="200" height="64" rx="10" fill="#111827" stroke="#10B981" stroke-opacity="0.35" />
      <circle cx="22" cy="32" r="9" fill="#10B981" fill-opacity="0.18" stroke="#10B981" stroke-width="1.5" />
      <path d="M 18 32 L 22 36 L 28 28" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="42" y="28" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="13" fill="#FFFFFF">Milestone 5</text>
      <text x="42" y="46" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="11" fill="rgba(255,255,255,0.6)">Continues forward · <tspan fill="#10B981" font-weight="700">$310K</tspan></text>
    </g>
  </g>

  <!-- Bottom-left tag strip -->
  <g transform="translate(64, 552)">
    <rect x="0" y="0" width="9" height="9" rx="1.5" fill="#10B981" />
    <text x="20" y="9" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="13" fill="rgba(255,255,255,0.75)">Vektrum does not hold funds, act as escrow, or execute wires.</text>
  </g>

  <!-- Bottom-right URL -->
  <g transform="translate(1136, 561)">
    <text text-anchor="end" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="13" fill="rgba(255,255,255,0.62)" letter-spacing="0.04em">vektrum.io</text>
  </g>
</svg>
`

// ─── Write SVG fallback ────────────────────────────────────────────────────────
writeFileSync(resolve(PUBLIC, 'og-image.svg'), svg, 'utf-8')
console.log('✓ Wrote public/og-image.svg (' + svg.length + ' bytes)')

// ─── Render PNG with sharp ─────────────────────────────────────────────────────
try {
  await sharp(Buffer.from(svg))
    .resize(1200, 630, { fit: 'contain', background: '#070D18' })
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(resolve(PUBLIC, 'og-image.png'))
  console.log('✓ Wrote public/og-image.png (1200×630)')
} catch (err) {
  console.error('✗ sharp PNG render failed:', err.message)
  console.error('  SVG fallback is available at public/og-image.svg')
  process.exit(1)
}
