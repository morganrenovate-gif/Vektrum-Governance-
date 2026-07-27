/**
 * tests/demo-procore-prototype.test.ts
 *
 * Behavioral + safety tests for the Procore × Vektrum partnership prototype at
 * /demo-live/procore. The workflow logic lives in a PURE reducer, so these are
 * real behavioral tests (no DOM needed) plus source-content safety scans.
 *
 * Coverage maps to the 32 required behaviors of the 2026-07 walkthrough
 * rebuild (marked [R1]..[R32]) on top of the original protections.
 *
 * Run: npx tsx tests/demo-procore-prototype.test.ts
 */
import fs from 'fs';
import path from 'path';
import {
  makeInitialContext, reducer, effectiveConditions, gateSummary, canAuthorize,
  buildAuditEvents, currentPreReview, financialImpact, snapshotId,
} from '../src/app/(marketing)/demo-live/procore/_lib/machine';
import {
  DISCLOSURE, project, draw, changeOrder, impact, gateConditions,
  IMPACT_STATEMENT, RAIL_AUTHORIZED_LINE, PARTNER_CONFIRMED_LINE,
  WRITEBACK_STATUS_LINE, REEVALUATING_LINE, CLOSING_LINE_1, CLOSING_LINE_2,
  MAPPING_CAVEAT, conceptualMappings, authorizationRecord, externalConfirmation,
} from '../src/app/(marketing)/demo-live/procore/_lib/fixtures';
import type { DemoContext } from '../src/app/(marketing)/demo-live/procore/_lib/types';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failures.push(msg); }
}
function statusOf(ctx: DemoContext, index: number) {
  return effectiveConditions(ctx).find((c) => c.index === index)!.status;
}

// ─── Canonical labels (Operating Constitution §6.1 — do not modify) ──────────
const CANONICAL_LABELS = [
  'Milestone status approved',
  'Protection status ready for release',
  'Sufficient funding or external funding confirmation',
  'Payout readiness verified for selected rail',
  'Contractor onboarding complete where required',
  'No existing active release for this milestone',
  'No open change orders on this milestone',
  'Signed contract on file',
  'Sequential-release ordering and prerequisites satisfied where required',
  'Approved conditional lien waiver on file where required',
];

// ─── 1. Initial state — simulated project workspace ──────────────────────────
let c = makeInitialContext();
ok(c.state === 'workspace', '[R31] initial state is the simulated project workspace');
ok(canAuthorize(c) === false, 'authorization unavailable initially');
ok(c.snapshotVersion === 1 && snapshotId(c) === 'SIM-SNAPSHOT-HPMC-07-V1',
  '[R17] initial evidence snapshot is SIM-SNAPSHOT-HPMC-07-V1');
ok(c.changeOrderStatus === 'pending', '[R9] CO-027 starts pending');
ok(c.lienWaiverStatus === 'unapproved', '[R10] lien waiver starts unapproved');

// ─── 2. Guards before evaluation ─────────────────────────────────────────────
let bad = reducer(c, { type: 'RESOLVE_SOURCE_RECORD', record: 'co_027' });
ok(bad.state === 'workspace', 'cannot resolve source records before evaluation');
bad = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(bad.state === 'workspace', 'cannot open authorization before evaluation');
bad = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(bad.state === 'workspace', '[R22] external confirmation impossible before evaluation');

// ─── 3. Evaluate against lender policy ───────────────────────────────────────
c = reducer(c, { type: 'EVALUATE' });
ok(c.state === 'review_blocked', 'EVALUATE → review_blocked');

// [R7] AI-assisted pre-review is complete (and blocking) BEFORE gate results
const pre1 = currentPreReview(c);
ok(pre1.riskLevel === 'critical' && pre1.observations.some((o) => o.kind === 'blocking'),
  '[R7] pre-review runs with the evaluation and reports blocking observations first');
ok(gateSummary(c).aiUnresolved === true,
  '[R7] AI requirement reported separately from the 10 conditions and unresolved initially');

// ─── 4. The 10 canonical conditions ─────────────────────────────────────────
const conds = effectiveConditions(c);
ok(conds.length === 10, '[R8] exactly 10 conditions');
ok(CANONICAL_LABELS.every((l, i) => conds[i].label === l),
  '[R8] all 10 canonical labels verbatim, in order');
