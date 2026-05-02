# Production Smoke Test

A run-this-after-deploy checklist that exercises the most important public and
authenticated flows on Vektrum. The static guardrails in
`tests/production-readiness-pass.test.ts` cover the file/copy/banned-phrase
side; this document covers the human/browser/3rd-party side that only a real
session can verify.

> **Scope.** This is a smoke test — the goal is "did anything obviously break"
> after a deploy, not full regression. Plan ~30 minutes for a complete pass.
> If a section fails, file a `P0/P1` and roll back if the failure touches
> release-gate, payments, signing, or auth.

> **Non-invasive rule.** Do NOT issue real Stripe transfers, real DocuSign
> envelopes against production-tier signers, or real partner-API calls during
> smoke testing unless explicitly part of a release-canary. Prefer the demo
> system + a dedicated test deal.

---

## 1. Public marketing pages

For each URL, open in an **incognito** window and verify:

- [ ] Loads without redirect or 5xx
- [ ] Hero renders with the expected H1
- [ ] No console errors (browser DevTools)
- [ ] No banned positioning copy (Cmd-F: "Vektrum moves money", "Vektrum holds funds", "Vektrum acts as escrow", "AI approves release", "guarantees compliance" — should find none)

| URL | Expected H1 | Cache mode |
|---|---|---|
| `/`                 | Stop releasing draws on incomplete evidence. | Static / ISR 1h |
| `/funders`          | Your draw process, systematized.             | Static / ISR 1h |
| `/contractors`      | (current contractor hero)                    | Static / ISR 1h |
| `/pricing`          | (current pricing hero)                       | Static / ISR 1h |
| `/demo`             | (current demo hero)                          | Static / ISR 1h |
| `/design-partners`  | Stop releasing draws on incomplete evidence. | Static / ISR 1h |
| `/security`         | (current security hero)                      | Static / ISR 1h |
| `/resources`        | Resources                                    | Static / ISR 1h |
| `/partners`         | (current partners hero)                      | Static / ISR 1h |
| `/help`             | (current help hero)                          | Static / ISR 1h |

**Trust boundary spot-check on the homepage:** the trust strip directly under
the hero must say "Vektrum does not hold funds, act as escrow, originate loans,
provide legal advice, or execute payment. Vektrum records release readiness
and authorization evidence. The selected payment rail executes disbursement."

---

## 2. Cache headers (run this AFTER #1)

Run each `curl -I` **twice** — the first response will likely be `MISS` or
`STALE`; the second should be `HIT`.

```bash
curl -I https://vektrum.io/
curl -I https://vektrum.io/funders
curl -I https://vektrum.io/pricing
curl -I https://vektrum.io/demo
curl -I https://vektrum.io/design-partners
curl -I https://vektrum.io/security
curl -I https://vektrum.io/contractors
curl -I https://vektrum.io/resources
curl -I https://vektrum.io/help
curl -I https://vektrum.io/partners
curl -I https://vektrum.io/about
curl -I https://vektrum.io/contact
curl -I https://vektrum.io/demo-booked
```

Expected on the **second** request:
- `cache-control` includes `public` or `s-maxage=…` (NOT `private, no-cache, no-store`)
- `x-vercel-cache: HIT`
- `age` non-zero

`/demo-live` is intentionally `force-dynamic` (DemoResetButton uses
`useSearchParams`). Cache headers there can be private/no-store and that's
correct — confirm by looking at `next/server` build output (`ƒ /demo-live`).

---

## 3. Design Partner application funnel

1. Open `/design-partners?utm_source=smoke&utm_medium=manual&utm_campaign=readiness&utm_content=qa&utm_term=test`
2. Verify hero CTA **"Apply to become a design partner"** is visible above the fold and links to `#apply`.
3. Scroll to the form. Fill with realistic test data using a **real test inbox** for `email`.
4. Click **Apply to become a design partner**.
5. Within 30 seconds, verify all of:
   - [ ] UI shows the green **"Application received."** card with a Cal.com link.
   - [ ] **Supabase**: a new row exists in `design_partner_applications` with the UTM fields populated and `admin_email_sent_at` set.
   - [ ] **Admin inbox** (the `DESIGN_PARTNER_ALERT_EMAIL` recipient) received a "New Vektrum design partner application" email with reply-to set to the applicant.
   - [ ] **Meta Pixel**: in the Facebook Events Manager test-events tab, a `Lead` event with `content_name: 'Design Partner Application'` fired exactly once **after** the API responded 200 (not before).
