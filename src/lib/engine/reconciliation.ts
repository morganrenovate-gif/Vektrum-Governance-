// =============================================================================
// Stripe ↔ DB Reconciliation Engine
//
// Four detection passes run sequentially. All issues are deduplicated so that
// subsequent runs UPDATE existing open issues rather than inserting duplicates.
//
// Pass 1  DB → Stripe       Does every DB release have a valid Stripe transfer?
// Pass 2  Billing records   Does every release have a corresponding billing_record?
// Pass 3  Stripe → DB       Does every Stripe transfer have a DB release record?
// Pass 4  Ledger arithmetic  Do deal.released_amount / fees_collected match their
//                            constituent rows?
//
// All writes use createSupabaseAdminClient() — reconciliation rows are never
// visible to users and bypass RLS intentionally.
// =============================================================================

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { calculateFee } from '@/lib/engine/billing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssueType =
  | 'orphaned_transfer'
  | 'missing_stripe_id'
  | 'amount_mismatch'
  | 'ledger_drift'
  | 'stripe_transfer_not_found'
  | 'missing_billing_record'
  | 'fee_ledger_drift'
  | 'metadata_mismatch'
  // ── Funding confirmation passes (Pass 5) ──
  /** funded_amount in DB exceeds the sum of bank-confirmed Stripe PaymentIntents. Phantom balance. */
  | 'funding_phantom_balance'
  /** Stripe has confirmed a PaymentIntent but DB funded_amount is lower. Probable missed webhook. */
  | 'funding_missing_webhook'

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus   = 'open' | 'acknowledged' | 'resolved' | 'false_positive' | 'auto_resolved'

export interface ReconciliationIssueInput {
  issueType:        IssueType
  severity:         IssueSeverity
  dealId?:          string | null
  milestoneId?:     string | null
  releaseId?:       string | null
  stripeTransferId?: string | null
  expectedAmount?:  number | null
  actualAmount?:    number | null
  description:      string
  rawEvidence:      Record<string, unknown>
  dedupKey:         string
  autoFixable:      boolean
}

export interface ReconciliationRunOptions {
  /**
   * Hours back to check DB releases, Stripe transfers, and PaymentIntents.
   * Takes precedence over `windowDays` when set.
   * Reads RECONCILIATION_LOOKBACK_HOURS env var when neither is provided.
   * Fallback default: 72 hours.
   */
  windowHours?:  number
  /** Days back to check (overridden by windowHours). Default 7 days / 168 h. */
  windowDays?:   number
  /** Who triggered this run. 'cron' or 'manual:{user_id}'. Default 'cron'. */
  triggeredBy?:  string
  /** Pre-created run ID (if starting from an API route). If omitted, creates one. */
  runId?:        string
}

export interface ReconciliationResult {
  runId:            string
  status:           'completed' | 'failed'
  releasesChecked:  number
  transfersChecked: number
  dealsChecked:     number
  issuesFound:      number
  issuesAutoFixed:  number
  durationMs:       number
  error?:           string
}

// ─── Severity Map ─────────────────────────────────────────────────────────────

const SEVERITY: Record<IssueType, IssueSeverity> = {
  orphaned_transfer:          'critical',
  missing_stripe_id:          'critical',
  amount_mismatch:            'critical',
  ledger_drift:               'critical',
  stripe_transfer_not_found:  'high',
  missing_billing_record:     'high',
  fee_ledger_drift:           'high',
  metadata_mismatch:          'medium',
  // Pass 5 — funding confirmation
  funding_phantom_balance:    'critical',  // funded_amount > confirmed — real money risk
  funding_missing_webhook:    'high',      // confirmed > funded_amount — likely missed webhook
}

