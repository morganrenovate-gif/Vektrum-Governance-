# Vektrum — Site Positioning Source of Truth

> **For developers and contributors:** Read this document before editing any public-facing copy, marketing pages, help content, legal disclaimers, demo flows, or pitch materials. Every positioning decision in this file exists for a legal, regulatory, or product-accuracy reason. When in doubt, ask before publishing.

Last updated: 2026-04-25 · Copy pass applied: all known gaps resolved

---

## 1. One-Sentence Positioning

**Vektrum is conditional authorization infrastructure for construction disbursements.**

This is the single approved positioning statement. It is the answer to "what does Vektrum do?" in investor conversations, sales calls, marketing copy, and press. Do not substitute synonyms or abbreviate it.

---

## 2. What Vektrum Does — Short Explanation

Vektrum enforces whether a construction draw is allowed to release. Payment execution happens through Stripe Connect or through the customer's existing title, escrow, treasury, or banking process.

Vektrum decides **yes** or **no**. Vektrum does not move money.

---

## 3. Supported Execution Paths

Vektrum supports two execution rails. Both must be represented accurately wherever execution is described.

| Rail | Label | Who executes payment |
|------|-------|----------------------|
| `stripe_connect` | Stripe Connect automated execution | Stripe, via Vektrum's release instruction |
| `external_manual` | External / manual execution | The funder, title company, escrow company, or treasury team — outside Vektrum entirely |

**Key distinctions:**
- On the Stripe Connect rail, funds are held in Stripe-managed accounts (not Vektrum accounts). Vektrum instructs Stripe to execute the transfer.
- On the external rail, funds never interact with Vektrum infrastructure at any point. Vektrum provides authorization proof; the partner controls execution.
- Stripe Connect is not required for all deals. Never present it as universal.
- Contractors on external-rail deals do not need a Stripe Connect account.

---

## 4. What Vektrum Is

Use these terms freely and accurately:

- Release authorization layer
- Release gate
- Conditional disbursement governance platform
- Audit and evidence system
- API-integrated infrastructure
- Construction disbursement control system
- Authorization infrastructure

---

## 5. What Vektrum Is Not

Vektrum is not any of the following. Do not use these terms to describe Vektrum, imply Vektrum performs these functions, or create copy that could reasonably be read as claiming these roles.

- Payment processor
- Escrow company or escrow agent
- Bank or depository institution
- Lender or credit provider
- Money transmitter
- Title company or title agent
- Trust account holder or trustee
- Fiduciary
- AI decision-maker (see Section 7)

---

## 6. Custody and Payment Language

### Approved phrases

- "For Stripe Connect releases, payment execution runs through Stripe Connect infrastructure."
- "For external/manual releases, payment is executed outside Vektrum by the funder, title company, escrow company, or treasury team."
- "Vektrum does not hold funds in its own bank account or act as escrow."
- "Vektrum governs authorization and records proof."
- "On Stripe Connect deals, funds are held in Stripe-managed accounts — not by Vektrum."
- "On external-rail deals, funds never interact with Vektrum infrastructure."
- "Vektrum authorizes releases. Stripe or the institutional partner executes them."

### Phrases to avoid

| Avoid | Reason |
|-------|--------|
| "Vektrum never touches money" | Too absolute. On the Stripe rail, Vektrum's instruction initiates the transfer. |
| "Vektrum holds funds" | False. Never use in any context. |
| "Vektrum executes wires" | False. Vektrum does not execute wire transfers. |
| "Vektrum moves money" | False for the same reason as above. |
| "Vektrum is non-custodial" | Acceptable only if immediately followed by an explanation. Do not use as a standalone claim. |
| "Stripe is required" | False. External-rail deals require no Stripe account from the contractor or funder. |
| "Stripe holds all funds" | Incomplete. Only accurate for Stripe-rail deals. |
| "Funds held in Project Trust Account" | Never use. "Trust account" is a regulated legal term implying fiduciary obligation Vektrum does not have. |
| "Vektrum Project Trust Agreement" | Does not exist. Never reference a document by this name. |

---

## 7. AI Language

Vektrum's AI component is a **precondition check that informs the release gate**. It flags risks, missing documents, and inconsistencies. It does not make release decisions.

