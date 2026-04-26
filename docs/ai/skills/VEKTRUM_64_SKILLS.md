# Vektrum 64-Skill Index

Use this file on demand only. Do not auto-load it for every Claude Code session. Load it when a task requires a specialized workflow.

## Usage Rule

Load only the skills needed for the current task. For most tasks, use 3-8 skills, not all 64.

Each skill below includes:
- **Use when** — when to activate the skill.
- **Do** — what Claude should do.
- **Output** — what Claude should return.

---

## Orchestration Skills

### 01. Task Triage
**Use when:** A task is broad, unclear, or multi-step.
**Do:** Classify the task as code, security, product, deployment, data, copy, or strategy.
**Output:** task type, risk level, recommended agents, next action.

### 02. Dependency Mapping
**Use when:** A change may affect multiple modules, routes, tests, or docs.
**Do:** Identify upstream/downstream dependencies before editing.
**Output:** dependency list, affected files, risk areas.

### 03. Risk Classification
**Use when:** A task touches release, admin, auth, API keys, payments, demo reset, deployment, or public claims.
**Do:** Classify risk as low/medium/high/critical.
**Output:** risk level, reason, mitigation.

### 04. Specialist Routing
**Use when:** Multiple agents could help.
**Do:** Select the minimum useful agents.
**Output:** selected agents and why each is needed.

### 05. Handoff Compression
**Use when:** Ending a session or passing work between agents.
**Do:** Compress work into branch, files, tests, risks, and next action.
**Output:** concise handoff note.

---

## Product and Copy Skills

### 06. Category Positioning
**Use when:** Writing or reviewing product positioning.
**Do:** Use “conditional authorization infrastructure for construction disbursements.”
**Output:** category-safe positioning statement.

### 07. Risky-Language Detection
**Use when:** Reviewing copy, docs, investor text, FAQs, or UI labels.
**Do:** Flag claims implying Vektrum holds funds, moves money, replaces escrow/title, acts as bank/lender/payment processor, or AI approves release.
**Output:** flagged phrases and safer replacements.

### 08. ICP Alignment
**Use when:** Writing buyer-facing or investor-facing material.
**Do:** Align message to construction lenders, title/escrow partners, private lenders, credit funds, institutional treasury teams, and controlled pilots.
**Output:** ICP-specific copy or notes.

### 09. FAQ Shaping
**Use when:** Creating or improving FAQs.
**Do:** Write concise answers that clarify custody, release authorization, Stripe/external rails, security, and implementation truth.
**Output:** FAQ questions and safe answers.

### 10. Site-Copy Review
**Use when:** Reviewing website, landing page, onboarding, dashboard, or demo copy.
**Do:** Improve clarity while removing overclaims.
**Output:** revised copy plus banned-claim notes.

---

## Architecture Skills

### 11. Architecture Review
**Use when:** Changing system design or core flows.
**Do:** Review against custody, authorization, governance/gate, and execution layers.
**Output:** architecture findings and recommended design.

### 12. Custody-Boundary Review
**Use when:** Payment, release, Stripe, escrow, treasury, or partner processes are mentioned.
**Do:** Ensure Vektrum does not hold funds or claim custody.
**Output:** boundary risks and safe implementation notes.

### 13. Rail-Model Validation
**Use when:** Changing Stripe Connect or external/manual execution flows.
**Do:** Validate rail-specific behavior and wording.
**Output:** Stripe rail notes, external rail notes, risks.

### 14. ADR Drafting
**Use when:** A decision changes architecture, data model, release behavior, integration model, or security posture.
**Do:** Draft a short Architecture Decision Record.
**Output:** ADR with context, decision, consequences.

### 15. Dependency-Risk Review
**Use when:** Adding packages, changing integrations, or modifying shared modules.
**Do:** Assess supply-chain, operational, and coupling risks.
**Output:** dependency risks and safer alternatives.

---

## Release Gate Skills

### 16. Gate-Condition Mapping
**Use when:** Touching release authorization logic.
**Do:** Map code/UI/API/DB behavior to the 10 public release gate conditions.
**Output:** condition matrix and gaps.

### 17. Release-State Transition Review
**Use when:** Changing milestone, draw, release, funding, or execution status.
**Do:** Validate allowed and forbidden transitions.
**Output:** transition table and invalid paths.

### 18. Duplicate-Release Prevention
**Use when:** Release creation, confirmation, retries, or webhooks are involved.
**Do:** Check idempotency, row locks, existing active release checks, and double-spend prevention.
**Output:** duplicate-release risks and tests.

### 19. Funder-Trigger Validation
**Use when:** Changing who can initiate release or execution.
**Do:** Confirm explicit funder action is required where appropriate and no unauthorized actor can release.
**Output:** actor/action matrix.

### 20. Gate Test Design
**Use when:** Adding or repairing release gate tests.
**Do:** Design tests for pass, fail, bypass attempt, duplicate attempt, and stale AI review.
**Output:** test cases and expected results.

---

## TDD and Testing Skills

### 21. Regression Test Design
**Use when:** Fixing a known bug.
**Do:** Create a test that fails before the fix and passes after.
**Output:** regression test description and file target.

