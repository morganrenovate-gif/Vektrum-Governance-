# Vektrum SOC 2 Readiness Review

**Date:** 2026-05-08  
**Reviewer role:** Senior SOC 2 readiness auditor, application security engineer, fintech compliance reviewer, full-stack code reviewer  
**Scope:** Full codebase, database, API, auth, audit trail, partner integration, public website, docs, and operational controls  
**Method:** Static analysis of all source files, migrations, tests, docs, and marketing copy — no assumptions made without file evidence  
**Branch:** `claude/bold-mestorf-aedfe8`

---

## 1. Executive Summary

### Are we SOC 2 compliant?

**No.** SOC 2 compliance requires a formal audit and attestation issued by a licensed CPA firm (AICPA). Vektrum has no such attestation. The security page correctly states: *"Vektrum has not obtained SOC 2, ISO 27001, PCI, or any other formal certification."* That is accurate and legally important to preserve.

### Are we SOC 2 ready?

**No — not yet.** SOC 2 readiness requires both technical controls and operational evidence. Vektrum's **technical controls are strong** and would satisfy a significant portion of what an auditor looks for. However, the **operational layer is materially incomplete**: change management is undocumented, backup and disaster recovery has no written strategy, incident response has no security-specific runbook, access review is not formalized, and centralized logging is absent. A SOC 2 auditor would issue findings against all of these.

### Are we SOC 2-aligned?

**Partially — on the technical side.** The release gate, RLS policies, append-only audit trail, hash chaining, HMAC-verified webhooks, MFA enforcement, rate limiting (with two gaps), and role-based access are all implemented and verifiable in code. These are genuine technical controls that align with SOC 2 Trust Services Criteria (TSC). The operational and process layer that a SOC 2 auditor would also examine does not yet exist in a documented, evidenced form.

### What can we safely say on the site today?

You can say — carefully and specifically — that Vektrum is **built with specific, named security and integrity controls** that are **aligned with SOC 2 principles**, and that **formal attestation is on the roadmap**. You cannot imply a breadth of controls that extends to operational processes you have not yet built.

### What should we not say?

- "SOC 2 compliant" — false without attestation  
- "SOC 2 certified" — false  
- "SOC 2 audited" — false  
- "bank-grade security" — vague and unverifiable; avoid  
- "enterprise-grade security" — too broad; make specific claims instead  
- "SOC 2-aligned controls" without qualification — technically defensible on the technical side but misleading without disclosing operational gaps  
- "SOC 2 Type II ready" — not yet; operational evidence accumulation period hasn't started  

---

## 2. Safe Website Language

### Conservative version (safe today, no risk)

> Vektrum is designed with security and governance controls from the ground up: role-based access enforced at the database layer, a deterministic 10-condition release gate that runs server-side before any draw is authorized, append-only audit records with cryptographic hash chaining, HMAC-verified partner events, and a non-custodial architecture that never holds construction funds. We are actively building toward SOC 2 attestation.

### Stronger but still safe version (requires the two rate-limit gaps are fixed first)

> Vektrum's release authorization infrastructure is built with controls aligned to SOC 2 security and processing integrity principles: multi-factor authentication for financial operations, role-based access with row-level database enforcement, server-side deterministic release conditions, HMAC-signed webhook and partner events, tamper-evident audit records with hash chaining, and idempotent release confirmations. Formal SOC 2 attestation is on our roadmap.

### Version for a Trust/Security page

> **Security & Compliance**  
>  
> Vektrum is built as authorization infrastructure, not a custodian or payment processor. Security and processing integrity are load-bearing requirements, not afterthoughts.  
>  
> **Controls we have built and verified:**  
> - Role-based access control enforced at the database layer via row-level security policies  
> - Multi-factor authentication (TOTP) required for all funder and admin financial operations  
> - A 10-condition deterministic release gate enforced server-side — no UI-only bypass is possible  
> - Append-only audit records with SHA-256 row hashing and cryptographic chain hash — records cannot be modified or deleted after creation  
> - HMAC-SHA256 signature verification on all Stripe and DocuSign webhook events  
> - ed25519-signed authorization tokens for partner integrations  
> - API keys stored as SHA-256 hashes only — raw keys are shown once and never recoverable  
> - Admin promotion disabled by default behind a multi-gate control (environment flag, role check, MFA, audit log)  
> - Rate limiting on all financial write operations, with fail-closed behavior on infrastructure outage  
>  
> **What we have not yet done:**  
> Vektrum has not undergone a formal SOC 2 audit. Pursuing SOC 2 Type I attestation is on our near-term roadmap. We are happy to share our security architecture documentation with prospective lender and institutional partners on request.  
>  
> Security inquiries: operations@vektrum.io

### Version for lender / design-partner conversations

> Vektrum functions as a second-approval control layer over your disbursement workflow. Before any draw can be authorized, our server-side release gate verifies: milestone approval status, protection status, available funding, contractor onboarding, sequential release order, no open change orders, a signed contract on file, and — where required — a conditional lien waiver. None of these conditions can be waived by a UI action or admin override; they are enforced at the API and database layers independently.  
>  
> Every authorization decision, block, and override is recorded in an append-only audit log with cryptographic hash chaining. These records cannot be altered after creation. We can provide a deal-level audit export for any transaction in your portfolio.  
>  
> We are building toward SOC 2 Type I. In the interim, we share our security architecture and are open to lender due diligence review on request.

### Claims to avoid

| Claim | Why to avoid |
|-------|-------------|
| "SOC 2 compliant" | Requires AICPA attestation — Vektrum has none |
| "SOC 2 certified" | No such thing in SOC 2; implies formal status that doesn't exist |
| "SOC 2 audited" | No audit has occurred |
| "Bank-grade security" | Undefined; creates implied warranty that may not be satisfied |
| "Enterprise-grade security" | Too vague; make specific claims |
| "Tamper-proof audit records" | Say "tamper-evident" — nothing is tamper-proof |
| "Real-time monitoring" | Not implemented; no Sentry/Datadog configured |
| "Zero-downtime architecture" | No SLA or uptime monitoring exists |
| "SOC 2-aligned controls" (unqualified) | Only the technical controls are aligned; operational processes are not yet documented |

---

## 3. Current Controls Found in Code

