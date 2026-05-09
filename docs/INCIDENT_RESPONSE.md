# Incident Response Policy

**Owner:** Operations  
**Last reviewed:** 2026-05-08  
**Review cadence:** Annually or after any SEV-1/SEV-2 incident  
**Contact:** operations@vektrum.io

---

## 1. Purpose

This policy defines how Vektrum detects, classifies, escalates, contains, remediates, and learns from security and operational incidents. It applies to all production systems: the Vektrum application (Vercel), the database (Supabase/Postgres), payment integrations (Stripe Connect), document integrations (DocuSign), AI providers, and email delivery (Resend).

---

## 2. Incident Severity Levels

| Severity | Definition | Examples | Response SLA |
|----------|-----------|---------|-------------|
| **SEV-1 Critical** | Active breach, data exposure, release gate bypassed, funds unauthorized | Confirmed unauthorized release; RLS bypass confirmed; service role key leaked; production DB compromised | Immediate — all hands |
| **SEV-2 High** | Probable breach or material system failure; financial operations impaired | Suspected unauthorized access; Stripe webhook pipeline failed > 1 hour; partner API key exposure suspected; auth system unavailable | Within 1 hour |
| **SEV-3 Medium** | Degraded service; no confirmed breach; recoverable failure | Stuck release (> 4 hours); DocuSign signing unavailable; AI review unavailable; reconciliation cron failure | Within 4 hours |
| **SEV-4 Low** | Minor disruption; no financial impact; workaround available | Single email delivery failure; non-critical route returning errors; demo system unavailable | Within 24 hours |

---

## 3. Detection Sources

Incidents may be discovered via:

- **Ops Dashboard** (`/dashboard/admin/ops`) — stuck approvals, failed payouts, stale Stripe webhook timestamps
- **Slack alerts** (`src/lib/engine/alerts.ts`) — automated alerts for critical business logic failures
- **Email notifications** (`src/lib/engine/notifications.ts`) — batched warning digests; immediate critical alerts
- **Admin Audit Log** (`/dashboard/admin`) — unusual admin actions, failed authorization attempts, IP-blocked access attempts
- **Audit Chain Health** (`/api/cron/audit-chain-health`) — hash-chain verification failures
- **External report** — partner, customer, security researcher via operations@vektrum.io
- **Supabase dashboard** — database error rates, connection exhaustion, RLS policy errors
- **Vercel dashboard** — function timeouts, error rate spikes, deployment failures
- **Stripe dashboard** — webhook delivery failures, transfer error rates

---

## 4. Incident Response Procedure

### Step 1: Detect and Triage (0–15 minutes)

1. Identify the incident source (alert, report, dashboard observation).
2. Assign an **Incident Commander** — the first responder owns the incident until it is resolved or formally handed off.
3. Classify severity (SEV-1 through SEV-4) using the table in Section 2.
4. Open an incident record (Slack thread, Linear ticket, or equivalent) with:
   - Timestamp of detection
   - Initial description
   - Severity classification
   - Affected systems

### Step 2: Contain (15–60 minutes for SEV-1/SEV-2)

**For suspected unauthorized access:**
- Revoke the suspect credential immediately: partner API key via `/dashboard/admin/partners`, admin session via Supabase Auth dashboard, service role key via Supabase project settings → regenerate
- Enable IP allowlist restriction for admin routes by setting `ADMIN_ALLOWED_IPS` in Vercel environment to a known-safe CIDR
- If production database access is suspect: contact Supabase support to temporarily restrict direct DB access

**For release gate bypass:**
- Verify via audit log (`/dashboard/admin` → Audit Log) whether any releases executed without proper conditions
- If a fraudulent release executed: do NOT attempt to reverse it via the application; escalate to Stripe directly and to the funder immediately
- Check `releases_stripe_active_unique` and `releases_external_active_unique` partial indexes are intact via Supabase SQL editor

**For data exposure:**
- Identify what data was exposed: query `audit_log` for recent reads by the suspect actor
- Assess whether personal data (names, emails, deal data) or financial data (amounts, payment references) was accessed
- If personal data was exposed: this may trigger notification obligations (see Section 7)

**For Stripe webhook pipeline failure:**
- Check `stripe_processed_events` table for recent entries; check Stripe dashboard webhook log
- Manually replay failed webhooks from Stripe dashboard if safe to do so
- Stuck payout states: use `/api/admin/reconciliation/*` to investigate and resolve

### Step 3: Investigate (parallel with containment for SEV-1/SEV-2)

1. Pull the affected time range from `audit_log` — query by `entity_id`, `actor_id`, or `action` type
2. Verify audit chain integrity for the affected period: call `/api/cron/audit-chain-health` and inspect result
3. Check `admin_audit_log` for unusual privileged operations in the surrounding window
4. Check Supabase auth logs for unusual sign-in patterns, geographic anomalies, or failed auth attempts
5. Check Vercel function logs for the affected routes during the incident window
6. Document: what happened, when, which actor or system, what data or operations were affected

### Step 4: Eradicate (resolve root cause)