### 22. Unit Test Design
**Use when:** Testing isolated functions, validators, guards, or helpers.
**Do:** Cover normal, edge, and invalid inputs.
**Output:** unit test cases.

### 23. Integration Test Design
**Use when:** Testing routes, API flows, DB-backed behavior, or multi-step workflows.
**Do:** Cover actor, state, authorization, side effects, and failure paths.
**Output:** integration test plan.

### 24. Fixture Construction
**Use when:** Tests need deals, milestones, users, partners, contractors, releases, or demo states.
**Do:** Build minimal safe fixtures with clear demo/non-demo separation.
**Output:** fixture plan or fixture code.

### 25. Red-Green-Refactor Workflow
**Use when:** Any behavior-changing code task begins.
**Do:** Write failing test, implement minimal change, refactor after green.
**Output:** test-first implementation sequence.

---

## Code Review Skills

### 26. Diff Reading
**Use when:** Reviewing changes.
**Do:** Inspect only changed files and necessary context.
**Output:** changed behavior summary.

### 27. Bug Spotting
**Use when:** Reviewing code or diagnosing a problem.
**Do:** Look for incorrect conditions, stale state, race conditions, missing awaits, bad defaults, and incorrect assumptions.
**Output:** likely bugs with file references.

### 28. Type-Safety Review
**Use when:** TypeScript, API contracts, forms, data parsing, or DB types are involved.
**Do:** Find unsafe any, unchecked nulls, weak unions, and invalid state types.
**Output:** type risks and corrections.

### 29. Dead-Code Detection
**Use when:** Refactoring, reviewing, or simplifying.
**Do:** Identify unused branches, duplicate helpers, obsolete demo code, and unreachable paths.
**Output:** removable code list.

### 30. Review-Comment Drafting
**Use when:** Preparing PR review comments.
**Do:** Write concise actionable comments with severity and fix suggestion.
**Output:** review comments.

---

## Security Skills

### 31. Threat Modeling
**Use when:** Touching sensitive routes, financial writes, admin, partner API, webhooks, AI review, or demo reset.
**Do:** Identify actors, assets, trust boundaries, abuse cases, and mitigations.
**Output:** threat model summary.

### 32. Authz Review
**Use when:** Changing permissions, roles, middleware, RLS, admin routes, or release controls.
**Do:** Verify who can do what and where checks are enforced.
**Output:** actor-permission matrix and gaps.

### 33. Secret Exposure Scan
**Use when:** Before commit/PR/deploy or when docs/screenshots/env files change.
**Do:** Check for real API keys, service-role secrets, tokens, raw partner keys, and frontend leaks.
**Output:** secret exposure findings.

### 34. MFA/Rate-Limit Checklist
**Use when:** Admin writes, partner API, financial writes, AI/draw review routes, funding/release routes, or cron/reconciliation triggers change.
**Do:** Check MFA needs and rate-limit coverage.
**Output:** checklist and missing controls.

### 35. Security Finding Severity Ranking
**Use when:** Reporting security issues.
**Do:** Rank as critical/high/medium/low with exploit path and remediation.
**Output:** severity-ranked findings.

---

## Partner API Skills

### 36. Endpoint Contract Review
**Use when:** Partner API endpoints or docs change.
**Do:** Validate request/response shape, status codes, errors, auth, and idempotency.
**Output:** endpoint contract findings.

### 37. Scoped API Key Review
**Use when:** API keys, partner auth, scopes, or token storage changes.
**Do:** Ensure keys are hashed, raw shown once, scoped, revocable, and not exposed.
**Output:** key handling review.

### 38. Idempotency Review
**Use when:** Confirm/fail/retry/webhook/reconciliation logic changes.
**Do:** Check event dedupe and safe repeated calls.
**Output:** idempotency risks and tests.

### 39. Postman Packet Review
**Use when:** Producing or reviewing partner API examples.
**Do:** Ensure examples use fake keys, accurate endpoints, and implemented behavior only.
**Output:** corrected Postman/doc notes.

### 40. Partner-Doc Truth Check
**Use when:** Reviewing partner docs or marketing pages.
**Do:** Remove claims about unimplemented outbound webhooks or unsupported integrations.
**Output:** truth-locked docs review.

---

## Admin and Demo Skills

### 41. Admin Route Review
**Use when:** Admin dashboard routes, links, or pages change.
**Do:** Verify routes exist, load, and enforce admin permissions.
**Output:** route findings and test steps.

### 42. Secret Display Review
**Use when:** Admin, partner, API key, or integration UI changes.
**Do:** Ensure raw secrets are not displayed except once at creation.
**Output:** secret display findings.

### 43. Reset-Scope Audit
**Use when:** Demo reset changes or bugs appear.
**Do:** Verify demo-only impact, approved IDs/slugs, idempotency, and production disablement.
**Output:** reset safety review.

### 44. Demo State Fixture Review
**Use when:** Demo data, demo contractor state, or reset fixtures change.
**Do:** Verify every visible demo state resets correctly.
**Output:** fixture gaps and reset checklist.

