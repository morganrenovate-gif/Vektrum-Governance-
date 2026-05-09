# Change Management Policy

**Owner:** Operations  
**Last reviewed:** 2026-05-08  
**Review cadence:** Annually or after any change-related incident  
**Contact:** operations@vektrum.io

---

## 1. Purpose

This policy defines how changes to Vektrum's production systems — application code, database schema, environment configuration, and infrastructure settings — are reviewed, approved, tested, and deployed. The goal is to ensure that all changes are authorized, tested before deployment, and reversible where possible.

---

## 2. Scope

This policy applies to all changes that affect:

- Application source code (Next.js app, API routes, business logic, UI)
- Database schema changes (Supabase migrations)
- Environment configuration changes (Vercel environment variables, feature flags)
- Infrastructure changes (Supabase project settings, Vercel project settings, Stripe webhook configuration, DocuSign Connect configuration)
- Security controls (RLS policies, auth middleware, rate limiting, webhook verification)

---

## 3. Change Categories

| Category | Examples | Review Required | Deployment Process |
|----------|---------|-----------------|-------------------|
| **Standard** | Bug fixes, UI copy, non-security feature additions | 1 reviewer | PR → merge → Vercel auto-deploy |
| **Significant** | New API routes, auth changes, release gate logic, RLS policies, DB migrations, rate limiting, webhook handling | 1 reviewer + smoke test | PR → review → merge → smoke test → confirm |
| **Critical** | Changes to release gate conditions, audit log structure, payment rail logic, admin permission model, credential rotation | Founding team review + full smoke test | PR → review → staging deploy → smoke test → production deploy → post-deploy verification |
| **Emergency** | Hotfixes for active SEV-1/SEV-2 incidents | Incident Commander authorization | Expedited — but must be documented in incident record; full PR review within 24 hours |

---

## 4. Code Review Requirements

### Standard and Significant changes

1. **Create a branch** from `main` named descriptively: `fix/[description]`, `feat/[description]`, `chore/[description]`
2. **Write tests first** for any behavior-changing code (per project TDD policy in `CLAUDE.md`)
3. **Open a Pull Request** with:
   - Description of what changed and why
   - Test results (paste or screenshot)
   - Manual test steps (for UI changes)
   - Any security or release-gate implications
   - Any migration changes and their reversibility
4. **Code review:** At least one other team member reviews and approves before merge
5. **Merge:** Squash-merge or merge commit to `main`; do not rebase and force-push `main`

### Critical changes (release gate, auth, RLS, payment rails)

Critical changes additionally require:
- Explicit review of the security implications section in the PR
- Verification that all existing tests still pass
- A staging deploy (Vercel preview URL) with the smoke test completed before merging to `main`
- Post-merge production smoke test (`docs/PRODUCTION_SMOKE_TEST.md`)

### Emergency changes (incident hotfixes)

In a SEV-1/SEV-2 incident, speed takes precedence over process — but not over safety:
1. The Incident Commander authorizes the expedited change
2. The change is deployed with the minimal scope needed to resolve the incident
3. A full PR is opened and reviewed within 24 hours of the hotfix
4. The hotfix and its context are documented in the incident record

---

## 5. Database Migration Policy

Database schema changes (files in `supabase/migrations/`) carry elevated risk because they are not automatically reversible.

### Before writing a migration

1. Confirm the migration is additive where possible (add columns, add tables, add constraints) — additive migrations are safer than destructive ones
2. For column removals or type changes: confirm no application code references the old column/type before deploying
3. For constraint additions: verify no existing rows violate the new constraint before applying

