# Where Vektrum Plugs In

**Conditional authorization infrastructure for construction disbursements.**

Vektrum sits before payment execution. It evaluates whether a construction draw is allowed to release, then records the authorization, proof, and audit trail. Existing payment rails remain in place.

**Partner inquiries:** operations@vektrum.io

---

## The Problem

Construction disbursements often rely on manual approval chains, emails, spreadsheets, and fragmented documentation. By the time a lien issue, missing waiver, disputed milestone, or contract problem is discovered, funds may have already moved.

- Draw approval does not always equal safe release
- Title and escrow teams need evidence before disbursement
- Lenders need enforceable controls, not just policy
- Contractors need faster clarity on what is missing
- Disputes should not freeze unrelated milestones

---

## Where Vektrum Fits

**Institutional / External Workflow**

```
Lender / Title / Escrow / Treasury
  → Sends draw package and release context

        ↓

[ Vektrum Authorization Layer ]
  10-condition release gate evaluated server-side

        ↓

Pass / Block decision + audit event
  Failed conditions block release; reason recorded

        ↓

Partner-controlled payment execution
  Wire · ACH · check · or Stripe Connect

        ↓

Payment reference and proof returned
  Method, reference, actor, timestamp

        ↓

Vektrum audit and reconciliation record
  Append-only, hash-chained
```

> Vektrum does not replace the payment process. It enforces whether the release is allowed before that process executes.

---

## Two Supported Execution Models

### External / Manual Execution

**Best for:** title companies, escrow companies, construction lenders, credit funds, institutional treasury teams

**Flow:**
1. Vektrum evaluates release conditions
2. Release is authorized or blocked
3. Partner executes payment outside Vektrum
4. Partner records method, reference, proof, actor, and timestamp
5. Vektrum stores the audit trail

> Payment is executed by the partner-controlled process. Vektrum governs authorization and records proof.

---

### Stripe Connect Automated Execution

**Best for:** private lenders, direct lenders, operators without existing disbursement infrastructure

**Flow:**
1. Vektrum evaluates release conditions
2. Funder triggers release
3. Stripe Connect executes the automated transfer
4. Vektrum records the release and reconciliation state

> For Stripe Connect releases, payment execution runs through Stripe Connect infrastructure.

---

## The 10-Condition Release Gate

Every release is checked before execution. All 10 conditions are evaluated simultaneously on the server. If any required condition fails, the release is blocked until resolved.

1. Milestone approved by the funder
2. Milestone protection status ready
3. Sufficient funded balance including platform fee
4. Contractor payout readiness verified
5. Contractor onboarding complete
6. No existing release on this milestone
7. No open change orders
8. Signed contract on file
9. Sequential ordering and prerequisites satisfied (where required)
10. Approved lien waiver on file (where required)

> Customers may add configured release requirements on top of the core gate.

---

## Partner API

The API lets partners confirm execution after Vektrum authorizes release. It does not allow partners to bypass the release gate. All calls are scoped to partner-associated deals, rate-limited, and written to the audit log.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/partner/releases/:id` | View release status, rail, milestone, amount, and confirmation state |
| `POST` | `/api/partner/releases/:id/confirm` | Confirm external payment execution — supply method, reference, proof, actor, and timestamp. Idempotent. |
| `POST` | `/api/partner/releases/:id/fail` | Mark external execution as failed. Cancels balance reservation and preserves audit visibility. |

**API characteristics:**
- Scoped API keys — partner-specific access
- Audit logging on every call
- Rate limiting enforced
- No direct fund movement through the partner API

---

## What Partners Get

- Clear pass / block decision before disbursement
- Fewer unsupported releases
- Cleaner lien waiver and milestone evidence
- Milestone-level dispute isolation
- Audit-ready release history
- Compatibility with existing payment processes
- API-ready integration path
- No requirement to replace title, escrow, bank, or treasury workflows

---

## What Vektrum Does Not Do

- Does not hold funds in its own bank account
- Does not act as escrow
- Does not execute wires
- Does not replace title companies
- Does not make credit decisions
- Does not provide legal advice
- AI does not approve payments — AI informs; the gate decides

> Vektrum governs authorization and records proof. Payment execution remains with Stripe Connect or the customer's partner-controlled process.

---

## Keep your payment process. Add release enforcement.

If you manage construction disbursements through title, escrow, treasury, banking, or internal lender workflows, Vektrum can sit before execution and enforce whether a draw is allowed to release.

**Talk to us about partner integration:**
- Schedule a call: vektrum.io/partners/placement
- Email: operations@vektrum.io

---

*Vektrum is authorization infrastructure — not a bank, lender, payment processor, or money transmitter. Vektrum does not hold or custody funds.*
