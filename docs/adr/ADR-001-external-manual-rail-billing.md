# ADR-001 — External/Manual Rail Billing Model

**Status:** Accepted  
**Date:** 2026-04-28  
**Authors:** Vektrum founding team  
**Supersedes:** none  
**Related:** `docs/payment-rails.md`, `supabase/migrations/20260425000000_rail_abstraction.sql`

---

## Context

Vektrum is **conditional authorization infrastructure for construction disbursements**. It verifies release conditions, issues or blocks authorization, and records proof. It is not a payment processor, money transmitter, bank, lender, escrow company, or trust account.

Two execution rails exist:

| Rail | Execution | Who holds funds |
|---|---|---|
| `stripe_connect` | Automated via Stripe Connect | Stripe Connect managed accounts |
| `external_manual` | Funder/partner/customer executes outside Vektrum (wire, ACH, check, partner treasury) | Customer's bank, escrow, title company, or treasury — never Vektrum |

The architectural invariant is:

> **Authorization is separated from execution. Vektrum does not hold, transmit, or control funds.**

For the Stripe rail, Vektrum instructs Stripe when to transfer; Stripe controls movement. A platform-fee model through Stripe's billing infrastructure is a natural fit for that rail.

For the external/manual rail, funds never touch any Vektrum infrastructure. Vektrum records an authorization and later a confirmation; the funder's existing banking/treasury/escrow partner executes payment outside Vektrum. There is no Stripe payment flow to attach a platform fee to. Attempting to skim or deduct from contractor disbursements on this rail would:

1. Require Vektrum to touch money it never sees.
2. Misrepresent Vektrum as a payment intermediary.
3. Break the authorization/execution separation that is the core architectural guarantee.
4. Expose Vektrum to money-transmission regulation in jurisdictions where a fee deduction from a payment constitutes transmission.

This ADR documents the billing model decision for the external/manual rail and its consequences.

---

## Decision

### 1. External/manual rail customers are billed directly by Vektrum via invoice

Vektrum does **not** deduct fees from contractor disbursements on external/manual rail deals. The customer's payment rail executes payment in full; Vektrum charges a separate platform/governance fee.

Billing is **funder/partner/customer-facing** by default. Contractors are not billed.

### 2. Billing structure for external/manual rail

The billing model is:

- **Base platform / governance retainer** — annual or quarterly, based on Active Construction Volume (ACV) or deal count. Establishes the right to use the release-control infrastructure.
- **Per-release governance fee** — charged per verified disbursement, at the applicable rate for the engagement model (0.70% Institutional, 0.65% Enterprise). Invoiced separately or offset against retainer credit.
- **Invoicing cadence** — monthly, quarterly, or annually, as contracted. Net-30 unless otherwise agreed.

The minimum per-release governance fee floor applies to external/manual rail customers on the same basis as Stripe-rail customers.

### 3. Stripe rail billing

For `stripe_connect` deals, platform/governance fees are captured at the time of transfer where Stripe's billing infrastructure supports it. The applicable rate and minimum fee floor are the same. No separate invoice is required for Stripe-rail customers — fees are automated.

### 4. Customer billing contact required at onboarding

Every external/manual rail engagement requires a named billing contact and billing address before the first deal is activated. This is a pre-onboarding requirement, not a post-deal-creation step.

### 5. Per-release and per-deal usage reporting

Vektrum must provide usage reports (deal count, authorized releases, release amounts, fee schedule applied) to external/manual rail customers as a basis for invoice reconciliation. This reporting is a future build; it is not in scope for this ADR.

---

## Non-Goals

This ADR does **not** authorize or describe:

- **Escrow services** — Vektrum does not hold funds in trust for any party.
- **Money transmission** — Vektrum does not transfer, forward, or intermediate money.
- **Contractor-payment deduction** — Vektrum does not deduct fees from any disbursement it does not execute and does not custody.
- **Automatic billing implementation** — the automated invoice workflow is a future build. This ADR documents the model, not the implementation.
- **Per-deal invoice generation** — future build.
- **Usage-based billing automation** — future build.
- **Stripe-rail fee changes** — the Stripe-rail fee flow is already implemented; this ADR only formalizes external/manual rail billing.

---

## Consequences

### Must be built (future PRs, not this ADR)

| Item | Priority |
|---|---|
| Invoice workflow — generate and send invoice to billing contact | High |
| Usage reporting — per-release/per-deal/per-month export | High |
| Billing contact capture at onboarding for external/manual rail customers | High |
| Per-release governance fee tracking for external/manual customers | Medium |
| Invoice reconciliation report (usage vs. billed) | Medium |

### Copy / positioning

- Pricing page must clarify that for external/manual rail, Vektrum invoices the customer directly and does not deduct fees from contractor disbursements.
- Partner docs must not imply that Vektrum takes a percentage of the partner's payment flow.
- Public copy must not say "we earn when the release executes" in a way that implies a Stripe-transfer mechanism on external/manual rail deals.
- "Keep your payment rail. Vektrum bills for release-control infrastructure." is the approved framing for external/manual rail customers.

### Security / RLS / auth

No changes to RLS, auth, release gate, or financial ledger logic. This is a business-model documentation decision.

### Open questions

1. What is the per-release governance fee floor for external/manual rail customers (same $50 as Stripe rail, or negotiated)?
2. Is billing contact capture a form field during deal creation, or a separate onboarding step?
3. What is the net-30 / net-60 invoice default for institutional customers?
4. Who issues the invoice — Vektrum directly, or via a billing platform (Stripe Invoicing, Lago, etc.)?

---

## References

- `docs/payment-rails.md` — canonical rail architecture reference
- `src/lib/engine/release-gate.ts` — 10-condition gate (Condition 4 is skipped for external/manual rail)
- `supabase/migrations/20260425000000_rail_abstraction.sql` — rail abstraction schema
- `src/app/pricing/page.tsx` — public pricing page (updated in the same PR as this ADR)