ok(statusOf(c, 7) === 'blocked', '[R9] condition 7 blocked (CO-027 pending)');
ok(statusOf(c, 10) === 'blocked', '[R10] condition 10 blocked (waiver unapproved)');
ok(statusOf(c, 4) === 'not_applicable', '[R11] condition 4 not applicable (external rail)');

let g = gateSummary(c);
ok(g.passed === 7 && g.notApplicable === 1 && g.blocked === 2,
  `summary 7/1/2 after evaluation (got ${g.passed}/${g.notApplicable}/${g.blocked})`);
ok(g.authorizationAvailable === false, '[R18] authorization unavailable while blocked');

// ─── 5. Financial-impact isolation (the AHA) ─────────────────────────────────
const fi = financialImpact(c);
ok(changeOrder.amount === 160_000, '[R12] CO-027 fixture amount is $160,000');
ok(fi.affected === 160_000, '[R12] $160,000 is the affected scope');
ok(fi.unaffected === 2_020_000, '[R12] $2,020,000 is the unaffected evaluated gross scope');
ok(fi.affected + fi.unaffected === draw.grossRequested,
  '[R12] affected + unaffected === gross requested (no invented amounts)');
ok(fi.releaseUnit === draw.milestone,
  '[R12] impact is tied to the draw’s release unit (milestone)');
ok(fi.isolated === 160_000, '[R12] $160K isolated while CO-027 is pending');
ok(IMPACT_STATEMENT.includes('unaffected') && IMPACT_STATEMENT.includes('isolated for review')
  && IMPACT_STATEMENT.includes('Authorization remains unavailable'),
  '[R13] impact statement describes unaffected evaluated gross scope only');

// ─── 6. Resolve CO-027 at the simulated source ───────────────────────────────
c = reducer(c, { type: 'RESOLVE_SOURCE_RECORD', record: 'co_027' });
ok(c.changeOrderStatus === 'approved', '[R15] CO-027 approved at simulated source');
ok(c.lienWaiverStatus === 'unapproved', '[R15] waiver untouched by CO-027 resolution');
ok(statusOf(c, 7) === 'passed', '[R15] condition 7 passes after CO-027 approval');
ok(statusOf(c, 10) === 'blocked', '[R15] condition 10 still blocked (only its own evidence clears it)');
ok(c.snapshotVersion === 2 && snapshotId(c) === 'SIM-SNAPSHOT-HPMC-07-V2',
  '[R17] first source correction advances snapshot to V2');
ok(c.state === 'review_blocked', 'still review_blocked with one condition outstanding');
ok(canAuthorize(c) === false, '[R18] one resolved condition is not enough to authorize');
ok(financialImpact(c).isolated === 0, 'isolated amount clears once CO-027 is approved');
bad = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(bad.state === 'review_blocked', '[R18] authorization rejected with condition 10 outstanding');
// Re-resolving the same record is a no-op (deterministic; no double-advance)
bad = reducer(c, { type: 'RESOLVE_SOURCE_RECORD', record: 'co_027' });
ok(bad.snapshotVersion === 2, '[R17] repeat resolution does not advance the snapshot');

// ─── 7. Resolve the lien waiver at the simulated source ──────────────────────
c = reducer(c, { type: 'RESOLVE_SOURCE_RECORD', record: 'lien_waiver' });
ok(c.lienWaiverStatus === 'approved', '[R16] waiver approved at simulated source');
ok(statusOf(c, 10) === 'passed', '[R16] condition 10 passes after waiver approval');
ok(statusOf(c, 4) === 'not_applicable', '[R11] condition 4 REMAINS not applicable (never "passed")');
ok(c.snapshotVersion === 3 && snapshotId(c) === 'SIM-SNAPSHOT-HPMC-07-V3',
  '[R17] second source correction advances snapshot to V3');
ok(c.state === 'gate_ready', 'all applicable conditions satisfied → gate_ready');
const pre2 = currentPreReview(c);
ok(pre2.riskLevel === 'low' && pre2.observations.every((o) => o.kind === 'informational'),
  'pre-review resolves to low risk after both corrections');
g = gateSummary(c);
ok(g.passed === 9 && g.notApplicable === 1 && g.blocked === 0,
  `summary 9/1/0 after both corrections (got ${g.passed}/${g.notApplicable}/${g.blocked})`);
ok(g.aiUnresolved === false && g.authorizationAvailable === true,
  '[R18] authorization available only when every required condition is satisfied');

