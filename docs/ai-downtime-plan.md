# AI Downtime Plan

_Last updated: 2026-04-23. Owner: Operations (operations@vektrum.io)._

This document describes how Vektrum behaves when one or more of its AI
providers is degraded or unavailable, and the operational procedure for
keeping releases moving without compromising governance.

It is written to be accurate to the code in `src/lib/engine/ai-provider.ts`,
`src/lib/engine/release-gate.ts`, and
`src/app/api/admin/milestones/[milestoneId]/override-ai-review/route.ts`.
If code and this document diverge, the code is the source of truth and
this document must be updated.

---

## 1. Scope

Vektrum uses AI in three places:

1. **Draw review** (`/api/ai/draw-review`). An AI-assisted review of the
   submitted evidence for a milestone draw. A valid review (or an admin
   override) is a **precondition** for any release, enforced server-side
   by `checkAiPrecondition` before the 10-condition release gate runs.
2. **Contract analyzer** (`/api/ai/contract-analyzer`). Pre-deal review of
   the uploaded contract. Advisory only. Not gating.
3. **Platform assistant** (`/api/ai/assistant`). In-app Q&A. Advisory only.
   Not gating.

Only draw review is on the release path. This plan focuses on draw review.

---

## 2. Providers and model versions

Draw review uses a three-provider ordered chain configured in
`src/lib/engine/ai-provider.ts`:

| Order | Provider   | Model                     | Notes              |
| ----- | ---------- | ------------------------- | ------------------ |
| 1     | Perplexity | `sonar-pro`               | Primary            |
| 2     | Anthropic  | `claude-sonnet-4-20250514`| First fallback     |
| 3     | OpenAI     | `gpt-4o`                  | Second fallback    |

Contract analyzer and platform assistant call **Perplexity only** and do
not fall back. They are not on the release path.

---

## 3. Normal behaviour

1. Contractor submits a draw request.
2. `/api/ai/draw-review` calls Perplexity `sonar-pro`.
3. If the response is non-2xx, throws, or parses as invalid JSON, the
   orchestrator moves to Anthropic, then to OpenAI.
4. The first successful, parseable response is written to the immutable
   audit log as an `ai_draw_review` entry with `risk_level`, `score`,
   `findings`, `recommendation`, `reasoning`, the provider name, and the
   model string.
5. `checkAiPrecondition` accepts a review that is:
   - less than 48 hours old, **and**
   - not `risk_level === 'critical'`.

If the review fails either check, the release is blocked.

---

## 4. Failure modes and code behaviour

### 4.1 All three providers fail at request time

The `runDrawReview` orchestrator throws after exhausting every provider.
`/api/ai/draw-review` returns a 5xx. No `ai_draw_review` audit entry is
written. The release remains blocked by `checkAiPrecondition`.

### 4.2 A provider returns malformed or untrusted output

`parseAssessment` in `ai-provider.ts` returns a synthetic assessment
with `risk_level: 'critical'`, `score: 0`, and a `recommendation: 'hold'`.
Because `checkAiPrecondition` rejects `critical` reviews, this **blocks
the release** rather than silently passing.

This is deliberate. A `'high'` fallback would have satisfied
`checkAiPrecondition` (which only rejects `'critical'`), so a malformed
provider response could have been used to bypass review. The audit entry
captures the raw provider output (first 500 chars) for later forensics.

### 4.3 An existing review is older than 48 h

`checkAiPrecondition` falls through to check for an admin override
before failing. If there is none, the release is blocked with reason
"AI precondition has not been satisfied within the 48-hour window."

### 4.4 An existing review is `critical`

Release is blocked. No automated path around this. An admin may issue an
override only **after** a new non-critical review exists — the override
endpoint refuses to issue an override while a critical review is in
effect (enforced in
`src/app/api/admin/milestones/[milestoneId]/override-ai-review/route.ts`).

---

## 5. Admin override (emergency bypass)

When all three providers are down and a release must move, an admin with
active AAL2 MFA may issue a time-boxed override:

