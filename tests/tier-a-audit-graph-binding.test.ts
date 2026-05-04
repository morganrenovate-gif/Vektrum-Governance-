/**
 * tests/tier-a-audit-graph-binding.test.ts
 *
 * Pins Tier A of the patent-readiness work (memo candidate #4: hash-chained
 * authorization-state ledger tied to evidence-graph commitments).
 *
 * Scope:
 *   1. Migration 20260504000000 extends audit_log with the 5 binding columns
 *      and a hash_schema_version discriminator.
 *   2. compute_audit_hash() v2 includes the 5 binding columns in row_hash and
 *      stamps hash_schema_version = 2.
 *   3. verify_audit_chain() dispatches on hash_schema_version (NULL/1 → v1
 *      formula; 2 → v2 formula).
 *   4. AuditParams + logAudit() expose the 5 binding fields as optional inputs
 *      and pass them through to the audit_log insert.
 *   5. sha256OfCanonicalJson() produces order-independent hashes.
 *   6. Three real producers actually pass these hashes through:
 *        - DocuSign webhook         → webhook_delivery_hash
 *        - Partner releases/confirm → partner_ack_hash
 *        - Milestone release        → rail_confirmation_hash
 *   7. The test is wired into npm test in package.json.
 *
 * Run: npx tsx tests/tier-a-audit-graph-binding.test.ts
 */

import fs   from 'fs'
import path from 'path'
import { sha256OfCanonicalJson } from '@/lib/engine/audit'

const ROOT = path.resolve(process.cwd())
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Source files
const MIGRATION    = 'supabase/migrations/20260504000000_audit_chain_bind_external_hashes.sql'
const AUDIT_LIB    = 'src/lib/engine/audit.ts'
const DOCUSIGN_RTE = 'src/app/api/webhooks/docusign/route.ts'
const PARTNER_RTE  = 'src/app/api/partner/releases/[releaseId]/confirm/route.ts'
const RELEASE_RTE  = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const PACKAGE_JSON = 'package.json'