6. Submit a SECOND application with a clearly bot-like User-Agent + the hidden honeypot field filled (use a curl POST). Verify:
   - [ ] API returns `{ ok: true, status: 'ok' }` (silent reject)
   - [ ] No row in `design_partner_applications`
   - [ ] No admin email
7. Submit an invalid application (missing `email`):
   - [ ] API returns 400 with the validation error
   - [ ] No row in `design_partner_applications`

---

## 4. Signup / login

1. Sign up as a brand-new **funder** with a fresh email. Verify:
   - [ ] Signup completes; redirected to onboarding or dashboard
   - [ ] Admin alert email arrives (existing `notifyAdminNewSignup`)
   - [ ] Meta Pixel `CompleteRegistration` fired
2. Sign up as a brand-new **contractor**. Same checks; redirected to `/dashboard/contractor/onboarding`.
3. Log out via the user menu. Log back in. Confirm `/auth/logout` works (no 404) and the dashboard loads.
4. Try logging in with wrong password. Confirm a clear error message; rate-limit kicks in after several attempts.

---

## 5. Funder empty dashboard

Fresh funder, no deals.

- [ ] Header reads "Funder Dashboard" + "Welcome back, …"
- [ ] PageHeader CTA is **"Create governed deal"** → `/dashboard/deals/new`
- [ ] Capital Summary renders zeros
- [ ] "All Projects" empty-state card:
  - Title: **"No governed deals yet"**
  - Body mentions "contract, funding agreement, or draw schedule" and "release authorization"
  - CTA: **"Create governed deal"** → `/dashboard/deals/new`
- [ ] No "once a contractor invites you" copy anywhere on the funder view
- [ ] Click CTA → form opens with eyebrow **"Governed Deal"**, H1 **"Create governed deal"**, advisory **"Start from the contract or funding documents"**, recommended path **"Import from contract or funding documents"**, manual path **"Enter deal details manually"** with the helper "Manual entry still requires verified governing documents before release authorization."
- [ ] Submit button reads **"Create governed deal"**.

---

## 6. Contractor empty dashboard