// ─── 8. Explicit funder authorization; non-funder actors rejected ────────────
bad = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(bad.state === 'gate_ready', '[R22] external confirmation rejected before authorization');

c = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(c.state === 'authorization_modal_open', 'authorization dialog opens');

for (const actor of ['admin', 'contractor', 'partner', 'ai'] as const) {
  bad = reducer(c, { type: 'RECORD_AUTHORIZATION', actor });
  ok(bad.state === 'authorization_modal_open' && !bad.authorizationRecorded,
    `[R20] ${actor} actor cannot record authorization`);
}

c = reducer(c, { type: 'RECORD_AUTHORIZATION', actor: 'funder' });
ok(c.state === 'authorization_recorded' && c.authorizationRecorded === true,
  '[R19] explicit funder action records the authorization');
ok(c.externalConfirmationRecorded === false,
  '[R21] authorizing does NOT confirm execution');

// ─── 9. Separate external confirmation ───────────────────────────────────────
c = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(c.state === 'external_confirmation_recorded' && c.externalConfirmationRecorded === true,
  '[R23] external confirmation recorded after authorization');
ok(c.authorizationRecorded === true && c.snapshotVersion === 3,
  '[R23] confirmation changes execution state without rewriting the authorization decision');
bad = reducer(c, { type: 'EVALUATE' });
ok(bad.state === 'external_confirmation_recorded', 'invalid transition (re-evaluate) rejected after confirmation');

// ─── 10. Deterministic reset ─────────────────────────────────────────────────
const reset = reducer(c, { type: 'RESET' });
ok(JSON.stringify(reset) === JSON.stringify(makeInitialContext()),
  '[R24] reset restores the EXACT initial fixture state');

// ─── 11. Audit timeline ──────────────────────────────────────────────────────
const audit = buildAuditEvents(c);
const refs = audit.map((e) => e.reference);
ok(refs.includes('DEMO-AUTH-HPMC-07'), 'audit includes funder authorization event');
ok(refs.includes('DEMO-MWTE-88241'), 'audit includes external confirmation event');
ok(audit.length >= 7, `audit timeline has full sequence (got ${audit.length})`);

// ─── 12. Identifiers are inert and demo-prefixed ─────────────────────────────
ok(/^(DEMO|MOCK|SIM)-/.test(project.projectNumber),
  `[R25] project identifier is demo-prefixed (${project.projectNumber})`);
ok(project.projectNumber === 'DEMO-HPMC-2026-014', '[R25] project id matches the approved fixture value');
ok(/^DEMO-/.test(authorizationRecord.authorizationId),
  '[R25] authorization id is demo-prefixed');
ok(/^DEMO-/.test(externalConfirmation.confirmationReference),
  '[R25] partner confirmation reference is demo-prefixed');
ok(refs.every((r) => /^(DEMO|MOCK|SIM)-/.test(r)),
  '[R25] every audit reference is demo-prefixed');

// ─── 13. Status-correct labels on mappings and write-back ────────────────────
ok(MAPPING_CAVEAT.includes('API feasibility and permissions not yet validated'),
  '[R26] conceptual-mapping caveat present');
ok(conceptualMappings.every((m) => m.prototypeStatus === 'conceptual' && m.apiValidated === false),
  '[R26] every mapping is conceptual and not API-validated');
ok(WRITEBACK_STATUS_LINE.includes('planned') && WRITEBACK_STATUS_LINE.includes('not implemented'),
  '[R27] write-back labeled planned, not implemented');
ok(REEVALUATING_LINE.startsWith('Simulated source record changed'),
  '[R15] source-change note labeled simulated (not webhook/live sync)');
ok(RAIL_AUTHORIZED_LINE ===
  'Release authorized. Payment execution would proceed through the selected partner-controlled rail.',
  'approved rail language verbatim');
ok(PARTNER_CONFIRMED_LINE ===
  'The simulated external partner subsequently confirmed execution through its own process.',
  'approved confirmation language verbatim');
ok(CLOSING_LINE_1 ===
  'Procore keeps the project record. Vektrum adds enforceable release governance before construction funds are disbursed.',
  'closing positioning line 1 verbatim');
ok(CLOSING_LINE_2 === 'Vektrum authorizes. The selected rail executes.',
  'closing positioning line 2 verbatim');

