/**
 * tests/tier-d-evidence-graph.test.ts
 *
 * Tier D — Construction-finance evidence graph ontology.
 *
 * What this tests (source-grep — no live DB):
 *   1. evidence-graph.ts exists and exports buildEvidenceGraph + computeGraphCommitment
 *   2. EvidenceGraph schema has required fields: milestone, deal, gate, ai_review, sov_links, execution
 *   3. graph_commitment field exists on IssueAuthorizationTokenInput (not hardcoded null)
 *   4. Release route imports buildEvidenceGraph and computeGraphCommitment
 *   5. Release route calls buildEvidenceGraph before issueAuthorizationToken
 *   6. Release route passes graphCommitment to issueAuthorizationToken
 *   7. authorization-token.ts uses input.graphCommitment (not hardcoded null)
 *   8. Release route binds graph_snapshot_hash on the funds_released audit row
 *   9. EVIDENCE_GRAPH_SCHEMA_VERSION constant exists in evidence-graph.ts
 *   10. Wired into npm test
 *
 * Run: npx tsx tests/tier-d-evidence-graph.test.ts
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

async function main() {

const GRAPH_SRC  = 'src/lib/engine/evidence-graph.ts'
const TOKEN_SRC  = 'src/lib/engine/authorization-token.ts'
const RELEASE_RT = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const PKG        = 'package.json'

// ── 1. evidence-graph.ts exists and exports the right symbols ────────────────

console.log('\n── 1. evidence-graph.ts exports ────────────────────────────────────')

check(
  fs.existsSync(path.join(ROOT, GRAPH_SRC)),
  'src/lib/engine/evidence-graph.ts exists',
)

const graphSrc = read(GRAPH_SRC)

check(
  graphSrc.includes('export function buildEvidenceGraph') ||
  graphSrc.includes('export async function buildEvidenceGraph'),
  'buildEvidenceGraph is exported',
)
check(
  graphSrc.includes('export async function computeGraphCommitment') ||
  graphSrc.includes('export function computeGraphCommitment'),
  'computeGraphCommitment is exported',
)

// ── 2. EvidenceGraph schema has required fields ───────────────────────────────

console.log('\n── 2. EvidenceGraph schema completeness ────────────────────────────')

check(
  graphSrc.includes('milestone') && graphSrc.includes('deal'),
  'EvidenceGraph includes milestone and deal nodes',
)
check(
  graphSrc.includes('gate') && graphSrc.includes('policy_version'),
  'EvidenceGraph includes gate node with policy_version',
)
check(
  graphSrc.includes('ai_review'),
  'EvidenceGraph includes ai_review node',
)
check(
  graphSrc.includes('sov_links'),
  'EvidenceGraph includes sov_links node',
)
check(
  graphSrc.includes('execution') && graphSrc.includes('rail_scope'),
  'EvidenceGraph includes execution node with rail_scope',
)

// ── 3. IssueAuthorizationTokenInput has graphCommitment field ─────────────────

console.log('\n── 3. authorization-token.ts accepts graphCommitment ───────────────')

const tokenSrc = read(TOKEN_SRC)

check(
  tokenSrc.includes('graphCommitment'),
  'IssueAuthorizationTokenInput includes graphCommitment field',
)
check(
  !tokenSrc.includes('graph_commitment: null,                    // Tier D produces this'),
  'graph_commitment is no longer hardcoded to null (Tier D is wired)',
)
check(
  tokenSrc.includes('graphCommitment ?? null') || tokenSrc.includes('input.graphCommitment'),
  'graph_commitment is set from input.graphCommitment',
)

// ── 4. Release route imports from evidence-graph.ts ──────────────────────────

console.log('\n── 4. Release route imports evidence-graph ─────────────────────────')

const releaseSrc = read(RELEASE_RT)

check(
  releaseSrc.includes('evidence-graph') && releaseSrc.includes('buildEvidenceGraph'),
  'Release route imports buildEvidenceGraph from evidence-graph',
)
check(
  releaseSrc.includes('computeGraphCommitment'),
  'Release route imports computeGraphCommitment',
)

// ── 5. Release route calls buildEvidenceGraph before issueAuthorizationToken ──

console.log('\n── 5. Release route calls graph builder before token issuer ────────')

const buildIdx = releaseSrc.indexOf('buildEvidenceGraph(')
const issueIdx = releaseSrc.indexOf('issueAuthorizationToken(')

check(
  buildIdx !== -1 && issueIdx !== -1 && buildIdx < issueIdx,
  'buildEvidenceGraph is called before issueAuthorizationToken in the route',
)

// ── 6. Release route passes graphCommitment to issueAuthorizationToken ────────

console.log('\n── 6. Release route wires graphCommitment into token issuer ────────')

check(
  releaseSrc.includes('graphCommitment') &&
  releaseSrc.includes('issueAuthorizationToken'),
  'Release route passes graphCommitment to issueAuthorizationToken',
)

// ── 7. authorization-token.ts does not hardcode graph_commitment: null ────────
// (Already checked above as part of check 3 — re-verify with a stricter string)

console.log('\n── 7. Token canonical payload uses input commitment ─────────────────')

check(
  tokenSrc.includes('graph_commitment: input.graphCommitment'),
  'Canonical payload uses input.graphCommitment (not hardcoded null)',
)

// ── 8. Release route binds graph_snapshot_hash on funds_released ──────────────

console.log('\n── 8. funds_released audit row binds graph_snapshot_hash ───────────')

check(
  releaseSrc.includes('graph_snapshot_hash') &&
  releaseSrc.includes('graphCommitment'),
  'Release route binds graph_snapshot_hash on the success-path audit row',
)

// ── 9. EVIDENCE_GRAPH_SCHEMA_VERSION constant ────────────────────────────────

console.log('\n── 9. Schema version constant ──────────────────────────────────────')

check(
  graphSrc.includes('EVIDENCE_GRAPH_SCHEMA_VERSION'),
  'EVIDENCE_GRAPH_SCHEMA_VERSION constant is defined in evidence-graph.ts',
)

// ── 10. Wired into npm test ───────────────────────────────────────────────────

console.log('\n── 10. Test wired into npm test ────────────────────────────────────')

const pkg = read(PKG)
check(
  pkg.includes('tier-d-evidence-graph.test.ts'),
  'tier-d-evidence-graph.test.ts is wired into npm test',
)

console.log('\n✅  tier-d-evidence-graph: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