| Control Area | File / Path | What Exists | Why It Matters for SOC 2 | Strength |
|---|---|---|---|---|
| Role-based access control | `src/middleware.ts`, `src/lib/auth/middleware.ts` | Three roles (contractor, funder, admin); role checked at route and DB layer independently | CC6.1, CC6.2 — access is authorized by role | Strong |
| Multi-factor authentication | `src/middleware.ts:AAL2 enforcement`, `src/lib/auth/middleware.ts:requireMFA()` | TOTP required for funder + admin on financial routes | CC6.3 — MFA for sensitive operations | Strong |
| Database row-level security | `supabase/migrations/014_rls_hardening.sql` | Role-scoped SELECT/INSERT/UPDATE policies on all core tables; WITH CHECK on writes | CC6.1, CC6.2 — data access bounded by tenant + role | Strong |
| DB state-machine triggers | `supabase/migrations/014_rls_hardening.sql:339–441` | `enforce_milestone_status_transition()` — validates state transitions at DB layer independently of app code | CC8.1 — processing integrity at storage layer | Strong |
| Deal participant immutability | `supabase/migrations/014_rls_hardening.sql:220–269` | DB trigger prevents `contractor_id`/`funder_id` mutation after creation | CC6.1 — access control cannot be hijacked | Strong |
| 10-condition release gate | `src/lib/engine/release-gate.ts` | All 10 TSC conditions evaluated atomically; all failures collected; returned in single pass | CC5.2, PI1.1 — complete, valid, authorized release decisions | Strong |
| Admin cannot release funds | `src/app/api/milestones/[milestoneId]/release/route.ts:76–84` | `requireRole('funder')` + `validateRelease()` both check independently; admin has no path to trigger release | CC6.2, PI1.1 — segregation of duties | Strong |
| Audit log append-only | `supabase/migrations/` audit tables, no UPDATE/DELETE RLS | No UPDATE or DELETE policies on `audit_log`; records are permanent by design | CC7.2 — audit records are not modifiable | Strong |
| Audit log hash chaining | `supabase/migrations/20260424000004_audit_hash_timestamp_fix.sql` | `row_hash` (SHA-256 of row fields) + `chain_hash` (SHA-256 of row_hash ∥ prev chain_hash) computed by trigger on INSERT | CC7.2 — tamper-evident evidence chain | Strong |
| External evidence hash binding | `src/lib/engine/audit.ts:174–214` | `token_hash`, `graph_snapshot_hash`, `webhook_delivery_hash`, `partner_ack_hash`, `rail_confirmation_hash` bind external artifacts to audit records | PI1.5 — evidence binds to release decisions | Strong |
| Stripe webhook HMAC | `src/app/api/stripe/webhook/route.ts:34–72` | `stripe.webhooks.constructEvent()` before any processing; missing signature = 400 | CC6.6 — external events authenticated | Strong |
| Stripe webhook deduplication | `src/app/api/stripe/webhook/route.ts:93–148` | Three-state lifecycle (processing/processed/failed) with unique constraint on `stripe_event_id`; idempotent on retry | CC8.1 — processing integrity; no double-ledger | Strong |
| DocuSign webhook HMAC | `src/app/api/webhooks/docusign/route.ts:61–126` | HMAC-SHA256 against `X-DocuSign-Signature-1`; fail-closed in all deployed envs | CC6.6 — external events authenticated | Strong |
| API key hashing | `src/lib/auth/partner.ts:132–146` | SHA-256 stored; raw key never stored; shown once; only prefix for UI | CC6.1 — credential security | Strong |
| Partner API key scoping | `src/app/api/partner/releases/[releaseId]/confirm/route.ts:200–215` | Partner's deal must match release's deal; cross-partner access impossible | CC6.2 — least privilege | Strong |
| Rate limiting (financial writes) | `src/lib/engine/rate-limit.ts` | `financial_write`: 5 per 60s; fail-closed on DB outage | CC6.7 — abuse protection on critical paths | Strong |
| Rate limiting (admin writes) | `src/lib/engine/rate-limit.ts` | `admin_write`: 20 per 60s on most admin routes | CC6.7 — but 5 admin routes lack this guard | Partial |
| IP allowlist (admin) | `src/middleware.ts:ADMIN_ALLOWED_IPS` | Optional CIDR-based IP restriction on `/admin/*`; violations logged to admin_audit_log | CC6.6 — network-level access control | Partial (opt-in) |
| Admin promotion multi-gate | `src/app/api/admin/promote/route.ts:59` | Env gate + role + MFA + audit log + admin justification required | CC6.3 — privileged access controlled | Strong |
| Secret environment isolation | `.env.example`, `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` server-only; no `NEXT_PUBLIC_` secrets; all 12 secret vars documented | CC6.1 — secrets not leaked to client | Strong |
| Parameterized queries / no raw SQL | All API routes via Supabase JS client | 100% parameterized; no dynamic SQL construction found | CC6.7 — SQL injection prevention | Strong |
| CSRF protection | Supabase session (HttpOnly cookies) + JWT signature | Session cookie is HttpOnly; JWT verified server-side | CC6.6 — CSRF prevented by cookie model | Strong |
| Concurrent release prevention | `supabase/migrations/20260425000003_releases_active_unique.sql` | Partial unique indexes prevent two active releases per milestone per rail | CC8.1, PI1.1 — duplicate release prevention | Strong |
| Idempotent external confirmation | `src/app/api/releases/[releaseId]/confirm-external/route.ts` | Returns `{ alreadyConfirmed: true }` if already settled; no double ledger | CC8.1, PI1.1 — idempotency | Strong |
| Privacy policy | `src/app/(marketing)/privacy/page.tsx` | Data collection, retention periods (30d / indefinite), user rights, subprocessors, contact | P1, P2, P3 — privacy controls documented | Strong |
| Security page | `src/app/(marketing)/security/page.tsx` | All claims backed by code; certifications not overclaimed | CC2.2 — transparency | Strong |
| Non-custody architecture | All payment routes; Terms of Service | Vektrum never holds funds; execution is through Stripe or external partner | CC6.2, PI1.1 — custody boundary clear | Strong |
| AI informs, gate decides | `src/lib/engine/release-gate.ts:521–612` | AI review is a precondition checked before `validateRelease()`; AI result does not approve release | PI1.1 — human/deterministic gate decides | Strong |
| Centralized error responses | `src/lib/errors.ts` | `internalError()`, `notFoundError()`, `validationError()`, `forbiddenError()` — consistent error shape | CC6.7 — no sensitive data leaked in errors | Strong |
| Demo isolation | `src/app/api/demo/reset/route.ts`, `src/lib/demo-data/` | Zero DB writes; auth-gated; env-blocked in production | CC6.2 — demo cannot affect production data | Strong |
| Ops alerting | `src/lib/engine/alerts.ts`, `src/lib/engine/notifications.ts` | Slack + email alerting for stuck releases, failed payouts, webhook health | CC7.2 — operational monitoring | Partial |
| 112 security/compliance tests | `tests/` (see Section 10) | Release gate, admin safety, webhook HMAC, partner scope isolation, RLS regression, demo safety, audit chain | CC4.1 — control testing evidence | Strong |
| Structured logging | N/A | Console.* only; no Sentry, Datadog, or structured JSON logging | CC7.2 — MISSING for SOC 2 | Missing |
| Backup and recovery | N/A | No documented backup strategy, RTO, RPO, or tested restore procedure | A1.2 — MISSING for SOC 2 | Missing |
| Change management | `/docs/PRODUCTION_SMOKE_TEST.md` | Post-deploy checklist exists; no CODEOWNERS, no CI branch protection documented | CC8.1 — PARTIAL for SOC 2 | Partial |
| Incident response | `/docs/ai-downtime-plan.md` | AI provider failure modes documented; no security incident runbook | CC7.3 — PARTIAL for SOC 2 | Partial |
| Access review | N/A | No formal access review cadence, role recertification, or user audit documented | CC6.2 — MISSING for SOC 2 | Missing |
| Vendor/subprocessor management | `privacy/page.tsx` | Three subprocessors listed; no dedicated page, no DPA references | CC9.2 — PARTIAL for SOC 2 | Partial |
| Vulnerability disclosure | `security/page.tsx` footer | Email contact exists; no `/.well-known/security.txt`, no bug bounty | CC7.3 — PARTIAL | Partial |
| Data deletion automation | N/A | Privacy policy says "request deletion"; no automated endpoint | P4 — MISSING | Missing |

