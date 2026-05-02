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

// ─── Helper: idempotent two-party notification ──────────────────────────────
//
// Create a notification of `notification_type` addressed to both the funder
// and the contractor on a deal, *unless* a notification of the same type
// already exists for the contract. This is the shared idempotency primitive
// used by:
//   - notifyContractEnvelopeSent      ('contract_envelope_sent')
//   - notifyContractFullyExecuted     ('contract_fully_executed')
//
// Idempotency is keyed on (entity_type='contract', entity_id=contractId,
// notification_type) — so webhook redelivery, manual refresh, and any race
// between webhook + refresh all converge on a single row per recipient.
//
// Never throws. Returns the number of newly-created notification rows.

interface TwoPartyNotifyInput {
  dealId:           string
  contractId:       string
  envelopeId:       string
  source:           DocuSignNotifySource
  notificationType: string
  subject:          string
  buildBody:        (dealTitle: string) => string
}

async function createTwoPartyContractNotification(
  input: TwoPartyNotifyInput,
): Promise<number> {
  const { dealId, contractId, envelopeId, source, notificationType, subject, buildBody } = input

  try {
    const admin = createSupabaseAdminClient()

    // ── Idempotency check ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('notifications')
      .select('id')
      .eq('entity_type', 'contract')
      .eq('entity_id',   contractId)
      .eq('notification_type', notificationType)
      .limit(1)
      .maybeSingle()

    if (existing) {
      console.info(
        `[docusign-notify] ${notificationType} already exists for contract ${contractId} — skipping`,
      )
      return 0
    }

    // ── Resolve deal context ────────────────────────────────────────────────
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('id, title, contractor_id, funder_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      console.warn(
        `[docusign-notify] deal ${dealId} not found — cannot create ${notificationType}`,
      )
      return 0
    }

    const dealTitle = deal.title ?? 'your deal'
    const body      = buildBody(dealTitle)

    // ── Resolve participant emails (best-effort fallback) ──────────────────
    async function emailFor(userId: string | null): Promise<string | null> {
      if (!userId) return null
      try {
        const r = await admin.auth.admin.getUserById(userId)
        return r.data?.user?.email ?? null
      } catch {
        return null
      }
    }
    const [funderEmail, contractorEmail] = await Promise.all([
      emailFor(deal.funder_id),
      emailFor(deal.contractor_id),
    ])

    const recipients: Array<{ user_id: string; email: string | null; party: 'funder' | 'contractor' }> = []
    if (deal.funder_id)     recipients.push({ user_id: deal.funder_id,     email: funderEmail,     party: 'funder' })
    if (deal.contractor_id) recipients.push({ user_id: deal.contractor_id, email: contractorEmail, party: 'contractor' })

    if (recipients.length === 0) {
      console.warn(
        `[docusign-notify] no participants on deal ${dealId} — skipping ${notificationType}`,
      )
      return 0
    }

    let created = 0
    const createdIds: string[] = []
    for (const r of recipients) {
      const id = await createNotification({
        recipient_user_id: r.user_id,
        recipient_email:   r.email,
        deal_id:           dealId,
        entity_type:       'contract',
        entity_id:         contractId,
        notification_type: notificationType,
        channel:           'in_app',
        subject,
        body_summary:      body,
      })
      if (id) {
        created++
        createdIds.push(id)
      }
    }

    if (created === 0) return 0

    // ── Audit (non-blocking) ────────────────────────────────────────────────
    try {
      await logAudit({
        entity_type:   'contract',
        entity_id:     contractId,
        action:        `${notificationType}_notified`,
        actor_id:      'system',
        system_source: `docusign-notify/${source}`,
        metadata: {
          deal_id:          dealId,
          envelope_id:      envelopeId,
          notification_ids: createdIds,
          recipient_count:  recipients.length,
          deep_link:        `/dashboard/deals/${dealId}`,
          source,
        },
      })
    } catch (err) {
      console.error(
        '[docusign-notify] audit log failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }

    return created
  } catch (err) {
    console.error(
      '[docusign-notify] unexpected error:',
      err instanceof Error ? err.message : err,
    )
    return 0
  }
}

// ─── Envelope sent — notify both parties ───────────────────────────────────

export interface NotifyEnvelopeSentInput {
  dealId:     string
  contractId: string
  envelopeId: string
  source:     DocuSignNotifySource
}

/**
 * Sent immediately after createEnvelope succeeds. Both parties see "Contract
 * sent for signature" so they know the document is in flight and milestone
 * releases are blocked until both sign.
 */
export async function notifyContractEnvelopeSent(
  input: NotifyEnvelopeSentInput,
): Promise<number> {
  return createTwoPartyContractNotification({
    dealId:           input.dealId,
    contractId:       input.contractId,
    envelopeId:       input.envelopeId,
    source:           input.source,
    notificationType: 'contract_envelope_sent',
    subject:          'Contract sent for signature',
    buildBody:        (deal) =>
      `The contract for ${deal} has been sent through DocuSign. ` +
      'Milestone releases remain blocked until all required parties complete signing.',
  })
}

// ─── Fully executed — notify both parties ───────────────────────────────────

export interface NotifyFullyExecutedInput {
  dealId:     string
  contractId: string
  envelopeId: string
  source:     DocuSignNotifySource
}

/**
 * Sent on `envelope-completed` (or when the manual refresh route observes
 * both timestamps). Both parties see "Contract fully executed" so they know
 * release setup can proceed once the remaining gate conditions are met.
 *
 * The release gate itself is unchanged — this is a notification side-effect.
 */
export async function notifyContractFullyExecuted(
  input: NotifyFullyExecutedInput,
): Promise<number> {
  return createTwoPartyContractNotification({
    dealId:           input.dealId,
    contractId:       input.contractId,
    envelopeId:       input.envelopeId,
    source:           input.source,
    notificationType: 'contract_fully_executed',
    subject:          'Contract fully executed',
    buildBody:        (deal) =>
      `Both parties have completed signing for ${deal}. ` +
      'Release setup can continue once all required conditions are satisfied.',
  })
}