- **Endpoint.** `POST /api/admin/milestones/:milestoneId/override-ai-review`.
- **Auth.** Admin role + AAL2 (MFA) verified in the current session.
  Non-MFA admin sessions are rejected.
- **TTL.** Configurable via `AI_ADMIN_OVERRIDE_TTL_HOURS` env var.
  Default **4 hours**. Minimum clamped to 1 hour.
- **Block on critical.** Overrides may not be created while a critical
  review is in effect for the milestone.
- **Audit.** Every override writes an `ai_review_admin_override` entry
  containing the admin actor, timestamp, reason, and the TTL used. The
  audit log is append-only and hash-chained; overrides cannot be edited
  or deleted.
- **Funder approval still required.** The override only satisfies the AI
  precondition. The 10-condition release gate must still pass, and only
  the **funder** of the deal can trigger the release. Admins cannot
  release funds directly — this is a deliberate security boundary.

---

## 6. Operational runbook

Trigger: a provider 5xx rate spike, a sustained OAuth failure, or a user
report that `/api/ai/draw-review` is returning errors.

1. **Detect.** Ops dashboard surfaces provider success rate per route.
   A sustained failure rate on all three draw-review providers within a
   5-minute window is the escalation threshold.
2. **Verify.** Check each provider's own status page (Perplexity,
   Anthropic, OpenAI) and confirm the outage is upstream, not a Vektrum
   bug.
3. **Communicate.** Post to the internal operations channel and email
   any funder with a release pending in the last hour.
4. **Decide.** If one of the three providers is healthy, the fallback
   chain is already handling it. No action needed. If all three are
   unhealthy and a release must move, proceed to step 5.
5. **Override.** An on-call admin with AAL2 MFA issues a single-
   milestone override via the override endpoint, with a written reason.
6. **Release.** The deal funder triggers the release. The 10-condition
   gate still enforces every other condition.
7. **Post-mortem.** When providers recover, request a fresh draw review
   for the affected milestones. Record the incident, the overrides
   issued, and the TTL used in the monthly ops review.

---

## 7. What this plan does not claim

- It does not claim zero-downtime AI. Three providers dramatically
  reduce the probability of a total outage, but do not eliminate it.
- It does not claim the admin override is self-healing. An override is
  a human action with a short TTL and an audit-log footprint. It is not
  a silent fallback.
- It does not claim the contract analyzer or platform assistant have
  provider fallback. They are Perplexity-only. If Perplexity is down,
  those endpoints fail. Neither is on the release path.

---

## 8. Configuration reference

| Variable                           | Default | Purpose                                                         |
| ---------------------------------- | ------- | --------------------------------------------------------------- |
| `PERPLEXITY_API_KEY`               | _unset_ | Required for draw review, contract analyzer, assistant          |
| `ANTHROPIC_API_KEY`                | _unset_ | Required for draw review fallback (provider 2)                  |
| `OPENAI_API_KEY`                   | _unset_ | Required for draw review fallback (provider 3)                  |
| `AI_ADMIN_OVERRIDE_TTL_HOURS`      | `4`     | TTL on an admin-issued AI precondition override (min 1 hour)    |

Draw-review freshness (48 h) is a code constant
(`FORTY_EIGHT_HOURS_MS` in `release-gate.ts`). Changing it requires a
code change, a migration path for in-flight reviews, and a review of
this document.

---

## 9. Monitoring and alerts

Required signals (Ops dashboard, `dashboard/admin/ops/page.tsx`):

- 5-minute rolling success rate per provider on `/api/ai/draw-review`.
- Count of `ai_review_admin_override` entries written in the last 24 h.
- Count of draw reviews with `risk_level = 'critical'` in the last 24 h.
- Count of milestones where `checkAiPrecondition` returned `passed: false`
  in the last 24 h.

A sustained failure on all three providers or an abnormal override
volume (> 3 per day) should page the on-call operator.

---

## 10. Revision policy

This document is part of the diligence record. Any change to provider
order, override TTL semantics, release-gate coupling, or the definition
of "valid review" must ship with an update here **in the same pull
request** as the code change. Reviewers should reject diffs that touch
the files listed at the top of this document without a corresponding
update to this plan.
