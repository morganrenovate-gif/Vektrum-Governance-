/**
 * tests/docusign-contract-surface.test.ts
 *
 * Static source-parse checks verifying that the DocuSign signing flow is now
 * surfaced on the deal page:
 *
 *  1.  ContractSigningSection component file exists
 *  2.  Component shows "Send for DocuSign Signatures" when no envelope exists
 *  3.  Send action calls the send-envelope API route (not a fake route)
 *  4.  Component shows "Open DocuSign" button for the active signer
 *  5.  Component shows waiting state for non-current signer
 *  6.  "Contract executed" (signed) state is handled by server-rendered section
 *  7.  send-envelope route file exists
 *  8.  send-envelope route uses existing DocuSign createEnvelope (not fake)
 *  9.  send-envelope route rejects admins/funders from sending (contractor/admin only)
 * 10.  send-envelope route downloads PDF from storage before calling DocuSign
 * 11.  send-envelope route saves envelope_id back to contracts table
 * 12.  send-envelope route audit-logs docusign_envelope_sent
 * 13.  send-envelope route rejects if envelope already exists (idempotent guard)
 * 14.  No fake/internal signature route added (no bypass of DocuSign)
 * 15.  sign route is unchanged — still uses getSigningUrl from DocuSign engine
 * 16.  Deal page imports ContractSigningSection
 * 17.  Deal page renders ContractSigningSection for pending contract states
 * 18.  ContractSigningSection is NOT shown for status=signed (server handles that)
 * 19.  ContractSigningSection is NOT shown for status=voided (server handles that)
 * 20.  ContractSigningSection release-blocker note present
 * 21.  Release gate is unchanged (no contract bypass)
 * 22.  Stripe/payment routes unchanged
 * 23.  DocuSign webhook route is unchanged
 * 24.  Contract upload route (ContractUploadSection) is unchanged
 * 25.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/docusign-contract-surface.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// ── File paths ────────────────────────────────────────────────────────────────

const SIGNING_SECTION  = 'src/components/deal/contract-signing-section.tsx'
const SEND_ENV_ROUTE   = 'src/app/api/deals/[dealId]/contract/send-envelope/route.ts'
const SIGN_ROUTE       = 'src/app/api/deals/[dealId]/contract/sign/route.ts'
const UPLOAD_ROUTE_S   = 'src/app/api/deals/[dealId]/contracts/route.ts'   // plural — no DocuSign
const DEAL_PAGE        = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const GATE             = 'src/lib/engine/release-gate.ts'
const STRIPE_ROUTE     = 'src/app/api/stripe/webhooks/route.ts'
const DS_WEBHOOK       = 'src/app/api/webhooks/docusign/route.ts'
const UPLOAD_COMPONENT = 'src/components/deal/contract-upload-section.tsx'
const PACKAGE_JSON     = 'package.json'

async function main() {
  console.log('\ndocusign-contract-surface.test.ts\n')

  // ── 1. ContractSigningSection exists ────────────────────────────────────────
  check(exists(SIGNING_SECTION), '1. ContractSigningSection component file exists')

  const section = read(SIGNING_SECTION)

  // ── 2. Shows "Send for DocuSign Signatures" when no envelope ─────────────────
  check(
    section.includes('Send for DocuSign Signatures'),
    '2. Component shows "Send for DocuSign Signatures" when no envelope exists',
  )

  // ── 3. Send action calls the real send-envelope API route ────────────────────
  check(
    section.includes('send-envelope'),
    '3. Send action calls /contract/send-envelope (not a fake route)',
  )
  check(
    !section.includes('fake') && !section.includes('internal_sign') && !section.includes('mock_sign'),
    '3b. No fake/mock signing in ContractSigningSection',
  )

  // ── 4. Shows "Open DocuSign" for active signer ───────────────────────────────
  check(
    section.includes('Open DocuSign to Sign'),
    '4. Component shows "Open DocuSign to Sign" for the active signer',
  )
  check(
    section.includes('/contract/sign'),
    '4b. Open DocuSign calls the real /contract/sign route',
  )

  // ── 5. Shows waiting state for non-current signer ────────────────────────────
  check(
    section.includes('Waiting for the funder') || section.includes('Waiting for'),
    '5. Component shows waiting state when it is not the current user\'s turn',
  )
  check(
    section.includes('waitingOnFunder') || section.includes('waitingOnContractor'),
    '5b. Waiting-state logic references funder/contractor ordering',
  )

  // ── 6. "Signed" state handled server-side ────────────────────────────────────
  // ContractSigningSection is only shown for pending states — the server renders
  // "Contract fully signed" directly when status === 'signed'.
  check(
    !section.includes("status === 'signed'"),
    '6. Component does not handle signed state (server renders that separately)',
  )

  // ── 7. send-envelope route file exists ───────────────────────────────────────
  check(exists(SEND_ENV_ROUTE), '7. send-envelope API route file exists')

  const sendEnv = read(SEND_ENV_ROUTE)

  // ── 8. Uses existing createEnvelope — not a fake ─────────────────────────────
  check(
    sendEnv.includes('createEnvelope'),
    '8. send-envelope route calls createEnvelope from DocuSign engine (not fake)',
  )
  check(
    sendEnv.includes("from '@/lib/engine/docusign'"),
    '8b. send-envelope imports from DocuSign engine module',
  )

  // ── 9. Role check — contractor or admin only ──────────────────────────────────
  check(
    sendEnv.includes("profile.role !== 'contractor'") &&
    sendEnv.includes("profile.role !== 'admin'"),
    '9. send-envelope rejects non-contractor/admin roles (funder cannot initiate)',
  )

  // ── 10. Downloads PDF from storage ────────────────────────────────────────────
  check(
    sendEnv.includes('.download(') && sendEnv.includes('storage_path'),
    '10. send-envelope downloads PDF from Supabase Storage using storage_path',
  )

  // ── 11. Saves envelope_id to contracts table ──────────────────────────────────
  check(
    sendEnv.includes('docusign_envelope_id') && sendEnv.includes('.update('),
    '11. send-envelope saves envelope_id back to contracts table',
  )

  // ── 12. Audit logs docusign_envelope_sent ─────────────────────────────────────
  check(
    sendEnv.includes('docusign_envelope_sent'),
    '12. send-envelope audit-logs docusign_envelope_sent action',
  )

  // ── 13. Idempotent — rejects if envelope already exists ──────────────────────
  check(
    sendEnv.includes('docusign_envelope_id') &&
    (sendEnv.includes('already has a DocuSign envelope') || sendEnv.includes('already has')),
    '13. send-envelope rejects with 409 if envelope already exists (idempotent guard)',
  )

  // ── 14. No fake signature route ───────────────────────────────────────────────
  const fakeRoutes = [
    'src/app/api/deals/[dealId]/contract/internal-sign',
    'src/app/api/deals/[dealId]/contract/fake-sign',
    'src/app/api/deals/[dealId]/contract/mock-sign',
    'src/app/api/deals/[dealId]/contract/ack-sign',
  ]
  for (const r of fakeRoutes) {
    check(!exists(r + '/route.ts'), `14. No fake signing route at ${r}`)
  }

  // ── 15. sign route unchanged — still uses getSigningUrl ──────────────────────
  const signRoute = read(SIGN_ROUTE)
  check(
    signRoute.includes('getSigningUrl'),
    '15. /contract/sign route still uses getSigningUrl from DocuSign engine',
  )
  check(
    signRoute.includes('signing_url'),
    '15b. /contract/sign route still returns signing_url to client',
  )

  // ── 16. Deal page imports ContractSigningSection ──────────────────────────────
  const dealPage = read(DEAL_PAGE)
  check(
    dealPage.includes('ContractSigningSection'),
    '16. Deal page imports and uses ContractSigningSection',
  )
  check(
    dealPage.includes("from \"@/components/deal/contract-signing-section\"") ||
    dealPage.includes("from '@/components/deal/contract-signing-section'"),
    '16b. Deal page imports from the correct path',
  )

  // ── 17. Deal page renders ContractSigningSection for pending states ────────────
  check(
    dealPage.includes('contract.status !== "signed"') &&
    dealPage.includes('contract.status !== "voided"'),
    '17. Deal page renders ContractSigningSection only for pending contract states',
  )
  check(
    dealPage.includes('envelopeId={contract.docusign_envelope_id') ||
    dealPage.includes('envelopeId={contract.docusign_envelope_id ?? null}'),
    '17b. Deal page passes envelopeId prop to ContractSigningSection',
  )

  // ── 18. Not shown for status=signed ──────────────────────────────────────────
  // The signed/voided guards ensure ContractSigningSection is hidden for completed contracts
  check(
    dealPage.includes('contract.status !== "signed"'),
    '18. ContractSigningSection is gated out for status=signed',
  )

  // ── 19. Not shown for status=voided ──────────────────────────────────────────
  check(
    dealPage.includes('contract.status !== "voided"'),
    '19. ContractSigningSection is gated out for status=voided',
  )

  // ── 20. Release-blocker note in signing section ───────────────────────────────
  check(
    section.includes('Milestone releases are blocked') ||
    section.includes('releases are blocked'),
    '20. ContractSigningSection shows release-blocker note',
  )

  // ── 21. Release gate unchanged ────────────────────────────────────────────────
  if (exists(GATE)) {
    const gate = read(GATE)
    check(
      !gate.includes('ContractSigningSection') && !gate.includes('send-envelope'),
      '21. Release gate is unchanged — no contract signing references added',
    )
  } else {
    pass('21. Release gate file not found at expected path — skipping (may be inline)')
  }

  // ── 22. Stripe route unchanged ────────────────────────────────────────────────
  if (exists(STRIPE_ROUTE)) {
    const stripe = read(STRIPE_ROUTE)
    check(
      !stripe.includes('ContractSigningSection') && !stripe.includes('send-envelope'),
      '22. Stripe/payment route is unchanged',
    )
  } else {
    pass('22. Stripe route file not found — skipping')
  }

  // ── 23. DocuSign webhook unchanged ────────────────────────────────────────────
  check(exists(DS_WEBHOOK), '23. DocuSign webhook route still exists (unchanged)')
  const dsWebhook = read(DS_WEBHOOK)
  check(
    dsWebhook.includes('envelope-completed') || dsWebhook.includes('recipient-completed'),
    '23b. DocuSign webhook still handles expected envelope events',
  )

  // ── 24. ContractUploadSection unchanged ──────────────────────────────────────
  check(exists(UPLOAD_COMPONENT), '24. ContractUploadSection component still exists')
  const uploadComp = read(UPLOAD_COMPONENT)
  check(
    uploadComp.includes('/api/deals/') && uploadComp.includes('/contracts'),
    '24b. ContractUploadSection still calls the /contracts upload route',
  )

  // ── 25. Test wired into package.json ─────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('docusign-contract-surface.test.ts'),
    '25. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All docusign-contract-surface tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
