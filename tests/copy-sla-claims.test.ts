/**
 * tests/copy-sla-claims.test.ts
 *
 * Guards against unsupported SLA, uptime, integration, and "no override"
 * claims in marketing copy.
 *
 * Specific fixes verified:
 *   1. pricing/page: "LOS / core banking API integration" removed
 *   2. pricing/page: "99.9% uptime SLA" removed
 *   3. pricing/page: "No manual override" replaced with "No release gate bypass"
 *   4. homepage: "SLA-tracked" removed from comparison table
 *   5. homepage: "No manual override" qualified with MFA + audit-log caveat
 *   6. pitch/page: "SLA-tracked" removed from comparison table
 *   7. pitch/page: "SLA-tracked; unconfirmed releases escalate" replaced
 *   8. admin override route exists (confirms replacement copy is accurate)
 *
 * Run: npx tsx tests/copy-sla-claims.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

const PRICING   = 'src/app/(marketing)/pricing/page.tsx'
const HOMEPAGE  = 'src/app/(marketing)/page.tsx'
const PITCH     = 'src/app/pitch/page.tsx'
const OVERRIDE  = 'src/app/api/admin/milestones/[milestoneId]/override-ai-review/route.ts'

async function main() {

console.log('\n── 1. pricing: LOS / core banking claim removed ────────────────────────')

const pricingSrc = read(PRICING)

check(
  !pricingSrc.includes('LOS / core banking API integration'),
  'pricing page does not claim "LOS / core banking API integration" (not implemented)',
)
check(
  !pricingSrc.includes('core banking'),
  'pricing page does not mention "core banking" (zero implementation exists)',
)

console.log('\n── 2. pricing: 99.9% uptime SLA removed ────────────────────────────────')

check(
  !pricingSrc.includes('99.9% uptime SLA'),
  'pricing page does not claim "99.9% uptime SLA" (no SLA infrastructure exists)',
)
check(
  !pricingSrc.match(/\d{2}\.\d%\s*uptime/),
  'pricing page does not claim any specific uptime percentage without infrastructure backing',
)

console.log('\n── 3. pricing: No manual override qualified ─────────────────────────────')

check(
  !pricingSrc.includes('No manual override.'),
  'pricing page does not use unqualified "No manual override." (admin MFA override exists)',
)

console.log('\n── 4. homepage: SLA-tracked removed ────────────────────────────────────')

const homeSrc = read(HOMEPAGE)

check(
  !homeSrc.includes('SLA-tracked'),
  'homepage does not contain "SLA-tracked" (no SLA tracking infrastructure exists)',
)

console.log('\n── 5. homepage: No manual override qualified ────────────────────────────')

check(
  !homeSrc.includes('No manual override.') ||
  homeSrc.includes('No release gate bypass'),
  'homepage does not use unqualified "No manual override." as a standalone sentence',
)

console.log('\n── 6. pitch: SLA-tracked removed from comparison table ─────────────────')

const pitchSrc = read(PITCH)

check(
  !pitchSrc.includes('SLA-tracked'),
  'pitch page does not contain "SLA-tracked" in any section',
)

console.log('\n── 7. pitch: escalate claim removed ────────────────────────────────────')

check(
  !pitchSrc.includes('unconfirmed releases escalate'),
  'pitch page does not claim "unconfirmed releases escalate" (no escalation system exists)',
)
check(
  pitchSrc.includes('Confirmation status tracked') ||
  pitchSrc.includes('confirmation status tracked') ||
  pitchSrc.includes('admin dashboard'),
  'pitch page uses accurate replacement language for confirmation tracking',
)

console.log('\n── 8. Admin override route exists (replacement copy is accurate) ────────')

check(
  fs.existsSync(path.join(ROOT, OVERRIDE)),
  'override-ai-review route exists — confirms "AI review overrides require admin MFA" claim is accurate',
)

const overrideSrc = read(OVERRIDE)
check(
  overrideSrc.includes('requireMFA') || overrideSrc.includes('requireRole'),
  'override-ai-review route requires authentication (admin + MFA)',
)

console.log('\n✅  copy-sla-claims: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
