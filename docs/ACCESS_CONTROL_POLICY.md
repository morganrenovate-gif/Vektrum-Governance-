# Access Control Policy

**Owner:** Operations  
**Last reviewed:** 2026-05-08  
**Review cadence:** Quarterly (access review); annually (policy review)  
**Contact:** operations@vektrum.io

---

## 1. Purpose

This policy governs who has access to Vektrum's production systems, how access is granted and revoked, and how access is periodically reviewed. It applies to all team members, contractors, and third parties with any form of access to Vektrum's production infrastructure, database, deployment systems, or privileged application functions.

---

## 2. Production Systems and Access Tiers

| System | Access Level | Who Has Access | Auth Method |
|--------|-------------|----------------|------------|
| Supabase project (dashboard) | **Owner / Admin** | Founding team only | Supabase account + MFA |
| Supabase service role key | **Privileged** | Application (server-side) only; no individual has standing access via application | Environment variable in Vercel |
| Vercel project (deployment) | **Admin** | Founding team only | Vercel account + MFA |
| Git repository (main branch) | **Admin / Write** | Founding team only | GitHub account + MFA + SSH key |
| Stripe dashboard | **Admin** | Founding team only | Stripe account + MFA |
| Resend dashboard | **Admin** | Founding team only | Resend account + MFA |
| Vektrum admin dashboard (`/dashboard/admin`) | **Application Admin** | Designated team members only | Vektrum account + TOTP MFA + IP allowlist |
| Vektrum ops dashboard (`/dashboard/admin/ops`) | **Application Admin** | Designated team members only | Same as admin dashboard |
| DocuSign admin | **Admin** | Founding team only | DocuSign account + MFA |
| AI provider dashboards | **Admin** | Founding team only | Provider account + MFA |

---

## 3. Access Principles

### Least Privilege
Access is granted at the minimum level required for the role. No individual has standing administrative access to the raw production database outside of emergency break-glass scenarios.

### Separation of Duties
- **Application admins cannot release funds.** The release gate (`src/lib/engine/release-gate.ts`) enforces `requireRole('funder')` independently of admin status.
- **Admin promotion requires multiple gates:** environment flag (`ADMIN_PROMOTION_ENABLED`), existing admin role, MFA, plus an admin justification string of at least 20 characters logged to `admin_audit_log`.
- **Contractors cannot approve their own milestones.** The DB trigger `enforce_milestone_status_transition()` rejects contractor self-approval.

### MFA Required
All team members with access to production systems must have MFA enabled on every account used to access those systems. This includes: Supabase, Vercel, GitHub, Stripe, Resend, DocuSign, and AI provider dashboards.

---

## 4. Access Granting Procedure

### New team member or contractor

1. Identify which systems the person needs access to for their role
2. Grant access at the minimum level required (do not grant admin where read-only suffices)
3. Confirm MFA is enabled on all granted accounts before granting production access
4. For Vektrum application admin role: set `profile.role = 'admin'` via Supabase dashboard (direct DB edit, not the application promote route) — this requires `ADMIN_PROMOTION_ENABLED=false` in production (the promote route is disabled by default)
5. Record the access grant in the Access Register (Section 8)
6. For contractors: access is time-limited; set a calendar reminder for access review at end of engagement

### Partner API key

1. Create partner record in `/dashboard/admin/partners`
2. The raw API key is displayed once — copy it to the partner's secure channel immediately
3. Record the key issuance (partner name, date, scoped to which deals) in the Access Register
4. Never transmit a raw API key over email; use a secure link or password manager share

---

## 5. Access Revocation Procedure

Access must be revoked **immediately** in any of these situations:
- Team member or contractor departs
- Role change that no longer requires the access
- Suspected credential compromise
- End of contractor engagement

### Revocation checklist on departure

- [ ] Remove Supabase project member (Supabase dashboard → Project → Team)
- [ ] Remove Vercel team member (Vercel dashboard → Team → Members)
- [ ] Remove GitHub repository access (GitHub → Repository → Settings → Collaborators)
- [ ] Remove Stripe team member (Stripe dashboard → Settings → Team)
- [ ] Remove Resend team member (Resend dashboard → Team)
- [ ] Remove DocuSign team member (if applicable)
- [ ] Remove AI provider API keys that were personal to the departing member (not shared production keys)
- [ ] Set `profile.role = 'contractor'` or delete the Vektrum admin account via Supabase if the person had application admin role
- [ ] Rotate any shared credentials the departing person had access to (see credential rotation table in `BACKUP_AND_RECOVERY.md`)
- [ ] Record revocation in the Access Register with date and reason

---

## 6. Break-Glass Procedure (Emergency Production Database Access)

There is no standing mechanism for individual direct database access in production. In an emergency requiring direct Postgres access:

1. **Authorization:** At least one founding team member must authorize the break-glass access
2. **Method:** Use Supabase dashboard → SQL Editor (requires Supabase account admin) — this is logged by Supabase
3. **Scope:** Execute only the minimum queries required to resolve the incident
4. **Documentation:** Log the access in `admin_audit_log` via a direct INSERT after the fact, recording: timestamp, operator, reason, queries executed, outcome
5. **Review:** Include the break-glass access in the next quarterly access review
6. **Duration:** Break-glass access is a one-time emergency action, not standing access

---

