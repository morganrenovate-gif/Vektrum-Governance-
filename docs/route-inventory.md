# Vektrum Route Inventory

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## Public Marketing Pages (no auth)

| Route | File | Purpose | Key Actions |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Home / hero | Links to signup, demo |
| `/about` | `src/app/about/page.tsx` | About Vektrum | Static |
| `/contact` | `src/app/contact/page.tsx` | Contact form + email link | Links to Calendly |
| `/careers` | `src/app/careers/page.tsx` | Careers page | Static |
| `/contractors` | `src/app/contractors/page.tsx` | Contractor-targeted landing | Links to signup |
| `/funders` | `src/app/funders/page.tsx` | Funder-targeted landing | Links to signup |
| `/founders` | `src/app/founders/page.tsx` | Founders page | Static |
| `/lenders` | `src/app/lenders/page.tsx` | Lender-targeted landing | Links to signup |
| `/partners` | `src/app/partners/page.tsx` | Partner program overview | Links to partner docs, placement |
| `/partners/docs` | `src/app/partners/docs/page.tsx` | Partner API documentation | Static reference |
| `/partners/placement` | `src/app/partners/placement/page.tsx` | Partner placement program | Static |
| `/pricing` | `src/app/pricing/page.tsx` | Pricing tiers | Links to signup |
| `/pitch` | `src/app/pitch/page.tsx` | Investor pitch deck view | Static |
| `/security` | `src/app/security/page.tsx` | Security overview | Static |
| `/help` | `src/app/help/page.tsx` | Help center landing | Static |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy policy | Static |
| `/terms` | `src/app/terms/page.tsx` | Terms of service | Static |

---

## Auth Pages