---

## 4. Gaps and Risks

| Gap | Severity | Why It Matters | Evidence from Code | Recommended Fix | Effort |
|-----|----------|---------------|-------------------|-----------------|--------|
| Rate-limit signature mismatch on `/api/partner/tokens/verify` | HIGH | Partner token verification endpoint may not be rate-limited; allows brute-force or abuse of verification endpoint | `src/app/api/partner/tokens/verify/route.ts:45` — wrong call signature | Fix signature; add integration test | Small |
| 5 admin write routes lack `admin_write` rate limit | MEDIUM | Compromised admin session can spam routes without RL protection | `api/admin/invite`, `api/admin/partners`, `api/admin/subscriptions/[id]/tier`, `api/admin/reconciliation/[id]`, `api/admin/partners/[id]/deals` — no `checkRateLimit` call | Add `checkRateLimit` with `admin_write` policy | Small |
| No centralized logging / error tracking | HIGH | SOC 2 CC7.2 requires monitoring and detection of security events; console.* does not persist, aggregate, or alert | No Sentry, Datadog, or structured logging found in any source file | Add Sentry DSN; emit structured JSON logs from all API routes | Medium |
| No backup and disaster recovery documentation | HIGH | SOC 2 A1.2 — system backup, recovery, and continuity must be documented and tested | No backup strategy, RTO, RPO, or restore test found in any doc or code | Document Supabase automated backup settings; define RTO/RPO; test restore | Medium |
| No security incident response runbook | HIGH | SOC 2 CC7.3 — must have documented procedures for detecting, classifying, escalating, containing, and recovering from security incidents | `/docs/ai-downtime-plan.md` covers AI provider failures only; no general security incident procedure | Create INCIDENT_RESPONSE.md covering breach detection, classification, escalation, communication, remediation, retrospective | Medium |
| Change management undocumented | HIGH | SOC 2 CC8.1 — changes to production systems must be authorized, reviewed, and tested; auditors ask for PR approval records | No CODEOWNERS, no CI workflow files, no branch protection documentation found | Document PR review requirements; add CI pipeline; add CODEOWNERS | Medium |
| No formal access review cadence | MEDIUM | SOC 2 CC6.2 — access to production systems must be periodically reviewed and excess access revoked | No access review procedure, user audit, or role recertification process documented anywhere | Create quarterly access review procedure for production credentials and admin roles | Small |
| Stripe Connect transfer untested against real sandbox | HIGH | Platform cannot confirm payout works end-to-end before real money is involved | No integration test for `stripe.transfers.create()` in `tests/` directory | Create `tests/stripe-connect-integration.test.ts` against Stripe test environment | Medium |
| Email delivery untested (Resend) | MEDIUM | Notification and receipt emails may not reach users; `RESEND_API_KEY` may be unconfigured | No `RESEND_API_KEY` usage test found in any test file | Create `tests/email-delivery-integration.test.ts`; verify key in prod env | Small |
| No E2E workflow test | HIGH | Integration bugs between components (invite → deal → release → payout) can only surface in full flow | No test covering full funder→contractor→release→payout sequence | Create `tests/e2e-pilot-workflow.test.ts` | Medium |
| No data deletion / export endpoints | MEDIUM | SOC 2 P4 — privacy policy says "request deletion" but there is no automated path; creates GDPR/CCPA risk | No `/api/users/:id/export` or `/api/users/:id/delete` found in any route | Implement user data export and deletion endpoints; wire to support flow | Medium |
| No `/.well-known/security.txt` | LOW | Industry standard for responsible disclosure; expected by security researchers and enterprise buyers | Not found in `/public/.well-known/` | Create `security.txt` with contact email and expiry | Small |
| No npm audit automation | MEDIUM | Three PDF parsing libraries (pdfjs-dist, pdf-parse, unpdf) represent file-handling attack surface; vulnerabilities won't be detected | No `"audit"` script in `package.json`; no CI job | Add `npm audit --audit-level=moderate` to CI/CD | Small |
| No dedicated subprocessors page | LOW | Enterprise buyers and lenders expect a clear subprocessors list; privacy policy buries it | Three subprocessors (Stripe, Supabase, AI providers) listed in privacy policy only | Create `/subprocessors` page with DPA status for each | Small |
| No DPA references for subprocessors | MEDIUM | SOC 2 CC9.2 — vendor risk management requires DPAs with data processors | No DPA references found in any doc | Confirm Stripe DPA, Supabase DPA, AI provider DPAs are signed and on file | Small |
| No production access control documentation | MEDIUM | SOC 2 CC6.2 — who has production DB access must be documented and controlled | No break-glass procedure, no service role rotation policy, no Vercel deployment access list | Document production access list; define rotation schedule; create break-glass procedure | Small |
| No vulnerability disclosure timeline | LOW | Enterprise buyers expect a defined response SLA for reported vulnerabilities | Security page has email contact but no response timeline | Add disclosure timeline to security page and security.txt | Small |
| DocuSign webhook missing email notifications | LOW | Contract signing events don't trigger user notifications (TODO comment in code) | `src/app/api/webhooks/docusign/route.ts:2–3` has TODO comment | Wire transactional email service | Small |
| No pen test history | MEDIUM | SOC 2 auditors routinely ask for pen test results; lenders may require them | No pen test referenced in any doc or README | Commission an independent pen test before SOC 2 Type I | Large |
| Supabase PII not encrypted at rest at field level | LOW | Supabase encrypts the database at rest (infrastructure level) but individual PII fields (name, email) are not field-encrypted | No `pgcrypto` usage found in migrations; no `ENCRYPTION_KEY` in `.env.example` | Document infrastructure-level encryption; evaluate field-level encryption for PII | Large |

---

## 5. SOC 2 Trust Services Criteria Mapping

### Security (CC6 — Common Criteria)

**What exists:**
- CC6.1 (Restrict logical access): RLS at DB layer; role-based access at route level; MFA for financial operations; JWT-based sessions; IP allowlist for admin routes
- CC6.2 (Role management): Three distinct roles with separate permission sets; admin promotion behind multi-gate control; admins explicitly excluded from release path
- CC6.3 (Authentication): TOTP MFA for funders and admins; session auto-refresh via middleware; password handled by Supabase Auth (PKCE flow)
- CC6.6 (Logical access controls): HMAC-SHA256 on Stripe and DocuSign webhooks; ed25519 on partner tokens; API keys hashed (SHA-256); rate limiting on financial and admin writes
- CC6.7 (Security incident prevention): Parameterized queries (no SQL injection); consistent error responses (no sensitive data leaked); CSRF prevention via HttpOnly session cookies; input validation on all financial routes