### Approved phrases

- "AI-assisted draw pre-review"
- "AI flags risks, missing documents, and inconsistencies"
- "AI informs; the gate decides"
- "AI is a precondition, not release authority"
- "AI analysis is one of the 10 conditions the gate evaluates"

### Phrases to avoid

| Avoid | Reason |
|-------|--------|
| "AI approves" | The AI does not approve. The gate decides. |
| "AI clears" | Same as above. |
| "AI decides" | Same as above. |
| "AI-powered releases" | Implies AI controls the release. It does not. |
| "Fully automated AI payments" | Combines two inaccuracies: AI is not the decision-maker, and Vektrum does not process payments. |

---

## 8. Admin and Role Language

Vektrum enforces strict role separation. The following facts are non-negotiable and must be represented accurately:

- The **funder** triggers a release request. Releases are funder-initiated.
- The **10-condition gate** evaluates the request server-side. The gate decides, not the admin.
- **Admins cannot release funds.** Admin accounts have privileged management capabilities but are explicitly excluded from the release trigger path by design.
- Privileged admin actions (credential rotation, partner management, etc.) require AAL2 MFA, actor justification, and full audit logging.

### Approved phrases

- "Funder-triggered, system-enforced"
- "Admins cannot release funds"
- "Release authority belongs to the funder, subject to gate conditions"
- "Privileged admin actions require AAL2 MFA, justification, and audit logging"
- "Role separation is enforced at the API and database layer"

---

## 9. Release Gate Language

### Approved phrases

- "10-condition server-side release gate"
- "If any required condition fails, release is blocked until resolved"
- "Core gate conditions are enforced at the API and database layer"
- "The gate evaluates all conditions atomically before authorizing a release"
- "Conditions include documentation, inspection, lien waivers, AI pre-review, and funder approval"

### Do not use

- "8-condition" — the gate has 10 conditions
- "7-condition" — the gate has 10 conditions
- Any specific condition count other than 10

---

## 10. Audit and Tamper-Evidence Language

The Vektrum audit log is append-only and hash-chained. Tampering is detectable because it breaks chain verification — this makes the log tamper-**evident** and tamper-**resistant**, not tamper-**proof**. No digital system is provably tamper-proof. Do not claim otherwise.

### Approved phrases

- "Append-only, hash-chained, tamper-evident audit log"
- "Updates and deletes are blocked at the database-trigger layer"
- "Tampering breaks chain verification"
- "Every action is recorded with actor, timestamp, and before/after values"
- "The audit log provides a permanent evidence trail"

### Phrases to avoid

| Avoid | Reason |
|-------|--------|
| "Tamper-proof" | Overclaims. No digital system is provably tamper-proof. Creates legal liability if a record is ever altered by any means. |
| "Forever" | Unenforceable guarantee. Use "permanent record" or "retained audit log" instead. |
| "Impossible to modify" | Same as tamper-proof. |
| "Immutable" | Use only in the qualified technical sense: "immutable at the application layer" — not as an absolute claim. |

---

## 11. Approved CTAs

Use these calls to action. Do not invent alternatives that imply Vektrum performs a payment, financial, or custodial function.

- "Book a call"
- "View demo"
- "See how release authorization works"
- "Talk to us about partner integration"
- "Request access"
- "Schedule a walkthrough"

---

## 12. Banned Phrases — Complete List

The following phrases are banned from all public-facing copy, demo flows, pitch materials, help content, and legal disclaimers. If you find any of these in the codebase, flag for immediate correction.

