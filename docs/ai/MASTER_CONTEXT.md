# MASTER_CONTEXT — Vektrum

## Product Identity
Vektrum is conditional authorization infrastructure for construction disbursements.

Vektrum verifies release conditions, authorizes or blocks release, and records proof/audit evidence. Payment execution happens through Stripe Connect or the customer’s existing title, escrow, treasury, banking, or institutional partner process.

## Non-Negotiables
- Authorization is separate from payment execution.
- Vektrum does not hold funds, act as escrow, or move money directly.
- Vektrum is not a payment processor, bank, lender, money transmitter, title replacement, contractor invoicing app, or Procore clone.
- The release gate is deterministic. AI informs; the gate decides.
- Admins, contractors, and partners cannot bypass the release gate.
- All required conditions must pass before release is authorized.
- Audit logs should be append-only, hash-chained, and tamper-evident.
- Avoid claims like “AI approves,” “Vektrum moves money,” “escrow replacement,” “Stripe required,” and “tamper-proof.”

## Architecture
Four layers:
1. Custody — funds remain with Stripe Connect, bank, escrow/title, lender treasury, or institutional partner.
2. Authorization — records who approved what, authority, and time.
3. Governance gate — deterministic release-condition checks.
4. Execution — Stripe Connect or partner-controlled external process executes only after authorization.

Strategic principle: keep the customer’s payment process; add release enforcement.

## Release Gate
Public 10-condition gate:
1. Milestone status approved
2. Protection status ready for release
3. Sufficient funding or external funding confirmation
4. Payout readiness verified
5. Contractor onboarding complete where required
6. No existing active release for milestone
7. No open change orders on milestone
8. Signed contract on file
9. Sequential-release prerequisites satisfied
10. Approved conditional lien waiver on file where required

Gate enforcement must exist in UI, API, and database. AI-assisted review must be current, documented, and have no unresolved critical risk.

## Security
- Admins cannot release funds.
- Admin promotion disabled by default.
- Privileged admin actions require MFA where applicable.
- API keys hashed; raw keys shown only once.
- No service-role secrets in frontend.
- No real API keys in docs/screenshots/examples.
- Sensitive routes should be rate-limited.
- Stripe webhooks require HMAC verification, event dedupe, idempotency, and safe handling of unknown events.
- Do not describe partner outbound webhooks as live unless implemented.

## Demo System
Demo reset must:
- affect demo data only
- never touch production/non-demo deals
- be idempotent
- require safe demo identifiers or approved demo IDs/slugs
- be disabled in production unless explicitly enabled

Known issue: demo reset button may not reset all buttons/state on demo contractor experience.

## Current Branch / Workflow
Working branch: `site-truth-lock`  
Target flow: `site-truth-lock -> main`

Before PR:
- working tree clean
- build/tests pass where available
- no real secrets
- no unrelated changes
- public copy truth-lock complete
- partner docs do not overclaim unimplemented functionality

After edits:
- run `npm run build`
- run TypeScript/lint/tests if available
- document pre-existing errors
- summarize changed files
- provide manual test steps

## Current Open Work

Critical:
- Verify `/auth/logout` 404 and fix route/link if confirmed.
- Verify broken dashboard navigation/user detail route.
- Verify partner API docs do not overclaim outbound webhooks.

High:
- Add route/navigation smoke tests.
- Verify admin dashboard safety.
- Verify demo reset safety.

Priority tests:
1. Release gate tests
2. Partner API confirm/fail tests
3. Admin promote disabled tests
4. Demo reset safety tests
5. Route/navigation smoke tests
6. Webhook idempotency tests
7. RLS/DB trigger expectation tests

## Claude Usage
Claude should operate as the Vektrum Agent OS orchestrator, not a casual chatbot.

For each task:
1. Select only necessary agents.
2. Plan briefly.
3. Use TDD for code changes.
4. Inspect custody/security/release-gate risk.
5. Run relevant checks.
6. Output memory updates when requested.