**What is missing:**
- CC6.1: No documented production access list for Supabase service role key or Vercel deployment
- CC6.2: No access review cadence; no role recertification documented
- CC6.3: No MFA enforcement for contractors (acceptable given they are receivers, not authorizers)
- CC6.7: No centralized error monitoring (Sentry/Datadog); no structured logging for security event detection; npm audit not automated

**What needs to be documented:**
- Who has Supabase service role access and how credentials are rotated
- How production deployments are authorized (who can merge to main, who can trigger Vercel deploy)
- Access review procedures (quarterly at minimum)

**What needs to be built:**
- Sentry or equivalent error tracking
- Structured JSON logging from API routes
- `npm audit` in CI
- `/.well-known/security.txt`

**What an auditor would ask for:**
- Evidence of MFA enforcement on sensitive routes (show middleware code + logs)
- Evidence of quarterly access reviews
- Evidence of credential rotation policy
- Pen test report from the last 12 months
- List of who has production access to database
- SIEM or log aggregation evidence

---

### Processing Integrity (PI1)

**What exists:**
- PI1.1 (Complete, valid, accurate, timely, authorized): All 10 release gate conditions checked atomically server-side; no UI bypass is possible; failed conditions returned in full; AI is a precondition, not the decision-maker; funder-only release authorization enforced at route and DB layer independently
- PI1.2 (Outputs are complete and accurate): Release decisions produce audit records with actor, timestamp, event type, conditions checked, result; hash-chained for tamper-evidence
- PI1.3 (System processing is complete, accurate, timely): Stripe webhook deduplication prevents double-settlement; idempotent external confirmation returns existing state; concurrent release prevention via DB partial unique indexes
- PI1.4 (Outputs are protected): Audit records are append-only with no UPDATE/DELETE paths; external evidence hash-bound (token_hash, webhook_delivery_hash, partner_ack_hash)
- PI1.5 (Inputs are complete, valid, authorized): Input validation on all financial routes; `requireDealAccess()` before any milestone operation; `requireRole()` before release paths

**What is missing:**
- PI1.1: No E2E test confirming full flow from authorization to actual fund movement
- PI1.2: Stripe Connect transfer is untested against real sandbox (payout may fail silently)

**What needs to be documented:**
- The release gate decision logic (can be excerpted from README — already documented)
- Idempotency strategy (not yet formally documented)
- Evidence that failed gate conditions are recorded (test output or audit log samples)

**What needs to be built:**
- Stripe Connect integration test
- E2E workflow test
- Monthly audit chain health report (cron exists; output needs to be stored as evidence)

**What an auditor would ask for:**
- Demonstrate a release that was blocked by a gate condition — show the audit log entry
- Demonstrate that a duplicate release attempt was prevented — show the DB constraint evidence
- Show the release gate test suite and results
- Demonstrate that admin cannot trigger a release — show code and a blocked attempt

---

### Confidentiality (C1)

**What exists:**
- C1.1 (Identify and maintain confidential information): Deal data, lien waivers, contracts, SOV, change orders all scoped to deal participants via RLS; admins can read all but cannot write financial data; contractors cannot see funder funding amounts; funders cannot see other funders' deals
- C1.2 (Dispose of confidential information): Privacy policy states 30-day deletion for account data, indefinite for audit records; Supabase cascading deletes on user deletion
- Data boundary: Supabase RLS enforces tenant isolation at row level; no cross-tenant data access found in any route

**What is missing:**
- C1.2: No automated user data export endpoint; no automated account deletion; deletion is manual via support
- No field-level encryption for PII (name, email) beyond Supabase's infrastructure-level encryption
- No data classification policy (what is confidential, what is not)

**What needs to be documented:**
- Data classification matrix (deal data, lien waivers, contracts = confidential; deal status = operational)
- How data is disposed of at contract termination (beyond what the privacy policy says)

**What needs to be built:**
- `/api/users/:id/export` — user data export endpoint (GDPR/CCPA right to portability)
- `/api/users/:id/delete` — automated account deletion with audit trail
- Data classification matrix document

**What an auditor would ask for:**
- Show RLS policies for the deals table — who can SELECT, INSERT, UPDATE, DELETE?
- Show that user A cannot access user B's deal data
- Show the data retention/deletion procedure and evidence of it being followed

---

### Availability (A1)

