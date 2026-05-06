# Tier B (B1–B3) — Manual QA checklist

Run before promoting Tier B (rail-scoped authorization tokens + rail adapter +
external-rail authorize-only path + expire-if-stale endpoint) to production.
Each section is independent; run them in the order below against a non-production
environment with migration `20260504000001_authorization_tokens.sql` applied.

Mark every numbered step pass/fail and capture a screenshot or DB snapshot for
any unexpected result. Hold the deploy until all sections pass.

---

## A. Migration dry-run

After applying `supabase/migrations/20260504000001_authorization_tokens.sql`:

```sql
-- Table shape + 35 columns
\d public.authorization_tokens

-- Indexes — expect 6 lookup indexes + 1 PRIMARY KEY + 3 UNIQUE constraints +
-- the partial unique `authorization_tokens_active_per_milestone (milestone_id)
-- WHERE status IN ('issued','delivered')`
SELECT pg_get_indexdef(indexrelid)
FROM pg_index
WHERE indrelid = 'public.authorization_tokens'::regclass;

-- Triggers — expect: authorization_tokens_immutable (BEFORE UPDATE),
-- authorization_tokens_no_delete (BEFORE DELETE)
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.authorization_tokens'::regclass;

-- RLS policies — expect: authorization_tokens_select_funder (SELECT for funder/payee/admin)
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.authorization_tokens'::regclass;

-- FK on releases
\d public.releases
-- expect: authorization_token_id UUID REFERENCES authorization_tokens(id) UNIQUE NULL
```

- [ ] A1. `authorization_tokens` table exists with 35 expected columns
- [ ] A2. Partial unique index on `(milestone_id) WHERE status IN ('issued','delivered')` is present
- [ ] A3. Both immutability triggers (`UPDATE` and `DELETE`) are installed
- [ ] A4. `authorization_tokens_select_funder` RLS policy exists; no INSERT/UPDATE/DELETE policy for `authenticated`
- [ ] A5. `releases.authorization_token_id` UNIQUE FK exists; existing rows have `NULL` value (verified by `SELECT count(*) FROM releases WHERE authorization_token_id IS NOT NULL` returning the expected count for any test data)
- [ ] A6. pgcrypto extension present in `extensions` schema (`SELECT 1 FROM pg_extension WHERE extname='pgcrypto'`)

---

## B. Stripe rail regression — response must be byte-identical to pre-Tier-B

Setup:
- Funder with `disbursement_rail='stripe'`
- Contractor with completed Stripe Connect (`stripe_account_id` populated, `stripe_payouts_enabled=true`)
- Funded deal with at least one `approved` milestone
- For simplicity: deal where `lien_waiver_required=false` and `sequential_release_required=false`

Run:

- [ ] B1. `POST /api/milestones/{id}/release` returns HTTP 200
- [ ] B2. Response body contains every pre-Tier-B field unchanged: `success`, `release.milestone_id`, `release.deal_id`, `release.stripe_transfer_id`, `release.idempotency_key`, `release.released_by`, `release.released_at`, `release.receipt`, `release.billing.{gross_amount,fee_amount,retainage_amount,retainage_percentage,net_to_contractor,billing_rate_bps,rate_label,total_debit}`
- [ ] B3. Response body contains the three new additive fields: `release.authorization_token_id` (UUID), `release.authorization_token_jti` (UUID), `release.execution_status: 'confirmed'`
- [ ] B4. `SELECT * FROM authorization_tokens WHERE milestone_id='…'` returns one row with `status='confirmed'`, `confirmed_at` populated, `rail_scope='stripe'`, `signature_alg` matches env (`ed25519` if signing key set, else `unsigned`)
- [ ] B5. `SELECT authorization_token_id FROM releases WHERE milestone_id='…'` matches the token id from B4
- [ ] B6. `SELECT row_hash, chain_hash, hash_schema_version, token_hash, rail_confirmation_hash FROM audit_log WHERE entity_id='…' AND action='funds_released' ORDER BY event_sequence DESC LIMIT 1` — every column non-null, `hash_schema_version=2`
- [ ] B7. `SELECT * FROM verify_audit_chain('milestone', '<milestone_uuid>')` — every returned row shows `row_hash_valid=true` AND `chain_hash_valid=true`
- [ ] B8. Stripe dashboard shows the transfer object with metadata including `authorization_token_id` and `authorization_token_jti` (new) plus all the historical fields (gross_amount, retainage_amount, net_to_contractor, etc.)
- [ ] B9. Funder receives the transaction-receipt email with the same content as before
- [ ] B10. Contractor receives the release-authorized notification

---

## C. Idempotency / replay — same milestone cannot duplicate-release

Continuing from B (same milestone, now released):

