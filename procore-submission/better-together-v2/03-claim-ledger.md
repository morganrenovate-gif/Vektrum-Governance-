# 03 — Claim Ledger

Every factual statement in the deck maps to a Claim ID below. No orphan claims.
**Confidence tiers:** A = authoritative source + implementation evidence · B = one authoritative source · C = supported inference, labeled · D = unsupported/conflicting — excluded.

| Claim ID | Proposed claim | Type | Status | Supporting source | Confidence | Allowed wording | Slides |
|---|---|---|---|---|---|---|---|
| V-01 | Vektrum is conditional authorization infrastructure for construction disbursements | Vektrum product fact | Approved canonical definition | Master System Prompt §3.1; site source | A | Verbatim | 1, 2 |
| V-02 | A deterministic 10-condition release gate must fully pass before release authorization | Vektrum product fact | Implemented and verified | Release gate engine + 55-test suite; MSP §6 | A | "All required conditions must pass before a release is authorized" | 2, 3, 4, 5, 6 |
| V-03 | Authorization is separated from execution; Vektrum does not hold or move funds | Vektrum product fact | Architectural invariant, verified | MSP §2, §5; rail adapter code | A | "Vektrum governs authorization; the selected rail executes" | 2, 3, 5, 6 |
| V-04 | Payment executes via Stripe Connect (one supported rail) or the customer's existing title/escrow/treasury/partner process | Vektrum product fact | Implemented and verified | Rail abstraction migration; Partner API; Stripe webhook tests | A | "Stripe Connect is one supported execution rail; institutional partners keep their own payment process" | 3, 4, 6 |
| V-05 | Every authorization or block is recorded in an append-only, hash-chained, tamper-evident audit trail | Vektrum product fact | Implemented and verified | `audit_log` hashing migrations; audit-chain-health 28/28 | A | "Append-only, hash-chained, tamper-evident" — never "tamper-proof" | 2, 4, 5, 6 |
| V-06 | AI-assisted draw pre-review flags completeness, conflicts, and risk; the deterministic gate decides; AI never approves | Vektrum product fact | Implemented and verified | AI review routes; MSP §6.3 | A | "AI informs; the gate decides" | 3, 6 |
| V-07 | Admins, contractors, and partners cannot release funds or bypass the gate | Vektrum product fact | Implemented and verified | MSP §7; admin-safety + partner-scope tests | A | "No bypass: only the authorized funder can trigger a release, and only after the gate passes" | 6 |
| V-08 | A dispute on one milestone blocks only that release unit; unrelated milestones can continue | Vektrum product fact | Implemented and verified | Disputes schema; demo-dispute-resolution 24/24; dispute-isolation resource page | A | "Milestone-level isolation" | 4, 5 |
| V-09 | Missing approved conditional lien waivers (Cond. 10) and open change orders (Cond. 7) block the affected release | Vektrum product fact | Implemented and verified | Gate conditions; lien-waiver + change-order schema/tests | A | As stated | 3, 4 |
| V-10 | Each authorization is a signed, immutable authorization record with actor, time, amounts, and expiry | Vektrum product fact | Implemented and verified | Authorization-token migration; tier-b1 test | A | "Signed authorization record" | 4, 5 |
| V-11 | Institutional partners confirm or fail external execution through Vektrum's Partner API; confirmations are idempotent and audit-bound | Vektrum product fact | Implemented and verified | Partner API routes; MSP §8 | A | "Partners confirm execution after Vektrum authorizes release" | 4 |
| V-12 | The published "$15K dispute on a $9M project" milestone-isolation scenario | Illustrative scenario | Verified as published Vektrum scenario (not customer data) | `/resources/construction-dispute-isolation` page source; homepage; help FAQ | A (as an illustration) | Must carry "illustrative scenario" label; never a customer result | 5 |
| J-01 | A simulated Vektrum + Procore workflow exists at vektrum.io/demo-live/procore: a fictional $2.18M Draw #07 on a fictional $42.8M project is blocked on an open change order + unapproved lien waiver, then authorized after both resolve at source, with a recorded audit timeline and external execution confirmation | Illustrative scenario / Joint integration fact (simulated) | Simulated prototype | `/demo-live/procore` fixtures + state machine; 70/70 behavioral checks | A (as a simulation) | "The simulated workflow demonstrates…"; fictional-data disclosure required | 3, 4, 5, 7 |
| J-02 | Vektrum has begun sandbox-level Procore connectivity: OAuth against the Procore Developer Sandbox with read-only, sandbox-only enforcement (identity + project list) | Joint integration fact | Implemented but not fully verified | Phase 1A code + migrations; `test:procore` 3/3 suites | B | "The current implementation is designed to connect to the Procore Developer Sandbox under OAuth — read-only, write operations disabled" | 6 |
| J-03 | The planned integration would carry Procore-originated project and cost records (SOV lines, change orders, invoices, documents, photos) into the lender's draw review | Planned capability | Planned (conceptual mappings not API-validated) | Prototype `conceptualMappings` (all `apiValidated:false`); no sync code | C | Future/conditional tense only | 3, 4, 6 |
| J-04 | The planned integration would return authorization proof/status to the project record | Planned capability | Planned | No write code; writes disabled by config | C | "The planned integration would…" | 6 |
| J-05 | Vektrum complements Procore: it does not manage schedules, submittals, or project documents, and does not replace Procore financials or Procore Pay | Joint positioning fact | Verified boundary | MSP §3.4 ("Procore clone" prohibited identity); prototype boundary copy | A | "Procore remains the project system of record" | 2, 3, 6 |
| P-01 | Procore is a construction management platform whose products include project execution and cost management (budgets, change orders, invoicing/pay applications) | Procore product fact | Verified via official Procore domains (search-verified; direct fetch blocked) | procore.com/cost-management, /project-financials, support.procore.com change-order & payment-application docs | B | Descriptive only; no claims about Procore gaps | 2, 3 |
| P-02 | Procore operates a Technology Partner program and an App Marketplace through which partners integrate via its open API | Procore product fact | Verified via official Procore domains (search-verified) | developers.procore.com partner overview; marketplace.procore.com | B | Descriptive | 6, 7 |
| P-03 | Procore Partnerships contact is techpartners@procore.com | Procore product fact | Verified | Official Better Together template (Slide 7) + AI Instructions doc | A | As stated | 7 |
| M-01 | "10 release conditions deterministically enforced before any authorization" | Internal product metric | Verified | Gate engine + tests | A | Label: internal product metric | 2, 5 |
| M-02 | "$2.18M simulated draw governed end to end" | Illustrative scenario | Verified as simulation | J-01 | A (as illustration) | Label: illustrative, simulated, fictional data | 5 |
| M-03 | "$15K dispute isolated inside a $9M project" | Illustrative scenario | Verified as published scenario | V-12 | A (as illustration) | Label: illustrative Vektrum scenario | 5 |
| C-01 | Vektrum's buyer (construction lenders/credit funds/owners running fund control) is largely adjacent to Procore's core GC customer base, making the joint story complementary rather than competitive | Inference | Supported inference | MSP §3.5/§4.2 ICP + P-01 | C | Present as positioning rationale, not as market data | 2, 6 |
| C-02 | Draw governance for the capital funding a project commonly runs on email, PDFs, and manual sign-off outside the project record | Industry observation | Internal doctrine, not independently verified here | MSP §4.2 ("Current process: Email + PDF + manual sign-off + bank wire"), §12.1 | C | Phrase as the customer pain Vektrum targets ("too often runs on…"), not as a cited statistic | 3 |

## Tier D — excluded claims (do not use)

| Excluded claim | Why excluded |
|---|---|
| Any live/production Vektrum + Procore integration; "fully integrated," "seamless," "real-time sync" | Only sandbox Phase 1A (not E2E verified) + simulated prototype exist |
| Vektrum is in the Procore Marketplace | No listing found |
| Procore approval, certification, partnership, or endorsement | Not documented |
| Joint customers, testimonials, adoption counts, cycle-time/ROI/dispute-reduction percentages | No customer data exists |
| "Prevents fraud," "guarantees compliance," "guaranteed faster payment/draws" | Banned guarantee claims |
| "AI approves/clears the draw"; "one-click payment from Procore"; "Procore tracks; Vektrum pays" | Banned framing (MSP §6.3, §11.2; assignment §9, §14) |
| "Tamper-proof" | Banned; "tamper-evident" only |
| "$550B+ US construction starts" market stat | Internal doctrine figure; could not be independently re-verified from an accessible authoritative source in this environment — excluded from deck copy |
| Specific Procore API object mappings presented as validated | Prototype marks all mappings `apiValidated: false` |
| Levelset waiver reads (present tense) | No code; prior-deck phrasing corrected |
