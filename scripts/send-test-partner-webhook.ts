#!/usr/bin/env tsx
/**
 * Controlled outbound partner-webhook verification.
 *
 * Looks up a partner row in Supabase by name (default: "Controlled Webhook
 * Test Partner"), builds a clearly-marked test event, signs it with the
 * partner's webhook_signing_secret using Vektrum's canonical HMAC scheme,
 * and POSTs it to partner.webhook_url.
 *
 * SAFETY GUARANTEES — enforced by what this script does NOT do:
 *   - Does not import or call any release-gate, milestone, or Stripe code.
 *   - Does not write to deals, milestones, releases, billing_records,
 *     transaction_receipts, or audit_log. (No SELECT-elsewhere either.)
 *   - Does not require any production money-moving env var. Stripe keys,
 *     CRON_SECRET, etc. are not read.
 *   - The event name is `partner.webhook.test` (NOT `release.authorized`),
 *     so any partner-side handler keyed on event name will not mistake
 *     this for a real authorization signal.
 *   - Payload IDs are prefixed `test_` and do not match the UUID pattern
 *     of real Vektrum records.
 *   - The X-Vektrum-Test: true header is set on every request.
 *
 * Usage:
 *   npm run webhook:test
 *   npm run webhook:test -- --partner-name "Some Other Test Partner"
 *   npm run webhook:test -- --partner-id <uuid>
 *   npm run webhook:test -- --url https://my.override.url   # bypass DB lookup
 *   npm run webhook:test -- --dry-run                       # build + sign, do not POST
 *
 * Env required (read-only):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    (used only to SELECT one partner row)
 *
 * Exit codes:
 *   0  — request sent and partner returned a 2xx
 *   1  — partner returned non-2xx, network error, or config error
 *   2  — partner not found (by name/id)
 */

import { createClient } from '@supabase/supabase-js'
import {
  buildTestPayload,
  signWebhook,
  buildHeaders,
} from '../src/lib/partner-webhook/test-event'

// ─── CLI args ─────────────────────────────────────────────────────────────────

interface Args {
  partnerName: string
  partnerId:   string | null
  urlOverride: string | null
  dryRun:      boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    partnerName: 'Controlled Webhook Test Partner',
    partnerId:   null,
    urlOverride: null,
    dryRun:      false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--partner-name': args.partnerName = required(argv[++i], '--partner-name'); break
      case '--partner-id':   args.partnerId   = required(argv[++i], '--partner-id');   break
      case '--url':          args.urlOverride = required(argv[++i], '--url');          break
      case '--dry-run':      args.dryRun      = true; break
      case '-h':
      case '--help':
        printHelpAndExit(0)
      default:
        console.error(`Unknown argument: ${a}`)
        printHelpAndExit(1)
    }
  }
  return args
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    console.error(`Missing value for ${name}`)
    printHelpAndExit(1)
  }
  return value as string
}

function printHelpAndExit(code: number): never {
  console.log(`
Controlled outbound partner-webhook verification.

Options:
  --partner-name <name>   Default: "Controlled Webhook Test Partner"
  --partner-id <uuid>     Look up by ID instead of name
  --url <https://...>     Override webhook_url (skips DB lookup of partner row)
  --dry-run               Build + sign, print, but do not POST
  -h, --help              This help
`)
  process.exit(code)
}

// ─── Partner lookup ───────────────────────────────────────────────────────────

interface PartnerRow {
  id:                     string
  name:                   string
  webhook_url:            string | null
  webhook_signing_secret: string | null
  is_active:              boolean
}