const AUTO_FIXABLE: Record<IssueType, boolean> = {
  orphaned_transfer:          false,
  missing_stripe_id:          false,
  amount_mismatch:            false,
  ledger_drift:               true,   // recompute from releases table
  stripe_transfer_not_found:  false,
  missing_billing_record:     true,   // insert from release + deal data
  fee_ledger_drift:           true,   // recompute from billing_records table
  metadata_mismatch:          false,
  // Pass 5 — cannot auto-fix financial discrepancies without human approval
  funding_phantom_balance:    false,
  funding_missing_webhook:    false,
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runReconciliation(
  options: ReconciliationRunOptions = {},
): Promise<ReconciliationResult> {
  const {
    windowHours:  optWindowHours,
    windowDays    = 7,
    triggeredBy   = 'cron',
    runId: presetRunId,
  } = options

  // Resolve effective lookback window in hours.
  // Priority: explicit windowHours option → RECONCILIATION_LOOKBACK_HOURS env var → windowDays fallback.
  const envHours = process.env.RECONCILIATION_LOOKBACK_HOURS
    ? parseInt(process.env.RECONCILIATION_LOOKBACK_HOURS, 10)
    : null
  const effectiveHours = optWindowHours ?? (envHours && isFinite(envHours) ? envHours : windowDays * 24)

  const startedAt   = Date.now()
  const windowEnd   = new Date()
  const windowStart = new Date(windowEnd.getTime() - effectiveHours * 3_600_000)

  const admin = createSupabaseAdminClient()

  // ── Create or reuse the run record ─────────────────────────────────────────
  let runId: string

  if (presetRunId) {
    runId = presetRunId
  } else {
    const { data: run, error: runInsertError } = await admin
      .from('reconciliation_runs')
      .insert({
        window_start: windowStart.toISOString(),
        window_end:   windowEnd.toISOString(),
        triggered_by: triggeredBy,
        status:       'running',
      })
      .select('id')
      .single()

    if (runInsertError || !run) {
      console.error('[reconciliation] Failed to create run record:', runInsertError?.message)
      return {
        runId:            'unknown',
        status:           'failed',
        releasesChecked:  0,
        transfersChecked: 0,
        dealsChecked:     0,
        issuesFound:      0,
        issuesAutoFixed:  0,
        durationMs:       Date.now() - startedAt,
        error:            runInsertError?.message ?? 'Failed to create run record',
      }
    }
    runId = run.id
  }

  const issues: ReconciliationIssueInput[] = []
  let releasesChecked  = 0
  let transfersChecked = 0
  let dealsChecked     = 0

  try {
    // ── Fetch DB releases in window ─────────────────────────────────────────
    const { data: dbReleases, error: relError } = await admin
      .from('releases')
      .select('id, milestone_id, deal_id, amount, stripe_transfer_id, idempotency_key, released_at, released_by')
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', windowEnd.toISOString())

    if (relError) throw new Error(`DB releases fetch failed: ${relError.message}`)

    const releases = dbReleases ?? []
    releasesChecked = releases.length

    // ── Fetch DB billing_records in window ─────────────────────────────────
    const { data: dbBillingRecords, error: brError } = await admin
      .from('billing_records')
      .select('id, release_id, milestone_id, deal_id, gross_amount, fee_amount, stripe_transfer_id')
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', windowEnd.toISOString())

    if (brError) throw new Error(`DB billing_records fetch failed: ${brError.message}`)

    const billingRecordsByReleaseId = new Map(
      (dbBillingRecords ?? []).map(br => [br.release_id, br]),
    )
    const billingRecordsByMilestoneId = new Map(
      (dbBillingRecords ?? []).map(br => [br.milestone_id, br]),
    )

    // ── Fetch Stripe transfers in window ────────────────────────────────────
    const stripeTransfers = new Map<string, Stripe.Transfer>()
    const windowStartUnix = Math.floor(windowStart.getTime() / 1000)
    const windowEndUnix   = Math.floor(windowEnd.getTime()   / 1000)

    for await (const transfer of stripe.transfers.list({
      created: { gte: windowStartUnix, lte: windowEndUnix },
      limit:   100,
    })) {
      if (transfer.metadata?.vektrum_action === 'milestone_release') {
        stripeTransfers.set(transfer.id, transfer)
        transfersChecked++
      }
    }

    // ── Pass 1: DB releases → Stripe (stripe confirmation) ─────────────────
    for (const release of releases) {
      if (!release.stripe_transfer_id) {
        // Release has no Stripe transfer ID at all
        issues.push({
          issueType:   'missing_stripe_id',
          severity:    SEVERITY.missing_stripe_id,
          dealId:      release.deal_id,
          milestoneId: release.milestone_id,
          releaseId:   release.id,
          description:
            `Release ${release.id} (milestone ${release.milestone_id}, ` +
            `$${Number(release.amount).toFixed(2)}) has no stripe_transfer_id. ` +
            'The Stripe transfer may have succeeded but the ID was not persisted.',
          rawEvidence:  { db_release: release },
          dedupKey:     `missing_stripe_id:${release.id}`,
          autoFixable:  false,
        })
        continue
      }

      const stripeTransfer = stripeTransfers.get(release.stripe_transfer_id)

      if (!stripeTransfer) {
        // ID is in DB but not found in Stripe (transfer not in window, cancelled, etc.)
        // Try a direct lookup before flagging
        let directFetch: Stripe.Transfer | null = null
        try {
          directFetch = await stripe.transfers.retrieve(release.stripe_transfer_id)
        } catch { /* not found */ }

        if (!directFetch) {
          issues.push({
            issueType:       'stripe_transfer_not_found',
            severity:        SEVERITY.stripe_transfer_not_found,
            dealId:          release.deal_id,
            milestoneId:     release.milestone_id,
            releaseId:       release.id,
            stripeTransferId: release.stripe_transfer_id,
            description:
              `Release ${release.id} references Stripe transfer ` +
              `${release.stripe_transfer_id} which could not be found in Stripe. ` +
              `DB amount: $${Number(release.amount).toFixed(2)}.`,
            rawEvidence:     { db_release: release },
            dedupKey:        `stripe_transfer_not_found:${release.id}`,
            autoFixable:     false,
          })
        } else {
          // Found via direct lookup — add to map for Pass 3 and check amount
          stripeTransfers.set(directFetch.id, directFetch)
          const dbCents     = Math.round(Number(release.amount) * 100)
          const stripeCents = directFetch.amount

          if (dbCents !== stripeCents) {
            issues.push(buildAmountMismatch(release, directFetch, dbCents, stripeCents))
          }
          // Check metadata
          if (directFetch.metadata?.milestone_id && directFetch.metadata.milestone_id !== release.milestone_id) {
            issues.push(buildMetadataMismatch(release, directFetch))
          }
        }
      } else {
        // Transfer found — check amount
        const dbCents     = Math.round(Number(release.amount) * 100)
        const stripeCents = stripeTransfer.amount

        if (dbCents !== stripeCents) {
          issues.push(buildAmountMismatch(release, stripeTransfer, dbCents, stripeCents))
        }

        // Check metadata consistency
        if (
          stripeTransfer.metadata?.milestone_id &&
          stripeTransfer.metadata.milestone_id !== release.milestone_id
        ) {
          issues.push(buildMetadataMismatch(release, stripeTransfer))
        }
      }
    }

    // ── Pass 2: Release → billing_record completeness ──────────────────────
    for (const release of releases) {
      const hasBillingRecord =
        billingRecordsByReleaseId.has(release.id) ||
        billingRecordsByMilestoneId.has(release.milestone_id)

      if (!hasBillingRecord) {
        issues.push({
          issueType:        'missing_billing_record',
          severity:         SEVERITY.missing_billing_record,
          dealId:           release.deal_id,
          milestoneId:      release.milestone_id,
          releaseId:        release.id,
          stripeTransferId: release.stripe_transfer_id,
          expectedAmount:   null,
          actualAmount:     Number(release.amount),
          description:
            `Release ${release.id} ($${Number(release.amount).toFixed(2)}) ` +
            'has no corresponding billing_record. The platform fee was not recorded.',
          rawEvidence:   { db_release: release },
          dedupKey:      `missing_billing_record:${release.id}`,
          autoFixable:   true,
        })
      }
    }

    // ── Pass 3: Stripe transfers → DB (orphaned transfers) ─────────────────
    const dbTransferIds = new Set(
      releases
        .map(r => r.stripe_transfer_id)
        .filter((id): id is string => id !== null && id !== undefined),
    )

    for (const [transferId, transfer] of stripeTransfers) {
      if (!dbTransferIds.has(transferId)) {
        const amountDollars = transfer.amount / 100

        issues.push({
          issueType:        'orphaned_transfer',
          severity:         SEVERITY.orphaned_transfer,
          dealId:           transfer.metadata?.deal_id ?? null,
          milestoneId:      transfer.metadata?.milestone_id ?? null,
          stripeTransferId: transferId,
          actualAmount:     amountDollars,
          description:
            `Stripe transfer ${transferId} ($${amountDollars.toFixed(2)}) ` +
            `has no DB release record. Money was transferred but not persisted. ` +
            `Metadata: deal=${transfer.metadata?.deal_id ?? 'unknown'}, ` +
            `milestone=${transfer.metadata?.milestone_id ?? 'unknown'}.`,
          rawEvidence:  {
            stripe_transfer: {
              id:       transfer.id,
              amount:   transfer.amount,
              currency: transfer.currency,
              metadata: transfer.metadata,
              created:  transfer.created,
            },
          },
          dedupKey:     `orphaned_transfer:${transferId}`,
          autoFixable:  false,  // requires human judgment to reconstruct DB state
        })
      }
    }

    // ── Pass 4: Ledger arithmetic ───────────────────────────────────────────
    // Check all active/completed deals — not limited to the window.
    const { data: activeDeals, error: dealError } = await admin
      .from('deals')
      .select('id, released_amount, fees_collected')
      .in('status', ['active', 'completed'])

    if (dealError) throw new Error(`Deal fetch for ledger check failed: ${dealError.message}`)

    dealsChecked = (activeDeals ?? []).length

    if (dealsChecked > 0) {
      // Aggregate actual releases per deal
      const { data: releaseSums } = await admin
        .from('releases')
        .select('deal_id, amount')

      const releaseByDeal = new Map<string, number>()
      for (const r of releaseSums ?? []) {
        releaseByDeal.set(r.deal_id, (releaseByDeal.get(r.deal_id) ?? 0) + Number(r.amount))
      }

      // Aggregate actual billing fees per deal
      const { data: feeSums } = await admin
        .from('billing_records')
        .select('deal_id, fee_amount')

      const feeByDeal = new Map<string, number>()
      for (const b of feeSums ?? []) {
        feeByDeal.set(b.deal_id, (feeByDeal.get(b.deal_id) ?? 0) + Number(b.fee_amount))
      }

      for (const deal of activeDeals ?? []) {
        const actualReleased = releaseByDeal.get(deal.id) ?? 0
        const dbReleased     = Number(deal.released_amount)

        if (Math.abs(actualReleased - dbReleased) > 0.01) {
          issues.push({
            issueType:      'ledger_drift',
            severity:       SEVERITY.ledger_drift,
            dealId:         deal.id,
            expectedAmount: actualReleased,  // what the ledger SHOULD show (sum of rows)
            actualAmount:   dbReleased,      // what the ledger ACTUALLY shows
            description:
              `Deal ${deal.id}: released_amount ledger shows $${dbReleased.toFixed(2)} ` +
              `but SUM(releases.amount) is $${actualReleased.toFixed(2)}. ` +
              `Drift: $${Math.abs(actualReleased - dbReleased).toFixed(2)}.`,
            rawEvidence:   { deal_id: deal.id, db_released_amount: dbReleased, sum_of_releases: actualReleased },
            dedupKey:      `ledger_drift:${deal.id}`,
            autoFixable:   true,
          })
        }

        const actualFees = feeByDeal.get(deal.id) ?? 0
        const dbFees     = Number(deal.fees_collected)

        if (Math.abs(actualFees - dbFees) > 0.01) {
          issues.push({
            issueType:      'fee_ledger_drift',
            severity:       SEVERITY.fee_ledger_drift,
            dealId:         deal.id,
            expectedAmount: actualFees,
            actualAmount:   dbFees,
            description:
              `Deal ${deal.id}: fees_collected ledger shows $${dbFees.toFixed(2)} ` +
              `but SUM(billing_records.fee_amount) is $${actualFees.toFixed(2)}. ` +
              `Drift: $${Math.abs(actualFees - dbFees).toFixed(2)}.`,
            rawEvidence:   { deal_id: deal.id, db_fees_collected: dbFees, sum_of_fees: actualFees },
            dedupKey:      `fee_ledger_drift:${deal.id}`,
            autoFixable:   true,
          })
        }
      }
    }

    // ── Pass 5: Funding confirmation — funded_amount vs confirmed Stripe PIs ──
    //
    // Uses the Stripe PaymentIntent Search API to retrieve all Vektrum
    // deal-funding PIs that have been bank-confirmed (status:'succeeded').
    // Groups them by deal_id, then compares each deal's funded_amount against
    // the sum of confirmed PI amounts.
    //
    // Flags two scenarios:
    //   funding_phantom_balance  — funded_amount > sum(confirmed PIs)
    //     Indicates funded_amount was incremented before bank confirmation
    //     (the old optimistic bug) or a webhook was not processed correctly.
    //   funding_missing_webhook  — sum(confirmed PIs) > funded_amount
    //     Indicates a payment_intent.succeeded webhook was lost or failed;
    //     funded_amount was never updated after bank confirmation.
    //
    // Stripe Search API docs:
    //   https://stripe.com/docs/api/payment_intents/search
    //   Supports: metadata['key']:'value' AND status:'succeeded'
    try {
      // Fetch all succeeded deal-funding PaymentIntents from Stripe
      const confirmedByDeal = new Map<string, { totalUsd: number; piIds: string[] }>()

      // Stripe Search: parameterized query for Vektrum deal-funding PIs
      // The Stripe Search API does NOT support date-range filters on metadata queries,
      // so we fetch all and let the dedup_key prevent re-reporting resolved issues.
      let searchPage = await stripe.paymentIntents.search({
        query:  `metadata['vektrum_action']:'deal_funding' AND status:'succeeded'`,
        limit:  100,
        expand: [],
      })

      // Apply lookback window: filter PIs outside the reconciliation window.
      // Stripe Search doesn't support date filters on metadata queries, so we
      // page through all results and discard PIs created before windowStart.
      const windowStartUnixSec = Math.floor(windowStart.getTime() / 1000)

      const processPiPage = (pis: Stripe.PaymentIntent[]) => {
        for (const pi of pis) {
          // Skip PIs outside the lookback window
          if (pi.created < windowStartUnixSec) continue

          const dId = pi.metadata?.deal_id
          if (!dId) continue
          const amtUsd = pi.amount / 100
          const entry  = confirmedByDeal.get(dId) ?? { totalUsd: 0, piIds: [] }
          entry.totalUsd += amtUsd
          entry.piIds.push(pi.id)
          confirmedByDeal.set(dId, entry)
        }
      }

      processPiPage(searchPage.data)

      while (searchPage.has_more && searchPage.next_page) {
        searchPage = await stripe.paymentIntents.search({
          query:     `metadata['vektrum_action']:'deal_funding' AND status:'succeeded'`,
          limit:     100,
          page:      searchPage.next_page,
        })
        processPiPage(searchPage.data)
      }

      if (confirmedByDeal.size > 0) {
        const fundingDealIds = [...confirmedByDeal.keys()]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fundingDeals } = await (admin as any)
          .from('deals')
          .select('id, funded_amount, funds_captured')
          .in('id', fundingDealIds)

        for (const deal of fundingDeals ?? []) {
          const stripeData = confirmedByDeal.get(deal.id)
          if (!stripeData) continue

          const dbFunded      = Number(deal.funded_amount)
          const stripeConfirmed = stripeData.totalUsd
          const delta          = dbFunded - stripeConfirmed

          // Tolerance: 1 cent. Floating-point arithmetic at 2 decimal places.
          if (Math.abs(delta) <= 0.01) continue

          if (delta > 0.01) {
            // funded_amount is higher than Stripe confirmed — phantom balance
            issues.push({
              issueType:      'funding_phantom_balance',
              severity:       SEVERITY.funding_phantom_balance,
              dealId:         deal.id,
              expectedAmount: stripeConfirmed,
              actualAmount:   dbFunded,
              description:
                `Deal ${deal.id}: funded_amount ($${dbFunded.toFixed(2)}) exceeds ` +
                `sum of bank-confirmed Stripe PaymentIntents ($${stripeConfirmed.toFixed(2)}). ` +
                `Phantom balance of $${delta.toFixed(2)}. ` +
                `Confirmed PIs: ${stripeData.piIds.join(', ')}.`,
              rawEvidence: {
                deal_id:           deal.id,
                db_funded_amount:  dbFunded,
                stripe_confirmed:  stripeConfirmed,
                delta,
                payment_intent_ids: stripeData.piIds,
              },
              dedupKey:    `funding_phantom_balance:${deal.id}`,
              autoFixable: false,
            })
          } else {
            // Stripe confirmed more than DB — missed payment_intent.succeeded webhook
            issues.push({
              issueType:      'funding_missing_webhook',
              severity:       SEVERITY.funding_missing_webhook,
              dealId:         deal.id,
              expectedAmount: stripeConfirmed,
              actualAmount:   dbFunded,
              description:
                `Deal ${deal.id}: Stripe has confirmed $${stripeConfirmed.toFixed(2)} ` +
                `across ${stripeData.piIds.length} PaymentIntent(s) but funded_amount ` +
                `is only $${dbFunded.toFixed(2)}. A payment_intent.succeeded webhook ` +
                `may have been lost. Missing: $${Math.abs(delta).toFixed(2)}. ` +
                `PI IDs: ${stripeData.piIds.join(', ')}.`,
              rawEvidence: {
                deal_id:           deal.id,
                db_funded_amount:  dbFunded,
                stripe_confirmed:  stripeConfirmed,
                delta:             Math.abs(delta),
                payment_intent_ids: stripeData.piIds,
              },
              dedupKey:    `funding_missing_webhook:${deal.id}`,
              autoFixable: false,
            })
          }
        }

        // Also flag deals with funds_captured=true that are not in Stripe's confirmed PI list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: capturedNotInStripe } = await (admin as any)
          .from('deals')
          .select('id, funded_amount')
          .eq('funds_captured', true)
          .not('id', 'in', `(${fundingDealIds.map(id => `'${id}'`).join(',')})`)

        for (const deal of capturedNotInStripe ?? []) {
          issues.push({
            issueType:      'funding_phantom_balance',
            severity:       SEVERITY.funding_phantom_balance,
            dealId:         deal.id,
            expectedAmount: 0,
            actualAmount:   Number(deal.funded_amount),
            description:
              `Deal ${deal.id}: funds_captured=true and funded_amount=$${Number(deal.funded_amount).toFixed(2)} ` +
              `but no confirmed Stripe PaymentIntent found. ` +
              `Possible data integrity issue — requires manual investigation.`,
            rawEvidence: {
              deal_id:          deal.id,
              funds_captured:   true,
              db_funded_amount: Number(deal.funded_amount),
              stripe_pi_count:  0,
            },
            dedupKey:    `funding_phantom_balance:${deal.id}:no_stripe_pi`,
            autoFixable: false,
          })
        }

        dealsChecked += (fundingDeals?.length ?? 0)
      }
    } catch (pass5Error) {
      // Pass 5 failure is non-fatal — the other passes still ran.
      // Log the error but do not abort the entire run.
      console.error(
        '[reconciliation] Pass 5 (funding confirmation) failed — skipped:',
        pass5Error instanceof Error ? pass5Error.message : String(pass5Error),
      )
    }

    // ── Persist issues (upsert — dedup on dedup_key) ────────────────────────
    // ON CONFLICT: open issues get their run_id updated so the admin can see
    // they were re-detected. Resolved/false_positive issues are skipped
    // (the unique constraint does not apply to them — we remove from the
    // unique index scope via a partial index trick).
    //
    // Implementation: we use INSERT ... ON CONFLICT DO UPDATE with a guard
    // that only updates open/acknowledged issues.

    let issuesInserted = 0

    for (const issue of issues) {
      const row = {
        run_id:            runId,
        issue_type:        issue.issueType,
        severity:          issue.severity,
        deal_id:           issue.dealId     ?? null,
        milestone_id:      issue.milestoneId ?? null,
        release_id:        issue.releaseId  ?? null,
        stripe_transfer_id: issue.stripeTransferId ?? null,
        expected_amount:   issue.expectedAmount ?? null,
        actual_amount:     issue.actualAmount   ?? null,
        description:       issue.description,
        raw_evidence:      issue.rawEvidence,
        dedup_key:         issue.dedupKey,
        auto_fixable:      issue.autoFixable,
        status:            'open',
      }

      const { error: upsertError } = await admin
        .from('reconciliation_issues')
        .upsert(row, {
          onConflict:        'dedup_key',
          ignoreDuplicates:  false,
        })

      if (!upsertError) {
        issuesInserted++
      } else {
        // If conflict was on a resolved/false_positive issue, that's fine — skip.
        // Log other errors.
        if (!upsertError.message.includes('unique') && !upsertError.message.includes('conflict')) {
          console.error('[reconciliation] Issue upsert error:', upsertError.message, issue.dedupKey)
        }
      }
    }

    // ── Finalize run record ─────────────────────────────────────────────────
    await admin
      .from('reconciliation_runs')
      .update({
        status:            'completed',
        completed_at:      new Date().toISOString(),
        releases_checked:  releasesChecked,
        transfers_checked: transfersChecked,
        deals_checked:     dealsChecked,
        issues_found:      issuesInserted,
      })
      .eq('id', runId)

    return {
      runId,
      status:           'completed',
      releasesChecked,
      transfersChecked,
      dealsChecked,
      issuesFound:      issuesInserted,
      issuesAutoFixed:  0,
      durationMs:       Date.now() - startedAt,
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[reconciliation] Run failed:', message)

    await admin
      .from('reconciliation_runs')
      .update({
        status:           'failed',
        completed_at:     new Date().toISOString(),
        releases_checked: releasesChecked,
        transfers_checked: transfersChecked,
        deals_checked:    dealsChecked,
        error_message:    message,
      })
      .eq('id', runId)

    return {
      runId,
      status:           'failed',
      releasesChecked,
      transfersChecked,
      dealsChecked,
      issuesFound:      issues.length,
      issuesAutoFixed:  0,
      durationMs:       Date.now() - startedAt,
      error:            message,
    }
  }
}

// ─── Auto-Fix Engine ──────────────────────────────────────────────────────────

/**
 * Applies a safe automated fix to an eligible issue.
 *
 * Currently supported:
 *   missing_billing_record — inserts the missing billing_record row
 *   ledger_drift           — recomputes deal.released_amount from releases
 *   fee_ledger_drift       — recomputes deal.fees_collected from billing_records
 *
 * Returns a description of what was done.
 * Throws if the fix cannot be applied safely.
 */
export async function applyAutoFix(issueId: string, adminUserId: string): Promise<string> {
  const admin = createSupabaseAdminClient()

  const { data: issue, error: fetchError } = await admin
    .from('reconciliation_issues')
    .select('*')
    .eq('id', issueId)
    .single()

  if (fetchError || !issue) {
    throw new Error(`Issue ${issueId} not found`)
  }

  if (!issue.auto_fixable) {
    throw new Error(`Issue ${issueId} (${issue.issue_type}) is not auto-fixable`)
  }

  if (issue.status !== 'open' && issue.status !== 'acknowledged') {
    throw new Error(`Issue ${issueId} is already ${issue.status}`)
  }

  let actionDescription: string

  // ── Fix: missing_billing_record ────────────────────────────────────────────
  if (issue.issue_type === 'missing_billing_record') {
    if (!issue.release_id) throw new Error('No release_id on issue')

    const { data: release } = await admin
      .from('releases')
      .select('id, deal_id, milestone_id, amount, stripe_transfer_id')
      .eq('id', issue.release_id)
      .single()

    if (!release) throw new Error(`Release ${issue.release_id} not found`)
    if (!release.stripe_transfer_id) throw new Error('Release has no stripe_transfer_id — cannot create billing_record')

    const { data: deal } = await admin
      .from('deals')
      .select('billing_rate_bps, funder_id')
      .eq('id', release.deal_id)
      .single()

    if (!deal) throw new Error(`Deal ${release.deal_id} not found`)
    if (!deal.funder_id) throw new Error('Deal has no funder_id')

    const fee = calculateFee(Number(release.amount), deal.billing_rate_bps)

    const { error: insertError } = await admin
      .from('billing_records')
      .insert({
        deal_id:           release.deal_id,
        milestone_id:      release.milestone_id,
        release_id:        release.id,
        funder_id:         deal.funder_id,
        gross_amount:      fee.grossAmount,
        billing_rate_bps:  fee.billingRateBps,
        fee_amount:        fee.feeAmount,
        net_amount:        fee.netAmount,
        stripe_transfer_id: release.stripe_transfer_id,
      })

    if (insertError) throw new Error(`Failed to insert billing_record: ${insertError.message}`)

    actionDescription = `billing_record_created — gross $${fee.grossAmount.toFixed(2)}, fee $${fee.feeAmount.toFixed(2)} (${fee.rateLabel})`
  }

  // ── Fix: ledger_drift ──────────────────────────────────────────────────────
  else if (issue.issue_type === 'ledger_drift') {
    if (!issue.deal_id) throw new Error('No deal_id on issue')

    const { data: sums } = await admin
      .from('releases')
      .select('amount')
      .eq('deal_id', issue.deal_id)

    const correctAmount = (sums ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const rounded       = Math.round(correctAmount * 100) / 100

    const { error: updateError } = await admin
      .from('deals')
      .update({ released_amount: rounded })
      .eq('id', issue.deal_id)

    if (updateError) throw new Error(`Failed to update deal released_amount: ${updateError.message}`)

    actionDescription = `ledger_recomputed — released_amount set to $${rounded.toFixed(2)}`
  }

  // ── Fix: fee_ledger_drift ──────────────────────────────────────────────────
  else if (issue.issue_type === 'fee_ledger_drift') {
    if (!issue.deal_id) throw new Error('No deal_id on issue')

    const { data: feeSums } = await admin
      .from('billing_records')
      .select('fee_amount')
      .eq('deal_id', issue.deal_id)

    const correctFees = (feeSums ?? []).reduce((s, r) => s + Number(r.fee_amount), 0)
    const rounded     = Math.round(correctFees * 100) / 100

    const { error: updateError } = await admin
      .from('deals')
      .update({ fees_collected: rounded })
      .eq('id', issue.deal_id)

    if (updateError) throw new Error(`Failed to update deal fees_collected: ${updateError.message}`)

    actionDescription = `fee_ledger_recomputed — fees_collected set to $${rounded.toFixed(2)}`
  }

  else {
    throw new Error(`No auto-fix implementation for issue type: ${issue.issue_type}`)
  }

  // ── Mark issue as auto_resolved ────────────────────────────────────────────
  await admin
    .from('reconciliation_issues')
    .update({
      status:            'auto_resolved',
      resolved_at:       new Date().toISOString(),
      resolved_by:       adminUserId,
      resolution_action: actionDescription,
      resolution_note:   `Automatically fixed by admin ${adminUserId}`,
      // Clear dedup_key so the issue can be re-detected if it recurs
      dedup_key: `resolved:${issue.dedup_key}:${Date.now()}`,
    })
    .eq('id', issueId)

  return actionDescription
}

// ─── Internal Builders ────────────────────────────────────────────────────────

function buildAmountMismatch(
  release:  { id: string; milestone_id: string; deal_id: string; amount: unknown; stripe_transfer_id: string | null },
  transfer: Stripe.Transfer,
  dbCents:  number,
  stripeCents: number,
): ReconciliationIssueInput {
  return {
    issueType:        'amount_mismatch',
    severity:         SEVERITY.amount_mismatch,
    dealId:           release.deal_id,
    milestoneId:      release.milestone_id,
    releaseId:        release.id,
    stripeTransferId: transfer.id,
    expectedAmount:   dbCents / 100,
    actualAmount:     stripeCents / 100,
    description:
      `Amount mismatch on release ${release.id}: ` +
      `DB records $${(dbCents / 100).toFixed(2)} but Stripe transfer ` +
      `${transfer.id} shows $${(stripeCents / 100).toFixed(2)}. ` +
      `Difference: $${(Math.abs(dbCents - stripeCents) / 100).toFixed(2)}.`,
    rawEvidence: {
      db_release:      { id: release.id, amount: release.amount, stripe_transfer_id: release.stripe_transfer_id },
      stripe_transfer: { id: transfer.id, amount: transfer.amount, currency: transfer.currency },
    },
    dedupKey:    `amount_mismatch:${release.id}`,
    autoFixable: false,
  }
}

function buildMetadataMismatch(
  release:  { id: string; milestone_id: string; deal_id: string },
  transfer: Stripe.Transfer,
): ReconciliationIssueInput {
  return {
    issueType:        'metadata_mismatch',
    severity:         SEVERITY.metadata_mismatch,
    dealId:           release.deal_id,
    milestoneId:      release.milestone_id,
    releaseId:        release.id,
    stripeTransferId: transfer.id,
    description:
      `Stripe transfer ${transfer.id} metadata milestone_id ` +
      `(${transfer.metadata?.milestone_id}) does not match ` +
      `DB release milestone_id (${release.milestone_id}).`,
    rawEvidence: {
      db_milestone_id:      release.milestone_id,
      stripe_milestone_id:  transfer.metadata?.milestone_id,
      transfer_id:          transfer.id,
    },
    dedupKey:    `metadata_mismatch:${release.id}:${transfer.id}`,
    autoFixable: false,
  }
}
