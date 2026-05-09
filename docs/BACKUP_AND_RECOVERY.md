# Backup and Disaster Recovery Policy

**Owner:** Operations  
**Last reviewed:** 2026-05-08  
**Review cadence:** Annually; tested quarterly  
**Contact:** operations@vektrum.io

---

## 1. Purpose

This policy defines Vektrum's backup strategy, recovery objectives, and disaster recovery procedures for all production systems. Vektrum is a non-custodial authorization platform — funds are never held by Vektrum — but the release authorization records, audit trail, deal data, and partner integration configuration represent critical business data that must be recoverable in the event of infrastructure failure.

---

## 2. Systems in Scope

| System | Provider | Data Stored | Criticality |
|--------|---------|------------|-------------|
| Application database | Supabase (Postgres on AWS) | Deals, milestones, releases, audit log, contracts, SOV, profiles, partner configuration | **Critical** |
| Application code | Vercel (deployment) + Git (source) | Next.js application source | **Critical** |
| Environment configuration | Vercel (env vars) + 1Password / secure vault | API keys, secrets, service role key | **Critical** |
| File storage | Supabase Storage (S3-backed) | Contract PDFs, lien waivers, draw documents, milestone photos | **High** |
| Email delivery | Resend | Transactional email delivery logs | **Low** |
| Payment state | Stripe | Transfer records, Connect account state | **Critical** (Stripe-owned) |

---

## 3. Recovery Objectives

| System | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) | Notes |
|--------|------------------------------|-------------------------------|-------|
| Application database | 4 hours | 24 hours | Supabase daily backups; point-in-time recovery (PITR) may reduce RPO |
| Application code | 1 hour | 0 (Git is source of truth) | Redeploy from Git at any commit |
| Environment configuration | 2 hours | 0 (stored in vault) | Secrets can be re-entered from vault into Vercel |
| File storage | 8 hours | 24 hours | Supabase Storage; files can be re-uploaded by users if lost |
| Stripe payment state | N/A | N/A | Stripe maintains their own infrastructure; Vektrum reconciles from Stripe API |

These are targets for a pre-revenue, early-pilot stage company. They will be tightened as the customer base grows.

---

## 4. Database Backup Strategy

### Supabase Automated Backups

Supabase provides automated backups on all paid plans:

- **Backup frequency:** Daily automated snapshots
- **Retention period:** 7 days (Pro plan) / 30 days (Team/Enterprise plan)
- **Backup type:** Full logical backup of the Postgres database
- **Storage location:** Managed by Supabase on AWS S3; geographically redundant within the AWS region

**To verify current backup configuration:**
1. Log in to Supabase dashboard → Project → Settings → Database
2. Confirm "Point in Time Recovery" or "Database Backups" section shows active backups
3. Confirm backup retention period matches the plan

### Point-in-Time Recovery (PITR)

If Supabase PITR is enabled on the current plan, the RPO reduces from 24 hours to approximately 1–5 minutes (WAL-based recovery). Confirm whether PITR is enabled in the Supabase dashboard under Settings → Database → Point in Time Recovery.

**Recommendation:** Enable PITR as soon as the first paying customer is onboarded.

### Database Migration Safety Net

All schema changes are managed through versioned migrations in `supabase/migrations/`. In a worst-case scenario where the database must be rebuilt from scratch, the migration history is sufficient to reconstruct the full schema. Application data (deal records, audit logs) cannot be reconstructed from migrations — only schema structure can.

---

## 5. Application Code Backup

Application source code is stored in Git. The Git repository is the authoritative source of truth. Vercel deployments are pinned to specific Git commits.

**Recovery procedure for application code:**
1. Any commit in the Git history can be redeployed to Vercel in approximately 3–5 minutes
2. No application code backup is required beyond the Git repository itself
3. Ensure at least two team members have admin access to both the Git repository and the Vercel project

---

## 6. Environment Configuration Backup

Production environment variables (API keys, secrets) are stored in Vercel. The raw values must also be maintained in a secure secrets vault (1Password, Bitwarden, HashiCorp Vault, or equivalent) independent of Vercel.

**Variables that must be vaulted (from `.env.example`):**

