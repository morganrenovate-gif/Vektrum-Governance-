import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'
import {
  verifyWebhookSignature,
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
//                         composite PDF, stores it, and marks status = 'signed'.
//
// Security: HMAC-SHA256 signature verified against DOCUSIGN_WEBHOOK_SECRET.
//
// DocuSign Connect setup:
//   Admin Console → Connect → Add Configuration
//   URL:             {APP_URL}/api/webhooks/docusign
//   Trigger events:  envelope-sent, envelope-completed, recipient-completed
//   HMAC key:        set to DOCUSIGN_WEBHOOK_SECRET value
//   Include data:    Recipients, Documents (for envelope-completed)
//   Format:          JSON

export async function POST(request: NextRequest) {
  // ── Read raw body for HMAC verification ─────────────────────────────────────
  // We must read the raw bytes before any parsing — HMAC is over the exact payload.
  const rawBody = Buffer.from(await request.arrayBuffer())

  // ── Verify webhook signature ─────────────────────────────────────────────────
  const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET
  if (!webhookSecret) {
    // If secret is not configured, accept the webhook in development mode only
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Webhook secret not configured.' },
        { status: 500 },
      )
    }
  } else {
    // DocuSign sends up to 5 HMAC signatures (X-DocuSign-Signature-1 through -5)
    // Verify against the first one.
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

  const admin = createSupabaseAdminClient()

  // ── Look up contract by envelope ID ──────────────────────────────────────────
  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select('id, deal_id, status, funder_signed_at, contractor_signed_at')
    .eq('docusign_envelope_id', envelopeId)
    .maybeSingle()

  if (contractError) {
    console.error('[docusign-webhook] DB lookup error:', contractError.message)
    return NextResponse.json({ error: 'DB error.' }, { status: 500 })
  }

  if (!contract) {
    // Could be from a different environment (staging vs prod) — log and ignore
    console.warn(`[docusign-webhook] No contract found for envelope ${envelopeId}`)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // Already fully signed — nothing to update
  if (contract.status === 'signed') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── Handle events ─────────────────────────────────────────────────────────────

  const eventType = event.event   // "recipient-completed" | "envelope-completed"
  const summary   = event.data?.envelopeSummary

  // ── recipient-completed ───────────────────────────────────────────────────────
  if (eventType === 'recipient-completed') {
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
    const routingOrder = Number(signer.routingOrder)
    const isFunderSigner     = routingOrder === 1
    const isContractorSigner = routingOrder === 2

    let updates: Record<string, unknown> = {}
    let newStatus = contract.status

    if (isFunderSigner && !contract.funder_signed_at) {
      updates.funder_signed_at = signedAt
      // If contractor already signed (shouldn't happen given routing order, but guard it)
      newStatus = contract.contractor_signed_at ? 'signed' : 'funder_signed'
    } else if (isContractorSigner && !contract.contractor_signed_at) {
      updates.contractor_signed_at = signedAt
      newStatus = contract.funder_signed_at ? 'signed' : 'contractor_signed'
    } else {
      // Already recorded
      return NextResponse.json({ received: true }, { status: 200 })
    }

    updates.status = newStatus

    const { error: updateError } = await admin
      .from('contracts')
      .update(updates)
      .eq('id', contract.id)

    if (updateError) {
      console.error('[docusign-webhook] Failed to update contract:', updateError.message)
      return NextResponse.json({ error: 'DB update failed.' }, { status: 500 })
    }

    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      isFunderSigner ? 'funder_signed' : 'contractor_signed',
      actor_id:    'system',
      old_values:  { status: contract.status },
      new_values:  { status: newStatus, ...updates },
      metadata: {
        deal_id:      contract.deal_id,
        envelope_id:  envelopeId,
        signer_email: signer.email,
        routing_order: signer.routingOrder,
        signed_at:    signedAt,
      },
    })

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── envelope-completed ────────────────────────────────────────────────────────
  if (eventType === 'envelope-completed') {
    const completedAt = summary?.completedDateTime
      ? new Date(summary.completedDateTime).toISOString()
      : new Date().toISOString()

    // Download the final signed composite PDF
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

    // Collect signing timestamps from the recipient list
    const signers   = summary?.recipients?.signers ?? []
    const funder    = signers.find(s => Number(s.routingOrder) === 1)
    const contractor = signers.find(s => Number(s.routingOrder) === 2)

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
      console.error('[docusign-webhook] Failed to finalize contract:', finalizeError.message)
      return NextResponse.json({ error: 'DB finalize failed.' }, { status: 500 })
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

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // ── envelope-voided ───────────────────────────────────────────────────────────
  if (eventType === 'envelope-voided' || summary?.status === 'voided') {
    const { error: voidError } = await admin
      .from('contracts')
      .update({
        status:      'voided',
        voided_at:   new Date().toISOString(),
        void_reason: summary?.voidedReason ?? 'Voided via DocuSign',
      })
      .eq('id', contract.id)

    if (!voidError) {
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
          reason:      summary?.voidedReason,
        },
      })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  }

  // All other events (envelope-sent, envelope-delivered, etc.) — acknowledge
  return NextResponse.json({ received: true }, { status: 200 })
}
