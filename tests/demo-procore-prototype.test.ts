/**
 * tests/demo-procore-prototype.test.ts
 *
 * Behavioral + safety tests for the Procore × Vektrum MILESTONE-ISOLATION
 * prototype at /demo-live/procore. The workflow logic lives in a PURE reducer
 * that drives the REAL reconciliation engine (src/lib/engine/release-units.ts),
 * so these are real behavioral tests (no DOM needed) plus source-content safety
 * scans. Proves: one unit isolated while three continue, scoped two-round
 * authorization that never includes the isolated amount, resolution + separate
 * re-authorization, safe reset, and truthful copy.
 *
 * Run: npx tsx tests/demo-procore-prototype.test.ts
 */
import fs from 'fs';
import path from 'path';
import {
  makeInitialContext, reducer, effectiveConditions, gateSummary,
  canAuthorize, canAuthorizeEligible, canAuthorizeResolved,
  drawReconciliation, authorizationScope, buildAuditEvents,
} from '../src/app/(marketing)/demo-live/procore/_lib/machine';
import { authEligible, authResolved, ISOLATED_UNIT_ID } from '../src/app/(marketing)/demo-live/procore/_lib/fixtures';
import type { DemoContext } from '../src/app/(marketing)/demo-live/procore/_lib/types';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) { if (cond) { passed++; } else { failures.push(msg); } }
function statusOf(ctx: DemoContext, index: number) {
  return effectiveConditions(ctx).find((c) => c.index === index)!.status;
}

// ─── 1. Initial state ────────────────────────────────────────────────────────
let c = makeInitialContext();
ok(c.state === 'snapshot_available', '1. initial state is snapshot_available');
ok(canAuthorize(c) === false, '1. authorization unavailable initially');

// ─── 2. Invalid transitions before import ────────────────────────────────────
ok(reducer(c, { type: 'RUN_PRE_REVIEW' }).state === 'snapshot_available', '2. RUN_PRE_REVIEW before import rejected');
ok(reducer(c, { type: 'OPEN_AUTHORIZATION', round: 'eligible' }).state === 'snapshot_available', '2. OPEN eligible before import rejected');

// ─── 3. Import → snapshot_imported ───────────────────────────────────────────
c = reducer(c, { type: 'IMPORT_SNAPSHOT' });
ok(c.state === 'snapshot_imported', '3. import → snapshot_imported');

// ─── 4. Pre-review → review_isolated ─────────────────────────────────────────
c = reducer(c, { type: 'RUN_PRE_REVIEW' });
ok(c.state === 'review_isolated', '4. run pre-review → review_isolated');

// ─── 5. Isolated unit gate: 7 & 10 blocked, 4 N/A ────────────────────────────
ok(statusOf(c, 7) === 'blocked', '5. condition 7 blocked (open change order) on isolated unit');
ok(statusOf(c, 10) === 'blocked', '5. condition 10 blocked (waiver) on isolated unit');
ok(statusOf(c, 4) === 'not_applicable', '5. condition 4 not applicable (external rail)');
let g = gateSummary(c);
ok(g.passed === 7 && g.notApplicable === 1 && g.blocked === 2, `5. isolated-unit summary 7/1/2 (got ${g.passed}/${g.notApplicable}/${g.blocked})`);

// ─── 6. Reconciliation exact; isolated $310K/$294.5K; eligible $1,776,500 ─────
let recon = drawReconciliation(c);
ok(recon.drawGross === 2_180_000, `6. draw gross $2,180,000 (got ${recon.drawGross})`);
ok(recon.retainageWithheld === 109_000, `6. retainage $109,000 (got ${recon.retainageWithheld})`);
ok(recon.drawNet === 2_071_000, `6. net $2,071,000 (got ${recon.drawNet})`);
ok(recon.isolatedGross === 310_000 && recon.isolatedNet === 294_500, `6. isolated $310,000/$294,500 (got ${recon.isolatedGross}/${recon.isolatedNet})`);
ok(recon.eligibleGross === 1_870_000 && recon.eligibleNet === 1_776_500, `6. eligible $1,870,000/$1,776,500 (got ${recon.eligibleGross}/${recon.eligibleNet})`);
ok(recon.eligibleGross + recon.isolatedGross + recon.alreadyReleasedGross === recon.drawGross, '6. partition reconciles exactly');

