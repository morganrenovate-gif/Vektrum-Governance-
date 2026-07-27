# 02 — Integration Truth Table

Status vocabulary (exactly one per capability):
**Implemented and verified** · **Implemented but not fully verified** · **Simulated prototype** · **Planned** · **Unsupported** · **Conflicting evidence**

A connected Procore Sandbox, a "Connect" button, a mocked screen, or a demo route alone is **not** treated as proof of an end-to-end production integration.

| Capability | Status | Evidence | Safe external wording | Deck relevance |
|---|---|---|---|---|
| Deterministic 10-condition release gate (all required conditions must pass; enforced in UI, API, DB) | **Implemented and verified** | `src/lib/engine/release-gate.ts`; `tests/release-gate.test.ts` — 55/55 passed 2026-07-24; Master System Prompt §6 | "All required conditions must pass before a release is authorized." | Slides 2, 3, 4, 5, 6 |
| Funder-triggered authorization; admins/contractors/partners cannot release or bypass | **Implemented and verified** | Master System Prompt §6.4/§7; `tests/admin-safety.test.ts`, `tests/partner-scope-isolation.test.ts` (6/6 passed) | "The authorized funder decides; the system enforces." | Slides 3, 6 |
| Signed authorization tokens (ed25519; amounts locked at issuance; expiry) | **Implemented and verified** | `tests/tier-b1-authorization-token.test.ts` passed; migration `20260504000001` | "Each authorization is recorded as a signed, immutable authorization record." | Slides 4, 5 |
| Append-only, hash-chained, tamper-evident audit log + exportable audit packet | **Implemented and verified** | `tests/audit-chain-health.test.ts` (28/28); `audit_log` row/chain hashing migrations; `/api/deals/[dealId]/audit-packet` | "Append-only, hash-chained, tamper-evident audit trail." (Never "tamper-proof.") | Slides 2, 4, 5, 6 |
| Milestone-level dispute isolation (a dispute blocks only the affected release unit) | **Implemented and verified** | `disputes` schema; `tests/demo-dispute-resolution.test.ts` (24/24); `/resources/construction-dispute-isolation` page source | "A dispute on one milestone does not automatically freeze unrelated milestones." | Slides 4, 5 |
| AI-assisted draw pre-review as a precondition (flags risk; never approves) | **Implemented and verified** | `/api/ai/draw-review`; `tests/ai-review-consistency.test.ts` in suite; Master System Prompt §6.3 | "AI informs; the deterministic gate decides." | Slides 3, 6 |
| Execution rails: Stripe Connect (automated) + external/manual partner-controlled rail; Partner API confirm/fail with HMAC webhooks | **Implemented and verified** | `src/app/api/partner/*`; `tests/stripe-webhook-security.test.ts`; partner-scope tests; Master System Prompt §5, §8 | "Stripe Connect is one supported execution rail; institutional partners keep their own payment process and confirm execution through the Partner API." | Slides 3, 4, 6 |
| SOV (G702/G703-style), lien-waiver records (Condition 10), change-order records (Condition 7), DocuSign contracts | **Implemented and verified** | Migrations + `tests/sov-*.test.ts`, `lien-waiver-signed-url.test.ts` in suite | "Lien-waiver and change-order requirements are enforced as release conditions." | Slides 3, 4 |
| Procore Developer Sandbox OAuth connect/disconnect (funder-initiated; hashed state; AES-256-GCM token storage; audit-logged) | **Implemented but not fully verified** | `src/app/api/integrations/procore/*`; migrations 2026-07-19/20; `npm run test:procore` — 3/3 suites passed 2026-07-24. No runtime end-to-end evidence in repo | "The current implementation is designed to connect to the Procore Developer Sandbox under OAuth, in a sandbox-only, read-only configuration." | Slides 4 (footnote), 6 |
| Read-only Procore sandbox reads: identity (`/rest/v1.0/me`) + project list (`/rest/v1.1/projects`) | **Implemented but not fully verified** | `client.ts` (read-only enforced by `procore-phase1a-safety.test.ts`); write ops disabled by config | "The current implementation is designed to read identity and project context from the Procore Developer Sandbox." | Slide 6 |
| Selecting one Procore sandbox project as Vektrum context (metadata only) | **Implemented but not fully verified** | `projects/select/route.ts`; stores id/name only — no financial data sync | "A funder can link a sandbox project as context; project financial data is not yet synchronized." | Internal only |
| Procore-record intake into a draw review (SOV lines, change orders, invoices, documents, photos, inspection reports) | **Simulated prototype** | `/demo-live/procore` fixture machine; `demo-procore-prototype.test.ts` 70/70; mappings marked "conceptual — API feasibility and permissions not yet validated" | "The simulated workflow demonstrates how Procore-originated records would flow into a lender's draw review." | Slides 3, 4, 5 |
| End-to-end joint workflow (snapshot → pre-review → gate → funder authorization → external execution confirmation → audit timeline) | **Simulated prototype** | Same; fictional Harbor Point Medical Center, Draw #07, $2.18M, `DEMO-AUTH-HPMC-07`, `DEMO-MWTE-88241`; on-page disclosure | "The simulated workflow demonstrates the full governed sequence, end to end, on fictional data." | Slides 4, 5 |
| Write-back to Procore (verification status / audit attachment) | **Planned** | No write code; `PROCORE_WRITE_OPERATIONS_ENABLED` must be `false`; client read-only by test | "The planned integration would return authorization proof to the project record." | Slide 6 (What's Next) |
| Procore webhooks / event subscriptions / automated re-verification | **Planned** | No receiver code | "The planned integration would re-evaluate readiness when source records change." | Slide 6 |
| Production (non-sandbox) Procore connectivity | **Planned** | Config hard-rejects non-sandbox environments | Do not present as available. | Slide 6 |
| Procore Marketplace listing for Vektrum | **Unsupported** | Web search 2026-07-24: no listing found | Omit; use "pursue Marketplace readiness." | Slide 6, 7 |
| Procore partnership, certification, approval, or endorsement | **Unsupported** | No documentation found | Omit. | — |
| Joint Vektrum + Procore customers, cycle-time metrics, ROI data | **Unsupported** | None exist in any source | Omit; use labeled illustrative scenarios only. | Slide 5 |
| Levelset lien-waiver status read | **Planned** (prior deck implied present tense — resolved) | No Levelset code; contradiction register #4 | "The planned integration would read waiver status from the customer's existing waiver system." | Omit from v1 deck |

## Joint-workflow step classification (assignment §10)

| Step | Classification |
|---|---|
| 1. Project + financial context exists in Procore | Procore product fact (their system; not a Vektrum claim) |
| 2. Relevant records selected for the draw-governance workflow | Simulated prototype (production intake planned); sandbox identity/project-list read implemented but not fully verified |
| 3. Vektrum associates evidence with deal/draw/milestone | Implemented and verified (native Vektrum objects); Procore-sourced association simulated |
| 4. Missing evidence and unresolved conditions shown | Implemented and verified (native); simulated for Procore-sourced records |
| 5. AI-assisted pre-review flags issues | Implemented and verified (native); deterministic fixture in the prototype |
| 6. Deterministic gate evaluates required conditions | Implemented and verified |
| 7. Failed condition blocks only the affected release unit | Implemented and verified (dispute isolation; gate blocks per milestone) |
| 8. Authorized funder authorizes eligible release | Implemented and verified |
| 9. Selected rail executes (Stripe Connect or partner-controlled) | Implemented and verified (rails exist); no Procore involvement in execution |
| 10. Authorization + execution evidence recorded for audit/reconciliation | Implemented and verified |
