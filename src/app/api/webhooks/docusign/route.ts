import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'
import {
  notifyContractorTurnToSign,
  notifyContractFullyExecuted,
} from '@/lib/engine/docusign-notify'
import {
  verifyWebhookSignature,
  isHmacBypassAllowed,
  downloadSignedDocument,
  type DocuSignWebhookEvent,
} from '@/lib/engine/docusign'

export const dynamic = 'force-dynamic'

// ─── POST /api/webhooks/docusign ──────────────────────────────────────────────
//
// Receives DocuSign Connect webhook events and updates contract signing status.
//
// Events handled:
//   recipient-completed — one signer has signed; updates the appropriate
//                         *_signed_at timestamp and advances contract status.
//   envelope-completed  — all signers have signed; downloads the final
//                         composite PDF, stores it, marks status = 'signed'.
//   envelope-voided     — envelope voided in DocuSign (admin or system action);
//                         marks contract voided; if milestone releases have
//                         already occurred on the deal, freezes the deal and
//                         logs contract_voided_with_releases.
//   envelope-declined   — at least one signer explicitly declined; marks
//                         contract voided with reason 'declined'; same freeze
//                         check as voided; logs contract_declined.
//
// Security: HMAC-SHA256 signature verified against DOCUSIGN_WEBHOOK_SECRET
//           before any payload is processed.
//
// IMPORTANT — staging / preview / CI environments:
//   DOCUSIGN_WEBHOOK_SECRET must be set in ALL deployed environments, including
//   Vercel preview branches and any staging server. Missing the secret in a
//   deployed context returns 500 and processes nothing. There is no bypass for
//   any deployed build; the dev bypass requires both NODE_ENV=development AND
//   DOCUSIGN_WEBHOOK_DEV_BYPASS=true (see isHmacBypassAllowed in docusign.ts).
//
// DocuSign Connect setup:
//   Admin Console → Connect → Add Configuration
//   URL:             {APP_URL}/api/webhooks/docusign
//   Trigger events:  envelope-sent, envelope-completed, recipient-completed,
//                    envelope-voided, envelope-declined
//   HMAC key:        set to DOCUSIGN_WEBHOOK_SECRET value
//   Include data:    Recipients, Documents (for envelope-completed)
//   Format:          JSON
//
// Error response strategy:
//   HMAC/parse failures: 401/400 — DocuSign should NOT retry these.
//   Processing failures: 200 — prevents spurious DocuSign retries on
//   transient DB or Stripe errors; errors are console.error'd for alerting.
//   Idempotency: each handler checks current state before mutating.