- [ ] C1. Re-POST `/api/milestones/{id}/release` immediately → expect 429 (existing rate limiter, 10s window) OR 409 `RELEASE_LOCK_CONFLICT` if the gate-rate-limit is already past.
- [ ] C2. Wait > 10s, re-POST → expect 400 with the gate's "Milestone must be approved" error (the milestone is now `released`, so the gate blocks at Condition 1).
- [ ] C3. Confirm no second `authorization_tokens` row was inserted for the same milestone.
- [ ] C4. Confirm no second Stripe transfer in the dashboard.
- [ ] C5. Confirm no second `funds_released` audit row.

---

## D. External-rail authorize-only path (B3 new behavior)

Setup:
- Funder with `disbursement_rail='external_rail'` (use Settings → Disbursement to switch, or update the profile directly).
- Same approved milestone shape as B but a different deal/milestone (so we don't collide with the released milestone from B).
- Contractor's Stripe Connect status does NOT matter on this rail.

Run:

- [ ] D1. `POST /api/milestones/{id}/release` returns HTTP 200
- [ ] D2. Response body shows `release.execution_status: 'pending'`, `release.execution_rail: 'external_manual'`, `release.stripe_transfer_id: null`, `release.receipt: null`, `release.authorization_token_id` populated
- [ ] D3. `SELECT rail_scope, status FROM authorization_tokens WHERE milestone_id='…'` → `rail_scope='external_rail'`, `status='delivered'`
- [ ] D4. `SELECT execution_rail, execution_status, stripe_transfer_id FROM releases WHERE milestone_id='…'` → `external_manual`, `pending`, `NULL`
- [ ] D5. Milestone status flipped to `released` (`SELECT status FROM milestones WHERE id='…'`)
- [ ] D6. **CRITICAL**: `SELECT reserved_amount FROM deals WHERE id='…'` is still elevated by (gross + fee) — reservation MUST stay locked
- [ ] D7. Audit row: `SELECT action, token_hash, rail_confirmation_hash FROM audit_log WHERE entity_id='…' ORDER BY event_sequence DESC LIMIT 1` → `action='release_authorization_recorded'`, `token_hash` populated, `rail_confirmation_hash` is NULL
- [ ] D8. Stripe dashboard shows **NO** new transfer for this time window (`stripe.transfers.list({ created: {gte: …} })`)
- [ ] D9. Contractor receives the release-authorized notification (settlement is pending but authorization is recorded)
- [ ] D10. Try re-POST same milestone → expect 409 `AUTHORIZATION_TOKEN_CONFLICT` (partial unique index blocks second active token)

---

## E. External-rail confirmation (settlement leg, existing route exercised)

Continuing from D:

- [ ] E1. `POST /api/releases/{releaseId}/confirm-external` with body `{"payment_method": "wire", "payment_reference": "TEST-WIRE-001"}` → HTTP 200, `success: true`
- [ ] E2. `releases.execution_status: 'pending' → 'confirmed'`
- [ ] E3. `billing_records` row inserted with `stripe_transfer_id=NULL`, correct `gross_amount` / `fee_amount` / `net_amount` / `retainage_amount`
- [ ] E4. `deals.released_amount` increased by net-to-contractor; `deals.fees_collected` increased by fee; `deals.reserved_amount` decreased by (net + fee)
- [ ] E5. `deals.retainage_held` increased by retainage; `deals.reserved_amount` further decreased by retainage (now back to pre-authorization level)
- [ ] E6. `authorization_tokens.status: 'delivered' → 'confirmed'`, `confirmed_at` populated
- [ ] E7. Audit row `external_release_confirmed` binds **both** `token_hash` AND `partner_ack_hash` (`SELECT token_hash, partner_ack_hash FROM audit_log WHERE action='external_release_confirmed' ORDER BY event_sequence DESC LIMIT 1`)
- [ ] E8. `verify_audit_chain('release', '<release_uuid>')` returns `row_hash_valid=true` and `chain_hash_valid=true` for every event
- [ ] E9. Re-POST `/confirm-external` for the same release → expect 409 (already confirmed)
- [ ] E10. **Partner confirm parity (optional, requires partner API key)**: same flow via `POST /api/partner/releases/{id}/confirm` against a new external-rail authorization shows the same DB transitions and `partner_release_confirmed` audit binds `token_hash` + `partner_ack_hash`.

---

## F. Expire-if-stale (G7 endpoint)

Setup:
- Fresh external-rail authorize-only release (state D again, on a new milestone).
- Note the token's default `expires_at` (30 days for external rail).
- To test, manually advance the expiry: `UPDATE authorization_tokens SET expires_at='2024-01-01' WHERE id='…'`.

Run:

- [ ] F1. As funder or admin: `POST /api/releases/{id}/expire-if-stale` with body `{"reason": "manual qa expiry"}` → HTTP 200, `success: true`, `reservation_freed: true`
- [ ] F2. `authorization_tokens.status: 'expired'`, `expired_at` populated
- [ ] F3. `releases.execution_status: 'failed'`
- [ ] F4. `deals.reserved_amount` decreased back by the original (gross + fee) — reservation freed
- [ ] F5. Audit row `release_authorization_expired` binds `token_hash` AND `partner_ack_hash`
- [ ] F6. Idempotency: re-POST `/expire-if-stale` → expect 409 `NOT_PENDING`
- [ ] F7. Pre-condition guards:
  - [ ] F7a. Try `expire-if-stale` on a fresh token whose `expires_at` is in the future → expect 409 `TOKEN_NOT_STALE`
  - [ ] F7b. Try `expire-if-stale` on a Stripe-rail release → expect 422 (only `external_manual` is eligible)
  - [ ] F7c. Try as a contractor (non-funder, non-admin) → expect 403
- [ ] F8. **CRITICAL — fee math**: confirm the reservation freed in F4 equals the reservation taken at authorization time. Compute manually: `fee = max(50, round(gross × billing_rate_bps / 10000, 2))`. The endpoint recomputes from current `deal.billing_rate_bps`; today this is immutable post-funding so the values match — but explicitly verify in QA.

---

## G. Token signing (optional, not required for B1–B3 deploy)

Pre-deploy decision: ship signed (`VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` env var set in production) OR ship unsigned for B1–B3 and add signing in B step 2 (partner verifier endpoints). Tier B1–B3 functionality does not depend on a signature.

If shipping signed:

- [ ] G1. Generate ed25519 keypair (PKCS8 PEM): `openssl genpkey -algorithm Ed25519 -out vektrum-token-signing-key.pem`. Extract public key for later partner verifier deploy: `openssl pkey -in vektrum-token-signing-key.pem -pubout -out vektrum-token-signing-key.pub.pem`. Store the private key in your secret manager.
- [ ] G2. Set `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` to the PEM contents (or base64-encoded PKCS8 DER) in the Vercel environment for the deploy target.
- [ ] G3. Trigger a Stripe-rail release; verify `SELECT signature, signature_alg FROM authorization_tokens ORDER BY created_at DESC LIMIT 1` → `signature_alg='ed25519'`, `signature` non-null.
- [ ] G4. Re-construct the canonical-JSON payload with the same field set the issuer signs (see `src/lib/engine/authorization-token.ts:canonicalPayload` shape) and verify the signature with the public key. (When the partner verifier ships in Tier B step 2 this becomes automated.)
- [ ] G5. Unset the env var on a non-prod environment; trigger a release; verify the row writes with `signature_alg='unsigned'`, `signature=NULL` and a console warning is logged. No HTTP error to the caller.

If shipping unsigned for B1–B3:

- [ ] G6. Verify production env DOES NOT have `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` set (so we don't half-sign tokens with a stale or wrong key).
- [ ] G7. Confirm the token row schema accepts `signature=NULL` and `signature_alg='unsigned'` without error.
- [ ] G8. Track a follow-up to switch on signing before deploying Tier B step 2's partner verifier endpoints.

---

## H. Audit-chain verification (cross-cutting)

After A–F have run, validate end-to-end chain continuity across the new audit events.

- [ ] H1. `SELECT * FROM verify_audit_chain(NULL, NULL) WHERE row_hash_valid=false OR chain_hash_valid=false` returns zero rows.
- [ ] H2. For a Stripe-rail release from B: pick its milestone and verify all audit events for that milestone are valid AND the `funds_released` event's `token_hash` matches `(SELECT token_hash FROM authorization_tokens WHERE id=<release.authorization_token_id>)`.
- [ ] H3. For an external-rail release from D+E: verify the `release_authorization_recorded` event (D) and the subsequent `external_release_confirmed` event (E) both reference the same `token_hash` (queryable via `metadata->>'authorization_token_id'`).
- [ ] H4. For an expired release from F: the `release_authorization_expired` event's `token_hash` matches the same token_hash from the original `release_authorization_recorded` event.
- [ ] H5. Sanity-check the v1 → v2 boundary: pre-Tier-A audit rows still verify `row_hash_valid=true` under v1 dispatch (these rows have `hash_schema_version IS NULL`).
- [ ] H6. Run the full test suite against the deployed environment if CI permits, or locally: `npm test` (full suite) AND `npx tsx tests/tier-a-audit-graph-binding.test.ts` AND `npx tsx tests/tier-b1-authorization-token.test.ts` AND `npx tsx tests/tier-b2-b3-rail-adapter.test.ts` — every test green.

---

## Sign-off

- [ ] All A–H checks pass.
- [ ] Migration applied to production database.
- [ ] Any new env vars (`VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` if signing) are set in production.
- [ ] No FAIL markers in the test suite.
- [ ] Deploy approved by: _____________________ Date: _____________
- [ ] Rollback plan acknowledged: revert the migration is non-trivial because the immutability trigger blocks UPDATEs and the partial unique index uses live column data; safest rollback is to leave the table in place, set the funder back to `disbursement_rail='stripe'`, and flip a feature flag (TBD) that bypasses the issuer call. Alternatively, revert the route change to the pre-B2 inline-Stripe path while leaving the table empty.