| Route | File | Access | Purpose |
|---|---|---|---|
| `/auth/login` | `src/app/auth/login/page.tsx` | Unauthenticated | Email/password sign-in |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | Unauthenticated | Self-service user registration (contractor or funder) |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx` | Unauthenticated | Password reset (token from email) |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Unauthenticated | Send password reset email |
| `/auth/mfa/enroll` | `src/app/auth/mfa/enroll/page.tsx` | Authenticated (AAL1) | TOTP enroll (required for funders and admins) |
| `/auth/mfa/verify` | `src/app/auth/mfa/verify/page.tsx` | Authenticated (AAL1) | TOTP verify → upgrades session to AAL2 |
| `/invite/[token]` | `src/app/invite/[token]/page.tsx` | Token-gated | Accept invite from admin |

---

## Demo Pages (no auth, frontend-state only)

All demo pages are static. No database reads or writes. State resets on navigation. Data defined in `src/lib/demo-data/index.ts`.

| Route | File | Purpose |
|---|---|---|
| `/demo` | `src/app/demo/page.tsx` | Demo overview / entry point |
| `/demo-live` | `src/app/demo-live/page.tsx` | Live demo hub |
| `/demo-live/admin` | `src/app/demo-live/admin/page.tsx` | Admin view demo |
| `/demo-live/audit` | `src/app/demo-live/audit/page.tsx` | Audit trail demo |
| `/demo-live/contractor` | `src/app/demo-live/contractor/page.tsx` | Contractor dashboard demo |
| `/demo-live/funder` | `src/app/demo-live/funder/page.tsx` | Funder dashboard demo |
| `/demo-live/funder/capital` | `src/app/demo-live/funder/capital/page.tsx` | Capital / funding demo |
| `/demo-live/deal/[id]` | `src/app/demo-live/deal/[id]/page.tsx` | Generic deal detail demo |
| `/demo-live/deal/harbor` | `src/app/demo-live/deal/harbor/page.tsx` | Harbor deal scenario |
| `/demo-live/deal/harbor-dispute` | `src/app/demo-live/deal/harbor-dispute/page.tsx` | Harbor deal dispute scenario |
| `/demo-live/deal/riverside` | `src/app/demo-live/deal/riverside/page.tsx` | Riverside deal scenario |
| `/demo-live/deal/westside` | `src/app/demo-live/deal/westside/page.tsx` | Westside deal scenario |

---

## Dashboard Pages (Supabase session required)

### Shared Dashboard

| Route | File | Roles | MFA | Purpose | Data Loaded |
|---|---|---|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | contractor, funder, admin | funder/admin: yes | Deal list / home | Deals for role; funder: ledger summary |
| `/dashboard/deals/new` | `src/app/dashboard/deals/new/page.tsx` | funder | yes | Create new deal form | Deal creation form state only |
| `/dashboard/deals/[dealId]` | `src/app/dashboard/deals/[dealId]/page.tsx` | contractor, funder, admin | funder/admin: yes | Deal detail + milestone management | Deal, milestones, releases, contract, lien waivers, change orders |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | all | — | Profile settings, MFA enrollment | Profile, MFA factors |
| `/dashboard/billing` | `src/app/dashboard/billing/page.tsx` | funder | — | Billing records for funded deals | billing_records |
| `/dashboard/audit` | `src/app/dashboard/audit/page.tsx` | admin | yes | System-wide audit log viewer | audit_log (paginated) |
| `/dashboard/receipts/[receiptId]` | `src/app/dashboard/receipts/[receiptId]/page.tsx` | funder (deal owner) | — | Transaction receipt detail | releases, billing_records |
| `/dashboard/receipts/[receiptId]/print` | `src/app/dashboard/receipts/[receiptId]/print/page.tsx` | funder (deal owner) | — | Print-optimised receipt | Same as above |

### Contractor-Specific

| Route | File | Roles | Purpose | Data Loaded |
|---|---|---|---|---|
| `/dashboard/contractor/onboarding` | `src/app/dashboard/contractor/onboarding/page.tsx` | contractor | Stripe Connect onboarding flow | Profile, Stripe account status |
| `/dashboard/contractor/payments` | `src/app/dashboard/contractor/payments/page.tsx` | contractor | Payout history | releases where contractor_id = user |
| `/dashboard/contractor/documents` | `src/app/dashboard/contractor/documents/page.tsx` | contractor | Uploaded milestone documents | milestone_documents |

### Funder-Specific

| Route | File | Roles | Purpose | Data Loaded |
|---|---|---|---|---|
| `/dashboard/funder/onboarding` | `src/app/dashboard/funder/onboarding/page.tsx` | funder | Funder onboarding (MFA enrollment prompt) | Profile, MFA status |

### Admin-Only (AAL2 required for all)

| Route | File | Roles | MFA | Purpose | Data Loaded |
|---|---|---|---|---|---|
| `/dashboard/admin` | `src/app/dashboard/admin/page.tsx` | admin | yes | Admin home: user table, admin tools | All profiles (via `getAdminData()`), summary stats |
| `/dashboard/admin/users/[userId]` | `src/app/dashboard/admin/users/[userId]/page.tsx` | admin | yes | User detail: profile + all deals | Profile, deals (as contractor + as funder, deduplicated) |
| `/dashboard/admin/ops` | `src/app/dashboard/admin/ops/page.tsx` | admin | yes | Ops dashboard: release health, alerts, reconciliation issues | Pulls from `/api/admin/ops/*` |
| `/dashboard/admin/partners` | `src/app/dashboard/admin/partners/page.tsx` | admin | yes | Partner / API key management | Partners list, API key creation |
| `/dashboard/admin/subscriptions` | `src/app/dashboard/admin/subscriptions/page.tsx` | admin | yes | Funder subscription tier management | Profiles with subscription_tier |

---

## Error / System Pages

| Route | File | Purpose |
|---|---|---|
| `[any 404]` | `src/app/not-found.tsx` | Dark-theme 404 page with "Back to home" link |

---

## Notes on Access Control

- All `/dashboard/*` pages perform server-side auth checks using `createClient()` + `getUser()` before rendering.
- `/dashboard/admin/*` pages additionally verify `profile.role === 'admin'`; redirect to `/auth/login` if not.
- Funder-only pages (fund deal, release milestone) check role and MFA status server-side.
- The admin dashboard does NOT redirect admins to `/auth/mfa/verify` automatically — the page content is blocked at the data-fetch layer if AAL2 is absent. The prompt to verify MFA appears inline.

---

## Related Docs

- `docs/api-inventory.md` — all API routes
- `docs/role-permission-matrix.md` — per-role access table
- `docs/system-map.md` — architecture overview
