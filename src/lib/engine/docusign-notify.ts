/**
 * DocuSign signing-state notifications.
 *
 * Centralises the contractor "it's your turn to sign" notification so the
 * webhook handler and the manual /contract/refresh-signing-status route can
 * use the same idempotent path. The helper:
 *
 *   1. Looks up the deal title and the contractor user id.
 *   2. Skips if a `contract_signing_turn` notification already exists for
 *      this contract (idempotent — webhook redelivery + manual refresh will
 *      not double-send).
 *   3. Inserts a `contract_signing_turn` notification row addressed to the
 *      contractor with deal-page deep link.
 *
 * Never throws. Returns true when a NEW notification was created, false
 * when the call was idempotent or skipped due to missing context.
 *
 * Does NOT authorize release, move funds, or modify the release gate. It is
 * a pure notification side-effect.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/engine/notify'
import { logAudit } from '@/lib/engine/audit'

export type DocuSignNotifySource = 'webhook' | 'refresh'

export interface NotifyContractorTurnInput {
  dealId:     string
  contractId: string
  envelopeId: string
  source:     DocuSignNotifySource
}

export async function notifyContractorTurnToSign(
  input: NotifyContractorTurnInput,
): Promise<boolean> {
  const { dealId, contractId, envelopeId, source } = input

  try {
    const admin = createSupabaseAdminClient()

    // ── Idempotency check ───────────────────────────────────────────────────
    // If a `contract_signing_turn` notification already exists for this
    // contract, do nothing. Covers webhook redelivery and the manual refresh
    // route arriving after the webhook fired (or vice-versa).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('notifications')
      .select('id')
      .eq('entity_type', 'contract')
      .eq('entity_id',   contractId)
      .eq('notification_type', 'contract_signing_turn')
      .limit(1)
      .maybeSingle()

    if (existing) {
      console.info(
        `[docusign-notify] contract_signing_turn already exists for contract ${contractId} — skipping`,
      )
      return false
    }

    // ── Resolve deal context ────────────────────────────────────────────────
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('id, title, contractor_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      console.warn(
        `[docusign-notify] deal ${dealId} not found — cannot create signing-turn notification`,
      )
      return false
    }

    if (!deal.contractor_id) {
      console.warn(
        `[docusign-notify] deal ${dealId} has no contractor — cannot notify`,
      )
      return false
    }

    // ── Resolve contractor email (best-effort, only used as fallback) ───────
    let contractorEmail: string | null = null
    try {
      const authUser = await admin.auth.admin.getUserById(deal.contractor_id)
      contractorEmail = authUser.data?.user?.email ?? null
    } catch {
      // Non-fatal — recipient_user_id is the primary addressing field
    }

    const subject  = 'Contract ready for your signature'
    const dealTitle = deal.title ?? 'your deal'
    const body     =
      `The funder has signed the contract for ${dealTitle}. ` +
      `Please complete contractor signing in DocuSign.`

    const notificationId = await createNotification({
      recipient_user_id: deal.contractor_id,
      recipient_email:   contractorEmail,
      deal_id:           dealId,
      entity_type:       'contract',
      entity_id:         contractId,
      notification_type: 'contract_signing_turn',
      channel:           'in_app',
      subject,
      body_summary:      body,
    })

    if (!notificationId) {
      console.error(
        `[docusign-notify] createNotification returned null for contract ${contractId}`,
      )
      return false
    }

    // ── Audit (non-blocking) ────────────────────────────────────────────────
    try {
      await logAudit({
        entity_type:   'contract',
        entity_id:     contractId,
        action:        'contractor_signing_turn_notified',
        actor_id:      'system',
        system_source: `docusign-notify/${source}`,
        metadata: {
          deal_id:        dealId,
          envelope_id:    envelopeId,
          contractor_id:  deal.contractor_id,
          notification_id: notificationId,
          deep_link:      `/dashboard/deals/${dealId}`,
          source,
        },
      })
    } catch (err) {
      console.error(
        '[docusign-notify] audit log failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }

    return true
  } catch (err) {
    console.error(
      '[docusign-notify] unexpected error:',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