---

## Build and Deployment Skills

### 45. Build Failure Diagnosis
**Use when:** Build fails locally or in Vercel/CI.
**Do:** Identify the first meaningful failure and likely root cause.
**Output:** root cause and fix path.

### 46. TypeScript Error Triage
**Use when:** TS errors appear.
**Do:** Separate new vs pre-existing errors and group by cause.
**Output:** triage summary and priority fixes.

### 47. CI Command Selection
**Use when:** Deciding what to run before PR/deploy.
**Do:** Select targeted tests, typecheck, lint, build, and smoke checks.
**Output:** command list and rationale.

### 48. Deployment Checklist
**Use when:** Preparing to deploy.
**Do:** Check branch, build, tests, env vars, secrets, migration risk, demo safety, and rollback.
**Output:** deploy go/no-go checklist.

### 49. Environment Variable Review
**Use when:** Env vars, Vercel settings, Stripe, Supabase, partner API, or admin flags change.
**Do:** Check missing, unsafe, frontend-exposed, or production-only variables.
**Output:** env risk review.

### 50. Release Rollback Notes
**Use when:** Preparing a release or deployment.
**Do:** Document rollback trigger, rollback command/process, and expected restored behavior.
**Output:** rollback note.

---

## Database, Payments, and Audit Skills

### 51. RLS Policy Review
**Use when:** DB access, tenant boundaries, admin/partner/user scopes, or Supabase policies change.
**Do:** Validate row-level access expectations.
**Output:** RLS findings and tests.

### 52. Trigger/Constraint Review
**Use when:** Migrations, release state, audit ledger, or DB enforcement changes.
**Do:** Check constraints/triggers prevent impossible states.
**Output:** DB enforcement findings.

### 53. Migration Safety
**Use when:** Adding or changing migrations.
**Do:** Check production data impact, rollback, locks, defaults, and irreversible changes.
**Output:** migration safety checklist.

### 54. Stripe Rail Review
**Use when:** Stripe Connect flows, onboarding, payout readiness, or transfer execution changes.
**Do:** Validate Stripe is an execution rail, not Vektrum custody.
**Output:** Stripe flow risks and safe wording.

### 55. External Rail Review
**Use when:** Title, escrow, bank, lender treasury, wire/ACH, or manual partner process changes.
**Do:** Validate partner-controlled execution and proof confirmation.
**Output:** external rail findings.

### 56. Reconciliation State Review
**Use when:** Payment/execution confirmations, failures, webhooks, or manual reconciliation changes.
**Do:** Ensure states are idempotent, auditable, and do not double-increment ledgers.
**Output:** reconciliation risks and tests.

### 57. Audit Event Taxonomy
**Use when:** Adding events or audit records.
**Do:** Define event type, actor, timestamp, target, previous state, new state, proof, and source.
**Output:** event taxonomy.

### 58. Hash-Chain Review
**Use when:** Audit ledger or tamper-evident evidence changes.
**Do:** Check previous hash, current hash, canonical payload, append-only behavior, and verification path.
**Output:** hash-chain findings.

### 59. Evidence Completeness Review
**Use when:** Release, partner confirmation, AI review, or audit proof changes.
**Do:** Verify enough evidence is recorded to reconstruct why release was authorized or blocked.
**Output:** missing evidence list.

---

## AI, Refactoring, Memory, and PR Skills

### 60. AI Wording Guardrail
**Use when:** AI review or AI-assisted language appears.
**Do:** Ensure AI informs/reviews/flags but never approves or decides release.
**Output:** safe AI wording.

### 61. Safe Refactor Test Strategy
**Use when:** Refactoring risky or shared code.
**Do:** Identify behavior that must stay unchanged and tests needed before cleanup.
**Output:** refactor test plan.

### 62. Context Pruning
**Use when:** Claude context is large or cost efficiency matters.
**Do:** Load only indexes, relevant files, diffs, and short summaries.
**Output:** minimal context plan.

### 63. Durable Memory Update
**Use when:** Ending sessions or changing product truth.
**Do:** Update MASTER_CONTEXT, BACKLOG, ADRs, SECURITY_LOG, RELEASE_NOTES, or HANDOFF_NOTES as appropriate.
**Output:** exact memory file updates.

### 64. PR Summary Writing
**Use when:** Preparing a PR.
**Do:** Summarize what changed, why, tests, risk, screenshots/manual QA, and follow-ups.
**Output:** PR title and body.

---

## Skill Selection Examples

### Fix demo reset bug
Use skills: 01, 03, 21, 24, 25, 31, 43, 44, 47, 63.

### Prepare deployment
Use skills: 01, 03, 33, 45, 46, 47, 48, 49, 50, 64.

### Review release gate logic
Use skills: 11, 12, 16, 17, 18, 19, 20, 31, 32, 51, 52, 57, 59.

### Improve FAQs or website copy
Use skills: 06, 07, 08, 09, 10, 40, 60.

### Audit partner API
Use skills: 31, 33, 36, 37, 38, 39, 40, 56, 57, 59.