| Banned phrase | Category | Reason |
|---------------|----------|--------|
| "Tamper-proof" | Audit | Overclaims; creates liability |
| "Impossible to modify" | Audit | Same as tamper-proof |
| "Forever" (as a data retention guarantee) | Audit | Unenforceable |
| "AI approves" | AI | AI is a precondition, not release authority |
| "AI clears" | AI | Same as above |
| "AI decides" | AI | Same as above |
| "AI-powered releases" | AI | Implies AI controls releases |
| "Fully automated AI payments" | AI | Double inaccuracy |
| "Vektrum holds funds" | Custody | Factually false |
| "Vektrum never touches money" | Custody | Too absolute; inaccurate for Stripe rail |
| "Vektrum moves money" | Custody | Inaccurate; Stripe or partner executes |
| "Vektrum executes wires" | Custody | False |
| "Vektrum is non-custodial" (standalone) | Custody | Only acceptable with immediate explanation |
| "Stripe is required" | Custody | False; external rail requires no Stripe account |
| "Stripe holds all funds" | Custody | Incomplete; only true for Stripe-rail deals |
| "Project Trust Account" | Legal | Regulated term; implies fiduciary relationship Vektrum does not have |
| "Vektrum Project Trust Agreement" | Legal | Does not exist; never reference |
| "Trust account" (describing any Vektrum account) | Legal | Same as above |
| "Payment processor" (describing Vektrum) | Legal | Vektrum is not licensed as a payment processor |
| "Money transmitter" (describing Vektrum) | Legal | Vektrum is not a money transmitter |
| "Escrow" (describing Vektrum's function) | Legal | Vektrum is not an escrow agent |
| "SOC 2 certified" | Compliance | Not yet certified; do not imply otherwise |
| "8-condition gate" | Product | Incorrect; gate has 10 conditions |
| "7-condition gate" | Product | Incorrect; gate has 10 conditions |
| "Coming soon" | Product | Do not use for unbuilt or unlaunched features without approval |
| "Four-eyes" (in public copy) | Process | Acceptable in internal/developer docs only; avoid in public-facing copy |
| "authorisation" / "authorise" | Spelling | Use American English: "authorization" / "authorize" |

---

## 13. How to Use This Document

**Before editing any public-facing file:**
1. Check Section 5 — confirm the proposed copy does not ascribe a prohibited role to Vektrum.
2. Check Section 6 — confirm any custody or payment language uses an approved phrase.
3. Check Section 12 — run a grep or search for banned phrases before committing.
4. If the copy describes the release flow, confirm it represents both execution rails accurately (Section 3).
5. If the copy mentions AI, confirm it uses approved framing (Section 7).

**Known copy gaps — status as of 2026-04-25 copy pass:**

All previously identified gaps have been resolved. The following files were updated:

| File | Fix applied |
|------|-------------|
| `src/app/demo/page.tsx` | "Project Trust Account" removed; "$2.19T governs" → market framing; "tamper-proof" → "tamper-evident" |
| `src/components/demo/ReleaseFundsModal.tsx` | "Vektrum Project Trust Agreement" removed |
| `src/components/demo/FundDealModal.tsx` | "Vektrum Project Trust Account" removed |
| `src/app/about/page.tsx` | "We never touch your money" → both-rail accurate statement |
| `src/app/contractors/page.tsx` | "tamper-proof" → "tamper-evident"; Stripe onboarding qualified as rail-specific |
| `src/app/help/page.tsx` | Both-rail custody answer; external rail FAQ entry added |
| `src/app/layout.tsx` | JSON-LD and footer disclaimers updated; "does not move funds" removed |
| `src/app/pitch/page.tsx` | "Funds never touch — on either rail" → accurate two-rail statement; competitive table string bug fixed |
| `src/app/terms/page.tsx` | External rail custody language added to Section 2 |
| `src/app/auth/signup/page.tsx` | "Vektrum never holds funds" removed |
| `src/app/auth/login/page.tsx` | "Vektrum never holds funds" removed |
| `src/components/onboarding/onboarding-wizard.tsx` | "Project Trust Account" × 2 removed |
| `src/components/onboarding/stripe-onboarding-wizard.tsx` | "Project Trust Account" removed |
| `docs/payment-rails.md` | British spelling normalized throughout |
| `README.md` | Stripe-only capital custody claim updated for both rails |

**Remaining low-priority items (not public-facing):**

| File | Item | Disposition |
|------|------|-------------|
| `src/lib/types/database.ts` | JSDoc comments referencing "Project Trust Account" / "trust account" | Developer-facing code comments only. No UI exposure. Flag for JSDoc cleanup pass. |
| Various API route `.ts` files | "authorisation/authorise" in backend code comments and internal error messages | Not consumer-visible. Normalize in a separate developer-docs pass. |

---

*This document is the binding internal reference for Vektrum public copy. It supersedes any conflicting language in earlier drafts, pitch decks, or inline comments.*