1. Patch the underlying vulnerability or misconfiguration
2. Rotate any credentials that were or may have been exposed:
   - Stripe secret key → regenerate in Stripe dashboard, update Vercel env
   - `SUPABASE_SERVICE_ROLE_KEY` → regenerate in Supabase dashboard, update Vercel env
   - Partner API key → revoke in `/dashboard/admin/partners`, issue new key to partner
   - `STRIPE_WEBHOOK_SECRET` → rotate in Stripe dashboard, update Vercel env
   - `DOCUSIGN_WEBHOOK_SECRET` → update in Vercel env, update in DocuSign Connect configuration
3. Deploy the fix to production
4. Run post-deploy smoke test: `/docs/PRODUCTION_SMOKE_TEST.md`
5. Verify audit chain is healthy post-fix: `/api/cron/audit-chain-health`

### Step 5: Recover (restore normal operations)

1. Confirm all automated alerts are clear (ops dashboard, Slack, email)
2. Confirm Stripe webhook pipeline is processing (check `stripe_processed_events` for new entries)
3. Confirm no stuck releases remain (ops dashboard → Release Health)
4. If any releases were held during the incident, verify gate conditions are still valid before allowing release to proceed
5. Remove any temporary access restrictions (IP allowlist tightening) once root cause is resolved

### Step 6: Post-Incident Review (within 5 business days)

For all SEV-1 and SEV-2 incidents, conduct a blameless post-incident review:

1. Timeline reconstruction: what happened, minute by minute
2. Root cause analysis: what was the underlying cause
3. Contributing factors: what made it possible or harder to detect
4. What worked: what detection/response mechanisms functioned correctly
5. What didn't work: what slowed detection, containment, or recovery
6. Action items: specific changes to prevent recurrence and improve response
7. Document the review in `docs/incidents/YYYY-MM-DD-[description].md`

---

## 5. Escalation Matrix

| Severity | Who to notify | How | When |
|----------|-------------|-----|------|
| SEV-1 | All team members with production access | Slack (immediate) + direct message | Within 15 minutes of detection |
| SEV-2 | Incident Commander + operations lead | Slack channel + email | Within 30 minutes of detection |
| SEV-3 | Incident Commander | Slack alert | Within 4 hours |
| SEV-4 | Assigned team member | Linear ticket | Within 24 hours |

---

## 6. Communication Templates

### Internal Slack: Incident Declared

```
🚨 INCIDENT DECLARED — [SEV LEVEL]
System: [affected system]
Detection time: [timestamp]
Initial impact: [what is affected]
Incident Commander: [name]
Thread: [link to tracking thread]
Status: Investigating / Containing / Recovering
```

### Internal Slack: Incident Resolved

```
✅ INCIDENT RESOLVED — [SEV LEVEL]
Duration: [start] → [end] ([X hours Y minutes])
Impact: [what was affected and for how long]
Root cause: [brief description]
Mitigations applied: [what was done]
Post-mortem: [link or "scheduled for [date]"]
```

### Customer / Partner Notification (for data exposure or service disruption)

```
Subject: Vektrum Service Notice — [Date]

We are writing to inform you of [a service disruption / a security event] that affected [describe scope].

What happened: [clear, plain-English description]
When it occurred: [start time] to [end time]
What was affected: [systems, data, operations]
What data may have been involved: [describe if applicable, or "no customer data was affected"]
What we have done: [containment and remediation steps]
What you should do: [if any action is required from the customer]
How to reach us: operations@vektrum.io

We are committed to transparency about incidents that affect your operations. A full post-incident report will be shared within [5 business days].
```

---

## 7. Breach Notification Obligations

If personal data (name, email, company, or financial-adjacent data) is confirmed exposed or accessed without authorization:

- **Assess notification scope:** How many individuals? Which data categories? Was financial data involved?
- **CCPA (California):** Notify affected California residents "in the most expedient time possible" — no specific deadline but breach notification laws apply to unauthorized access to personal information
- **GDPR (if applicable):** Notify supervisory authority within 72 hours of discovery; notify affected individuals "without undue delay" if high risk to their rights
- **Consult legal counsel** before issuing any public breach notification
- **Document the decision** whether to notify — even a decision not to notify must be documented with reasoning

---

## 8. External Reporting

**Security vulnerability reports:**  
operations@vektrum.io — acknowledged within 24 hours

**Responsible disclosure:**  
We do not currently operate a bug bounty program. We commit to working in good faith with researchers who report vulnerabilities responsibly. We will not pursue legal action against good-faith disclosures.

---

## 9. Evidence Preservation

For all SEV-1 and SEV-2 incidents:

1. Export the `audit_log` for the affected time range before any remediation that might alter system state
2. Save Vercel function logs (download from Vercel dashboard before 30-day retention expires)
3. Save Supabase auth logs for the affected period
4. Save Stripe dashboard webhook delivery log for the affected period
5. Do not delete or overwrite any logs related to the incident until the post-incident review is complete

---

## 10. Related Documents

- [Backup and Disaster Recovery](BACKUP_AND_RECOVERY.md)
- [Access Control Policy](ACCESS_CONTROL_POLICY.md)
- [Production Smoke Test](PRODUCTION_SMOKE_TEST.md)
- [AI Downtime Plan](ai-downtime-plan.md)
- [Ops Dashboard guide](ops/)
