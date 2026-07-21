/**
 * tests/demo-procore-prototype.test.ts
 *
 * Behavioral + safety tests for the Procore × Vektrum partnership prototype at
 * /demo-live/procore. The workflow logic lives in a PURE reducer, so these are
 * real behavioral tests (no DOM needed) plus source-content safety scans.
 *
 * Run: npx tsx tests/demo-procore-prototype.test.ts
 */
import fs from 'fs';
import path from 'path';
import {
  makeInitialContext, reducer, effectiveConditions, gateSummary, canAuthorize,
  buildAuditEvents,
} from '../src/app/(marketing)/demo-live/procore/_lib/machine';
import type { DemoContext } from '../src/app/(marketing)/demo-live/procore/_lib/types';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failures.push(msg); }
}
function statusOf(ctx: DemoContext, index: number) {
  return effectiveConditions(ctx).find((c) => c.index === index)!.status;
}

// ─── 1. Initial state ────────────────────────────────────────────────────────
let c = makeInitialContext();
ok(c.state === 'snapshot_available', '1. initial state is snapshot_available');
ok(canAuthorize(c) === false, '1. authorization unavailable initially');

// ─── 2. Cannot review before import (invalid transition rejected) ────────────
let bad = reducer(c, { type: 'RUN_PRE_REVIEW' });
ok(bad.state === 'snapshot_available', '2. RUN_PRE_REVIEW before import is rejected (unchanged)');
bad = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(bad.state === 'snapshot_available', '2. OPEN_AUTHORIZATION before import is rejected');

// ─── 3. Import transitions correctly ─────────────────────────────────────────
c = reducer(c, { type: 'IMPORT_SNAPSHOT' });
ok(c.state === 'snapshot_imported', '3. import → snapshot_imported');

// ─── 4. Pre-review → review_blocked with two exceptions ──────────────────────
c = reducer(c, { type: 'RUN_PRE_REVIEW' });
ok(c.state === 'review_blocked', '4. run pre-review → review_blocked');

// ─── 5. Conditions 7 & 10 blocked, 4 not applicable ──────────────────────────
ok(statusOf(c, 7) === 'blocked', '5. condition 7 blocked (open change order)');
ok(statusOf(c, 10) === 'blocked', '5. condition 10 blocked (waiver not approved)');
ok(statusOf(c, 4) === 'not_applicable', '6. condition 4 not applicable (external rail)');

// ─── 6/7. Gate summary + authorization unavailable while blocked ─────────────
let g = gateSummary(c);
ok(g.passed === 7 && g.notApplicable === 1 && g.blocked === 2, `7. summary 7/1/2 (got ${g.passed}/${g.notApplicable}/${g.blocked})`);
ok(g.aiUnresolved === true, '7. AI pre-review unresolved before updates');
ok(g.authorizationAvailable === false, '7. authorization unavailable while blocked');
ok(canAuthorize(c) === false, '7. canAuthorize false while blocked');
bad = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(bad.state === 'review_blocked', '7. OPEN_AUTHORIZATION rejected while blocked');

// ─── 8. One source update alone is insufficient ──────────────────────────────
let one = reducer(c, { type: 'STAGE_SOURCE_UPDATE', update: 'co_approved' });
ok(one.state === 'review_blocked', '8. one update staged → still review_blocked');
let recv = reducer(one, { type: 'RECEIVE_UPDATED_SNAPSHOT' });
ok(recv.state === 'review_blocked', '8. cannot receive updated snapshot with only one update');
ok(statusOf(recv, 7) === 'blocked' && statusOf(recv, 10) === 'blocked', '8. conditions still blocked with one update');

// ─── 9/10/11. Both updates required → updated snapshot, risk Low, all pass ────
c = reducer(one, { type: 'STAGE_SOURCE_UPDATE', update: 'waiver_approved' });
ok(c.state === 'source_updates_staged', '9. both updates staged → source_updates_staged');
c = reducer(c, { type: 'RECEIVE_UPDATED_SNAPSHOT' });
ok(c.state === 'gate_ready', '10. both updates + receive → gate_ready');
ok(c.riskLevel === 'low', '10. updated snapshot changes risk to Low');
ok(c.aiRequirementSatisfied === true, '10. AI-assisted requirement satisfied after update');
ok(statusOf(c, 7) === 'passed' && statusOf(c, 10) === 'passed', '11. conditions 7 & 10 pass after update');
ok(statusOf(c, 4) === 'not_applicable', '11. condition 4 remains not applicable (never "passed")');
g = gateSummary(c);
ok(g.passed === 9 && g.notApplicable === 1 && g.blocked === 0, `11. summary 9/1/0 (got ${g.passed}/${g.notApplicable}/${g.blocked})`);
ok(g.authorizationAvailable === true, '11. authorization available when all applicable pass');

// ─── 12. External confirmation impossible before authorization ───────────────
bad = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(bad.state === 'gate_ready', '15. external confirmation rejected before authorization');

// ─── 13. Authorization recorded; execution NOT confirmed by authorizing ──────
c = reducer(c, { type: 'OPEN_AUTHORIZATION' });
ok(c.state === 'authorization_modal_open', '20. authorization modal opens');
c = reducer(c, { type: 'RECORD_AUTHORIZATION' });
ok(c.state === 'authorization_recorded', '13. authorization recorded');
ok(c.authorizationRecorded === true, '13. authorizationRecorded true');
ok(c.externalConfirmationRecorded === false, '14. authorizing does NOT confirm execution');

// ─── 14. External confirmation after authorization ───────────────────────────
c = reducer(c, { type: 'RECORD_EXTERNAL_CONFIRMATION' });
ok(c.state === 'external_confirmation_recorded', '14. external confirmation recorded after authorization');

// ─── 16. Issued authorization record cannot be re-imported / changed ─────────
bad = reducer(c, { type: 'IMPORT_SNAPSHOT' });
ok(bad.state === 'external_confirmation_recorded', '17. invalid transition (re-import) rejected after issue');

// ─── 15. Reset restores the EXACT initial state ──────────────────────────────
const reset = reducer(c, { type: 'RESET' });
ok(JSON.stringify(reset) === JSON.stringify(makeInitialContext()), '16. reset restores exact initial fixture state');

// ─── 17. Audit timeline reflects progress ────────────────────────────────────
const audit = buildAuditEvents(c);
const refs = audit.map((e) => e.reference);
ok(refs.includes('DEMO-AUTH-HPMC-07'), '17. audit includes funder authorization event');
ok(refs.includes('DEMO-MWTE-88241'), '17. audit includes external confirmation event');
ok(audit.length >= 7, `17. audit timeline has full sequence (got ${audit.length})`);

// ─── 18/19. Source scans: no production imports, no banned language ──────────
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

// Required disclosure present in the prototype source.
ok(lower.includes('simulated integration concept'), '2. disclosure text present in source');

// ─── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n❌ demo-procore-prototype: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error('   - ' + f));
  process.exit(1);
}
console.log(`✅ demo-procore-prototype: all ${passed} checks passed`);
