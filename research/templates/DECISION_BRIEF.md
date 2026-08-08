# Decision Brief — <TITLE>

**Date:** YYYY-MM-DD · **Analyst:** vektrum-market-researcher · **Geography:** <US> · **Horizon:** <period>
**Status:** Draft / Final · **Supersedes:** <brief or none>

> Copy this file to `research/briefs/YYYY-MM-DD-<slug>.md`. Delete the guidance in blockquotes before finalizing. Answer first — the research diary belongs at the bottom or nowhere.

---

## 1. Decision and scope

**Decision being supported:** <one sentence — a choice someone will make, not a topic>
**Decision owner:** <who>
**Reversibility:** <cheap and reversible / expensive and sticky> — *this sets the evidence bar*
**In scope:** <segments, geography, time period>
**Out of scope:** <explicitly excluded, and why>
**Completion criteria for this brief:** <what had to be true to finish>

---

## 2. Executive answer

> Three to six sentences. The answer, the confidence, and the one thing that would change it. If a reader stops here, they should still be able to act — or know why they shouldn't.

**Answer:** <...>
**Confidence:** High / Medium / Low / **Insufficient**
**If you read nothing else:** <the single most decision-relevant sentence>

---

## 3. Key findings

> Ranked by decision impact, not by discovery order. Every finding labeled and cited. Aim for 5–8. A finding that doesn't move the decision isn't a finding, it's trivia.

1. `[FACT S-0xx]` <finding> — *why it matters:* <...>
2. `[INFERENCE]` <finding, derived from S-0xx and S-0yy because ...> — *why it matters:* <...>
3. `[HYPOTHESIS]` <finding> — *validation method:* <...>

---

## 4. Evidence table

| # | Claim | Label | Source ID(s) | Verification | Primary? | Independent corroboration | Notes |
|---|-------|-------|--------------|--------------|----------|--------------------------|-------|
| 1 | | `[FACT]` | S-0xx | VERIFIED | Yes | S-0yy | |
| 2 | | `[HYPOTHESIS]` | S-0xx | UNVERIFIED-SNIPPET | Yes | **None — single-sourced** | Cannot anchor a recommendation |

> Any row with no corroboration must say **single-sourced** in words. Any row at `UNVERIFIED-SNIPPET` cannot carry `[FACT]`.

---

## 5. Segment / option comparison

> Identical criteria across every option. Selective criteria produce flattering, useless comparisons. Show the rubric.

**Scoring rubric:** <1–5 scale definition per criterion, and the weights>

| Criterion | Weight | Option A | Option B | Option C | Evidence |
|-----------|--------|----------|----------|----------|----------|
| Buying authority match | | | | | S-0xx |
| Urgency of problem | | | | | |
| Population size | | | | | |
| Draw / transaction frequency | | | | | |
| Integration complexity | | | | | |
| Procurement friction | | | | | |
| Willingness to pilot | | | | | |
| **Weighted total** | | | | | |

**Where the scores are weakest:** <name the criteria carried by hypothesis rather than evidence — these are what the comparison actually rests on>

---

## 6. Recommendation and rationale

**Recommendation:** <what to do — or, explicitly, "no recommendation; evidence is insufficient">

**Rationale:** <the causal chain, referencing findings by number>

**What this commits:** <time, money, focus>
**What this forecloses:** <options given up>

> If the confidence level is Insufficient, this section says so plainly and moves straight to §11. **Never manufacture a winner to look decisive.**

---

## 7. Counterevidence and risks

> This section is mandatory and must be substantive. A brief with a thin counterevidence section is presumed incomplete, not presumed strong. Say what you searched for that would have contradicted you.

**Disconfirming evidence found:**
- `[FACT S-0xx]` <evidence pointing the other way> — *why it doesn't overturn the recommendation, or why it partly does*

**Disconfirming evidence deliberately sought but not found:**
- <what you searched for, where, and what it would have meant if found>

**Key risks:**

| Risk | Likelihood | Impact | Early warning signal | Owner |
|------|-----------|--------|---------------------|-------|
| | | | | |

---

## 8. Confidence level

**Overall:** High / Medium / Low / Insufficient

**Why this level:**
- Sources: <count verified vs unverified vs single-sourced>
- Primary evidence: <what kind, how much>
- Counterevidence: <sought? found? weight?>
- Weakest link: <the input whose failure would most damage the conclusion>

**What would raise it to the next level:** <specific, actionable>

---

## 9. Assumptions

> Every assumption this recommendation stands on, with its register ID. If an assumption isn't in `ASSUMPTIONS_AND_QUESTIONS.md`, add it there now.

| ID | Assumption | Confidence | If wrong, what breaks |
|----|-----------|-----------|----------------------|
| A-xx | | | |

---

## 10. What would falsify this recommendation

> Pre-register the falsification tests. Committing in advance to what would change your mind is the main defense against motivated reasoning — and it's only meaningful if written before the evidence arrives.

| # | If we observed... | ...the recommendation would | How we'd observe it | By when |
|---|-------------------|----------------------------|--------------------|---------|
| 1 | | flip / weaken / survive | | |

---

## 11. Next validation actions

> Ranked by information gained per dollar and per day. The top item is the single highest-value next move — name one, not nine.

| # | Action | Answers | Cost | Time | Owner |
|---|--------|---------|------|------|-------|
| 1 | | | $0 | | |

**Single highest-value next action:** <one>

---

## 12. Sources

> Every source ID cited above, with verification status visible. Full detail in `research/SOURCE_LOG.csv`.

| ID | Title | Publisher | Date | Type | Verification |
|----|-------|-----------|------|------|--------------|
| S-0xx | | | | | |

---

## Quality gate confirmation

Run `research/templates/QUALITY_CHECKLIST.md` before finalizing. Confirm here:

- [ ] All gates passed
- [ ] Gates that required a revision: <which, and what changed>