## 7. IP Allowlist for Admin Routes

The Vektrum application supports IP-based access restriction for all `/dashboard/admin/*` and `/api/admin/*` routes via the `ADMIN_ALLOWED_IPS` environment variable.

**Configuration:**
```
ADMIN_ALLOWED_IPS=203.0.113.0/24,198.51.100.5
```

- Multiple CIDRs and IPs are comma-separated
- Blocked access attempts are logged to `admin_audit_log` with action `admin_access_blocked_ip`
- An empty value disables the allowlist (default behavior — any IP can access admin routes if authenticated)

**Recommendation:** Set `ADMIN_ALLOWED_IPS` to the team's office IP range and VPN IP range before onboarding the first external customer. This adds a network-layer control on top of the authentication and MFA controls.

---

## 8. Access Register

Maintain this register and update it whenever access is granted or revoked.

| Name / System | Role | Systems | Access Since | Last Reviewed | Notes |
|--------------|------|---------|-------------|--------------|-------|
| [Name] | Founder | Supabase Admin, Vercel Admin, GitHub Admin, Stripe Admin, Resend Admin, App Admin | [date] | [date] | MFA confirmed |
| [Name] | Founder | Supabase Admin, Vercel Admin, GitHub Admin, Stripe Admin | [date] | [date] | MFA confirmed |
| [Partner Name] API key | Partner | Partner API (scoped to [deal IDs]) | [date] | [date] | Key prefix: vkp_live_[prefix]; revoke: admin/partners |

*Add a row for each individual with production access and each active partner API key.*

---

## 9. Quarterly Access Review Procedure

**Frequency:** Every 90 days  
**Owner:** Operations lead  
**Estimated effort:** 1–2 hours

1. Pull the Access Register
2. For each person listed:
   - Confirm they are still on the team and in the same role
   - Log in to each system and verify their access level matches what is in the register
   - If access is no longer needed: revoke immediately (Section 5)
   - If MFA status is unknown: verify with the individual or check system settings
3. For each active partner API key:
   - Confirm the partner integration is still active
   - Confirm the key scope (deal IDs) is still accurate
   - Revoke any keys for inactive or completed partner integrations
4. Review `admin_audit_log` for unusual privileged operations in the past 90 days:
   - SQL: `SELECT * FROM admin_audit_log WHERE created_at > now() - interval '90 days' ORDER BY created_at DESC;`
   - Flag anything unexpected for investigation
5. Document the review completion in `docs/access-reviews/YYYY-MM-DD.md`:
   - Date of review
   - Reviewer name
   - Number of accounts reviewed
   - Changes made (revocations, role changes)
   - Any anomalies found
   - Sign-off

---

## 10. Credential Rotation Schedule

| Credential | Rotation Trigger | Maximum Age |
|-----------|-----------------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Team member departure; suspected exposure | 12 months |
| `STRIPE_SECRET_KEY` | Team member departure; suspected exposure | 12 months |
| `STRIPE_WEBHOOK_SECRET` | Suspected exposure | No required rotation (stable unless exposed) |
| `DOCUSIGN_PRIVATE_KEY` | Suspected exposure | 12 months |
| `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` | Suspected exposure | On rotation, existing tokens become invalid — coordinate with partners |
| `RESEND_API_KEY` | Team member departure; suspected exposure | 12 months |
| `CRON_SECRET` | Team member departure; suspected exposure | 12 months |
| AI provider keys | Team member departure | 12 months |
| Partner API keys | Partner offboarding; suspected exposure | At partner offboarding |

---

## 11. Supabase Row-Level Security and Application-Layer Controls

This section documents the access control architecture as implemented in the codebase, for auditor reference.

### Database Layer (RLS)

All core tables enforce row-level security policies (`supabase/migrations/014_rls_hardening.sql`):

- **deals:** Participants (contractor + funder) can read; funder can update status; contractor can update non-financial fields; neither can modify `contractor_id` or `funder_id` after creation (trigger-enforced)
- **milestones:** Participants can read; contractor can create and update status within allowed transitions; funder can approve or reject; DB trigger validates every status change
- **releases:** Participants can read; INSERT is restricted to server-side operations (service role); no UPDATE or DELETE
- **audit_log:** Participants can read their own deal's entries; admins can read all; no INSERT via client (service role only); no UPDATE or DELETE (trigger-enforced)
- **profiles:** Users can read their own profile and counterparts on shared deals; admins can read all; users can update their own profile only

### Application Layer (Route Guards)

Every API route enforces:

1. `getAuthUser()` — valid Supabase JWT required
2. `requireRole(profile, 'funder' | 'contractor' | 'admin')` — role check
3. `requireMFA()` — AAL2 TOTP verification for financial operations (funders) and admin routes
4. `requireDealAccess(dealId, profile)` — participant membership check
5. Rate limiting via `checkRateLimit()` — fail-closed on financial writes

These controls are independent of each other. A failure in one layer does not bypass the others.

---

## 12. Related Documents

- [Incident Response Policy](INCIDENT_RESPONSE.md)
- [Backup and Disaster Recovery Policy](BACKUP_AND_RECOVERY.md)
- [Change Management Policy](CHANGE_MANAGEMENT.md)
- [Role Permission Matrix](role-permission-matrix.md)
- [Security Controls Map](security-controls-map.md)
