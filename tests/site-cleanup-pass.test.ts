/**
 * tests/site-cleanup-pass.test.ts
 *
 * Pins the targeted cleanup pass:
 *   1. /demo-live metadata: canonical, og:url, single Vektrum suffix
 *   2. /resources teaser links to /resources/construction-dispute-isolation
 *      with specific link text
 *   3. partners@vektrum.com is absent from public copy
 *   4. /pricing includes the CFO-safe separate-fee-bases explanation
 *   5. public/meta.json exists and contains only safe metadata
 *   6. Banned positioning claims remain absent on each touched surface
 *
 * Run: npx tsx tests/site-cleanup-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const DEMO_LIVE     = 'src/app/(marketing)/demo-live/page.tsx'
const RESOURCES     = 'src/app/(marketing)/resources/page.tsx'
const PRICING       = 'src/app/(marketing)/pricing/page.tsx'
const META_JSON     = 'public/meta.json'
const PACKAGE_JSON  = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\nsite-cleanup-pass.test.ts\n')

  // ── 1. /demo-live metadata ──────────────────────────────────────────────
  console.log('1. /demo-live metadata')
  const demo = read(DEMO_LIVE)

  check(demo.includes('export const metadata'),
    '  1a. /demo-live exports metadata')
  check(
    demo.includes("alternates: { canonical: 'https://vektrum.io/demo-live' }"),
    '  1b. canonical is https://vektrum.io/demo-live',
  )
  check(
    demo.includes("url: 'https://vektrum.io/demo-live'"),
    '  1c. openGraph.url is https://vektrum.io/demo-live',
  )
  check(
    demo.includes('Interactive Construction Draw Demo | Vektrum'),
    '  1d. title is "Interactive Construction Draw Demo | Vektrum"',
  )
  // No title string contains "Vektrum" twice (would render as "Demo — Vektrum | Vektrum")
  check(
    !/title:\s*['"][^'"]*Vektrum[^'"]*Vektrum[^'"]*['"]/.test(demo),
    '  1e. no title string contains "Vektrum" twice (no double-suffix pattern)',
  )

  // ── 2. /resources teaser ────────────────────────────────────────────────
  console.log('\n2. /resources teaser')
  const res = read(RESOURCES)

  check(
    res.includes("slug: 'construction-dispute-isolation'"),
    '  2a. dispute-isolation article slug present',
  )
  // Teaser link uses /resources/${article.slug} (built-in interpolation)
  check(
    res.includes('href={`/resources/${article.slug}`}'),
    '  2b. teaser Link href = /resources/${article.slug}',
  )
  // No href="#" stub remaining on the teaser cards
  check(
    !/Link[^>]*href="#"[^>]*>[\s\S]{0,400}construction-dispute-isolation/.test(res),
    '  2c. no href="#" stub on the dispute-isolation teaser',
  )
  // Specific link text per spec — uses the article title, prefixed "Read:"
  check(
    res.includes('Read: {article.title}') ||
    res.includes("Read: \" + article.title") ||
    res.includes("Read: Why a $15K Construction Dispute Shouldn"),
    '  2d. teaser link text uses "Read: <article title>" pattern',
  )
  // The exact dispute-isolation title string is present
  check(
    res.includes("Why a $15K Construction Dispute Shouldn't Freeze a $9M Project"),
    '  2e. exact article title present in source',
  )

  // ── 3. partners@vektrum.com is absent from public copy ─────────────────
  console.log('\n3. partners@vektrum.com absent from public copy')
  const publicSurfaces: string[] = []
  // Walk src/app/(marketing) and src/components/marketing
  const walk = (dir: string) => {
    const full = path.resolve(ROOT, dir)
    if (!fs.existsSync(full)) return
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(rel)
      else if (/\.(tsx|ts|md|mdx|json)$/.test(entry.name)) {
        publicSurfaces.push(read(rel))
      }
    }
  }
  walk('src/app/(marketing)')
  walk('src/components/marketing')

  for (const surface of publicSurfaces) {
    if (surface.includes('partners@vektrum.com')) {
      fail('  3. partners@vektrum.com appeared in a marketing surface')
    }
  }
  pass('  3. partners@vektrum.com absent from src/app/(marketing) and src/components/marketing')

  // ── 4. /pricing CFO-safe separate-fee-bases explanation ────────────────
  console.log('\n4. /pricing CFO-safe explanation')
  const pricing = read(PRICING)

  check(
    pricing.includes('annual retainer'),
    '  4a. pricing references the "annual retainer"',
  )
  check(
    pricing.includes('platform') &&
    (pricing.includes('platform fee') || pricing.includes('platform/governance fee')),
    '  4b. retainer is described as a platform/governance fee',
  )
  check(
    pricing.includes('active construction volume') ||
    pricing.includes('Active Construction Volume'),
    '  4c. retainer is sized by active construction volume',
  )
  check(
    pricing.includes('per-release fee applies only to authorized disbursements'),
    '  4d. "per-release fee applies only to authorized disbursements"',
  )
  check(
    pricing.includes('separate fee bases'),
    '  4e. "separate fee bases" wording present',
  )
  // Pricing must not imply Vektrum moves money
  const pricingLower = pricing.toLowerCase()
  check(
    !pricingLower.includes('vektrum moves money') &&
    !pricingLower.includes('vektrum collects funds') &&
    !pricingLower.includes('vektrum holds funds'),
    '  4f. pricing does not imply Vektrum moves/collects/holds money',
  )

  // ── 5. public/meta.json exists and is safe ─────────────────────────────
  console.log('\n5. public/meta.json')
  check(exists(META_JSON), '  5a. public/meta.json exists')

  const raw = read(META_JSON)
  let meta: Record<string, unknown>
  try {
    meta = JSON.parse(raw)
  } catch {
    fail('  5b. public/meta.json is valid JSON')
    return
  }
  check(meta.name === 'Vektrum',                              '  5b. meta.name === "Vektrum"')
  check(meta.url === 'https://vektrum.io',                    '  5c. meta.url === "https://vektrum.io"')
  check(typeof meta.description === 'string' && (meta.description as string).length > 0,
    '  5d. meta.description is a non-empty string')
  check(meta.type === 'website',                              '  5e. meta.type === "website"')

  // No leakage — must NOT contain emails, phone numbers, internal IDs,
  // service-role hints, secrets, or env-style keys.
  const lower = raw.toLowerCase()
  for (const banned of [
    '@vektrum',           // any email address
    'service_role',
    'service-role',
    'supabase_url',
    'supabase_anon',
    'stripe_',
    'sk_live',
    'sk_test',
    'rk_',
    'pk_live',
    'process.env',
    'admin_email',
    'resend_api_key',
  ]) {
    if (lower.includes(banned)) {
      fail(`  5f. public/meta.json must not contain "${banned}"`)
    }
  }
  // No phone-number-shaped strings
  if (/\+?\d[\d\-\s().]{8,}\d/.test(raw)) {
    fail('  5g. public/meta.json must not contain a phone-number-shaped string')
  }
  pass('  5f. public/meta.json contains no emails, secrets, env keys, or IDs')
  pass('  5g. public/meta.json contains no phone-number-shaped strings')

  // Only the four documented top-level keys
  const keys = Object.keys(meta).sort()
  const expected = ['description', 'name', 'type', 'url']
  check(
    JSON.stringify(keys) === JSON.stringify(expected),
    `  5h. public/meta.json keys === ${JSON.stringify(expected)} (got ${JSON.stringify(keys)})`,
  )

  // ── 6. Banned positioning claims remain absent on touched surfaces ─────
  console.log('\n6. Banned positioning claims absent on touched surfaces')
  const all = (demo + '\n' + res + '\n' + pricing + '\n' + raw).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum acts as escrow',
    'vektrum is escrow',
    'vektrum is a lender',
    'vektrum holds funds',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'automatic payment',
    'guarantees compliance',
    'guarantees payment',
    'prevents fraud',
  ]) {
    check(!all.includes(banned), `  6. banned: "${banned}" absent`)
  }

  // ── 7. Test wired into npm test ────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('site-cleanup-pass.test.ts'),
    '7. site-cleanup-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All site-cleanup-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
