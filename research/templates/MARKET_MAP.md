# Market Map — <SEGMENT / WORKFLOW>

**Date:** YYYY-MM-DD · **Geography:** <US> · **Analyst:** vektrum-market-researcher
**Purpose:** describe how construction funds actually move from draw request to payment, who touches them, where the workflow fails, and where an authorization layer could sit.

> Every box, actor, and number below is labeled and cited. A market map with unlabeled claims is a diagram of assumptions.

---

## 1. The workflow, end to end

> Trace the real path, not the idealized one. Note where the path forks by segment or by rail.

```
<Draw request originated by ...>
        ↓
<Documentation assembled: ...>
        ↓
<Verification / inspection: ...>
        ↓
<Review and approval: who, how long, what tooling>
        ↓
<Authorization decision: who holds it, what makes it binding>
        ↓
<Payment execution: which rail, who initiates, who bears risk>
        ↓
<Reconciliation and record: what is retained, by whom, for how long>
```

**Where Vektrum's gate would sit:** <exact step>
**What must already exist upstream for the gate to evaluate:** <inputs>
**What happens downstream that Vektrum does not control:** <execution, custody>

---

## 2. Actors

| Actor | Role in the workflow | What they optimize for | What they fear | Authority over release? | Evidence |
|-------|---------------------|----------------------|----------------|------------------------|----------|
| Funder / lender | | | | | S-0xx |
| Loan administrator | | | | | |
| Draw inspector | | | | | |
| Title / escrow participant | | | | | |
| General contractor | | | | | |
| Subcontractor | | | | | |
| Developer / borrower | | | | | |
| Fund control company | | | | | |

> **Authority column is the important one.** Vektrum's release trigger belongs to the funder (`VEKTRUM_CONTEXT.md` §3). Any actor with no release authority is a user or influencer — never assume they are a buyer.

---

## 3. Incentives and conflicts

| Actor pair | Aligned on | In tension over | Consequence for adoption |
|-----------|-----------|-----------------|-------------------------|
| Lender ↔ contractor | | speed vs. verification | |
| Lender ↔ inspector | | | |
| Developer ↔ lender | | | |

> Conflicts are where enforcement software either gets bought or gets blocked. The party that loses discretion when a gate is installed is the party that will resist it — name them explicitly.

---

## 4. Bottlenecks and handoffs

| # | Step | Bottleneck | Typical delay | Who absorbs the cost | Evidence |
|---|------|-----------|--------------|---------------------|----------|
| 1 | | | | | S-0xx |

---

## 5. Failure points

> The core thesis lives here. Each failure mode needs a documented, dated instance — not a vendor statistic and not an assertion.

| # | Failure mode | How it happens | Frequency evidence | Cost evidence | Would Vektrum's gate prevent it? | Which condition |
|---|-------------|----------------|--------------------|--------------|----------------------------------|-----------------|
| 1 | Release without required lien waiver | | | | | Condition 10 |
| 2 | Duplicate release on one milestone | | | | | Condition 6 |
| 3 | Release with open change order | | | | | Condition 7 |
| 4 | Over-advance beyond funded balance | | | | | Condition 3 |
| 5 | Release before contract execution | | | | | Condition 8 |

> **Honesty requirement:** for each row, also state what the gate would *not* have prevented. A gate enforces conditions; it does not detect fraud inside documents that satisfy those conditions (`VEKTRUM_CONTEXT.md` §4). Overstating gate coverage is the fastest way to lose a technical buyer.

---

## 6. Segments within this market

| Segment | Defining attributes | Population estimate | Source | Draw frequency | Current tooling |
|---------|--------------------|--------------------|--------|----------------|-----------------|
| | | | S-0xx | | |

---

## 7. Trends, technology shifts, and catalysts

| # | Trend | Evidence | Direction of effect on Vektrum | Confidence |
|---|-------|----------|-------------------------------|-----------|
| 1 | | S-0xx | tailwind / headwind / neutral | |

> Include headwinds. A trends section listing only tailwinds is marketing, not research. Incumbent AI capability moving toward automated draw decisions is a headwind and belongs here whenever it is current.

---

## 8. Where an authorization layer can sit

| Insertion point | What it requires | Integration cost | Who must agree | Viability |
|----------------|-----------------|-----------------|----------------|-----------|
| Standalone before execution | | | | |
| Embedded in lender core system | | | | |
| Embedded in an existing draw platform | | | | |
| Via title / escrow partner | | | | |

---

## 9. Open questions from this map

| # | Question | Why it matters | How to answer | Register ID |
|---|----------|---------------|--------------|-------------|
| 1 | | | | A-xx |

---

## 10. Sources

| ID | Title | Publisher | Date | Verification |
|----|-------|-----------|------|--------------|
| S-0xx | | | | |
