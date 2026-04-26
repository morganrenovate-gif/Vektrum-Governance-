# MASTER_CONTEXT Starter for Vektrum

## Current product identity

Vektrum is conditional authorization infrastructure for construction disbursements.

It sits between draw approval and payment execution, verifies release conditions, then records authorization, proof, and audit evidence. Vektrum authorizes or blocks release. Payment execution happens through Stripe Connect or through the customer’s existing title, escrow, treasury, banking, or institutional partner process.

## Non-negotiable product rules

1. Authorization is separated from execution.
2. Vektrum does not hold funds in its own bank account or act as escrow.
3. Vektrum is not a payment processor, escrow company, bank, lender, money transmitter, title replacement, contractor invoicing app, or Procore clone.
4. The release gate is deterministic. AI informs; the gate decides.
5. Admins, contractors, and partners cannot bypass the release gate.
6. All required conditions must pass before release is authorized.
7. Audit logs should be append-only, hash-chained, and tamper-evident.
8. Avoid “tamper-proof,” “AI approves,” “Vektrum moves money,” “Vektrum holds funds,” “escrow replacement,” “Stripe required,” and “7/8-condition gate.”

## Architecture model

### Four layers

1. Custody layer — funds sit with Stripe Connect, a bank, escrow partner, title company, lender treasury, or institutional partner. Vektrum must not commingle or hold customer funds in its own bank account.
2. Authorization layer — captures who approved what, under what authority, at what time. Admins must not release funds.
3. Governance/gate layer — checks release conditions deterministically. No trust-me bypasses.
4. Execution layer — Stripe Connect executes automated transfers, or partners execute externally and confirm back. Execution must not occur without passed gate and explicit funder action.

### Supported execution rails

Stripe Connect automated rail:
- Best for private/direct lenders and lower-friction pilots.
- Safe wording: “For Stripe Connect releases, payment execution runs through Stripe Connect infrastructure.”

External/manual institutional rail:
- Best for title companies, escrow companies, construction lenders, credit funds, institutional treasury teams, and existing bank/wire/ACH workflows.
- Safe wording: “Payment is executed by the partner-controlled process. Vektrum governs authorization and records proof.”

Strategic principle: keep your payment process; add release enforcement.

## Release gate

Public 10-condition gate labels:

1. Milestone status approved
2. Protection status ready for release
3. Sufficient funding or external funding confirmation
4. Payout readiness verified for selected rail
5. Contractor onboarding complete where required
6. No existing active release for this milestone
7. No open change orders on this milestone
8. Signed contract on file
9. Sequential-release ordering and prerequisites satisfied where required
10. Approved conditional lien waiver on file where required

AI-assisted draw review must be current, documented, and have no unresolved critical risk.

Gate enforcement must exist in:
- UI: unauthorized users do not see release controls.
- API: release endpoints reject invalid attempts.
- Database: constraints, triggers, and row locks prevent impossible state transitions and double-spend.

## Security posture

Security rules:
- Admins cannot release funds.
- Admin promotion through dashboard is disabled.
- Admin promotion API is gated by `ADMIN_PROMOTION_ENABLED=true` and defaults disabled.
- Privileged admin actions require MFA where applicable.
- Partners cannot bypass release gate.
- API keys must be hashed; raw keys shown only once.
- No service-role secrets in frontend.
- No real API keys in docs, screenshots, or examples.
- Sensitive routes should be rate-limited.

Sensitive routes include:
- financial writes
- admin writes
- partner API
- AI/draw review routes
- funding/release routes
- cron/reconciliation triggers

Stripe webhook handling should include:
- HMAC verification of raw body
- event ID deduplication
- idempotent state transitions
- no double ledger increments
- unknown event types logged but not failed

Partner outbound webhooks must not be described as live unless implemented.

## Demo system

Demo reset must:
- affect only demo data
- never touch production/non-demo deals
- be idempotent
- require safe demo identifiers or approved demo IDs/slugs
- be disabled in production unless explicitly enabled where appropriate

Current known issue to investigate: demo reset button may not reset all buttons/state on the demo contractor experience.

## Current branch/workflow

Working branch from current context: `site-truth-lock`

Target flow:
`site-truth-lock -> main`

PR target:
- base: `main`
- compare: `site-truth-lock`

Before PR:
- working tree clean
- build passes
- no real secrets
- no unrelated changes
- public copy truth-lock complete
- partner docs do not overclaim unimplemented functionality

After edits:
- run `npm run build`
- run TypeScript/lint/tests if available
- document pre-existing errors
- summarize files changed
- provide manual test steps

## Current open work

Critical/before merge if confirmed:
- Verify `/auth/logout` 404 and fix route/link if confirmed.
- Verify broken dashboard navigation/user detail route.
- Verify partner API docs do not overclaim outbound webhooks.

High/before controlled pilot:
- Add route/navigation smoke tests.
- Verify admin dashboard: no Promote button, admin promotion disabled by default, partner/API integrations link visible, user detail page loads, no raw secrets exposed.
- Verify demo reset: demo-only, idempotent, no non-demo impact, clean reload.

Medium:
- Clarify milestone revert behavior after partner execution failure.
- Clean UI/contrast issues if readability suffers.
- Verify existing TypeScript issues before fixing.

Priority tests to add:
1. Release gate tests
2. Partner API confirm/fail tests
3. Admin promote disabled tests
4. Demo reset safety tests
5. Route existence/navigation smoke tests
6. Webhook idempotency tests
7. RLS/DB trigger expectation tests where practical

## Claude usage rule

Claude should not be used as a casual chatbot for this project. Use it as the orchestrator of the Vektrum Agent OS.

For every task, Claude should:
1. Select agents.
2. Plan briefly.
3. Use TDD for code changes.
4. Inspect security/custody/release-gate risks.
5. Run checks.
6. Output memory updates.