// ─── 14. Financial definitions stay coherent ─────────────────────────────────
ok(draw.grossRequested === 2_180_000 && draw.retainage === 109_000 && draw.netRepresented === 2_071_000,
  'gross/retainage/net match the verified fixture definitions');
ok(draw.grossRequested - draw.retainage === draw.netRepresented, 'net = gross − retainage');
ok(authorizationRecord.authorizedGrossAmount === draw.grossRequested,
  'authorized amount equals the full gross draw (no partial authorization)');
ok(impact.grossRequested === draw.grossRequested && impact.affectedByChangeOrder === changeOrder.amount,
  'impact constants derive from the fixture, not invented numbers');

// ─── 15/16. Source scans: purity, no partial-release claims, banned language ─
const ROOT = path.join(__dirname, '..', 'src', 'app', '(marketing)', 'demo-live', 'procore');
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  }).filter((f) => /\.(ts|tsx)$/.test(f));
}
const files = walk(ROOT);
const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const lower = corpus.toLowerCase();

const prohibitedImports = [
  '@/lib/supabase', 'supabase', 'stripe', 'jsonwebtoken', 'axios',
  '@/lib/engine/release-gate', '@/lib/engine/audit', '@/lib/auth/partner',
  '@/lib/engine/authorization-token', '@/lib/integrations/procore',
];
prohibitedImports.forEach((imp) => {
  ok(!new RegExp(`from ['"][^'"]*${imp.replace(/[/@]/g, '\\$&')}`, 'i').test(corpus),
    `[R5/R6] no import of ${imp}`);
});
ok(!/\bfetch\s*\(/.test(corpus), '[R3] no fetch() call');
ok(!/process\.env/.test(corpus), '[R4] no process.env usage');
ok(!/\boauth\b/i.test(corpus), '[R6] no OAuth');
ok(!/crypto\.|createHash|createSign|jwt\.sign/i.test(corpus), '[R6] no crypto / signing');

// [R14] no partial-authorization capability implied or created
ok(!lower.includes('can be released now'), '[R14] no "can be released now" claim');
ok(!lower.includes('released independently'), '[R14] no independent-release claim');
ok(!lower.includes('authorize the unaffected'), '[R14] no partial-authorization action');
ok(!/partial\s+(release|authorization)/i.test(corpus.replace(/no partial[^\n]*/gi, '')),
  '[R14] no partial release/authorization capability language');

// [R28/R29] banned integration + custody + AI-approval language
const banned = [
  'vektrum moves money', 'vektrum pays the contractor', 'vektrum executes payment',
  'vektrum initiates the wire', 'vektrum holds funds', 'vektrum trust account',
  'project trust account', 'escrow replacement', 'procore replacement',
  'better than procore pay', 'procore lacks', 'ai approves',
  'ai clears the payment', 'ai decides', 'automated ai payments', 'tamper-proof',
  'live procore integration', 'marketplace app', 'official partner', 'real-time sync',
  'validated api mapping', 'fully integrated', 'seamless integration',
  'procore-approved', 'procore partner', 'procore endorsement',
  'one-click payment', 'live project data', 'procore api records received',
  'evaluated in 14 seconds',
];
banned.forEach((phrase) => ok(!lower.includes(phrase), `[R28/R29] banned phrase absent: "${phrase}"`));
// No unlabeled processing-duration claims ("evaluated in N seconds")
ok(!/evaluated in \d+ ?(seconds|ms)/i.test(corpus), '[R28] no claimed processing duration');

// [R1] mandatory disclosure verbatim in source
ok(corpus.includes(
  'Simulated integration concept — fictional demo data only. No external system is connected and no funds are moved.',
), '[R1] mandatory disclosure present verbatim in source');
ok(DISCLOSURE ===
  'Simulated integration concept — fictional demo data only. No external system is connected and no funds are moved.',
  '[R1] DISCLOSURE constant is verbatim');

// [R2/R30] fixture-driven only: no imports from outside the prototype directory
// except React/next/lucide presentational deps.
const importLines = corpus.match(/from ['"][^'"]+['"]/g) ?? [];
const allowedExternal = /^from ['"](react|next|lucide-react|\.)/;
ok(importLines.every((l) => allowedExternal.test(l.trim())),
  '[R2/R30] prototype imports only React/Next/lucide + local fixture modules');

// ─── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n❌ demo-procore-prototype: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error('   - ' + f));
  process.exit(1);
}
console.log(`✅ demo-procore-prototype: all ${passed} checks passed`);