// ─── 7. Round-1 scope EXCLUDES the isolated unit ─────────────────────────────
let scope = authorizationScope(c);
ok(!scope.unitIds.includes(ISOLATED_UNIT_ID), '7. eligible scope excludes the isolated unit');
ok(scope.excludedIsolatedUnitIds.includes(ISOLATED_UNIT_ID), '7. isolated unit explicitly excluded');
ok(scope.netAmount === 1_776_500, `7. authorizable net $1,776,500 (got ${scope.netAmount})`);
ok(canAuthorizeEligible(c) === true && canAuthorizeResolved(c) === false, '7. only the eligible round is authorizable now');
// Fixture record agrees with the computed engine scope.
ok(authEligible.authorizedNetAmount === scope.netAmount, '7. authEligible record net matches computed scope');
ok(authEligible.excludedUnitIds.includes(ISOLATED_UNIT_ID), '7. authEligible record excludes the isolated unit');

// ─── 8. Source updates cannot be staged before eligible units authorized ─────
ok(reducer(c, { type: 'STAGE_SOURCE_UPDATE', update: 'co_approved' }).state === 'review_isolated', '8. staging rejected before eligible authorization');
ok(reducer(c, { type: 'OPEN_AUTHORIZATION', round: 'resolved' }).state === 'review_isolated', '8. resolved-round authorization rejected before resolution');

// ─── 9. Authorize eligible units (round 1) ───────────────────────────────────
c = reducer(c, { type: 'OPEN_AUTHORIZATION', round: 'eligible' });
ok(c.state === 'authorize_eligible_open', '9. eligible authorization dialog opens');
c = reducer(c, { type: 'RECORD_AUTHORIZATION' });
ok(c.state === 'eligible_authorized' && c.eligibleAuthorized === true, '9. eligible units authorized');
ok(c.resolvedAuthorized === false, '9. resolved unit NOT authorized by round 1');
// The isolated amount was never authorizable in round 1 → still contained.
recon = drawReconciliation(c);
ok(recon.isolatedGross === 310_000, '9. isolated amount still contained after round 1');

// ─── 10. Genuine gating: RECORD_EXTERNAL_CONFIRMATION impossible pre-resolve ──
ok(reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' }).state === 'eligible_authorized', '10. external confirmation rejected before resolved authorization');

// ─── 11. Stage BOTH source corrections, then receive updated snapshot ────────
let one = reducer(c, { type: 'STAGE_SOURCE_UPDATE', update: 'co_approved' });
ok(one.state === 'eligible_authorized', '11. one correction staged → still eligible_authorized');
ok(reducer(one, { type: 'RECEIVE_UPDATED_SNAPSHOT' }).state === 'eligible_authorized', '11. cannot receive snapshot with one correction');
c = reducer(one, { type: 'STAGE_SOURCE_UPDATE', update: 'waiver_approved' });
ok(c.state === 'source_updates_staged', '11. both corrections staged → source_updates_staged');
c = reducer(c, { type: 'RECEIVE_UPDATED_SNAPSHOT' });
ok(c.state === 'isolated_resolved' && c.isolatedResolved === true, '11. updated snapshot → isolated_resolved');
ok(c.riskLevel === 'low', '11. risk drops to Low after resolution');
ok(statusOf(c, 7) === 'passed' && statusOf(c, 10) === 'passed', '11. conditions 7 & 10 now pass on the resolved unit');
ok(statusOf(c, 4) === 'not_applicable', '11. condition 4 remains not applicable (never "passed")');

// ─── 12. Round-2 scope is JUST the resolved unit; net $294,500 ───────────────
scope = authorizationScope(c);
ok(scope.unitIds.length === 1 && scope.unitIds[0] === ISOLATED_UNIT_ID, '12. resolved scope is exactly the previously-isolated unit');
ok(scope.netAmount === 294_500, `12. resolved authorizable net $294,500 (got ${scope.netAmount})`);
ok(canAuthorizeResolved(c) === true, '12. resolved round is now authorizable');
ok(authResolved.authorizedNetAmount === scope.netAmount, '12. authResolved record net matches computed scope');

// ─── 13. Authorize resolved unit (round 2) — separate record ─────────────────
c = reducer(c, { type: 'OPEN_AUTHORIZATION', round: 'resolved' });
ok(c.state === 'authorize_resolved_open', '13. resolved authorization dialog opens');
c = reducer(c, { type: 'RECORD_AUTHORIZATION' });
ok(c.state === 'resolved_authorized' && c.resolvedAuthorized === true, '13. resolved unit authorized');
ok(authEligible.authorizationId !== authResolved.authorizationId, '13. the two authorizations are distinct records');
ok(c.externalConfirmationRecorded === false, '13. authorizing does NOT confirm execution');

// ─── 14. External confirmation after both authorizations ─────────────────────
c = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(c.state === 'external_confirmation_recorded', '14. external confirmation recorded');

// ─── 15. Invalid transition after issue is rejected ──────────────────────────
ok(reducer(c, { type: 'IMPORT_SNAPSHOT' }).state === 'external_confirmation_recorded', '15. re-import rejected after issue');

// ─── 16. Reset restores the EXACT initial state (idempotent, demo-scoped) ─────
ok(JSON.stringify(reducer(c, { type: 'RESET' })) === JSON.stringify(makeInitialContext()), '16. reset restores exact initial fixture state');
ok(JSON.stringify(reducer(reducer(c, { type: 'RESET' }), { type: 'RESET' })) === JSON.stringify(makeInitialContext()), '16. reset is idempotent');

// ─── 17. Audit shows containment AND resolution AND both authorizations ───────
const audit = buildAuditEvents(c);
const refs = audit.map((e) => e.reference);
ok(refs.includes('DEMO-EVT-ISOLATE-STEEL'), '17. audit records the containment decision');
ok(refs.includes('DEMO-EVT-REEVAL-STEEL'), '17. audit records the re-evaluation after resolution');
ok(refs.includes('DEMO-AUTH-HPMC-07A'), '17. audit records the eligible-units authorization');
ok(refs.includes('DEMO-AUTH-HPMC-07B'), '17. audit records the separate resolved-unit authorization');
ok(refs.includes('DEMO-MWTE-88241'), '17. audit records the external confirmation');
ok(audit.length >= 9, `17. audit timeline has the full sequence (got ${audit.length})`);

// ─── 18. Source scans: shared-logic import present; production runtime absent ─
const ROOT = path.join(__dirname, '..', 'src', 'app', '(marketing)', 'demo-live', 'procore');
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  }).filter((f) => /\.(ts|tsx)$/.test(f));
}
const corpus = walk(ROOT).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const lower = corpus.toLowerCase();