export async function POST(request: NextRequest) {
  // ── Read raw body for HMAC verification ─────────────────────────────────────
  // Must read the raw bytes before any parsing — HMAC is over the exact bytes.
  const rawBody = Buffer.from(await request.arrayBuffer())

  // ── Verify webhook signature ─────────────────────────────────────────────────
  //
  // Gate logic (evaluated in order):
  //
  //   1. Secret present → always verify HMAC; 401 on missing/invalid signature.
  //
  //   2. Secret missing + bypass allowed (NODE_ENV=development AND
  //      DOCUSIGN_WEBHOOK_DEV_BYPASS=true) → skip HMAC with a noisy warning.
  //      Next.js sets NODE_ENV='production' for every Vercel build, so this
  //      branch is unreachable in any deployed context (preview, staging, prod).
  //
  //   3. Secret missing + bypass NOT allowed (all other cases, including any
  //      deployed environment) → 500 immediately; nothing is parsed or mutated.
  //
  const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET
  if (!webhookSecret) {
    if (!isHmacBypassAllowed(process.env)) {
      // Missing secret with no bypass: fail closed.
      // This covers production, staging, preview, CI, and any Node server where
      // NODE_ENV is not 'development' or DOCUSIGN_WEBHOOK_DEV_BYPASS is absent.
      console.error(
        '[docusign-webhook] DOCUSIGN_WEBHOOK_SECRET is not configured. ' +
        'Set it in all deployed environments. ' +
        'For local development only, also set DOCUSIGN_WEBHOOK_DEV_BYPASS=true.',
      )
      return NextResponse.json(
        { error: 'Webhook secret not configured.' },
        { status: 500 },
      )
    }
    // Local dev explicit bypass — log loudly so it is never silently active.
    console.warn(
      '[docusign-webhook] DOCUSIGN_WEBHOOK_SECRET not set — HMAC check BYPASSED. ' +
      'DOCUSIGN_WEBHOOK_DEV_BYPASS=true is active. ' +
      'This must NEVER be set in staging, preview, or production.',
    )
  } else {
    // DocuSign sends up to 5 HMAC signatures (X-DocuSign-Signature-1 through -5).
    // We verify against the first one.
    const signature = request.headers.get('x-docusign-signature-1')
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing X-DocuSign-Signature-1 header.' },
        { status: 401 },
      )
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature.' },
        { status: 401 },
      )
    }
  }

  // ── Parse payload ─────────────────────────────────────────────────────────────
  let event: DocuSignWebhookEvent
  try {
    event = JSON.parse(rawBody.toString('utf-8')) as DocuSignWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const envelopeId = event.data?.envelopeId
  if (!envelopeId) {
    return NextResponse.json({ error: 'Missing envelopeId in payload.' }, { status: 400 })
  }

  const eventType = event.event
  const summary   = event.data?.envelopeSummary

  const admin = createSupabaseAdminClient()

  // ── Look up contract by envelope ID ──────────────────────────────────────────
  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select('id, deal_id, status, funder_signed_at, contractor_signed_at')
    .eq('docusign_envelope_id', envelopeId)
    .maybeSingle()

  if (contractError) {
    console.error('[docusign-webhook] DB lookup error:', contractError.message)
    // Return 200 to prevent retries — this is an internal error, not a DocuSign problem
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!contract) {
    // Could be from a different environment (staging vs prod) — log and ignore
    console.warn(`[docusign-webhook] No contract found for envelope ${envelopeId}`)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── Handle events ─────────────────────────────────────────────────────────────

  // ── recipient-completed ───────────────────────────────────────────────────────
  if (eventType === 'recipient-completed') {
    // If the contract is already fully signed, nothing to update for individual
    // recipient events. (Voided/declined events are processed even on signed contracts.)
    if (contract.status === 'signed') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const signer = summary?.recipients?.signers?.find(s => s.status === 'completed')
    if (!signer) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const signedAt = signer.signedDateTime
      ? new Date(signer.signedDateTime).toISOString()
      : new Date().toISOString()

    // Identify signer role by routingOrder:
    //   routingOrder "1" = funder
    //   routingOrder "2" = contractor
    const routingOrder        = Number(signer.routingOrder)
    const isFunderSigner      = routingOrder === 1
    const isContractorSigner  = routingOrder === 2

    const updates: Record<string, unknown> = {}
    let newStatus = contract.status

    if (isFunderSigner && !contract.funder_signed_at) {
      updates.funder_signed_at = signedAt
      newStatus = contract.contractor_signed_at ? 'signed' : 'funder_signed'
    } else if (isContractorSigner && !contract.contractor_signed_at) {
      updates.contractor_signed_at = signedAt
      newStatus = contract.funder_signed_at ? 'signed' : 'contractor_signed'
    } else {
      // Already recorded — idempotent no-op
      return NextResponse.json({ received: true }, { status: 200 })
    }

    updates.status = newStatus

    const { error: updateError } = await admin
      .from('contracts')
      .update(updates)
      .eq('id', contract.id)

    if (updateError) {
      console.error('[docusign-webhook] Failed to update contract (recipient-completed):', updateError.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      isFunderSigner ? 'funder_signed' : 'contractor_signed',
      actor_id:    'system',
      old_values:  { status: contract.status },
      new_values:  { status: newStatus, ...updates },
      metadata: {
        deal_id:       contract.deal_id,
        envelope_id:   envelopeId,
        signer_email:  signer.email,
        routing_order: signer.routingOrder,
        signed_at:     signedAt,
      },
    })

    // ── Notify contractor that it is their turn to sign ──────────────────────
    //
    // Triggered only when the funder has just signed and the contractor has
    // not yet signed. Idempotent at the helper level — sees the existing
    // `contract_signing_turn` notification and skips re-creation.
    //
    // Fire-and-forget: notification failures must not flip the webhook to a
    // non-200 response (DocuSign would retry indefinitely).
    if (isFunderSigner && !contract.contractor_signed_at) {
      try {
        await notifyContractorTurnToSign({
          dealId:      contract.deal_id,
          contractId:  contract.id,
          envelopeId,
          source:      'webhook',
        })
      } catch (err) {
        console.error(
          '[docusign-webhook] notifyContractorTurnToSign failed (non-fatal):',
          err instanceof Error ? err.message : err,
        )
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── envelope-completed ────────────────────────────────────────────────────────
  if (eventType === 'envelope-completed') {
    // Idempotent: if already marked signed, skip
    if (contract.status === 'signed') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const completedAt = summary?.completedDateTime
      ? new Date(summary.completedDateTime).toISOString()
      : new Date().toISOString()

    // Download the final signed composite PDF.
    // Non-critical: if the download fails, we still mark the contract as signed
    // (the signing event is the authoritative fact; storage is supplementary).
    let signedStoragePath: string | null = null

    try {
      const signedPdfBuffer = await downloadSignedDocument(envelopeId)
      const path            = `${contract.deal_id}/signed-${envelopeId}.pdf`

      const { error: uploadError } = await admin.storage
        .from('contracts')
        .upload(path, signedPdfBuffer, {
          contentType:  'application/pdf',
          upsert:       true,
          cacheControl: '86400',
        })

      if (!uploadError) {
        signedStoragePath = path
      } else {
        console.error('[docusign-webhook] Failed to store signed PDF:', uploadError.message)
      }
    } catch (err) {
      console.error('[docusign-webhook] Failed to download signed PDF:', String(err))
    }

    const signers     = summary?.recipients?.signers ?? []
    const funder      = signers.find(s => Number(s.routingOrder) === 1)
    const contractor  = signers.find(s => Number(s.routingOrder) === 2)

    const { error: finalizeError } = await admin
      .from('contracts')
      .update({
        status:               'signed',
        funder_signed_at:     funder?.signedDateTime
                                ? new Date(funder.signedDateTime).toISOString()
                                : contract.funder_signed_at ?? completedAt,
        contractor_signed_at: contractor?.signedDateTime
                                ? new Date(contractor.signedDateTime).toISOString()
                                : contract.contractor_signed_at ?? completedAt,
        signed_storage_path:  signedStoragePath,
      })
      .eq('id', contract.id)

    if (finalizeError) {
      console.error('[docusign-webhook] Failed to finalize contract (envelope-completed):', finalizeError.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      'contract_fully_signed',
      actor_id:    'system',
      old_values:  { status: contract.status },
      new_values:  { status: 'signed' },
      metadata: {
        deal_id:             contract.deal_id,
        envelope_id:         envelopeId,
        completed_at:        completedAt,
        signed_storage_path: signedStoragePath,
      },
    })

    // ── Notify both parties — fully-executed event ────────────────────────────
    // Idempotent at the helper level (skips if a contract_fully_executed row
    // already exists for this contract). Wrapped in try/catch so notification
    // failures cannot turn the webhook into a non-200 response (which would
    // make DocuSign retry indefinitely).
    try {
      await notifyContractFullyExecuted({
        dealId:      contract.deal_id,
        contractId:  contract.id,
        envelopeId,
        source:      'webhook',
      })
    } catch (err) {
      console.error(
        '[docusign-webhook] notifyContractFullyExecuted failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── envelope-voided ───────────────────────────────────────────────────────────
  if (eventType === 'envelope-voided' || summary?.status === 'voided') {
    // Idempotent: if already voided, skip
    if (contract.status === 'voided') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const voidedAt    = summary?.voidedDateTime
      ? new Date(summary.voidedDateTime).toISOString()
      : new Date().toISOString()
    const voidReason  = summary?.voidedReason ?? 'Voided via DocuSign'

    const { error: voidError } = await admin
      .from('contracts')
      .update({
        status:      'voided',
        voided_at:   voidedAt,
        void_reason: voidReason,
      })
      .eq('id', contract.id)

    if (voidError) {
      console.error('[docusign-webhook] Failed to void contract:', voidError.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      'contract_voided',
      actor_id:    'system',
      old_values:  { status: contract.status },
      new_values:  { status: 'voided' },
      metadata: {
        deal_id:     contract.deal_id,
        envelope_id: envelopeId,
        voided_at:   voidedAt,
        reason:      voidReason,
      },
    })

    // ── Deal freeze check ──────────────────────────────────────────────────────
    // If any milestones on this deal have already been released, a void-after-
    // funding is a governance incident. Freeze the deal so no further releases
    // occur until an admin reviews and unfreezes with documented justification.
    await freezeDealIfReleasesExist(admin, contract.deal_id, contract.id, envelopeId, voidReason)

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── envelope-declined ─────────────────────────────────────────────────────────
  //
  // At least one signer explicitly declined the envelope. Treat similarly to
  // voided — mark the contract voided, run the freeze check, log contract_declined.
  //
  // TODO: wire up a transactional email service here to notify both the funder
  // and contractor that a signer declined (declinerEmail from summary.recipients).
  if (eventType === 'envelope-declined' || summary?.status === 'declined') {
    // Idempotent: already voided/declined
    if (contract.status === 'voided') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const declinedAt  = new Date().toISOString()
    const decliner    = summary?.recipients?.signers?.find(s => s.status === 'declined')
    const declineReason = decliner
      ? `Signer (${decliner.email}, routing order ${decliner.routingOrder}) declined the envelope`
      : 'Envelope declined via DocuSign'

    const { error: declineError } = await admin
      .from('contracts')
      .update({
        status:      'voided',
        voided_at:   declinedAt,
        void_reason: declineReason,
      })
      .eq('id', contract.id)

    if (declineError) {
      console.error('[docusign-webhook] Failed to mark contract declined:', declineError.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      'contract_declined',
      actor_id:    'system',
      old_values:  { status: contract.status },
      new_values:  { status: 'voided' },
      metadata: {
        deal_id:        contract.deal_id,
        envelope_id:    envelopeId,
        declined_at:    declinedAt,
        decliner_email: decliner?.email ?? null,
        routing_order:  decliner?.routingOrder ?? null,
        reason:         declineReason,
      },
    })

    // Notify both parties — TODO: implement when transactional email is wired up.
    // Required: notify funder (deal funder) and contractor (deal contractor_id)
    // that the contract was declined and must be re-sent.
    console.warn(
      `[docusign-webhook] contract_declined for deal ${contract.deal_id} — ` +
      `notify both parties. Decliner: ${decliner?.email ?? 'unknown'}`,
    )

    // Run freeze check (unlikely to be needed for a pre-signing decline,
    // but run defensively in case a re-signing decline occurs post-release).
    await freezeDealIfReleasesExist(admin, contract.deal_id, contract.id, envelopeId, declineReason)

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // All other events (envelope-sent, envelope-delivered, etc.) — acknowledge
  return NextResponse.json({ received: true }, { status: 200 })
}

// ─── Helper: freeze deal when a contract void follows milestone releases ───────
//
// Called by both the envelope-voided and envelope-declined handlers.
// Checks if any milestone on this deal has been released. If so, sets deal
// status to 'frozen', records deal_freeze_on_void = true and
// frozen_from_status = <prior status>, then logs contract_voided_with_releases.
//
// Idempotent: skips if deal is already frozen.

async function freezeDealIfReleasesExist(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  dealId:     string,
  contractId: string,
  envelopeId: string,
  reason:     string,
): Promise<void> {
  try {
    // ── 1. Check for any released milestones on this deal ──────────────────────
    const { data: releasedMilestones, error: mErr } = await admin
      .from('milestones')
      .select('id')
      .eq('deal_id', dealId)
      .eq('status', 'released')
      .limit(1)

    if (mErr) {
      console.error('[docusign-webhook] freeze check — milestone query error:', mErr.message)
      return
    }

    if (!releasedMilestones || releasedMilestones.length === 0) {
      // No releases have occurred — no freeze needed
      return
    }

    // ── 2. Fetch current deal status ───────────────────────────────────────────
    const { data: deal, error: dErr } = await admin
      .from('deals')
      .select('id, status')
      .eq('id', dealId)
      .single()

    if (dErr || !deal) {
      console.error('[docusign-webhook] freeze check — deal fetch error:', dErr?.message)
      return
    }

    // Idempotent: already frozen
    if (deal.status === 'frozen') return

    // ── 3. Freeze the deal ─────────────────────────────────────────────────────
    const { error: freezeError } = await admin
      .from('deals')
      .update({
        status:             'frozen',
        deal_freeze_on_void: true,
        frozen_from_status: deal.status,
      })
      .eq('id', dealId)

    if (freezeError) {
      console.error('[docusign-webhook] Failed to freeze deal:', freezeError.message)
      return
    }

    // ── 4. Audit log ───────────────────────────────────────────────────────────
    await logAudit({
      entity_type: 'deal',
      entity_id:   dealId,
      action:      'contract_voided_with_releases',
      actor_id:    'system',
      old_values:  { status: deal.status },
      new_values:  {
        status:             'frozen',
        deal_freeze_on_void: true,
        frozen_from_status: deal.status,
      },
      metadata: {
        contract_id:      contractId,
        envelope_id:      envelopeId,
        void_reason:      reason,
        released_count:   releasedMilestones.length,
      },
      system_source: 'api/webhooks/docusign',
    })

    console.warn(
      `[docusign-webhook] Deal ${dealId} frozen — contract voided after milestone releases. ` +
      `Prior status: ${deal.status}. Admin unfreeze required at ` +
      `POST /api/admin/deals/${dealId}/unfreeze`,
    )
  } catch (err) {
    console.error('[docusign-webhook] Unexpected error in freezeDealIfReleasesExist:', String(err))
  }
}
