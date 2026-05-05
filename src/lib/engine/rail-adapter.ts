// src/lib/engine/rail-adapter.ts
//
// Stage B2 + B3 of the patent-readiness work (memo candidate #6: rail-agnostic
// dispatch of one authorization token to multiple execution rails).
//
// `getRailAdapter(rail).dispatch(...)` is the single point of egress from the
// milestone release route to a payment rail. Today there are two rails:
//
//   stripe         → automated Stripe Connect transfer (synchronous; rail
//                    confirmation = Stripe transfer object)
//   external_rail  → no rail-side call; authorization is recorded on-platform,
//                    the funder/partner executes off-platform and confirms
//                    back via /api/releases/{releaseId}/confirm-external or
//                    /api/partner/releases/{releaseId}/confirm
//
// Adding a new rail (ACH, wire, RTP/FedNow, escrow, treasury, stablecoin —
// per the patent memo's #6) means writing a new adapter here and registering
// it in `getRailAdapter`. The route does not need to change.

import { stripe } from '@/lib/stripe'
import { sha256OfCanonicalJson } from '@/lib/engine/audit'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RailScope = 'stripe' | 'external_rail'

export interface RailDispatchInput {
  /** Rail this dispatch targets. Must match the token's rail_scope. */
  rail: RailScope

  /** Authorization-token reference for Stripe metadata + later reconciliation. */
  token: {
    id:        string
    jti:       string
    tokenHash: string
  }

  /** Milestone identifying scope for the rail-side call. */
  milestone: {
    id:      string
    dealId:  string
    title:   string
  }

  /** Payee identity. stripeAccountId is required by the stripe adapter; null is OK on external_rail. */
  contractor: {
    id:               string
    stripeAccountId:  string | null
  }

  /** Pre-computed amounts. amountInCents is what actually moves on the wire (net to contractor). */
  amounts: {
    amountInCents:    number
    grossAmount:      number
    feeAmount:        number
    retainageAmount:  number
    netToContractor:  number
  }

  /** Stable idempotency key — same value across retries gets the same outcome. */
  idempotencyKey: string
}

export interface RailDispatchResult {
  /** Always true when dispatch returns; failure is signalled by a thrown error. */
  authorized: true
  /**
   * `true` when the rail itself executed disbursement synchronously (Stripe today).
   * `false` when authorization is recorded but execution is deferred to a later
   * confirmation step (external_rail today). The caller branches on this.
   */
  executed: boolean
  rail: RailScope
  /** Populated when the rail is Stripe and a transfer was created. Null otherwise. */
  stripeTransferId: string | null
  /**
   * Canonical SHA-256 of the rail-side execution proof. Bound into the audit
   * chain via audit_log.rail_confirmation_hash on the success-path event.
   * Null when there is no rail confirmation yet (external_rail at authorize time).
   */
  railConfirmationHash: string | null
}

export interface RailAdapter {
  rail: RailScope
  dispatch(input: RailDispatchInput): Promise<RailDispatchResult>
}

// ─── Public factory ───────────────────────────────────────────────────────────

export function getRailAdapter(rail: RailScope): RailAdapter {
  switch (rail) {
    case 'stripe':        return stripeRailAdapter
    case 'external_rail': return externalRailAdapter
    default: {
      // Exhaustiveness check; fail loudly if a new rail is added without an adapter.
      const _exhaustive: never = rail
      throw new Error(`No adapter registered for rail: ${String(_exhaustive)}`)
    }
  }
}

// ─── Stripe adapter ───────────────────────────────────────────────────────────

const stripeRailAdapter: RailAdapter = {
  rail: 'stripe',
  async dispatch(input) {
    if (input.rail !== 'stripe') {
      throw new Error(`stripeRailAdapter.dispatch called with rail=${input.rail}`)
    }
    if (!input.contractor.stripeAccountId) {
      throw new Error(
        `Stripe rail dispatch failed: contractor ${input.contractor.id} has no Stripe Connect account. ` +
        `The contractor must complete Stripe Connect onboarding before a Stripe-rail release can execute.`,
      )
    }

    const transfer = await stripe.transfers.create(
      {
        amount:          input.amounts.amountInCents,
        currency:        'usd',
        destination:     input.contractor.stripeAccountId,
        transfer_group:  input.milestone.dealId,
        metadata: {
          milestone_id:            input.milestone.id,
          deal_id:                 input.milestone.dealId,
          contractor_id:           input.contractor.id,
          vektrum_action:          'milestone_release',
          idempotency_key:         input.idempotencyKey,
          gross_amount:            input.amounts.grossAmount.toFixed(2),
          retainage_amount:        input.amounts.retainageAmount.toFixed(2),
          net_to_contractor:       input.amounts.netToContractor.toFixed(2),
          authorization_token_id:  input.token.id,
          authorization_token_jti: input.token.jti,
        },
        description: `Vektrum milestone release — ${input.milestone.title}`,
      },
      {
        idempotencyKey: input.idempotencyKey,
      },
    )

    // Canonical SHA-256 of the Stripe transfer object — bound into the audit
    // chain via audit_log.rail_confirmation_hash (Tier A column). Identical
    // canonicalisation to what we used inline before B2 so the resulting
    // hash is byte-for-byte stable across the refactor.
    const railConfirmationHash = await sha256OfCanonicalJson({
      id:              transfer.id,
      object:          transfer.object,
      amount:          transfer.amount,
      currency:        transfer.currency,
      destination:     transfer.destination,
      transfer_group:  transfer.transfer_group,
      created:         transfer.created,
      livemode:        transfer.livemode,
      metadata:        transfer.metadata,
    })

    return {
      authorized:           true,
      executed:             true,
      rail:                 'stripe',
      stripeTransferId:     transfer.id,
      railConfirmationHash,
    }
  },
}

// ─── External-rail adapter ────────────────────────────────────────────────────

const externalRailAdapter: RailAdapter = {
  rail: 'external_rail',
  async dispatch(input) {
    if (input.rail !== 'external_rail') {
      throw new Error(`externalRailAdapter.dispatch called with rail=${input.rail}`)
    }

    // External-rail dispatch is a no-op on the platform side. The funder or
    // partner executes the disbursement off-platform and confirms back via
    // POST /api/releases/{releaseId}/confirm-external (user-session) or
    // POST /api/partner/releases/{releaseId}/confirm (partner-API key).
    //
    // Settlement (billing_records insert, increment_deal_financials,
    // increment_deal_retainage) happens at confirm time, not here.
    //
    // The reservation acquired by reserve_release_funds() before issuance
    // STAYS in deals.reserved_amount until one of:
    //   - confirm route lands           → settled via increment_deal_financials
    //   - rejection / fail route lands  → cancel_release_reservation
    //   - token expires (G7)            → /api/releases/{id}/expire-if-stale
    //                                     calls cancel_release_reservation
    return {
      authorized:           true,
      executed:             false,
      rail:                 'external_rail',
      stripeTransferId:     null,
      railConfirmationHash: null,
    }
  },
}
