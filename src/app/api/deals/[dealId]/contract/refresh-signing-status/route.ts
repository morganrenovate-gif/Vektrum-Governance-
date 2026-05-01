/**
 * POST /api/deals/[dealId]/contract/refresh-signing-status
 *
 * Manual fallback for envelopes that were created before envelope-level
 * eventNotification was configured, or when a webhook delivery has been lost.
 *
 * Behaviour:
 *   1. Authenticated participant on the deal (contractor / funder) or admin.
 *   2. Looks up the active contract by dealId.
 *   3. Calls DocuSign for the live envelope recipient status.
 *   4. Updates funder_signed_at / contractor_signed_at from authoritative
 *      DocuSign timestamps.
 *   5. Sets contract.status to 'signed' ONLY when both timestamps exist.
 *      Otherwise to the appropriate intermediate ('funder_signed' /
 *      'contractor_signed') — matching the webhook handler.
 *   6. If the funder is now signed and the contractor is still pending,
 *      creates the same `contract_signing_turn` notification as the webhook
 *      (idempotent — `notifyContractorTurnToSign` checks for an existing row).
 *
 * Hard guarantees:
 *   - Does NOT authorize release.
 *   - Does NOT move funds.
 *   - Does NOT mark a contract signed unless DocuSign reports BOTH recipients
 *     completed.
 *   - Does NOT side-effect any release-gate or payment-execution code path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { getEnvelopeStatus, DocuSignError } from '@/lib/engine/docusign'
import { notifyContractorTurnToSign } from '@/lib/engine/docusign-notify'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

interface SignerStatus {
  routingOrder:    string
  status:          string
  signedDateTime?: string
  email:           string
}

function pickSigner(
  signers: SignerStatus[],
  routingOrder: number,
): SignerStatus | undefined {
  return signers.find((s) => Number(s.routingOrder) === routingOrder)
}

function completedTimestamp(s?: SignerStatus): string | null {
  if (!s) return null
  if (s.status !== 'completed') return null
  return s.signedDateTime
    ? new Date(s.signedDateTime).toISOString()
    : new Date().toISOString()
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }
  const { user, profile } = authContext

  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── 2. Fetch contract ──────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()

  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select('id, deal_id, status, docusign_envelope_id, funder_signed_at, contractor_signed_at')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (contractError) {
    return internalError('Failed to fetch contract record.', contractError.message)
  }
  if (!contract) {
    return notFoundError(`No contract has been uploaded for deal ${dealId}.`)
  }

  if (!contract.docusign_envelope_id) {
    return NextResponse.json(
      { error: 'This contract does not yet have a DocuSign envelope. Send signatures first.' },
      { status: 409 },
    )
  }

  if (contract.status === 'voided') {
    return NextResponse.json(
      { error: 'This contract has been voided. A new contract must be uploaded.' },
      { status: 409 },
    )
  }

  // ── 3. Pull live status from DocuSign ──────────────────────────────────────
  let live: Awaited<ReturnType<typeof getEnvelopeStatus>>
  try {
    live = await getEnvelopeStatus(contract.docusign_envelope_id)
  } catch (err) {
    const message = err instanceof DocuSignError ? err.message : String(err)
    return internalError(
      'Could not refresh signing status from DocuSign. Please try again.',
      message,
    )
  }

  const signers = (live.recipients?.signers ?? []) as SignerStatus[]

  const funderSigner     = pickSigner(signers, 1)
  const contractorSigner = pickSigner(signers, 2)

  const funderCompletedAt     = completedTimestamp(funderSigner)
  const contractorCompletedAt = completedTimestamp(contractorSigner)

  // ── 4. Resolve next contract state ─────────────────────────────────────────
  const updates: Record<string, unknown> = {}

  // Only set timestamps that aren't already recorded — the webhook may have
  // written its own copy from the same event. Using the DB's existing value
  // first preserves whichever timestamp arrived first.
  const newFunderSignedAt =
    contract.funder_signed_at ?? funderCompletedAt
  const newContractorSignedAt =
    contract.contractor_signed_at ?? contractorCompletedAt

  if (!contract.funder_signed_at && newFunderSignedAt) {
    updates.funder_signed_at = newFunderSignedAt
  }
  if (!contract.contractor_signed_at && newContractorSignedAt) {
    updates.contractor_signed_at = newContractorSignedAt
  }

  // Status transition rule:
  //   both signed       → 'signed'
  //   funder only       → 'funder_signed'
  //   contractor only   → 'contractor_signed'
  //   neither           → leave the existing status alone (likely 'pending_signatures')
  let newStatus = contract.status as string
  if (newFunderSignedAt && newContractorSignedAt) {
    newStatus = 'signed'
  } else if (newFunderSignedAt && !newContractorSignedAt) {
    if (contract.status !== 'funder_signed' && contract.status !== 'signed') {
      newStatus = 'funder_signed'
    }
  } else if (!newFunderSignedAt && newContractorSignedAt) {
    if (contract.status !== 'contractor_signed' && contract.status !== 'signed') {
      newStatus = 'contractor_signed'
    }
  }
  if (newStatus !== contract.status) {
    updates.status = newStatus
  }

  // ── 5. Apply updates if any ────────────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('contracts')
      .update(updates)
      .eq('id', contract.id)

    if (updateError) {
      return internalError(
        'Could not save the refreshed signing status.',
        updateError.message,
      )
    }

    await logAudit({
      entity_type:   'contract',
      entity_id:     contract.id,
      action:        'contract_signing_status_refreshed',
      actor_id:      user.id,
      actor_role:    profile.role,
      system_source: 'api/deals/contract/refresh-signing-status',
      old_values:    {
        status:               contract.status,
        funder_signed_at:     contract.funder_signed_at,
        contractor_signed_at: contract.contractor_signed_at,
      },
      new_values:    {
        status:               newStatus,
        funder_signed_at:     newFunderSignedAt,
        contractor_signed_at: newContractorSignedAt,
      },
      metadata: {
        deal_id:     dealId,
        envelope_id: contract.docusign_envelope_id,
        live_envelope_status: live.status,
      },
    })
  }

  // ── 6. Notify contractor if funder is now signed and contractor is pending ─
  // Idempotent at the helper level — checks for an existing
  // `contract_signing_turn` notification before inserting.
  if (newFunderSignedAt && !newContractorSignedAt) {
    try {
      await notifyContractorTurnToSign({
        dealId,
        contractId:  contract.id,
        envelopeId:  contract.docusign_envelope_id,
        source:      'refresh',
      })
    } catch (err) {
      console.error(
        '[refresh-signing-status] notifyContractorTurnToSign failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return NextResponse.json({
    ok:                  true,
    status:              newStatus,
    funder_signed_at:    newFunderSignedAt,
    contractor_signed_at: newContractorSignedAt,
    envelope_status:     live.status,
  })
}