| Variable | Rotation | Stored In |
|----------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | On team member departure or suspected exposure | Vault + Vercel |
| `STRIPE_SECRET_KEY` | Annually or on exposure | Vault + Vercel |
| `STRIPE_WEBHOOK_SECRET` | On rotation of Stripe webhook | Vault + Vercel |
| `DOCUSIGN_PRIVATE_KEY` | Annually | Vault + Vercel |
| `DOCUSIGN_WEBHOOK_SECRET` | On rotation | Vault + Vercel |
| `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` | On exposure | Vault + Vercel |
| `VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC` | With private key rotation | Vault + Vercel |
| `RESEND_API_KEY` | Annually | Vault + Vercel |
| `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Annually | Vault + Vercel |
| `CRON_SECRET` | Annually | Vault + Vercel |

**Recovery procedure for environment configuration:**
1. Open vault → locate Vektrum production secrets
2. Add secrets to Vercel: Project → Settings → Environment Variables
3. Trigger a Vercel redeploy to pick up the new variables
4. Run smoke test after redeployment

---

## 7. File Storage Backup

Contract PDFs, lien waivers, draw documents, and milestone photos are stored in Supabase Storage (S3-backed). Supabase Storage follows the same backup model as the database (daily snapshots).

Files uploaded by users are the authoritative source — they can be re-uploaded if lost. The database records (file metadata, signing status, audit records) are more critical than the raw files themselves.

---

## 8. Restore Procedures

### 8.1 Full Database Restore (Supabase)

**Trigger:** Database corruption, accidental data loss, infrastructure failure

1. Log in to Supabase dashboard → Project → Settings → Database → Backups
2. Select the most recent backup prior to the incident
3. Click "Restore" — this creates a new Supabase project or restores in-place (depending on plan)
4. Verify the restored database:
   ```sql
   -- Spot-check deal count
   SELECT COUNT(*) FROM deals;
   -- Verify audit log chain is intact
   SELECT COUNT(*) FROM audit_log;
   -- Check last 10 audit entries
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
   ```
5. Update the `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` in Vercel if the restored project has a new URL (new project restore scenario)
6. Run the audit chain health check: `POST /api/cron/audit-chain-health` with `CRON_SECRET`
7. Run the production smoke test: `docs/PRODUCTION_SMOKE_TEST.md`

**Estimated duration:** 30 minutes for Supabase to restore + 30 minutes for verification = ~1 hour

### 8.2 Partial Data Recovery (Specific Tables)

**Trigger:** Accidental deletion of specific records (unlikely given no DELETE policies on core tables, but possible for supporting tables)

1. Use Supabase PITR (if enabled) to create a point-in-time snapshot just before the loss event
2. Connect to the PITR snapshot database
3. Export the affected table: `pg_dump -t affected_table -h [pitr-host] -U postgres vektrum > recovery.sql`
4. Import into production: review carefully before importing; coordinate with the investigation to understand scope of loss
5. Log the recovery action to `admin_audit_log` manually if the audit log itself cannot capture it

### 8.3 Application Redeploy (Code or Infrastructure)

**Trigger:** Vercel deployment failure, corrupted deployment, accidental deletion of project

1. Identify the last known-good Git commit (check Vercel deployment history or `git log`)
2. Deploy that commit via Vercel: `vercel deploy --prod` or trigger via Vercel dashboard
3. Verify environment variables are intact in Vercel (they persist across deployments unless manually deleted)
4. Run smoke test

**Estimated duration:** 5–10 minutes for redeploy + 30 minutes smoke test

### 8.4 Credential Rotation After Exposure

**Trigger:** Any credential suspected of exposure (see Incident Response policy)

| Credential | Rotation Steps |
|-----------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → Regenerate; update Vercel; redeploy |
| `STRIPE_SECRET_KEY` | Stripe dashboard → API Keys → Roll key; update Vercel; redeploy |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks → Roll signing secret; update Vercel; redeploy |
| Partner API key | `/dashboard/admin/partners` → Revoke key → Issue new key → Notify partner |
| `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` | Generate new ed25519 keypair; update Vercel; all existing tokens issued with old key become unverifiable; notify partners |

---

## 9. Quarterly Restore Test

**Frequency:** Once per quarter  
**Owner:** Operations

To verify that backups are restorable:

1. Create a Supabase branch (or use the Supabase "fork" feature in supported plans) from the most recent production backup
2. Run the following verification queries:
   ```sql
   SELECT COUNT(*) FROM deals;
   SELECT COUNT(*) FROM milestones;
   SELECT COUNT(*) FROM releases;
   SELECT COUNT(*) FROM audit_log;
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
   ```
3. Verify that the record counts are consistent with production (allow for < 24 hours of lag)
4. Run the audit chain health check against the restored branch
5. Document the test result in `docs/incidents/restore-test-YYYY-MM-DD.md`:
   - Date of test
   - Backup date used
   - Record counts verified
   - Chain health result
   - Pass / Fail
   - Any anomalies

---

## 10. Disaster Recovery Scenarios

### Scenario A: Complete Supabase project unavailable

**Cause:** Supabase infrastructure outage (AWS region failure)  
**Impact:** Application database unreachable; no releases can be authorized; dashboard unavailable  
**Response:**
1. Confirm outage is Supabase-side via status.supabase.com
2. Do not attempt local fixes — wait for Supabase to restore service
3. Communicate to active customers via Statuspage (or direct email if no Statuspage)
4. Once Supabase restores: run smoke test to confirm all functions restored
5. Review `stripe_processed_events` for any webhooks received during outage that need replay
6. Run reconciliation cron: `POST /api/cron/reconcile` to catch any missed events

### Scenario B: Vercel deployment unavailable

**Cause:** Vercel infrastructure outage  
**Impact:** Application frontend and API routes unreachable  
**Response:**
1. Confirm outage via vercel-status.com
2. Supabase data is unaffected and intact
3. Wait for Vercel to restore; redeploy from last known-good commit if Vercel recovers but deployment is corrupted
4. Communicate to customers

### Scenario C: Stripe payment processing degraded

**Cause:** Stripe Connect infrastructure issues  
**Impact:** Stripe-rail releases may fail or stall  
**Response:**
1. Check status.stripe.com
2. Existing active transfers may auto-recover when Stripe restores service
3. For funders on external/manual rail: no impact — releases can proceed through partner confirmation
4. Run reconciliation cron post-recovery to verify all pending transfers settled correctly
5. For any transfer that failed permanently: use `/api/releases/[id]/retry` after Stripe recovery, or escalate to manual resolution

### Scenario D: Critical security breach (data exfiltration)

**Refer to:** [Incident Response Policy](INCIDENT_RESPONSE.md), Section 4, Step 2 (Contain)

---

## 11. Related Documents

- [Incident Response Policy](INCIDENT_RESPONSE.md)
- [Access Control Policy](ACCESS_CONTROL_POLICY.md)
- [Production Smoke Test](PRODUCTION_SMOKE_TEST.md)
