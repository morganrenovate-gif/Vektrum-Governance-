// ─── Transaction Receipt Engine ───────────────────────────────────────────────
//
// Creates, updates, and retrieves transaction receipts for milestone fund
// releases. Receipts are immutable financial records generated at release time
// and delivered via in-app UI and email.
//
// All write functions use the service-role admin client because the
// transaction_receipts RLS policy blocks client-side INSERT/UPDATE.

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionReceipt {
  id:                string
  receipt_number:    string
  release_id:        string
  milestone_id:      string
  deal_id:           string
  billing_record_id: string | null
  status:            'pending' | 'confirmed' | 'failed' | 'reversed'

  // Financial snapshot
  gross_amount:      number
  fee_amount:        number
  fee_rate_bps:      number
  total_charged:     number

  // Stripe
  stripe_transfer_id: string

  // Parties
  contractor_id:   string
  funder_id:       string
  contractor_name: string
  funder_name:     string

  // Deal / milestone titles
  deal_title:      string
  milestone_title: string

  // Timestamps
  released_at:      string
  failed_at:        string | null
  email_sent_at:    string | null
  created_at:       string
  updated_at:       string
}

export interface CreateReceiptParams {
  releaseId:         string
  milestoneId:       string
  dealId:            string
  billingRecordId:   string | null
  grossAmount:       number
  feeAmount:         number
  feeBps:            number
  totalCharged:      number
  stripeTransferId:  string
  contractorId:      string
  funderId:          string
  contractorName:    string
  funderName:        string
  dealTitle:         string
  milestoneTitle:    string
  releasedAt:        string
}

// ─── createTransactionReceipt ─────────────────────────────────────────────────
//
// Called immediately after Step 7 (audit log) in the release route, while the
// Stripe transfer is in-flight. Returns the created receipt or null on error.
// Never throws — a receipt creation failure must NOT abort the release response.

export async function createTransactionReceipt(
  params: CreateReceiptParams,
): Promise<{ id: string; receipt_number: string } | null> {
  const admin = createSupabaseAdminClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('transaction_receipts')
      .insert({
        // receipt_number is auto-assigned by the set_receipt_number trigger
        release_id:         params.releaseId,
        milestone_id:       params.milestoneId,
        deal_id:            params.dealId,
        billing_record_id:  params.billingRecordId,
        gross_amount:       params.grossAmount,
        fee_amount:         params.feeAmount,
        fee_rate_bps:       params.feeBps,
        total_charged:      params.totalCharged,
        stripe_transfer_id: params.stripeTransferId,
        contractor_id:      params.contractorId,
        funder_id:          params.funderId,
        contractor_name:    params.contractorName,
        funder_name:        params.funderName,
        deal_title:         params.dealTitle,
        milestone_title:    params.milestoneTitle,
        released_at:        params.releasedAt,
      })
      .select('id, receipt_number')
      .single()

    if (error) {
      console.error('[receipts] createTransactionReceipt insert failed:', error.message)
      return null
    }

    return data as { id: string; receipt_number: string }
  } catch (err) {
    console.error('[receipts] createTransactionReceipt unexpected error:', err)
    return null
  }
}

// ─── confirmTransactionReceipt ───────────────────────────────────────────────
//
// Called from the transfer.succeeded webhook handler when Stripe confirms that
// funds reached the contractor's Connect account.
//
// Transitions status: 'pending' → 'confirmed'.
// Guards against overwriting 'failed' or 'reversed' (Stripe can deliver events
// out of order; a prior failure event takes precedence over a late success).
// Idempotent: a second call for an already-confirmed receipt is a no-op.

export async function confirmTransactionReceipt(releaseId: string): Promise<void> {
  const admin = createSupabaseAdminClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('transaction_receipts')
      .update({ status: 'confirmed' })
      .eq('release_id', releaseId)
      // Only transition from pending — do not overwrite a failure status,
      // and treat an already-confirmed receipt as a no-op.
      .eq('status', 'pending')

    if (error) {
      console.error('[receipts] confirmTransactionReceipt update failed:', error.message)
    }
  } catch (err) {
    console.error('[receipts] confirmTransactionReceipt unexpected error:', err)
  }
}

// ─── failTransactionReceipt ───────────────────────────────────────────────────
//
// Called from the Stripe webhook handler when transfer.failed or
// transfer.reversed fires. Updates the receipt status and records the
// failed_at timestamp.
//
// Looks up the receipt by release_id (via releases.stripe_transfer_id) since
// the webhook handler works with release records, not receipt IDs.

export async function failTransactionReceipt(params: {
  releaseId: string
  status:    'failed' | 'reversed'
  failedAt:  string
}): Promise<void> {
  const admin = createSupabaseAdminClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('transaction_receipts')
      .update({
        status:    params.status,
        failed_at: params.failedAt,
      })
      .eq('release_id', params.releaseId)
      // Only transition from pending — idempotency guard
      .eq('status', 'pending')

    if (error) {
      // Non-fatal — receipt may simply not exist yet (race: webhook before insert)
      console.error('[receipts] failTransactionReceipt update failed:', error.message)
    }
  } catch (err) {
    console.error('[receipts] failTransactionReceipt unexpected error:', err)
  }
}

// ─── markReceiptEmailSent ─────────────────────────────────────────────────────
//
// Records that a receipt email was delivered. Called after a successful
// notifyTransactionReceipt() send. Also used by the /receipt/resend API.

export async function markReceiptEmailSent(receiptId: string): Promise<void> {
  const admin = createSupabaseAdminClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('transaction_receipts')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', receiptId)

    if (error) {
      console.error('[receipts] markReceiptEmailSent failed:', error.message)
    }
  } catch (err) {
    console.error('[receipts] markReceiptEmailSent unexpected error:', err)
  }
}

// ─── getReceiptByReleaseId ────────────────────────────────────────────────────

export async function getReceiptByReleaseId(
  releaseId: string,
): Promise<TransactionReceipt | null> {
  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('transaction_receipts')
    .select('*')
    .eq('release_id', releaseId)
    .maybeSingle()

  if (error) {
    console.error('[receipts] getReceiptByReleaseId failed:', error.message)
    return null
  }

  return data as TransactionReceipt | null
}

// ─── getReceiptById ───────────────────────────────────────────────────────────

export async function getReceiptById(
  receiptId: string,
): Promise<TransactionReceipt | null> {
  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('transaction_receipts')
    .select('*')
    .eq('id', receiptId)
    .maybeSingle()

  if (error) {
    console.error('[receipts] getReceiptById failed:', error.message)
    return null
  }

  return data as TransactionReceipt | null
}

// ─── getReceiptsByDealId ──────────────────────────────────────────────────────
//
// Returns all receipts for a deal, ordered newest first.
// Used in deal pages to list "Released milestones with receipts".

export async function getReceiptsByDealId(
  dealId: string,
): Promise<TransactionReceipt[]> {
  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('transaction_receipts')
    .select('*')
    .eq('deal_id', dealId)
    .order('released_at', { ascending: false })

  if (error) {
    console.error('[receipts] getReceiptsByDealId failed:', error.message)
    return []
  }

  return (data ?? []) as TransactionReceipt[]
}

// ─── formatReceiptFeeRate ─────────────────────────────────────────────────────
//
// Formats a basis-point rate for display: 100 → "1.00%", 70 → "0.70%"

export function formatReceiptFeeRate(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}
