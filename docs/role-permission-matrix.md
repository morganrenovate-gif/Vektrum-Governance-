# Vektrum Role & Permission Matrix

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## Roles

| Role | Created via | Session auth | MFA required | Description |
|---|---|---|---|---|
| `contractor` | Self-signup | Supabase session cookie | No | Build-side; submits milestones, uploads documents, receives payouts |
| `funder` | Self-signup | Supabase session cookie | Yes (AAL2) | Capital-side; creates deals, approves milestones, releases funds |
| `admin` | Owner-controlled (`ADMIN_PROMOTION_ENABLED` or direct DB) | Supabase session cookie | Yes (AAL2) | Platform operator; sees all data, manages partners, handles escalations |
| `partner` | Admin creates via `/dashboard/admin/partners` | API key (Bearer token) | N/A | Institutional execution-rail partner; can only confirm/fail external releases |

---

## Deal Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| View own deals | ✅ | ✅ | ✅ (all deals) | ❌ |
| Create deal | ❌ | ✅ (MFA) | ❌ | ❌ |
| Update deal metadata | ❌ | ✅ (deal owner, MFA) | ❌ | ❌ |
| Fund deal (Stripe PaymentIntent) | ❌ | ✅ (MFA) | ❌ | ❌ |
| View deal readiness report | ❌ | ✅ (deal owner) | ✅ | ❌ |
| Freeze deal | ❌ | ❌ | ❌ | ❌ — automatic on DocuSign void-after-release |
| Unfreeze deal | ❌ | ❌ | ✅ (MFA + justification) | ❌ |
| Assign deal to partner | ❌ | ❌ | ✅ (MFA) | ❌ |

---

## Milestone Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| View milestones | ✅ (own deals) | ✅ (own deals) | ✅ (all) | ❌ |
| Create milestone | ❌ | ✅ (MFA) | ❌ | ❌ |
| Transition: `not_started → in_progress` | ✅ | ❌ | ❌ | ❌ |
| Transition: `in_progress → ready_for_review` | ✅ | ❌ | ❌ | ❌ |
| Transition: `ready_for_review → approved` | ❌ | ✅ | ❌ | ❌ |
| Transition: `ready_for_review → in_progress` (send back) | ❌ | ✅ | ❌ | ❌ |
| Transition: `approved → released` directly | ❌ | ❌ (use /release) | ❌ (system-only) | ❌ |
| Release milestone funds (Stripe Connect) | ❌ | ✅ (MFA, deal funder) | ❌ ⛔ explicitly blocked | ❌ |
| Authorize external-rail release | ❌ | ✅ (MFA, deal funder) | ❌ ⛔ explicitly blocked | ❌ |
| Retry `payout_failed` milestone | ❌ | ✅ (MFA) | ❌ | ❌ |
| Upload milestone documents | ✅ | ❌ | ❌ | ❌ |
| Override AI review (emergency) | ❌ | ❌ | ✅ (MFA + justification; not critical risk) | ❌ |

**Critical note:** Admin role is explicitly blocked from triggering milestone releases or external-rail authorizations. This is enforced at both the route level (`requireRole(profile, 'funder')`) and inside `validateRelease()` in `release-gate.ts:76-84`. Admin compromise cannot bypass funder authorization.

---

## Contract Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| View contract status | ✅ | ✅ | ✅ | ❌ |
| Upload contract PDF | ❌ | ✅ | ❌ | ❌ |
| Trigger DocuSign signing | ❌ | ✅ (MFA) | ❌ | ❌ |

---

## Lien Waiver Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Upload lien waiver | ✅ | ❌ | ❌ | ❌ |
| Approve lien waiver | ❌ | ✅ (MFA) | ❌ | ❌ |
| Reject lien waiver | ❌ | ✅ (MFA) | ❌ | ❌ |

---

## Change Order Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Create change order | ✅ | ✅ | ❌ | ❌ |
| Approve change order | ❌ | ✅ | ❌ | ❌ |
| Reject change order | ❌ | ✅ | ❌ | ❌ |

---

## Dispute Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Open dispute | ✅ | ✅ | ❌ | ❌ |
| Resolve dispute | ❌ | ❌ | ✅ (MFA + justification) | ❌ |

---

