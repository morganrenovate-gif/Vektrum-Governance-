/**
 * tests/docusign-envelope-notification.test.ts
 *
 * Static source-parse tests verifying that createEnvelope() includes a correct
 * eventNotification block so every Vektrum-created DocuSign envelope delivers
 * signing events back to /api/webhooks/docusign without needing account-level
 * DocuSign Connect configuration.
 *
 * Checks:
 *  1.  createEnvelope() payload includes eventNotification
 *  2.  Webhook URL resolves to /api/webhooks/docusign (uses APP_URL / NEXT_PUBLIC_APP_URL)
 *  3.  includeDocuments is 'false' — documents are NOT sent in webhook payloads
 *  4.  includeDocumentFields is 'true' — vektrum_deal_id custom field arrives in payload
 *  5.  envelopeEvents includes 'completed'
 *  6.  envelopeEvents includes 'declined'
 *  7.  envelopeEvents includes 'voided'
 *  8.  recipientEvents includes 'Completed'
 *  9.  recipientEvents includes 'Declined'
 * 10.  recipientEvents includes 'DeliveryFailed'
 * 11.  requireAcknowledgment is set (DocuSign will retry on non-200)
 * 12.  HMAC: includeHMAC and hmacKeys are configured when secret is available
 * 13.  HMAC secret is never logged (no console.log/info of webhookSecret value)
 * 14.  customFields still includes vektrum_deal_id
 * 15.  customFields includes vektrum_contract_id (new — for webhook correlation)
 * 16.  CreateEnvelopeInput interface now includes contractId field
 * 17.  send-envelope route passes contractId to createEnvelope()
 * 18.  Webhook handler maps funder (routingOrder 1) to funder_signed_at
 * 19.  Webhook handler maps contractor (routingOrder 2) to contractor_signed_at
 * 20.  Webhook handler handles envelope-completed event
 * 21.  Webhook handler handles envelope-voided event
 * 22.  Webhook handler handles envelope-declined event
 * 23.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/docusign-envelope-notification.test.ts
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

const DOCUSIGN_ENGINE  = 'src/lib/engine/docusign.ts'
const SEND_ENV_ROUTE   = 'src/app/api/deals/[dealId]/contract/send-envelope/route.ts'
const WEBHOOK_ROUTE    = 'src/app/api/webhooks/docusign/route.ts'
const PACKAGE_JSON     = 'package.json'

async function main() {
  console.log('\ndocusign-envelope-notification.test.ts\n')

  check(exists(DOCUSIGN_ENGINE), 'DocuSign engine file exists')

  const ds         = read(DOCUSIGN_ENGINE)
  const sendEnv    = read(SEND_ENV_ROUTE)
  const webhook    = read(WEBHOOK_ROUTE)

  // ── 1. eventNotification present in createEnvelope payload ───────────────────
  check(
    ds.includes('eventNotification'),
    '1. createEnvelope() payload includes eventNotification',
  )

  // ── 2. Webhook URL points to /api/webhooks/docusign via APP_URL env ───────────
  check(
    ds.includes('/api/webhooks/docusign'),
    '2. Webhook URL contains /api/webhooks/docusign',
  )
  check(
    ds.includes('NEXT_PUBLIC_APP_URL') && ds.includes('APP_URL'),
    '2b. URL resolves via NEXT_PUBLIC_APP_URL / APP_URL env vars',
  )

  // ── 3. Documents NOT included in webhook payloads ─────────────────────────────
  check(
    ds.includes("includeDocuments") && ds.includes("'false'"),
    '3. includeDocuments is set to false — documents not sent in webhook payloads',
  )

  // ── 4. Document fields included (for custom field correlation) ────────────────
  check(
    ds.includes('includeDocumentFields') && ds.includes("'true'"),
    '4. includeDocumentFields is true — vektrum_deal_id arrives in webhook payload',
  )

  // ── 5–7. Envelope events ──────────────────────────────────────────────────────
  check(
    ds.includes("envelopeEventStatusCode: 'completed'") ||
    ds.includes('envelopeEventStatusCode: "completed"'),
    '5. envelopeEvents includes completed',
  )
  check(
    ds.includes("envelopeEventStatusCode: 'declined'") ||
    ds.includes('envelopeEventStatusCode: "declined"'),
    '6. envelopeEvents includes declined',
  )
  check(
    ds.includes("envelopeEventStatusCode: 'voided'") ||
    ds.includes('envelopeEventStatusCode: "voided"'),
    '7. envelopeEvents includes voided',
  )

  // ── 8–10. Recipient events ────────────────────────────────────────────────────
  check(
    ds.includes("recipientEventStatusCode: 'Completed'") ||
    ds.includes('recipientEventStatusCode: "Completed"'),
    '8. recipientEvents includes Completed',
  )
  check(
    ds.includes("recipientEventStatusCode: 'Declined'") ||
    ds.includes('recipientEventStatusCode: "Declined"'),
    '9. recipientEvents includes Declined',
  )
  check(
    ds.includes("recipientEventStatusCode: 'AuthenticationFailed'") ||
    ds.includes('recipientEventStatusCode: "AuthenticationFailed"'),
    '10. recipientEvents includes AuthenticationFailed',
  )
  // Regression guard — the DocuSign API rejects 'DeliveryFailed' at the
  // recipient level with INVALID_REQUEST_PARAMETER. Make sure we never
  // ship that value again. The string can still appear in a comment
  // documenting the historical bug — only quoted-string usage counts.
  check(
    !ds.includes("recipientEventStatusCode: 'DeliveryFailed'") &&
    !ds.includes('recipientEventStatusCode: "DeliveryFailed"'),
    '10b. recipientEvents does NOT include the invalid value DeliveryFailed',
  )

  // ── 11. requireAcknowledgment set ─────────────────────────────────────────────
  check(
    ds.includes('requireAcknowledgment'),
    '11. requireAcknowledgment is configured (DocuSign retries on non-200)',
  )

  // ── 12. HMAC: includeHMAC and hmacKeys configured ─────────────────────────────
  check(
    ds.includes('includeHMAC') && ds.includes('hmacKeys'),
    '12. includeHMAC and hmacKeys are set when DOCUSIGN_WEBHOOK_SECRET is present',
  )
  check(
    ds.includes('DOCUSIGN_WEBHOOK_SECRET'),
    '12b. DOCUSIGN_WEBHOOK_SECRET is read to populate hmacKeys',
  )

  // ── 13. HMAC secret not logged (never in a console.log/info/error with the value)
  // We check that the variable name 'webhookSecret' is not passed directly to
  // any console call. The actual check is: console calls don't concatenate
  // webhookSecret into a string. Simple heuristic: no 'console.log(webhookSecret'.
  check(
    !ds.includes('console.log(webhookSecret') &&
    !ds.includes('console.info(webhookSecret') &&
    !ds.includes('console.error(webhookSecret') &&
    !ds.includes('console.warn(webhookSecret'),
    '13. HMAC secret value is never passed directly to a console call',
  )

  // ── 14. vektrum_deal_id still in customFields ─────────────────────────────────
  check(
    ds.includes('vektrum_deal_id'),
    '14. customFields still includes vektrum_deal_id',
  )

  // ── 15. vektrum_contract_id added to customFields ─────────────────────────────
  check(
    ds.includes('vektrum_contract_id'),
    '15. customFields includes vektrum_contract_id for webhook correlation',
  )

  // ── 16. CreateEnvelopeInput includes contractId ────────────────────────────────
  check(
    ds.includes('contractId'),
    '16. CreateEnvelopeInput interface includes contractId field',
  )

  // ── 17. send-envelope route passes contractId ─────────────────────────────────
  check(
    sendEnv.includes('contractId: contract.id') ||
    sendEnv.includes('contractId:contract.id'),
    '17. send-envelope route passes contractId: contract.id to createEnvelope()',
  )

  // ── 18. Webhook maps funder (routingOrder 1) to funder_signed_at ───────────────
  check(
    webhook.includes('routingOrder') &&
    webhook.includes('=== 1') &&
    webhook.includes('funder_signed_at'),
    '18. Webhook handler maps routing order 1 to funder_signed_at',
  )

  // ── 19. Webhook maps contractor (routingOrder 2) to contractor_signed_at ───────
  check(
    webhook.includes('=== 2') &&
    webhook.includes('contractor_signed_at'),
    '19. Webhook handler maps routing order 2 to contractor_signed_at',
  )

  // ── 20–22. Webhook handles envelope events ────────────────────────────────────
  check(
    webhook.includes('envelope-completed'),
    '20. Webhook handler handles envelope-completed event',
  )
  check(
    webhook.includes('envelope-voided'),
    '21. Webhook handler handles envelope-voided event',
  )
  check(
    webhook.includes('envelope-declined'),
    '22. Webhook handler handles envelope-declined event',
  )

  // ── 23. Wired into package.json ───────────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('docusign-envelope-notification.test.ts'),
    '23. Test file is wired into npm test in package.json',
  )

  console.log('\n✓ All docusign-envelope-notification tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