Fresh contractor (post-Stripe Connect onboarding so the gate doesn't redirect).

- [ ] Header reads "Contractor Dashboard"
- [ ] PageHeader CTA is **"Submit project information"** (NOT "Create New Deal")
- [ ] Next-Best-Action card title: **"Submit your first project"** with body mentioning "submit project information for funder review"
- [ ] "Your Deals" empty-state card:
  - Title: **"No projects yet"**
  - Body: **"You'll see projects here when a funder invites you, or you can submit project information for funder review."**
  - CTA: **"Submit project information"** → `/dashboard/deals/new`
- [ ] No "Create governed deal" / "Import from contract" copy on the contractor view
- [ ] No "Authorize release" / "Release funds" / "Approve release" copy
- [ ] Click CTA → form opens with eyebrow **"Project Submission"**, H1 **"Submit project for funder review"**, advisory **"Submit project information for funder review"** with the funder-verifies / Vektrum-enforces-gate / "selected payment rail executes" body and the **"draft until a funder verifies the deal"** note.
- [ ] Form labels read: **Project Name**, **Proposed Contract Amount (USD)**, **Proposed Retainage Term**, **Suggested milestone sequence**.
- [ ] Submit button reads **"Submit project information"**.

---

## 7. Deal creation / setup

Stay logged in as funder. Use a dedicated test deal.

1. Click **Create governed deal** → fill the manual form → submit.
2. Verify deal appears in the dashboard list and routes correctly.
3. Open the deal page. Confirm:
   - [ ] Setup checklist visible (deal title, parties, contract status)
   - [ ] **Contract upload section** description reads "Upload the signed or governing contract / funding documents to establish the source of truth before release authorization." (funder copy)
   - [ ] Switch to a contractor session for the same deal — the upload description should read "Upload supporting contract documents for funder verification. The funder must verify governing terms before releases can proceed."

---

## 8. Contract upload + DocuSign signing

Use a DocuSign sandbox account; do NOT run this against production-tier signers
in a smoke test unless this is a release-canary.

1. As funder, upload a real PDF contract.
2. Click **Send for DocuSign Signatures**. Verify:
   - [ ] Both parties' notification bells receive **"Contract sent for signature"** ("Contract sent for signature" / "The contract for {deal} has been sent through DocuSign. Milestone releases remain blocked until all required parties complete signing.").
3. As funder, click **Open DocuSign to Sign** → DocuSign session opens → sign → redirect back.
4. Wait for the webhook (~10 s). Verify:
   - [ ] Funder row shows "Signed (date)" + contractor row shows "Pending — your turn"
   - [ ] Contractor bell receives **"Contract signing"** ("Contract ready for your signature" / "The funder has signed the contract for {deal}. Please complete contractor signing in DocuSign.")
   - [ ] Activity feed: `funder_signed` audit + `contractor_signing_turn_notified` audit
5. Switch to contractor session. Verify:
   - [ ] **"It's your turn to sign."** cue + **"Open DocuSign to Sign"** button visible
   - [ ] **"Refresh signing status"** secondary button visible
6. Click **Open DocuSign to Sign** → DocuSign session opens (no `USER_LACKS_PERMISSIONS` error). Sign → redirect.
7. Wait for the webhook. Verify:
   - [ ] Contract status flips to `signed` only after BOTH timestamps populate
   - [ ] Both bells receive **"Contract executed"**
   - [ ] Activity feed: `contractor_signed`, `contract_fully_signed`, `contract_fully_executed_notified`
   - [ ] Signed PDF stored
8. **Idempotency check**: replay the `recipient-completed` webhook for the funder using a Postman collection. Verify NO duplicate `contract_signing_turn` rows appear.
9. **Refresh fallback check**: on a separate test deal whose envelope was created before `eventNotification` was wired (or with the webhook briefly disabled), funder signs in DocuSign → contractor opens deal page → click **Refresh signing status** → confirm `funder_signed_at` updates AND the contractor `contract_signing_turn` notification appears AND **clicking Refresh again does NOT create a second notification**.

---

## 9. Release-gate safety

- [ ] As contractor, attempt to sign before the funder — server returns 409 with **"The funder must sign first."**
- [ ] As a non-participant, attempt to GET/POST `/api/deals/<otherDealId>/contract/sign` — server returns 403.
- [ ] As admin, open a deal page — see "Admins do not sign contracts" read-only message; no Sign button.
- [ ] Try to call `/api/deals/<dealId>/contract/refresh-signing-status` while logged out — should reject (auth required).

---

## 10. Notifications

- [ ] Bell shows correct unread count after each contract event in #8
- [ ] Clicking a notification routes to `/dashboard/deals/{dealId}`
- [ ] Click "Mark all read" — count goes to 0; refresh the page → count stays 0
- [ ] Notification labels render cleanly:
  - Contract sent for signature
  - Contract signing
  - Contract executed
  *(Not the snake-case fallbacks "contract envelope sent", "contract signing turn", "contract fully executed".)*

---

## 11. Demo / live demo

Use `/demo-live` in incognito.

1. Open `/demo-live/contractor`. Verify the **Release blocked** amber card lists 4 conditions including **Funder authorization required** (no action button — locked).
2. Click **Upload lien waiver** → instant emerald checkmark + activity entry.
3. Click **Resolve change order** → same.
4. Click **Request AI review** — verify the animated state machine:
   - Button → disabled **"AI review running…"** with spinner
   - Blue **"AI pre-review in progress"** panel appears with the 5-step checklist (Reading draw request → Comparing against SOV → Checking lien waiver status → Checking open change orders → Preparing review summary)
   - After ~4 seconds: emerald **"AI pre-review complete — funder authorization still required."** panel
   - Activity log gains "AI pre-review requested" then "AI pre-review completed — deterministic release gate and funder authorization still control release"
5. With all 3 contractor conditions complete:
   - [ ] Card switches to blue **"Awaiting funder authorization"**
   - [ ] **"Funder authorization required"** condition is still listed and still open (no checkmark)
   - [ ] No "Authorize release" / "Release funds" buttons exist on the contractor view
6. Click **Reset Demo** in the banner. Verify everything returns to the original "Release blocked" state.
7. Open `/demo-live/funder`. Verify **"Ready for Authorization"** + **"Funder authorization required to proceed"** + **"Review & Authorize"** CTA → `/demo-live/deal/harbor?from=funder`.

---

## 12. Stripe / payment guardrails

These guard against accidentally executing real money during a smoke test.

- [ ] Confirm in Stripe dashboard: no transfers were created during this smoke pass.
- [ ] If running in a release-canary, milestone-release attempts on the test deal do NOT actually move funds (the test contractor's Connect account is a sandbox / non-payout-enabled account).
- [ ] No webhook errors on the Stripe webhook endpoint (`Cache-Control: private` and 200s only).

---

## 13. Analytics

- [ ] Vercel Analytics: pageviews appear for the marketing pages visited in #1.
- [ ] Meta Pixel: `PageView` fires on initial load; `ViewContent` fires once on `/funders`, `/contractors`, `/pricing`, `/demo`, `/design-partners`. No double-fires (the `fired` ref guards each).
- [ ] `/demo-booked` fires `Schedule` on mount; `robots: noindex` set.

---

## 14. Contract → Release Rules → SOV Workflow

End-to-end verification of the contract-derived release-governance pipeline.
Use a dedicated test deal in DocuSign sandbox. **Do not run against
production-tier signers without an explicit canary plan.**

**Pre-conditions:**
- Migrations applied (see §16): `design_partner_applications`,
  `contract_release_rule_drafts`, `sov_source_draft_id`.
- Env vars set (see §17): `PERPLEXITY_API_KEY`, all `DOCUSIGN_*`,
  `RESEND_API_KEY`, etc.
- Test deal has a contractor + funder assigned, no contract yet.

### A. Contract upload → signature collection

1. As funder, click **Send for DocuSign Signatures** on the deal page.
2. Upload a real PDF contract (≥ 1 page of text, not a scanned image).
3. Confirm both parties' notification bells receive **"Contract sent for signature"**.
4. As funder, click **Open DocuSign to Sign** → sign in DocuSign → return.
5. Auto-refresh fires; funder row flips to **Signed**; contractor row stays **Pending — your turn**.
6. Contractor's bell receives **"Contract signing"** ("Contract ready for your signature…").

### B. Contractor signs → contract fully executed

7. Switch to contractor session. Confirm **It's your turn to sign.** + **Open DocuSign to Sign**.
8. Click → sign in DocuSign → return.
9. Auto-refresh fires; both timestamps populate; contract status flips to `signed`.
10. Both bells receive **"Contract executed"**.
11. Setup checklist: ✓ Contract uploaded · ✓ Contract fully signed · ☐ Release rules drafted.

### C. Generate draft release rules from signed contract

12. Switch to funder. Open the deal page. The **Contract Fully Executed → Next required step** card shows **"Generate draft SOV & release rules"** + **"Enter manually"**.
13. Click **Generate draft SOV & release rules**.
14. Wait for success (≤ 30 s). Vercel logs should show:
    ```
    [release-rules] extraction ok { selected_source: 'signed' | 'original',
                                    extraction_method: 'pdf-parse' | 'unpdf',
                                    extracted_text_length: <n> }
    ```
15. Card flips to the **Review draft release rules** state.
16. Verify in Supabase Studio: a row in `contract_release_rule_drafts` with `status='draft'`, `source='perplexity'`, full payload, warnings array.
17. Verify `audit_log` has `contract_release_rules_draft_generated`.

### D. Review draft rules

18. Confirm the review card shows:
    - SOV line items with confidence pills + Review badges
    - Retainage with source snippet
    - 5 release conditions (Sequential / Lien waiver / Inspection / Change-order / Funder authorization — the last is always Required)
    - Evidence requirements
    - Warnings + Assumptions
    - Document-source diagnostic ("Source: signed DocuSign PDF" or fallback)
19. Switch to contractor session: **"Release rules under review"** read-only block. No action buttons.

### E. Approve draft → SOV draft rows materialised

20. Back to funder. Click **Approve draft release rules**.
21. Spinner → 200. Page refreshes. Confirm:
    - Status pill flips to emerald `accepted`
    - Action row hides
    - Setup checklist gains ✓ Release rules drafted · ✓ Release rules approved · ✓ SOV created
    - **SOV approved** stays ☐ — *this is correct*. The funder still has to walk through the existing per-line-item approve flow.
22. Verify `sov_line_items` rows exist for this deal:
    ```sql
    SELECT id, status, source_draft_id, scheduled_value, sort_order
      FROM sov_line_items
     WHERE deal_id = '<deal-id>'
     ORDER BY sort_order;
    ```
    All rows must have `status='draft'` and `source_draft_id` = the draft's UUID.
23. Verify `audit_log` has both `contract_release_rules_draft_approved` AND `sov_draft_created_from_release_rules`.

### F. Idempotency + safety guardrails

24. Replay the PATCH approve via curl with the same `(dealId, draftId)`. Server returns 409 (terminal-state), no duplicate SOV rows.
25. **No Stripe transfers** were created during steps 1–23 (verify in Stripe Dashboard → Transfers).
26. **No `release_*` audit rows** generated by this workflow alone.
27. Attempt a milestone release via the existing release UI. **Release gate stays blocked** by the existing conditions (SOV approved / milestone linked / evidence / funder authorization / etc.). Approving a draft does not bypass any of them.

### G. SOV approval → release-gate progression

28. Walk the existing manual SOV approval flow per line item. Setup checklist's **SOV approved** flips ✓ only after every line is explicitly approved.
29. Link milestones to SOV via the existing UI. **Milestones linked to SOV** flips ✓.
30. Only NOW does the release gate become satisfiable. Test a milestone release end-to-end as the funder authorizes — confirm the gate evaluates the actual conditions and the selected rail (Stripe Connect / external) executes. The release-rule draft and approval played their advisory role: they did not authorize.

### H. Discard path (separate test deal)

31. On a fresh test deal, generate a draft → click **Discard draft**.
32. Confirm: draft status flips to `discarded`. **No** `sov_line_items` rows inserted. Audit shows only `contract_release_rules_draft_discarded`.

### I. Failure-path checks

33. **Scanned PDF.** Upload a PDF that is a scanned image (no extractable text). Generate. Server returns 422 with `reason: 'scanned_pdf_no_ocr'` and the message "Could not extract text from this PDF. It may be scanned or image-based. Enter release rules manually for now." User can fall back to manual entry.
34. **Missing PERPLEXITY_API_KEY** (preview env). Generate. Server returns 503 with "AI extraction is not configured. Enter release rules manually until PERPLEXITY_API_KEY is set in the deployment environment."
35. **Perplexity 4xx.** Force a malformed schema name in code temporarily; generate. Server returns 502 with **"Could not generate draft release rules right now. Enter release rules manually or try again."** — never blames the PDF. Vercel log shows `response_format_type: 'json_schema'`, `response_format_has_json_schema: true`. Restore code afterwards.

### J. Banned-copy + boundary spot checks

36. DOM `Cmd-F` for "AI approves", "automatically released", "guarantees compliance", "Vektrum moves money", "funds are released automatically", "guaranteed extraction" — **should find none** anywhere on the deal page across funder + contractor sessions.
37. Confirm the boundary microcopy is visible at every safety touchpoint:
    - Generate card: "Draft rules must be reviewed and approved before they control release readiness."
    - Review card: "Approving the draft does not authorize release. The deterministic release gate and funder authorization still control release."
    - Contractor read-only: "Draft rules do not control release readiness."

---

## 15. Stripe / payment guardrails — final sweep

After the full §14 workflow, verify in the Stripe dashboard:

- [ ] Zero new Connect transfers
- [ ] Zero new charges, payouts, or refunds
- [ ] Webhook log shows zero new events from this deal
- [ ] No new `release_executed` / `release_authorized` rows in `audit_log` from §14 actions

Any of those firing means the release-rule pipeline accidentally crossed into payment execution — file P0, roll back the deployment.

---

## 16. Required migrations (applied before testing)

These migrations must be live in production before running §14:

| Migration | Adds | Used by |
|---|---|---|
| `20260430000000_design_partner_applications.sql` | `design_partner_applications` table + RLS | §3 design-partner funnel |
| `20260501000000_contract_release_rule_drafts.sql` | `contract_release_rule_drafts` table + RLS + active-draft uniqueness | §14C–§14E |
| `20260502000000_sov_source_draft_id.sql` | `sov_line_items.source_draft_id` column + partial index | §14E SOV materialisation |

Apply with the project's standard pipeline (`supabase db push` or the equivalent migration runner). Verify post-apply by listing tables in Supabase Studio. **Do not run §14 until all three are in place** — §14C will 500 if `contract_release_rule_drafts` is missing, and §14E will 500 if `source_draft_id` is missing.

---

## 17. Required production env vars

Set in Vercel project settings (Production + Preview). Re-deploy after changes.

### Always required

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_APP_URL`           | DocuSign envelope-level webhook URL builder |
| `RESEND_API_KEY`                | Design-partner alert email + transactional email |
| `EMAIL_FROM`                    | Sender for transactional email |
| `DESIGN_PARTNER_ALERT_EMAIL`    | Recipient of design-partner application alerts |
| `DOCUSIGN_INTEGRATION_KEY`      | DocuSign JWT auth |
| `DOCUSIGN_USER_ID`              | DocuSign impersonation user |
| `DOCUSIGN_OAUTH_HOST`           | `account.docusign.com` (prod) / `account-d.docusign.com` (sandbox) |
| `DOCUSIGN_PRIVATE_KEY`          | RSA private key, base64-encoded |
| `DOCUSIGN_ACCOUNT_ID`           | DocuSign account UUID |
| `DOCUSIGN_BASE_PATH`            | `https://na3.docusign.net/restapi` (prod) / `https://demo.docusign.net/restapi` (sandbox) |
| `DOCUSIGN_WEBHOOK_SECRET`       | HMAC verification on every inbound webhook |
| `PERPLEXITY_API_KEY`            | Server-only Sonar key for §14C draft generation |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service-role client for the admin-client server paths |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key |
| `STRIPE_SECRET_KEY`             | Stripe Connect (release execution; out of §14 scope) |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook HMAC verification |

### Optional / overrides

| Var | Default | Purpose |
|---|---|---|
| `PERPLEXITY_MODEL`           | `sonar-pro`     | Override for cost / latency / model A-B testing |
| `NEXT_PUBLIC_BOOK_CALL_URL`  | `https://cal.com/vektrum` | Override for staging / preview booking flows |
| `NEXT_PUBLIC_META_PIXEL_ID`  | (unset)          | Meta Ads tracking; component is a no-op when unset |
| `DEMO_RESET_ENABLED`         | (unset)          | Production-only — must be `'true'` to enable demo reset on prod |
| `DOCUSIGN_WEBHOOK_DEV_BYPASS`| (unset)          | Local-dev only — never set in any deployed env |

**NEVER use `NEXT_PUBLIC_` prefixes for `PERPLEXITY_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `DOCUSIGN_*` private keys, or any other secret.** `NEXT_PUBLIC_*` vars ship to the browser bundle.

---

## 18. Known non-goals

These are NOT part of the smoke test. Don't be alarmed if they look incomplete:

- Real partner-API outbound webhooks (still planned)
- Production retainage release UX (in development)
- Production-tier DocuSign Connect HMAC rotation (operational task)
- Bulk SOV / multi-milestone import beyond the contract-import flow
- Multi-language copy
- Native mobile app

---

## Recovery / rollback

If a P0 blocker is hit during smoke testing:

1. Stop the smoke pass immediately.
2. Capture: the failing step, the URL, console output, network request HAR, and the current Vercel deployment ID.
3. If the failure touches release-gate, payments, signing, or auth: roll back via Vercel ("Promote previous deployment").
4. File the incident with the captured context and the offending commit.

For non-blocking issues (copy, layout, analytics): ticket and continue.
