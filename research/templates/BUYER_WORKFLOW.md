# Buyer Workflow — <SEGMENT>

**Date:** YYYY-MM-DD · **Segment:** <...> · **Evidence base:** <n interviews, n documents> · **Analyst:** vektrum-market-researcher

**Purpose:** describe how this segment actually processes a draw today, and how a purchase decision actually gets made — as two separate workflows, because they are.

---

## Part A — The operational workflow (how a draw gets paid today)

### A1. Trigger

| Question | Answer | Evidence |
|----------|--------|----------|
| What starts a draw request? | | S-0xx |
| Who submits it? | | |
| What documentation accompanies it? | | |
| How is it transmitted? | | |

### A2. Step-by-step

| # | Step | Who does it | Tooling | Duration | What can go wrong |
|---|------|------------|---------|----------|-------------------|
| 1 | | | | | |

**Total cycle time, request to funds received:** <range, with source>
**Longest step:** <...>
**Step with the most rework:** <...>

### A3. Conditions actually checked today

> Map to Vektrum's ten public gate conditions. Be exact about *how* each is checked — a checklist item is not the same as an enforced condition.

| Vektrum condition | Checked today? | How | Enforced or advisory | Can it be skipped under pressure? | Evidence |
|-------------------|---------------|-----|---------------------|----------------------------------|----------|
| 1. Milestone approved | | | | | |
| 2. Protection status ready | | | | | |
| 3. Sufficient funded balance | | | | | |
| 4. Payout readiness | | | | | |
| 5. Contractor onboarding | | | | | |
| 6. No existing active release | | | | | |
| 7. No open change orders | | | | | |
| 8. Signed contract on file | | | | | |
| 9. Sequential prerequisites | | | | | |
| 10. Approved conditional lien waiver | | | | | |

> The "skipped under pressure" column is the wedge test. Ask about the *last time* it happened, not whether it *could*.

### A4. Where money physically moves

| Question | Answer | Evidence |
|----------|--------|----------|
| Who holds the funds before disbursement? | | |
| Who initiates the payment? | | |
| What rail? (wire / ACH / check / platform) | | |
| Who reconciles? | | |
| What proof is retained, and for how long? | | |

### A5. Failure incidents

> Documented, dated, specific. "It happens sometimes" is not evidence.

| # | What happened | When | Cost | Root cause | Which Vektrum condition would have blocked it | Evidence |
|---|--------------|------|------|-----------|----------------------------------------------|----------|
| 1 | | | | | | |

---

## Part B — The buying workflow (how a purchase decision gets made)

### B1. The buying committee

> Six distinct positions. One person may hold two, but never assume it. Name real roles from interviews.

| Position | Role title | What they care about | What they need to approve | Veto power? | Evidence |
|----------|-----------|---------------------|--------------------------|-------------|----------|
| **Economic buyer** — signs and owns the budget | | | | | |
| **Champion** — advocates internally | | | | | |
| **User** — operates it daily | | | | | |
| **Blocker** — can stop it (infosec, legal, IT) | | | | | |
| **Compliance reviewer** — approves the control posture | | | | | |
| **Release authority** — holds the disbursement decision | | | | | |

> For Vektrum, the **release authority is the funder** (`VEKTRUM_CONTEXT.md` §3). If the release authority in this segment is a *different organization* than the economic buyer, note that prominently — it is a structural sales problem, not a detail.

### B2. Purchase path

| # | Stage | Who drives | Typical duration | What can kill it here |
|---|-------|-----------|-----------------|----------------------|
| 1 | Problem recognition | | | |
| 2 | Internal advocacy | | | |
| 3 | Vendor evaluation | | | |
| 4 | Security / vendor risk review | | | **SOC 2 status — Vektrum is not certified** |
| 5 | Legal / contracting | | | |
| 6 | Budget approval | | | |
| 7 | Pilot | | | |
| 8 | Production rollout | | | |

**Total cycle time:** <range>
**Most common stall point:** <...>

### B3. Budget

| Question | Answer | Evidence |
|----------|--------|----------|
| Which budget line would fund this? | | |
| Who controls that line? | | |
| Annual or per-transaction budgeting? | | |
| Is a percentage-of-disbursement fee budgetable here, or does it need to be a fixed line? | | |
| What comparable vendors are already paid for from this line, and how much? | | |

> The percentage-fee question tests A-26 directly. A fee structure that cannot be budgeted is a deal blocker regardless of its size.

### B4. Triggers and blockers

**What creates urgency:** <examiner finding, loss event, audit, growth, staff turnover — with evidence>
**What blocks:** <no budget, no authority, security review, incumbent contract, no perceived problem>

---

## Part C — Implications

| Finding | Implication for Vektrum | Confidence |
|---------|------------------------|-----------|
| | | |

**Does this segment hold release authority?** yes / no / partly — *decisive for viability*
**Can a pilot run without integration?** yes / no
**Highest-value next question for this segment:** <one>

---

## Sources

| ID | Type | Date | Verification |
|----|------|------|--------------|
| S-0xx | Interview / document | | |