async function loadPartner(args: Args): Promise<PartnerRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to look up the partner row.')
    process.exit(1)
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const query = admin
    .from('partners')
    .select('id, name, webhook_url, webhook_signing_secret, is_active')
    .limit(1)
  const { data, error } = args.partnerId
    ? await query.eq('id', args.partnerId).maybeSingle()
    : await query.eq('name', args.partnerName).maybeSingle()
  if (error) {
    console.error('Supabase lookup failed:', error.message)
    process.exit(1)
  }
  return data as PartnerRow | null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  // Resolve partner. With --url, we skip DB lookup entirely (useful for ad-hoc
  // tests against a fresh webhook.site URL without modifying the DB row).
  let partnerId:    string
  let partnerName:  string
  let webhookUrl:   string
  let signingSecret: string | null

  if (args.urlOverride) {
    partnerId     = 'override'
    partnerName   = args.partnerName
    webhookUrl    = args.urlOverride
    signingSecret = process.env.WEBHOOK_TEST_SIGNING_SECRET ?? null
    if (!signingSecret) {
      console.warn(
        '⚠  --url override given but WEBHOOK_TEST_SIGNING_SECRET is unset. ' +
        'Webhook will be delivered UNSIGNED. Set WEBHOOK_TEST_SIGNING_SECRET to verify the signature path.',
      )
    }
  } else {
    const partner = await loadPartner(args)
    if (!partner) {
      console.error(`Partner not found: ${args.partnerId ?? args.partnerName}`)
      process.exit(2)
    }
    if (!partner.webhook_url) {
      console.error(`Partner "${partner.name}" has no webhook_url configured.`)
      process.exit(1)
    }
    if (!partner.is_active) {
      console.warn(`⚠  Partner "${partner.name}" is marked inactive. Sending the test event anyway (this is a test).`)
    }
    partnerId     = partner.id
    partnerName   = partner.name
    webhookUrl    = partner.webhook_url
    signingSecret = partner.webhook_signing_secret
  }

  // Build, sign, and POST.
  const payload      = buildTestPayload({ partnerId, partnerName })
  const bodyJson     = JSON.stringify(payload)
  const timestampS   = Math.floor(Date.now() / 1000)

  let signatureValue: string
  if (signingSecret) {
    const sig = signWebhook({ body: bodyJson, secret: signingSecret, timestampS })
    signatureValue = sig.headerValue
  } else {
    signatureValue = `t=${timestampS},sha256=unsigned`
  }

  const headers = buildHeaders({ payload, signatureValue, timestampS })

  // Print plan. Never print the secret value itself.
  console.log('')
  console.log('────────────────────────────────────────────────────────────────────────')
  console.log('  VEKTRUM — controlled outbound webhook test')
  console.log('────────────────────────────────────────────────────────────────────────')
  console.log(`  Partner:        ${partnerName}  (${partnerId})`)
  console.log(`  Webhook URL:    ${webhookUrl}`)
  console.log(`  Event:          ${payload.event}`)
  console.log(`  Test flag:      ${payload.test}`)
  console.log(`  Idempotency:    ${payload.idempotency_key}`)
  console.log(`  Timestamp:      ${timestampS}`)
  console.log(`  Signing secret: ${signingSecret ? `present (len=${signingSecret.length})` : 'NONE — delivering unsigned'}`)
  console.log(`  Signature hdr:  ${signatureValue}`)
  console.log('────────────────────────────────────────────────────────────────────────')
  console.log('')

  if (args.dryRun) {
    console.log('--dry-run set. Payload + signature shown above. NOT sending.')
    process.exit(0)
  }

  // POST. No retry — this is a one-shot diagnostic, not the production path.
  let res: Response
  try {
    res = await fetch(webhookUrl, { method: 'POST', headers, body: bodyJson })
  } catch (err) {
    console.error(`✗  Network error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const responseBody = await res.text().catch(() => '')
  console.log(`HTTP ${res.status} ${res.statusText}`)
  if (responseBody) {
    console.log(`Body (first 400 chars): ${responseBody.slice(0, 400)}`)
  }

  if (res.ok) {
    console.log('')
    console.log('✓  Delivered. Visit the partner endpoint (e.g. webhook.site) to inspect.')
    console.log('')
    console.log('  Partner-side verification (Node):')
    console.log('    const signed = `${ts}.${rawBody}`')
    console.log("    const expected = require('crypto').createHmac('sha256', SECRET).update(signed).digest('hex')")
    console.log("    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSha256))")
    console.log('')
    process.exit(0)
  } else {
    console.error('')
    console.error('✗  Delivery non-2xx. Investigate at the partner endpoint.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