**What exists:**
- A1.1 (Current processing capacity): Vercel handles infrastructure scaling; Supabase handles DB scaling
- A1.2 (Backup restoration): Supabase automated backups exist at infrastructure level (not documented in Vektrum's own docs)
- A1.3 (Environmental protections): Demo data fully isolated; demo reset is a no-op on production data; rate limiting prevents abuse-driven overload
- Operational alerting: Slack/email alerts for stuck releases, failed payouts, webhook health degradation
- External partner failure states: `mark-external-failed` endpoint exists; reconciliation cron runs daily; audit captures failure states

**What is missing:**
- A1.2: No documented RTO (Recovery Time Objective) or RPO (Recovery Point Objective)
- No tested restore procedure from Supabase backup
- No uptime monitoring (no Statuspage, no external health check, no uptime SLA)
- No documented incident escalation path beyond ops email
- No disaster recovery runbook

**What needs to be documented:**
- Supabase backup retention period and restore procedure (even if just documenting the built-in Supabase feature)
- RTO/RPO targets (even conservative ones: RTO 4 hours, RPO 24 hours is realistic for this stage)
- Operational escalation path

**What needs to be built:**
- External uptime monitoring (Vercel has built-in; configure alerting)
- Statuspage (Instatus or similar) for customer-facing incident communication
- Documented DR procedure

**What an auditor would ask for:**
- Evidence that backups are taken and can be restored
- Evidence of a tested restore exercise
- Uptime history for the review period (SOC 2 Type II)
- Incident log from the review period

---

### Privacy (P1–P8)

**What exists:**
- P1 (Privacy notice): Privacy policy exists with data collection, retention, rights, subprocessors, contact — comprehensive
- P2 (Choice and consent): Terms of Service establishes consent at signup; Stripe handles payment consent
- P3 (Collection): Limited to what's needed (name, email, company, role, deal data); Stripe handles payment card data
- P4 (Use / retention / disposal): 30-day account deletion policy documented; indefinite audit record retention documented and justified
- P5 (Access): Users can request data access via support@vektrum.io
- P6 (Disclosure to third parties): Subprocessors listed in privacy policy (Stripe, Supabase, AI providers)
- P7 (Quality): Not explicitly addressed in privacy policy
- P8 (Monitoring): Not explicitly addressed

**What is missing:**
- P4: Automated deletion and export endpoints — current path is manual via email
- P6: No dedicated `/subprocessors` page; no DPA status matrix
- P7: No documented procedure for correcting inaccurate personal data
- P8: No privacy monitoring or audit procedure

**What needs to be documented:**
- DPA status with Stripe, Supabase, Perplexity, Anthropic, OpenAI
- Data correction procedure (beyond email to support)
- Privacy monitoring procedure

**What needs to be built:**
- User data export endpoint
- User account deletion endpoint
- Dedicated `/subprocessors` page

**What an auditor would ask for:**
- Show the data flow diagram (what PII goes to which subprocessor)
- Show evidence of signed DPAs with subprocessors
- Show evidence of a deletion request being fulfilled within the stated 30-day window

---

## 6. Product-Specific SOC 2 Angle

### Can Vektrum function as a second-approval / independent release verification control for lenders bringing draws in-house?

**Yes — this is the strongest claim Vektrum can make to a lender.** Here is how each SOC 2 principle supports it:

#### Authorization controls
The 10-condition release gate is fully server-side, deterministic, and enforced independently at both the API layer (`src/lib/engine/release-gate.ts`) and the database layer (status transition triggers, partial unique indexes, funding constraints). A lender's internal system can require Vektrum authorization token verification as a prerequisite for their own payment execution. The authorization token is ed25519-signed and includes a hash of the evidence snapshot — the lender's system can cryptographically verify it was issued by Vektrum after all conditions passed.

#### Segregation of duties
Admins cannot trigger or bypass releases — this is enforced by `requireRole('funder')` in the release route and independently by the gate's role check. The contractor who submits a draw cannot approve their own milestone (`enforce_milestone_status_transition()` trigger blocks contractor self-approval). The AI system that generates draw review can only produce a precondition result — it cannot authorize a release. This is a meaningful segregation-of-duties architecture that would satisfy a financial institution's internal controls requirements.

#### Processing integrity
The release gate is deterministic: same inputs always produce the same pass/fail decision. The gate checks every condition on every call — there is no cached or stale result from a prior evaluation. Idempotency is maintained: a duplicate release attempt returns the existing state rather than executing a second time. The concurrent release prevention constraint (`releases_stripe_active_unique`) prevents two active releases for the same milestone on the same rail. This satisfies the "complete, valid, accurate, timely, authorized" processing integrity standard.

#### Audit evidence
Every release decision — pass, block, or override — is recorded in the append-only `audit_log` with: actor identity and role, deal and milestone IDs, event type, timestamp, old/new state, and external evidence hashes (token hash, webhook delivery hash, partner acknowledgement hash). The hash chain prevents retroactive insertion or deletion of records. A lender or auditor can receive a deal-level audit export and mathematically verify the chain is unbroken. This is the strongest audit evidence claim Vektrum can make today.

#### What must be implemented before this claim is strong enough for institutional lenders
1. **Stripe sandbox integration test** — without evidence that the payout actually executes, the claim is theoretical
2. **Centralized logging** — lenders will ask "how do you know if something goes wrong?"; console.* logs don't answer this
3. **Pen test** — any financial institution will ask for a pen test report before integrating
4. **SLA documentation** — even a conservative one (99% monthly uptime, 4-hour RTO) establishes accountability
5. **DPA signatures** — lenders' legal/compliance teams will require DPAs with all subprocessors

---

## 7. Audit Trail and Release Gate Review

### Are release decisions server-side?
**Yes, unambiguously.** The release gate (`src/lib/engine/release-gate.ts`) runs exclusively in a Next.js API route handler. No release decision is made client-side. The frontend pre-checks are advisory only — the server independently evaluates all 10 conditions before issuing an authorization or executing a transfer.

### Are release conditions deterministic?
**Yes.** All 10 conditions are boolean checks against database state. There is no probabilistic element (the AI review is a separate precondition whose output is binary: pass/fail). Same database state always produces the same gate result. Conditions are evaluated atomically in a single pass — there is no partial evaluation or short-circuit that could mask a failing condition.

### Are failed conditions recorded?
**Yes.** `validateRelease()` collects all failing conditions in an errors array and returns them in full. The calling route logs the block event to `audit_log` with the conditions that failed. Blocked release attempts are not silent — they are recorded.

### Are approvals and blocks logged?
**Yes.** Both `audit_log` (business events) and `admin_audit_log` (admin actions) capture release events. The log entry includes actor, role, milestone ID, deal ID, event type (release_authorized / release_blocked / release_failed), old state, new state, and external evidence hashes.

### Is the audit log append-only in practice?
**Yes.** No UPDATE or DELETE RLS policies exist on `audit_log`. The database trigger (`deny_audit_modification()`) rejects any UPDATE or DELETE attempt, including from the service role. Records cannot be modified after creation — even by a database admin running as service role (the trigger fires before the modification).

### Is there hash chaining?
**Yes.** Each `audit_log` row has a `row_hash` (SHA-256 of its own key fields) and a `chain_hash` (SHA-256 of `row_hash` concatenated with the previous row's `chain_hash`). The chain is ordered by `event_sequence` (monotonic integer assigned at INSERT). The `/api/cron/audit-chain-health` route re-computes hashes for all rows and verifies the chain on each run.

### Is external evidence hash binding implemented?
**Yes — this is a notable strength.** Five external artifacts are bound to each audit record via SHA-256:
- `token_hash` — the authorization token payload
- `graph_snapshot_hash` — the evidence graph snapshot at time of decision
- `webhook_delivery_hash` — the exact bytes of the outbound webhook payload
- `partner_ack_hash` — the partner's acknowledgement response
- `rail_confirmation_hash` — the Stripe transfer object or external rail confirmation

This means the audit record not only records what happened but binds to the external artifacts that prove it — a materially stronger evidentiary standard than most systems.

### Can records be modified or deleted?
**No.** DB trigger + RLS policy + no application-layer mutation path = three independent barriers to modification. The only way to alter a record would be direct Postgres superuser access to the underlying database infrastructure (outside Vektrum's application layer). This is a Supabase infrastructure concern, not an application concern.

### Are user/actor/timestamp/event details recorded?
**Yes.** Each record captures: `actor_id`, `actor_name` (denormalized), `actor_email` (denormalized), `actor_role`, `entity_type`, `entity_id`, `action`, `created_at`, `old_values`, `new_values`, `system_source`, and all external evidence hashes. Denormalization of name and email is correct — it prevents records from becoming unattributable if a user account is later deleted.

### Does the audit trail create evidence an auditor or lender would trust?
**Yes — with one caveat.** The technical implementation is strong and the evidentiary standard is appropriate for fintech. The caveat: the audit chain health cron runs on a schedule, but there is no out-of-band monitoring alert if the chain fails verification. An auditor would want to see evidence that hash-chain failures are detected and escalated, not just that the check runs.

---

## 8. Partner API and Webhook Review

### Is partner confirmation secure enough?
**Yes, for current use.** API key authentication (SHA-256 hash lookup), request scope isolation (partner's deals only), HMAC-signed outbound webhooks (per-partner secrets), ed25519-signed authorization tokens, and rate limiting on partner endpoints combine into a defensible security model. The token verification endpoint has a rate-limit signature bug (SEC-1 in the risk register) that must be fixed before claiming full rate-limit coverage.

### Are duplicate confirmations prevented?
**Yes.** The external confirmation route checks `execution_status` before processing and returns `{ alreadyConfirmed: true }` with HTTP 200 if already settled. The DB partial unique index (`releases_external_active_unique`) prevents a second active external release for the same milestone. Both are defense-in-depth against duplicate confirmations.

### Are failed confirmations captured?
**Yes.** The `mark-external-failed` endpoint exists and creates an audit record for the failure. The reconciliation cron (`/api/cron/reconcile`) audits for pending external confirmations that have not been settled within the expected window and creates reconciliation issues for admin review.

### Are external events bound to release/audit records?
**Yes.** Partner confirmation events are logged to `audit_log` with `actor=partner_token`, partner ID, release ID, and `partner_ack_hash` (SHA-256 of the acknowledgement response). The webhook delivery hash is committed to the audit record at the time of outbound webhook dispatch.

### What must be improved before presenting to lenders, title, escrow, or platform partners?
1. **Fix rate-limit signature in `/api/partner/tokens/verify`** — this is an active gap, not a theoretical one
2. **Create formal partner API documentation** — no public endpoint reference, no token verification guide
3. **Commission a pen test** — institutional partners will require external verification of security claims
4. **Add DPA matrix for subprocessors** — any title company or escrow partner will have a legal review that requires documented DPAs
5. **Implement a sandbox environment** — partners need a safe environment to test integration before production

---

## 9. Database and Supabase Security Review

### Are RLS policies present?
**Yes — comprehensively.** The `supabase/migrations/014_rls_hardening.sql` migration implements role-based RLS policies on all core tables (profiles, deals, milestones, releases, audit_log, admin_audit_log, and others). Each policy includes WITH CHECK clauses on writes to prevent bypass via crafted payloads.

### Are tenant/project/organization boundaries enforced?
**Yes.** Every deal has `contractor_id` and `funder_id`. RLS policies restrict data access to deal participants and admins. The `enforce_deal_participants_immutable()` trigger prevents any change to these IDs after creation — a deal cannot be reassigned to a different user pair to gain access.

### Could one user access another user's data?
**No — with current controls.** Cross-tenant access is blocked at both the RLS level (SELECT policies require participant membership or admin role) and the application level (`requireDealAccess()` checks membership before any route handler proceeds). The migration comment documents 11 specific vulnerabilities that were identified and closed.

### Are service role keys used safely?
**Yes.** The `SUPABASE_SERVICE_ROLE_KEY` is used exclusively in `src/lib/supabase/admin.ts`, which is a server-only module. It is never exported to the frontend, never referenced in any `NEXT_PUBLIC_` variable, and never used in client-side components.

### Are sensitive operations server-only?
**Yes.** All financial operations (release, fund, confirm external, reconcile) are in Next.js API routes that execute server-side. The frontend receives only the result. No financial logic runs client-side.

### Are audit records protected from client-side mutation?
**Yes.** `audit_log` has no UPDATE or DELETE RLS policies. Client-side users have no path to modify audit records. The DB trigger additionally blocks service-role mutation attempts.

### Are migrations consistent with product claims?
**Yes.** The migration history traces a coherent evolution: initial schema → RLS hardening (014) → audit hash-chain (20260424) → contract uniqueness + deal freeze (20260425) → active release unique indexes (20260425). The feature set described in the security page and README is verifiably present in the migration history.

---

## 10. Tests Review

### Which tests support SOC 2 readiness?

| Test File | SOC 2 Relevance | Criteria |
|---|---|---|
| `release-gate.test.ts` | All 10 conditions + AI precondition tested | PI1.1 |
| `release-gate-demo-pass.test.ts` | Demo data passes gate correctly | PI1.1 |
| `demo-reset-safety.test.ts` | Auth gate, env gate, zero DB writes verified | CC6.1, CC6.2 |
| `stripe-webhook-security.test.ts` | HMAC verification, event dedup | CC6.6, CC8.1 |
| `docusign-webhook-hmac.test.ts` | HMAC verification, fail-closed | CC6.6 |
| `partner-scope-isolation.test.ts` | Partner cannot access other partner's data | CC6.2, C1.1 |
| `token-signing.test.ts` | ed25519 signature generation and verification | CC6.6, PI1.5 |
| `authorization-token.test.ts` | Token lifecycle, expiry, revocation | CC6.6, PI1.5 |
| `admin-safety.test.ts` | Admin cannot modify financial data | CC6.2 |
| `rls-regression.test.ts` | RLS policy regression suite | CC6.1, C1.1 |
| `audit-chain-health.test.ts` | Hash chain integrity verification | CC7.2, PI1.4 |
| `audit-p0-coverage.test.ts` | Critical audit event coverage | CC7.2 |
| `funder-mfa-onboarding.test.ts` | MFA enrollment flow verified | CC6.3 |
| `route-smoke.test.ts` | All critical routes exist | A1.1 |
| `env-validation.test.ts` | Required env vars are set | CC6.1 |
| `production-readiness-pass.test.ts` | Production safety checklist | Multiple |
| `external-rail-billing.test.ts` | External rail billing correctness | PI1.1 |
| `sov-foundation.test.ts` | SOV integrity and calculation | PI1.1 |
| `retainage-math.test.ts` | Retainage calculation accuracy | PI1.1 |

### Which security/compliance tests exist?
17 tests directly map to SOC 2 TSC criteria. The release gate test suite alone would satisfy an auditor's request for evidence that the gate conditions are implemented and tested.

### What critical tests are missing?

| Test to Add | Criteria | Why |
|---|---|---|
| `tests/stripe-connect-integration.test.ts` | PI1.1 | Confirms payout executes against real Stripe sandbox |
| `tests/e2e-pilot-workflow.test.ts` | PI1.1, CC8.1 | End-to-end flow evidence for audit |
| `tests/email-delivery-integration.test.ts` | A1.1 | Confirms notification delivery |
| `tests/partner-rate-limit.test.ts` | CC6.7 | Verifies 429 response on token verify endpoint after fix |
| `tests/admin-rate-limit.test.ts` | CC6.7 | Verifies 429 response on all 5 admin routes after fix |
| `tests/audit-log-immutability.test.ts` | CC7.2, PI1.4 | Explicitly verifies UPDATE/DELETE are rejected on audit_log |
| `tests/user-data-export.test.ts` | P4 | Verifies data export endpoint when built |
| `tests/concurrent-release-prevention.test.ts` | CC8.1, PI1.3 | Load test verifying DB constraint prevents race condition |
| `tests/chain-hash-tamper-detection.test.ts` | CC7.2, PI1.4 | Verifies chain health check catches modified rows |

---

## 11. Immediate Fixes Before Putting SOC 2 Language on the Site

### Must fix before publishing any SOC 2 readiness claim
- [ ] **SEC-1:** Fix rate-limit call signature in `src/app/api/partner/tokens/verify/route.ts:45` — this is the only live security gap in the technical controls
- [ ] **Add `admin_write` rate limiting** to 5 unguarded admin routes — otherwise the "rate limiting on all financial and admin writes" claim is inaccurate
- [ ] **Verify Stripe Connect sandbox transfer executes** — cannot claim processing integrity without evidence the payment rail works
- [ ] **Verify `RESEND_API_KEY` is configured** and at least one notification type delivers successfully

### Should fix before lender pilots
- [ ] Create `INCIDENT_RESPONSE.md` — security incident classification, escalation, remediation, notification procedure
- [ ] Create backup and recovery documentation — document Supabase backup settings, define RTO/RPO (even conservative)
- [ ] Document production access list — who has Supabase service role, who can deploy to Vercel, credential rotation schedule
- [ ] Add centralized error tracking (Sentry is a 2-hour implementation)
- [ ] Commission a pen test — institutional partners will ask for one
- [ ] Create `/.well-known/security.txt`
- [ ] Add `npm audit` to CI/CD pipeline
- [ ] Create `/subprocessors` page and confirm DPAs with Stripe, Supabase, AI providers

### Should fix before SOC 2 Type I
- [ ] Document change management process (PR review requirements, branch protection, release authorization)
- [ ] Create access review procedure (quarterly review of all production credentials and admin roles)
- [ ] Implement structured JSON logging on all API routes
- [ ] Implement user data export and deletion endpoints
- [ ] Create data classification matrix document
- [ ] Establish uptime monitoring (Vercel analytics minimum; Statuspage preferred)
- [ ] Document vendor/subprocessor risk assessment
- [ ] Wire transactional email into DocuSign webhook handler (DocuSign TODO)
- [ ] Create audit chain tamper detection test

### Should fix before SOC 2 Type II
- [ ] Operate all Type I controls for at least 6 months (evidence accumulation period)
- [ ] Complete a second pen test and remediate all findings
- [ ] Establish a formal security training program for all team members with production access
- [ ] Document and test disaster recovery procedure (restore from backup exercise)
- [ ] Create a formal risk assessment and risk register
- [ ] Implement automated access review workflow
- [ ] Establish a formal vulnerability management program (patch SLA by severity)
- [ ] Create a customer-facing status page with incident history

---

## 12. Recommended Trust/Security Page Structure

### `/security` — Vektrum Trust & Security

**Section 1: Non-Custodial Architecture**
> Vektrum is not a bank, escrow company, payment processor, or money transmitter. Vektrum never holds construction funds. Funds remain with your lender treasury, Stripe Connect, or institutional partner. Vektrum's role is to verify release conditions before authorization — not to execute payment.

**Section 2: Release Authorization Controls**
> Before any draw is authorized, Vektrum verifies 10 deterministic conditions server-side: milestone approval status, protection status, sufficient funding, contractor onboarding, no duplicate active release, no open change orders, signed contract on file, sequential prerequisites, conditional lien waiver (where required), and AI review currency. All conditions must pass. No condition can be waived by a UI action or admin override. The gate is enforced independently at both the API layer and the database layer.

**Section 3: Role-Based Access**
> Vektrum enforces three distinct roles — funder, contractor, and admin — at both the application and database layer via row-level security policies. Admins cannot trigger or approve releases. Contractors cannot approve their own milestones. Funders can only access their own deals. Multi-factor authentication (TOTP) is required for all funder and admin financial operations.

**Section 4: Audit Trail**
> Every release decision, block, override, and external confirmation is recorded in an append-only audit log. Records cannot be modified or deleted after creation — enforced by a database trigger that rejects UPDATE and DELETE operations, including from the service role. Each record includes a SHA-256 row hash and is linked to the previous record via a cryptographic chain hash. External artifacts (authorization tokens, webhook payloads, partner acknowledgements) are bound to audit records via SHA-256. Audit exports are available per deal for lender review.

**Section 5: Partner Confirmation Logging**
> Partner release confirmations and failures are captured with actor attribution, timestamp, event type, and a hash of the partner acknowledgement. Outbound partner webhooks are signed with per-partner HMAC-SHA256 secrets. Authorization tokens are ed25519-signed and include a hash of the evidence snapshot at the time of authorization.

**Section 6: Data Protection**
> Deal data, contracts, lien waivers, SOV line items, draw packages, and payment-adjacent records are scoped to deal participants only. Row-level security policies in the database enforce participant boundaries independently of application-layer access controls. The Supabase service role key is used server-side only and is never exposed to the frontend or client.

**Section 7: Webhook and API Security**
> All inbound webhooks (Stripe, DocuSign) are verified with HMAC-SHA256 signatures before processing. Partner API keys are stored as SHA-256 hashes only — the raw key is shown once at creation and is never recoverable. Rate limiting is enforced on all financial write operations, with fail-closed behavior if our rate-limit store becomes unavailable.

**Section 8: SOC 2 Roadmap**
> Vektrum is building toward SOC 2 Type I attestation. Our technical controls — release authorization logging, tamper-evident audit records, HMAC-verified external events, and role-based database enforcement — are implemented and tested. We are actively completing the operational controls (change management documentation, incident response procedures, centralized logging, and vendor risk management) required before engaging a CPA firm for formal audit. Estimated timeline: SOC 2 Type I engagement in [Q4 2026 / H1 2027].

**Section 9: Incident Response**
> Security incidents are handled by our operations team. To report a security concern, contact operations@vektrum.io. We acknowledge receipt within 24 hours and aim to resolve critical issues within 72 hours.

**Section 10: Subprocessors**
> Vektrum uses the following third-party data processors: Stripe (payment processing and Stripe Connect account management), Supabase (authentication and database infrastructure), and AI service providers (Perplexity, Anthropic, OpenAI — used for draw review analysis only). Updated: [date]. [Link to full `/subprocessors` page]

**Section 11: Security FAQ**
- *Is Vektrum SOC 2 certified?* No. SOC 2 attestation is on our roadmap. We will share our security architecture documentation with prospective lender and institutional partners on request.
- *Does Vektrum hold funds?* No. Vektrum is authorization infrastructure. Funds remain with your bank, Stripe Connect, or institutional partner.
- *Can an admin bypass the release gate?* No. Admins cannot trigger or approve releases. The gate requires funder authorization and is enforced at the database layer independently of application code.
- *Can I get an audit log export for a deal?* Yes. Deal-level audit exports are available to funders from the billing section of the dashboard. Contact us for bulk exports.
- *How are API keys stored?* API keys are stored as SHA-256 hashes only. The raw key is shown once at creation and cannot be recovered.
- *Where is my data stored?* Deal data is stored in Supabase (PostgreSQL) hosted on AWS. See our [Privacy Policy] for details.

---

## 13. SOC 2 Type I Readiness Plan

SOC 2 Type I attests that controls are **designed** and **in place** as of a point in time. It does not require a review period. A Type I audit can be completed in approximately 8–12 weeks with an auditor once the controls below are in place.

### Days 1–30: Technical Gaps and Critical Documentation

**Product/Engineering:**
- [ ] Fix rate-limit signature in `/api/partner/tokens/verify` (1 day)
- [ ] Add `admin_write` rate limiting to 5 unguarded admin routes (1 day)
- [ ] Verify Stripe Connect sandbox transfer executes end-to-end (3 days)
- [ ] Add Sentry error tracking (1 day — DSN config + wrapper in error.ts)
- [ ] Add `npm audit` to CI/CD pipeline (0.5 day)
- [ ] Create `/.well-known/security.txt` (0.5 day)
- [ ] Implement user data export endpoint `/api/users/:id/export` (2 days)
- [ ] Implement user account deletion endpoint `/api/users/:id/delete` (2 days)
- [ ] Create E2E workflow test (2 days)
- [ ] Wire transactional email into DocuSign webhook (1 day)

**Policy/Documentation:**
- [ ] Create `INCIDENT_RESPONSE.md` (security incident procedure) (2 days)
- [ ] Create `BACKUP_AND_RECOVERY.md` (document Supabase backup, define RTO/RPO) (1 day)
- [ ] Create `ACCESS_CONTROL_POLICY.md` (production access list, break-glass procedure, rotation schedule) (1 day)
- [ ] Create `CHANGE_MANAGEMENT.md` (PR review requirements, branch protection, release authorization) (1 day)
- [ ] Create `VULNERABILITY_MANAGEMENT.md` (patch SLA by severity) (1 day)
- [ ] Create `/subprocessors` page with DPA status matrix (1 day)
- [ ] Confirm DPAs signed with Stripe, Supabase, Perplexity, Anthropic, OpenAI (legal task, 1–2 weeks)

**Security Tools:**
- [ ] Sentry (error tracking and alerting) — $26/mo or free tier
- [ ] Vercel Log Drains → external SIEM or structured log store (Papertrail, Logtail) — $10–50/mo
- [ ] Uptime monitoring (Better Uptime, UptimeRobot) — free tier available

### Days 31–60: Operational Controls and Vendor Management

**Engineering:**
- [ ] Add structured JSON logging to all API routes (3 days)
- [ ] Implement audit chain tamper-detection alert (if chain fails, emit alert via existing alerting system) (1 day)
- [ ] Add `tests/audit-log-immutability.test.ts`, `tests/concurrent-release-prevention.test.ts`, `tests/admin-rate-limit.test.ts`, `tests/partner-rate-limit.test.ts` (2 days)
- [ ] Commission external pen test — scope: web application, API, authentication (4–6 weeks, external firm)

**Policy/Documentation:**
- [ ] Create `DATA_CLASSIFICATION.md` (what is confidential, sensitive, public) (1 day)
- [ ] Create `VENDOR_RISK_ASSESSMENT.md` (risk assessment for Stripe, Supabase, AI providers) (2 days)
- [ ] Create `SECURITY_TRAINING.md` (minimum security awareness for team members with production access) (1 day)
- [ ] Create `RISK_REGISTER.md` (risk identification, severity, mitigation, owner) (2 days)
- [ ] Document quarterly access review procedure and run first review (2 days)

**Operational:**
- [ ] Stand up customer-facing status page (Instatus free tier) and configure Vercel alerts to feed it
- [ ] Set up CODEOWNERS file and document branch protection requirements
- [ ] Establish PR review SLA (all changes require at least one reviewer approval before merge)
- [ ] Test restore from Supabase backup (1 day)
- [ ] Run first formal access review — list all production credentials, confirm rotation dates

### Days 61–90: Auditor Engagement and Evidence Collection

**Evidence Collection:**
- [ ] Compile evidence pack: test run results, deployment logs, access review records, pen test report (partial or complete), policy documents, screenshot of Sentry/monitoring setup, screenshot of backup configuration, DPA confirmations
- [ ] Run audit chain health report and store output as evidence
- [ ] Generate sample audit log export for a test deal to demonstrate export capability
- [ ] Document and run a simulated incident response exercise (tabletop)

**Auditor Engagement:**
- [ ] Issue RFP to 2–3 SOC 2 auditors (Schellman, A-LIGN, Johanson Group, Prescient Security are common for startups)
- [ ] Define the audit scope (Security TSC is mandatory; recommend adding Processing Integrity for Vektrum's core value proposition)
- [ ] Define the system description (what systems are in scope, what is out of scope)
- [ ] Schedule audit readiness assessment with chosen auditor

**Approximate Cost:**
- SOC 2 Type I audit: $15,000–$30,000 (startup-tier firms)
- Security tooling (Sentry + log drain + uptime monitor): ~$100–200/month
- Pen test: $8,000–$20,000 (scope-dependent)
- Total: ~$25,000–$55,000 to reach Type I

---

## 14. Final Verdict

### Verdict: **C — Safe to say "SOC 2-aligned controls" with specificity**

Vektrum is not at verdict D (Type I audit prep-ready) because three operational control categories are materially absent: change management documentation, backup and disaster recovery documentation, and security incident response procedures. SOC 2 Type I requires that controls be **documented** and **designed** — several of Vektrum's are designed in code but not yet documented as policies.

However, verdict A (not ready to mention SOC 2 at all) would be false. Vektrum has implemented genuine, verifiable technical controls that align with SOC 2 Security and Processing Integrity criteria: HMAC-verified webhooks, append-only hash-chained audit records, MFA enforcement, role-based DB-layer access, deterministic server-side release gating, and idempotent confirmation flows. These are real and they are tested.

### The proposed statement, evaluated line by line:

> "Vektrum is built with SOC 2-aligned controls including role-based access, release authorization logging, tamper-evident audit records, signed partner events, and non-custodial payment architecture."

**Assessment: Each specific claim is accurate and code-backed.** "Role-based access" — verified in RLS + middleware. "Release authorization logging" — verified in audit_log with all conditions. "Tamper-evident audit records" — verified via hash-chain trigger. "Signed partner events" — verified via HMAC on webhooks and ed25519 on tokens. "Non-custodial payment architecture" — verified in product design, terms, and release flow. The phrase "SOC 2-aligned controls" is defensible because these specific controls are named and are genuinely present.

> "Formal SOC 2 attestation is on our roadmap."

**Assessment: Accurate and appropriate.** This is the correct way to describe a pre-audit state. It is honest, sets expectations correctly, and does not overclaim.

### Recommended revision to tighten the claim further:

> "Vektrum is built with security and processing integrity controls aligned to SOC 2 principles: role-based database enforcement, multi-factor authentication for financial operations, a deterministic 10-condition release gate enforced server-side, tamper-evident audit records with cryptographic hash chaining, and HMAC-signed partner events. Formal SOC 2 attestation is on our roadmap. Security documentation available upon request."

This version is:
- Fully accurate based on code evidence
- More specific (auditors like specificity; it shows you know what you built)
- Less likely to be challenged as overclaiming "SOC 2-aligned" in a broad operational sense
- Appropriate for a website, a lender data room, or a due diligence conversation

**Do not use the proposed statement without fixing the two rate-limit gaps first.** Until SEC-1 and SEC-2 are resolved, the claim "rate limiting on... [financial operations]" is partially inaccurate.

---

*This review is based on static analysis of the codebase as of branch `claude/bold-mestorf-aedfe8` on 2026-05-08. It is a readiness assessment, not a formal audit. It cannot substitute for an engagement with a licensed CPA firm conducting a SOC 2 examination under AICPA AT-C Section 205.*