async function main() {

const migration  = read(MIGRATION)
const auditLib   = read(AUDIT_LIB)
const docusign   = read(DOCUSIGN_RTE)
const partnerRte = read(PARTNER_RTE)
const releaseRte = read(RELEASE_RTE)
const pkg        = read(PACKAGE_JSON)

const BINDING_COLUMNS = [
  'graph_snapshot_hash',
  'token_hash',
  'webhook_delivery_hash',
  'partner_ack_hash',
  'rail_confirmation_hash',
]

console.log('\n── 1. Migration adds 5 binding columns + version discriminator ─────────')

for (const col of BINDING_COLUMNS) {
  check(
    new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\s+TEXT`).test(migration),
    `Migration adds nullable TEXT column "${col}"`,
  )
  check(
    new RegExp(`COMMENT ON COLUMN public\\.audit_log\\.${col}`).test(migration),
    `Migration documents column "${col}" with a COMMENT ON COLUMN`,
  )
}
check(
  /ADD COLUMN IF NOT EXISTS hash_schema_version\s+SMALLINT/.test(migration),
  'Migration adds SMALLINT hash_schema_version discriminator',
)

console.log('\n── 2. v2 trigger function includes new fields + stamps version ─────────')

check(
  /CREATE OR REPLACE FUNCTION public\.compute_audit_hash\(\)/.test(migration),
  'Migration replaces compute_audit_hash()',
)
for (const col of BINDING_COLUMNS) {
  check(
    new RegExp(`COALESCE\\(NEW\\.${col}`).test(migration),
    `Trigger v2 formula references NEW.${col} via COALESCE`,
  )
}
check(
  /NEW\.hash_schema_version\s*:=\s*2;/.test(migration),
  'Trigger stamps hash_schema_version = 2 on every insert',
)
// chain_hash logic must remain SHA-256(row_hash || prev_chain) so the chain is
// continuous across the v1 → v2 boundary.
check(
  /digest\(NEW\.row_hash\s*\|\|\s*COALESCE\(v_prev_chain,\s*''\),\s*'sha256'\)/.test(migration),
  'chain_hash logic unchanged: SHA-256(row_hash || prev_chain) anchored to empty string',
)

console.log('\n── 3. verify_audit_chain dispatches on hash_schema_version ──────────────')

check(
  /CREATE OR REPLACE FUNCTION public\.verify_audit_chain/.test(migration),
  'Migration replaces verify_audit_chain()',
)
check(
  /v_version\s+SMALLINT/.test(migration),
  'verify_audit_chain declares a version local',
)
check(
  /COALESCE\(r\.hash_schema_version,\s*1\)/.test(migration),
  'verify_audit_chain treats version IS NULL as v1 (backward-compatible)',
)
check(
  /IF v_version = 2 THEN/.test(migration),
  'verify_audit_chain takes the v2 branch when version = 2',
)
// v2 branch must include all 5 binding fields in the recomputed input
for (const col of BINDING_COLUMNS) {
  check(
    new RegExp(`COALESCE\\(r\\.${col}`).test(migration),
    `verify_audit_chain v2 branch includes r.${col}`,
  )
}

console.log('\n── 4. AuditParams + logAudit pass 5 fields through ──────────────────────')

for (const col of BINDING_COLUMNS) {
  check(
    new RegExp(`${col}\\?\\:\\s*string\\s*\\|\\s*null`).test(auditLib),
    `AuditParams declares ${col} as optional string | null`,
  )
  check(
    new RegExp(`${col}:\\s*params\\.${col}\\s*\\?\\?\\s*null`).test(auditLib),
    `logAudit insert passes params.${col} through (?? null)`,
  )
}
// hash_schema_version must NOT be passed by application code — DB trigger sets it.
check(
  !/hash_schema_version:\s*params/.test(auditLib),
  'logAudit does NOT pass hash_schema_version (trigger-controlled)',
)

console.log('\n── 5. sha256OfCanonicalJson produces order-independent hashes ───────────')

const canonA = await sha256OfCanonicalJson({ b: 2, a: 1, nested: { y: 4, x: 3 } })
const canonB = await sha256OfCanonicalJson({ a: 1, nested: { x: 3, y: 4 }, b: 2 })
check(
  canonA === canonB,
  'sha256OfCanonicalJson is key-order-independent at every depth',
)
check(
  /^[0-9a-f]{64}$/.test(canonA),
  'sha256OfCanonicalJson returns lowercase hex SHA-256 (64 chars)',
)
// Array order MUST matter (positional semantics for amount vectors etc.)
const arrA = await sha256OfCanonicalJson([1, 2, 3])
const arrB = await sha256OfCanonicalJson([3, 2, 1])
check(
  arrA !== arrB,
  'sha256OfCanonicalJson preserves array order (positional semantics intact)',
)

console.log('\n── 6. Real producers thread hashes into logAudit ────────────────────────')

// DocuSign webhook → webhook_delivery_hash on every audit event
check(
  /import\s+\{\s*createHash\s*\}\s+from\s+'node:crypto'/.test(docusign),
  'DocuSign webhook imports createHash from node:crypto',
)
check(
  /createHash\('sha256'\)\.update\(rawBody\)\.digest\('hex'\)/.test(docusign),
  'DocuSign webhook computes SHA-256 of the raw body',
)
check(
  /webhookDeliveryHash/.test(docusign),
  'DocuSign webhook holds the hash in webhookDeliveryHash',
)
const dsAuditCount      = (docusign.match(/await logAudit\(\{/g) ?? []).length
const dsBindingCount    = (docusign.match(/webhook_delivery_hash:\s*webhookDeliveryHash/g) ?? []).length
check(
  dsAuditCount > 0 && dsBindingCount === dsAuditCount,
  `DocuSign webhook threads webhook_delivery_hash into all ${dsAuditCount} audit events (binding count = ${dsBindingCount})`,
)

// Partner /confirm → partner_ack_hash on every audit event
check(
  /import\s+\{\s*createHash\s*\}\s+from\s+'node:crypto'/.test(partnerRte),
  'Partner /confirm imports createHash from node:crypto',
)
check(
  /partnerAckHash/.test(partnerRte) &&
  /createHash\('sha256'\)\.update\(rawBody\)\.digest\('hex'\)/.test(partnerRte),
  'Partner /confirm hashes the inbound ack body',
)
const partnerAuditCount   = (partnerRte.match(/await logAudit\(\{/g) ?? []).length
const partnerBindingCount = (partnerRte.match(/partner_ack_hash:\s*partnerAckHash/g) ?? []).length
check(
  partnerAuditCount > 0 && partnerBindingCount === partnerAuditCount,
  `Partner /confirm threads partner_ack_hash into all ${partnerAuditCount} audit events (binding count = ${partnerBindingCount})`,
)

// Milestone release → rail_confirmation_hash on the success-path funds_released event
check(
  /import\s+\{\s*logAudit,\s*sha256OfCanonicalJson\s*\}\s+from\s+'@\/lib\/engine\/audit'/.test(releaseRte),
  'Milestone release imports sha256OfCanonicalJson from audit lib',
)
check(
  /railConfirmationHash\s*=\s*await\s+sha256OfCanonicalJson\(\{[\s\S]*?id:\s+transfer\.id/.test(releaseRte),
  'Milestone release computes railConfirmationHash from the canonical Stripe transfer payload',
)
check(
  /rail_confirmation_hash:\s*railConfirmationHash/.test(releaseRte),
  'Milestone release threads rail_confirmation_hash into the funds_released audit event',
)

console.log('\n── 7. Test wired into npm test ──────────────────────────────────────────')

check(
  pkg.includes('tier-a-audit-graph-binding.test.ts'),
  'tier-a-audit-graph-binding.test.ts is wired into the npm test pipeline',
)

console.log('\n✅  tier-a-audit-graph-binding: all checks passed\n')

}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
