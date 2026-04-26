# BACKLOG Starter for Vektrum

## P0 — Fix before merge if confirmed

### 1. Verify `/auth/logout` 404
- Status: needs verification
- Agent set: QA Smoke Test, Code Review, TDD, Build
- Acceptance criteria:
  - User menu logout route works or links to correct existing logout behavior.
  - Route/navigation test or smoke checklist covers logout.
  - Build passes.

### 2. Verify dashboard user navigation
- Status: partly addressed / needs verification
- Agent set: Admin Dashboard, QA Smoke Test, TDD
- Acceptance criteria:
  - “View deals” or user links route to the correct user detail page.
  - `/dashboard/admin/users/[userId]` loads selected user and associated deals.
  - No broken `/dashboard?userId=...` behavior remains if unsupported.

### 3. Audit partner API docs for webhook overclaims
- Status: needs verification
- Agent set: Partner API, Copy Truth-Lock, Compliance/Legal Posture
- Acceptance criteria:
  - Docs do not claim outbound partner webhooks are live unless implemented.
  - Planned webhook language is clearly marked as planned/future if not live.

## P1 — Controlled pilot readiness

### 4. Add route/navigation smoke tests
- Agent set: QA Smoke Test, TDD, Build
- Scope:
  - public pages
  - dashboard pages
  - admin pages
  - partner docs
  - demo pages
  - auth/logout
- Acceptance criteria:
  - Smoke test or manual QA checklist exists.
  - Critical routes render without obvious 404s.

### 5. Verify admin dashboard safety
- Agent set: Admin Dashboard, Security Audit, TDD
- Acceptance criteria:
  - No Promote button in normal dashboard.
  - Admin promotion disabled by default.
  - Partner/API integrations link visible where appropriate.
  - No raw API secrets exposed after initial creation.
  - Admins cannot release funds or bypass release gate.

### 6. Verify demo reset safety
- Agent set: Demo System, Security Audit, TDD, QA Smoke Test
- Acceptance criteria:
  - Demo reset affects only demo data.
  - Reset is idempotent.
  - Reset does not touch non-demo deals.
  - Contractor demo state/buttons reset correctly.
  - Production safety flag behavior is documented.

### 7. Release gate regression suite
- Agent set: Release Gate, TDD, Database/RLS, Security Audit
- Acceptance criteria:
  - All 10 public gate conditions are represented in tests where practical.
  - Duplicate release blocked.
  - Admin/contractor/partner bypass blocked.
  - Gate runs before execution path.

## P2 — Product hardening

### 8. Partner confirm/fail state tests
- Agent set: Partner API, Payments/Rails, TDD
- Acceptance criteria:
  - Confirm/fail flows are idempotent.
  - External/manual confirmation cannot exist without valid authorized release.
  - Failure behavior is explicit and visible.

### 9. Webhook idempotency tests
- Agent set: Payments/Rails, Audit Ledger, TDD, Security Audit
- Acceptance criteria:
  - Duplicate webhook event IDs do not double-increment ledgers.
  - Unknown event types are logged but do not fail incorrectly.

### 10. Milestone revert behavior after partner failure
- Agent set: Release Gate, Payments/Rails, Architecture Steward, Product Positioning
- Acceptance criteria:
  - Decide whether failure requires funder re-authorization.
  - Decide whether milestone protection/status reverts.
  - Decide whether reservation is cancelled.
  - Update ADR if behavior affects architecture.

## P3 — Investor/profile readiness

### 11. Peachscore/profile completion above 60%
- Agent set: Investor Demo Readiness, Market Strategy, Product Positioning, Copy Truth-Lock
- Acceptance criteria:
  - Clear category statement.
  - ICP defined.
  - Problem/wedge explained.
  - Demo screenshots/video ready.
  - FAQs cover custody, escrow, Stripe, AI, gate, audit trail, integrations.

### 12. FAQ set for site/investor profile
- Agent set: Copy Truth-Lock, Compliance/Legal Posture, Investor Demo Readiness
- Acceptance criteria:
  - FAQs use approved language.
  - No escrow/payment/custody overclaims.
  - AI positioned as pre-review, not approval.

## Parking lot / do not touch unless needed

- Release gate logic
- Money/custody language after truth-lock
- Billing logic
- Webhook transaction logic
- Admin permissions
- Partner API request/response shapes
- Public site copy unless legal/product behavior changed