// The demo MUST use the real, pure reconciliation engine (not a scripted fake).
ok(/from ['"]@\/lib\/engine\/release-units['"]/.test(corpus), '18. demo imports the real release-units engine (shared logic)');

// …but MUST NOT reach any I/O / authorization / audit runtime.
const prohibitedImports = [
  '@/lib/supabase', 'supabase', 'stripe', 'jsonwebtoken', 'axios',
  '@/lib/engine/release-gate', '@/lib/engine/audit', '@/lib/auth/partner',
];
prohibitedImports.forEach((imp) => {
  ok(!new RegExp(`from ['"][^'"]*${imp.replace(/[/@]/g, '\\$&')}`, 'i').test(corpus), `18. no import of ${imp}`);
});
ok(!/\bfetch\s*\(/.test(corpus), '18. no fetch() call');
ok(!/process\.env/.test(corpus), '18. no process.env usage');
ok(!/\boauth\b/i.test(corpus), '18. no OAuth');
ok(!/crypto\.|createHash|createSign|jwt\.sign/i.test(corpus), '18. no crypto / signing');

const banned = [
  'vektrum moves money', 'vektrum pays the contractor', 'vektrum executes payment',
  'vektrum initiates the wire', 'vektrum holds funds', 'vektrum trust account',
  'project trust account', 'escrow replacement', 'procore replacement',
  'better than procore pay', 'procore lacks payment controls', 'ai approves',
  'ai clears the payment', 'ai decides', 'automated ai payments', 'tamper-proof',
  'live procore integration', 'marketplace app', 'official partner', 'real-time sync',
  'validated api mapping',
];
banned.forEach((phrase) => ok(!lower.includes(phrase), `19. banned phrase absent: "${phrase}"`));

// Required disclosure + funds/execution copy present in the prototype source.
ok(lower.includes('simulated integration concept'), '19. disclosure text present in source');
ok(lower.includes('no real funds are moved'), '19. "no real funds are moved" copy present');
ok(lower.includes('payment execution would flow through the selected rail'), '19. execution-rail copy present');

// ─── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n❌ demo-procore-prototype: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error('   - ' + f));
  process.exit(1);
}
console.log(`✅ demo-procore-prototype: all ${passed} checks passed`);