### Migration naming convention

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20260508120000_add_partner_webhook_config.sql`

### Migration content checklist

- [ ] Migration is idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- [ ] Migration does not contain raw secrets or real data
- [ ] Migration includes a comment explaining the purpose
- [ ] If destructive: includes a rollback procedure comment
- [ ] RLS policies are reviewed: any new table must have RLS policies before being accessible from the client
- [ ] If adding a new status enum value: verify the state machine documentation and trigger function are updated

### Migration deployment

1. Test against a Supabase branch or local Supabase instance before applying to production
2. Apply via Supabase CLI (`supabase db push`) or Supabase dashboard SQL editor
3. Verify the migration applied cleanly (no errors in Supabase dashboard → Database → Migrations)
4. Run the smoke test post-migration

---

## 6. Environment Configuration Changes

Changes to environment variables (Vercel dashboard → Settings → Environment Variables) follow this procedure:

1. Document the reason for the change and the new value (store in the secure vault, not in the PR)
2. For secret rotation: update in vault first, then update in Vercel
3. Trigger a Vercel redeploy after updating env vars (Vercel does not auto-redeploy on env changes)
4. Run smoke test after redeploy to confirm the application is functioning with the new value
5. Record the change in the change log (Section 9)

### Feature flags

Two feature flags are currently controlled via environment variables:

| Flag | Default | Effect |
|------|---------|--------|
| `ADMIN_PROMOTION_ENABLED` | `false` | Enables `/api/admin/promote` — disabled in production unless explicitly enabled |
| `DEMO_RESET_ENABLED` | `false` | Enables `/api/demo/reset` — must not be enabled in production with real customer data |

Changes to these flags are **Critical** changes and require founding team authorization.

---

## 7. Pre-Deployment Checklist

Before any production deployment, verify:

- [ ] All tests pass locally: `npm test`
- [ ] TypeScript compiles without new errors: `npm run build`
- [ ] No real secrets or credentials in committed code
- [ ] No `NEXT_PUBLIC_` prefixed variables contain secret values
- [ ] `DEMO_RESET_ENABLED` is not set to `true` in production
- [ ] `ADMIN_PROMOTION_ENABLED` is not set to `true` in production (unless explicitly authorized)
- [ ] Any new API routes have: auth guard, role check, rate limiting (for write operations), error handling
- [ ] Any new tables have RLS policies
- [ ] Migration has been tested against a non-production database
- [ ] PR has been reviewed and approved

---

## 8. Post-Deployment Verification

After every production deployment:

1. Run the production smoke test: `docs/PRODUCTION_SMOKE_TEST.md`
2. Check the Vercel deployment status for function errors
3. Check the ops dashboard (`/dashboard/admin/ops`) for any new alerts
4. For critical changes: verify the specific control that was changed is functioning as expected
5. Monitor for 30 minutes post-deploy for error rate spikes or unusual behavior

---

## 9. Change Log

Maintain a running log of significant changes in the table below. This is the audit trail for change management and supports SOC 2 evidence collection.

| Date | Change | Category | Author | Reviewer | PR / Reference | Deployed By | Post-Deploy Test |
|------|--------|----------|--------|----------|---------------|------------|-----------------|
| 2026-05-08 | SOC 2 policy documents created | Standard | [name] | [name] | — | — | N/A (docs only) |
| | | | | | | | |

*Add a row for every production deployment that includes significant or critical changes.*

---

## 10. Rollback Procedure

If a deployment introduces a regression:

1. **Identify the issue** via smoke test, ops dashboard, or customer report
2. **Assess severity** — use the incident severity levels in `INCIDENT_RESPONSE.md`
3. **Rollback options:**
   - **Vercel instant rollback:** Vercel dashboard → Deployments → select previous deployment → "Promote to Production" — completes in ~60 seconds
   - **Git revert:** `git revert [commit-hash]` → open PR → expedited review → deploy
   - **Migration rollback:** If a DB migration must be reversed, use a new migration to undo the change — do not delete the original migration from `supabase/migrations/`
4. **Document** the rollback in the incident record and change log

---

## 11. Vendor and Infrastructure Change Controls

Changes to third-party service configuration that could affect production:

| Change | Control |
|--------|---------|
| Stripe webhook endpoint URL or events | Verify new endpoint is live before removing old one; test with Stripe CLI |
| Stripe Connect permissions or account settings | Review Stripe documentation; test in Stripe test mode first |
| DocuSign Connect webhook configuration | Update `DOCUSIGN_WEBHOOK_SECRET` in both DocuSign and Vercel simultaneously |
| Supabase plan change (affects backups, PITR, connections) | Review implications before changing; update `BACKUP_AND_RECOVERY.md` |
| AI provider model or API version change | Test draw review output with a sample draw package before enabling in production |

---

## 12. Secure SDLC Practices

All team members with commit access to the production repository are expected to follow:

- **No secrets in code:** API keys, passwords, and private keys must never be committed to the repository — use `.env` files (git-ignored) locally and Vercel env vars in production
- **Dependency hygiene:** Run `npm audit` before adding a new dependency; prefer well-maintained packages with a track record
- **Input validation:** All user-supplied inputs processed by API routes must be validated before use
- **Error messages:** Errors returned to the client must not include stack traces, internal paths, or sensitive system information — use the standardized error functions in `src/lib/errors.ts`
- **Test first:** Write failing tests before implementing behavior changes (TDD requirement in `CLAUDE.md`)
- **Least-privilege code:** New API routes must use `requireRole()` and `requireDealAccess()` before accessing any deal or user data

---

## 13. Related Documents

- [Incident Response Policy](INCIDENT_RESPONSE.md)
- [Backup and Disaster Recovery Policy](BACKUP_AND_RECOVERY.md)
- [Access Control Policy](ACCESS_CONTROL_POLICY.md)
- [Production Smoke Test](PRODUCTION_SMOKE_TEST.md)
- [CLAUDE.md](../CLAUDE.md) — development workflow rules