## Release Confirmation (External Rail)

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Confirm external release (UI) | ❌ | ✅ (MFA, deal funder) | ❌ | ❌ |
| Confirm external release (API) | ❌ | ❌ | ❌ | ✅ (own deals only) |
| Mark external release failed (UI) | ❌ | ✅ (MFA) | ❌ | ❌ |
| Mark external release failed (API) | ❌ | ❌ | ❌ | ✅ (own deals only) |

---

## Billing and Receipts

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| View billing records | ❌ | ✅ (own deals) | ✅ (all) | ❌ |
| Export billing CSV | ❌ | ✅ (own deals) | ✅ | ❌ |
| View receipt | ❌ | ✅ (deal owner) | ✅ | ❌ |
| Resend receipt email | ❌ | ✅ | ✅ | ❌ |
| View payout history | ✅ (own) | ❌ | ✅ (all) | ❌ |

---

## Admin-Only Operations

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| View all users | ❌ | ❌ | ✅ (MFA) | ❌ |
| View user detail + all deals | ❌ | ❌ | ✅ (MFA) | ❌ |
| View system-wide audit log | ❌ | ❌ | ✅ (MFA) | ❌ |
| Export deal audit CSV | ❌ | ❌ | ✅ (MFA) | ❌ |
| Invite new admin | ❌ | ❌ | ✅ (MFA) | ❌ |
| Promote user to admin | ❌ | ❌ | ✅ (MFA + `ADMIN_PROMOTION_ENABLED=true`) | ❌ |
| Change subscription tier | ❌ | ❌ | ✅ (MFA + justification) | ❌ |
| Create partner / issue API key | ❌ | ❌ | ✅ (MFA) | ❌ |
| Rotate partner API key | ❌ | ❌ | ✅ (MFA) | ❌ |
| Deactivate partner | ❌ | ❌ | ✅ (MFA) | ❌ |
| View reconciliation issues | ❌ | ❌ | ✅ (MFA) | ❌ |
| Resolve reconciliation issue | ❌ | ❌ | ✅ (MFA) | ❌ |
| View ops alerts | ❌ | ❌ | ✅ (MFA) | ❌ |
| View release health | ❌ | ❌ | ✅ (MFA) | ❌ |
| View webhook health | ❌ | ❌ | ✅ (MFA) | ❌ |

---

## Stripe and Onboarding

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Initiate Stripe Connect onboarding | ✅ | ❌ | ❌ | ❌ |
| View Stripe account status | ✅ (own) | ❌ | ❌ | ❌ |
| Complete funder onboarding (MFA) | ❌ | ✅ | ❌ | ❌ |

---

## Invite Flow

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Invite contractor to deal | ❌ | ✅ | ❌ | ❌ |
| Accept invite | ✅ (invitee) | ❌ | ❌ | ❌ |

---

## AI Features

| Action | Contractor | Funder | Admin | Partner |
|---|---|---|---|---|
| Request AI draw review | ❌ | ✅ (MFA) | ❌ | ❌ |
| Analyze contract (AI) | ✅ | ✅ | ✅ | ❌ |
| Use AI assistant | ✅ | ✅ | ✅ | ❌ |
| Override AI review (emergency) | ❌ | ❌ | ✅ (MFA + justification) | ❌ |

---

## Summary: What Each Role CANNOT Do

### Contractor cannot:
- Create or fund deals
- Approve milestones or release funds
- View any other user's data
- Access admin features
- Use the partner API

### Funder cannot:
- Submit or transition milestones (except approve/send-back)
- Upload milestone documents or lien waivers
- Access admin features or see other funders' deals
- Use the partner API
- **Release funds directly via the partner API** — funder release is session-authenticated only

### Admin cannot:
- **Release milestone funds** (hard-blocked at route and gate level)
- **Authorize external releases** (same block)
- Fund deals
- Submit milestones
- Access the partner API key endpoints (those are for API-key authenticated partners)

### Partner (API key) cannot:
- Authorize releases (they can only confirm or fail them after funder authorization)
- View deal details beyond what's needed for the release
- Access any dashboard pages
- Perform any admin operations

---

## Related Docs

- `docs/api-inventory.md` — per-route auth and role requirements
- `docs/workflow-test-matrix.md` — end-to-end flows with test scenarios
- `docs/security-controls-map.md` — how controls are enforced technically
- `docs/system-map.md` — roles table and release gate overview
