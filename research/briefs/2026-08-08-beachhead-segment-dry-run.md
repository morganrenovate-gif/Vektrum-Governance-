# Decision Brief — Initial US Pilot Segment

**Date:** 2026-08-08 · **Analyst:** vektrum-market-researcher · **Geography:** United States `[ASSUMPTION A-1]` · **Horizon:** next 2 quarters
**Status:** Draft — **system validation dry run, deliberately limited scope**
**Supersedes:** none

> **Read this first.** This brief was produced as a validation run for the research system, on a deliberately limited evidence base (one desk-research pass, no interviews, and an environment where most government sources could not be fetched). It is included to demonstrate the citation, confidence, counterevidence, and falsification mechanics working end to end — **and to demonstrate the system correctly declining to name a winner on thin evidence.** Do not treat its conclusions as a completed segment analysis.

---

## 1. Decision and scope

**Decision being supported:** Which initial US pilot segment should Vektrum pursue first — construction lenders, private construction-credit funds, or real-estate developers?

**Decision owner:** Founder
**Reversibility:** Moderately sticky. Segment choice sets messaging, pilot design, integration priority, and roughly a quarter of calendar time. Recoverable, but not cheap.
**In scope:** US; the three named segments; beachhead selection only.
**Out of scope:** pricing validation (blocked, `VEKTRUM_CONTEXT.md` §7), market sizing (deferred to Phase 3), partnership strategy.
**Completion criteria:** either a segment recommendation at Medium+ confidence, or an explicit statement of what evidence is missing and how to get it.

---

## 2. Executive answer

**The evidence does not currently support choosing between construction lenders (H-SEG-1) and private construction-credit funds (H-SEG-2).** Every criterion that would separate them — buying authority, urgency, procurement friction, willingness to pilot — is presently carried by hypothesis rather than by evidence, and no primary demand evidence exists at all.

Two things *can* be said now. First, real-estate developers (H-SEG-3) should be **provisionally deprioritized** as a beachhead on a structural argument: Vektrum's release authority belongs to the funder, and a developer is typically the borrower — so a developer plausibly cannot buy enforcement over a decision another party controls. That argument is an `[INFERENCE]` from a verified product fact, and it needs one cheap test before it is acted on. Second, the single most urgent research task is not segment selection at all — it is verifying whether incumbent draw platforms now **enforce** release conditions, because Built shipped an agentic "Draw Agent" in November 2025 claiming automatic policy enforcement `[HYPOTHESIS S-004]`. If that claim is accurate, it stresses the wedge that all three segment cases depend on, and segment choice is the wrong question to answer first.

**Confidence: Insufficient** for the primary question. **Low** for the provisional developer deprioritization.

**If you read nothing else:** don't pick a segment this week — run the two kill tests first, because one of them could change what you're selling, not just who you sell it to.

---

## 3. Key findings

1. `[FACT S-INT-001, S-INT-002]` **Release authority belongs to the funder.** Positioning source of truth §8 states releases are funder-initiated and admins cannot release; the code registry enforces `ACTOR_AUTHORIZED` as a gate condition. This is verified in code, not just claimed in docs. *Why it matters:* it is the hardest constraint on who can buy, and it applies before any market consideration.

2. `[INFERENCE]` **Developers likely cannot buy the core enforcement value.** Derived from finding 1: if the funder holds release authority and the developer is the borrower, the developer can request enforcement but cannot install it over the funder's decision. *Why it matters:* it demotes the most accessible, highest-pain segment. *Caveat:* untested against structures where a developer self-funds subcontractor draws, which would break the inference. Registered as A-6, Phase 0 kill test #1.

3. `[HYPOTHESIS S-004]` **Incumbent AI may be moving from advisory to deciding.** Built announced an agentic "Draw Agent" on 2025-11-04, described as approving draws in under three minutes and enforcing each lender's policies automatically. *Why it matters:* Vektrum's differentiation rests on enforcement-vs-record-keeping and AI-as-precondition-vs-AI-as-approver (`VEKTRUM_CONTEXT.md` §4). This claim stresses both. *Caveat:* a press release is a marketing claim, not a capability specification, and it is `UNVERIFIED-SNIPPET`. "Approve" in a headline may still mean "recommend to a human approver."

4. `[HYPOTHESIS S-005]` **Incumbent penetration in the lender segment may be high.** Built claims 300+ lenders including 17 of the top 25 US lenders. *Why it matters:* if roughly accurate, H-SEG-1 is largely a displacement or embedding market rather than a greenfield one, which raises the bar and argues for a partnership path. *Caveat:* undated, unaudited vendor self-report.

5. `[FACT]` **Vektrum's own materials are not evidence about competitors.** The handbook asserts that Built, Land Gorilla, and Rabbet track rather than enforce (§23), but this is `[INTERNAL]` and has never been independently verified. *Why it matters:* the central competitive claim is currently unsourced. Registered as A-12/A-19.

6. `[HYPOTHESIS S-007, S-008]` **At least two states run dedicated regimes over construction disbursement control.** California licenses joint control agents under the Escrow Law, with the burden of proving an exemption on the party claiming it; Nevada licenses and bonds "construction controls" under NRS Ch. 627, with express exemptions for banks and title insurers. *Why it matters:* whether an authorization-only party falls inside or outside these regimes is a question for counsel that could gate a pilot. *This is not a legal conclusion and must not be read as one.*

7. `[FACT]` **No primary demand evidence exists.** Zero interviews conducted. Every urgency, authority, and willingness-to-pay input across all three segments is currently hypothesis. *Why it matters:* this alone caps the achievable confidence at Insufficient, regardless of how much desk research is added.

8. `[FACT — direct observation]` **Most government primary sources could not be verified in this environment.** `WebFetch` returned `EGRESS_BLOCKED` for census.gov, fred.stlouisfed.org, leg.state.nv.us, and pages.nist.gov. *Why it matters:* market sizing cannot reach `VERIFIED` status without manual human verification. Registered as A-32.

---

## 4. Evidence table

| # | Claim | Label | Source ID(s) | Verification | Primary? | Corroboration | Notes |
|---|-------|-------|--------------|--------------|----------|---------------|-------|
| 1 | Release authority belongs to the funder; admins cannot release | `[FACT]` | S-INT-001, S-INT-002 | VERIFIED | Yes (internal) | Docs + code agree | Strongest fact in the brief |
| 2 | Developers cannot buy enforcement over a funder's decision | `[INFERENCE]` | derived from #1 | — | — | **None — untested** | Kill test #1 |
| 3 | Built launched agentic Draw Agent claiming policy enforcement | `[HYPOTHESIS]` | S-004 | UNVERIFIED-SNIPPET | Yes (company) | S-005 partially | Cannot anchor a recommendation |
| 4 | Built claims 300+ lenders, 17 of top 25 | `[HYPOTHESIS]` | S-005 | UNVERIFIED-SNIPPET | Yes (vendor) | **Single-sourced** | Undated marketing claim |
| 5 | Land Gorilla offers configurable workflows and risk tolerances | `[HYPOTHESIS]` | S-006 | UNVERIFIED-SNIPPET | Yes (vendor) | **Single-sourced** | Configurability ≠ enforcement |
| 6 | CA licenses joint control agents; exemption burden on claimant | `[HYPOTHESIS]` | S-007 | UNVERIFIED-SNIPPET | Yes | **Single-sourced** | Question for counsel |
| 7 | NV licenses/bonds construction controls under NRS 627 | `[HYPOTHESIS]` | S-008 | UNVERIFIED-SNIPPET | Yes | **Single-sourced** | Question for counsel |
| 8 | US construction spending ≈ $2.17T SAAR, June 2026 | `[HYPOTHESIS]` | S-001 | UNVERIFIED-SNIPPET | Yes | **Single-sourced** | Context only. **Not** an addressable market |
| 9 | Bank C&D loans outstanding ≈ $450B | `[HYPOTHESIS]` | S-002, S-003 | UNVERIFIED-SNIPPET | Yes | **Sources contradict each other** | See §7 |
| 10 | Incumbents track rather than enforce | `[INTERNAL]` | handbook §23 | — | No | **None** | Vektrum's belief, not evidence |

---

## 5. Segment comparison

**Rubric:** 1–5 per criterion, weights from `templates/ICP_SCORECARD.csv`. **Scores marked `H` are hypothesis-only** — no logged source supports them.

| Criterion | Weight | Construction lenders | Private credit funds | Developers | Evidence |
|-----------|--------|---------------------|---------------------|-----------|----------|
| Organization holds release authority | 3 | 5 | 5 | **1** `H` | S-INT-001 (product fact); segment mapping untested |
| Urgency of problem | 3 | 4 `H` | 3 `H` | 4 `H` | none |
| Population size | 2 | 4 `H` | 2 `H` | 5 `H` | none |
| Draw frequency per account | 3 | 5 `H` | 3 `H` | 3 `H` | none |
| Integration complexity (5 = easiest) | 2 | 2 `H` | 4 `H` | 3 `H` | none |
| Procurement friction (5 = least) | 2 | 1 `H` | 4 `H` | 4 `H` | SOC 2 gap is `[FACT]`; its effect is hypothesis |
| Willingness to pilot | 3 | 2 `H` | 4 `H` | 4 `H` | none |
| Incumbent entrenchment (5 = least) | 2 | **2** | 4 `H` | 3 `H` | S-005 |
| **Weighted total** | | **69** | **72** | **62** | |
| **Evidence coverage** | | **13%** | **0%** | **13%** | |

> **Do not act on these totals.** At 0–13% evidence coverage, the six-point spread between funds and lenders is noise generated by the analyst's own priors. The table is included to show the mechanics and to make the emptiness visible — which is precisely what a scorecard should do before the evidence arrives. The only row carrying real weight is the first, and only for developers.

---

## 6. Recommendation and rationale

**No segment recommendation. The evidence is insufficient.**

What is recommended instead is a **sequence**, on the reasoning that two questions currently sit upstream of segment choice and one of them could change the product's positioning rather than merely its audience:

1. **Kill test #2 first — does any incumbent now enforce?** Verify Built's Draw Agent and Land Gorilla's workflow engine against official product documentation. Specifically: can a user proceed past a failed condition? Does the AI decide, or recommend to a human? If an incumbent genuinely enforces server-side, the wedge narrows for *every* segment and positioning needs rework before any pilot conversation.
2. **Kill test #1 — can a developer hold release authority in any common structure?** Two developer conversations and one lender conversation resolve it. Either H-SEG-3 comes back into contention, or it becomes a demand-generation channel and the comparison simplifies to two.
3. **Then run 6 interviews split across lenders and funds**, using `templates/INTERVIEW_GUIDE.md` §2 and §4, to populate the empty rows above.

**Provisional and low-confidence:** deprioritize developers as a *beachhead* pending kill test #1. Do not disengage from them — they are the most accessible source of workflow evidence and may be the best route to a lender introduction.

**What this commits:** roughly two weeks and no money.
**What this forecloses:** nothing. Every option stays open, which is the appropriate posture at this confidence level.

---

## 7. Counterevidence and risks

**Disconfirming evidence found:**

- `[HYPOTHESIS S-005]` **Against the lender segment:** if Built serves 300+ lenders including 17 of the top 25, the highest-authority segment may already be covered. This argues against H-SEG-1 as greenfield and toward an embedded or partnership approach — a materially different company shape.
- `[HYPOTHESIS S-004]` **Against the core wedge:** an incumbent claiming automatic policy enforcement contradicts the internal position that incumbents only track. If verified, this weakens all three segment cases simultaneously.
- `[HYPOTHESIS S-006]` **Ambiguous:** Land Gorilla's "configurable permissions, alerts, and workflows to match risk tolerances" could describe either advisory routing or real enforcement. The snippet cannot distinguish them, and treating the ambiguity as favorable would be motivated reasoning.
- **Sources contradicting each other:** S-002 reports ≈$453B in bank C&D loans while S-003's snippet reports $450.6B for all commercial banks *and* $427.4B large + $304.8B small — figures that cannot all be true. Most likely a snippet-assembly error across different series, but that cannot be confirmed without reading H.8 directly. **No C&D figure is usable until one authoritative table is read.**

**Disconfirming evidence deliberately sought but not found:**

- Searched for evidence that developers hold disbursement authority in common structures — found nothing either way. The inference in finding 2 remains untested rather than supported.
- Searched for documented enforcement actions or litigation over improper construction draw releases — found nothing in this pass. **The frequency-of-harm claim underpinning the entire thesis (A-11) has no external support yet.** This is the most important gap in the brief and is not a small one.
- Searched for third-party (non-vendor) verification of incumbent enforcement behavior — none found.

**Key risks:**

| Risk | Likelihood | Impact | Early warning | Owner |
|------|-----------|--------|--------------|-------|
| Incumbent AI already decides, not advises | Medium | **Critical** — wedge erodes | Product docs describe autonomous approval | Agent, kill test #2 |
| Improper-release harm is rarer than assumed | Medium | **Critical** — thesis fails | Interviews can't produce incidents | Founder, Phase 2 |
| SOC 2 absence blocks bank pilots outright | Medium | High | Vendor risk teams decline at intake | Founder |
| Fund control licensing reaches authorization-only parties | Low–Medium | High | Counsel flags exposure | Counsel |
| Segment chosen on unvalidated scores | **High if this brief is misread** | High | Acting on §5 totals | Founder |

---

## 8. Confidence level

**Overall: Insufficient** (primary question). **Low** for the provisional developer deprioritization.

**Why:**
- Sources: 11 logged — 3 `VERIFIED` (all internal), 7 `UNVERIFIED-SNIPPET`, 1 `INACCESSIBLE`. **Zero verified external sources.**
- Primary demand evidence: none. Zero interviews.
- Counterevidence: sought and found, and it points against the emerging story rather than for it.
- Weakest link: A-11 — that improper releases happen often enough to fund a solution. Nothing external supports it yet, and everything else depends on it.

**What would raise this to Medium:** kill tests #1 and #2 completed against official product documentation, plus 6 interviews with the release-authority question (guide Q24) answered consistently.
**What would raise it to High:** 15+ interviews, verified sizing, and ≥3 documented failure incidents from independent accounts.

---

## 9. Assumptions

| ID | Assumption | Confidence | If wrong, what breaks |
|----|-----------|-----------|----------------------|
| A-1 | Geography is the US | Medium | All sizing and every legal question |
| A-5 | Release authority sits with the funder | High `[FACT]` | Nothing — verified in code |
| A-6 | Developers therefore can't buy enforcement | Low `[INFERENCE]` | The developer deprioritization in §6 |
| A-11 | Improper releases are frequent enough to fund a solution | None | **The entire thesis** |
| A-12/A-19 | Incumbents advise rather than enforce | None | The wedge, and all three segment cases |
| A-20 | Competitor AI is advisory | None — trending against | Differentiation |
| A-32 | Government sources reach only `UNVERIFIED-SNIPPET` without human help | High `[FACT]` | Achievable confidence ceiling |

---

## 10. What would falsify this brief's reasoning

Pre-registered before the evidence arrives.

| # | If we observed... | ...the reasoning would | How we'd observe it | By when |
|---|-------------------|----------------------|--------------------|---------|
| 1 | A developer structure where the developer funds and controls subcontractor draws | **Flip** the developer deprioritization; H-SEG-3 returns | 3 developer interviews, guide Q24 | Week 1 |
| 2 | Built's Draw Agent decides autonomously with no human approver and no bypass | **Break the wedge**; positioning needs rework before any pilot | Official product docs + a user interview | Week 1 |
| 3 | Lender interviews show conditions are already enforced server-side today | **Break** A-12/A-19; Vektrum becomes a workflow tool, not enforcement | Guide Q9–Q11 | Week 3 |
| 4 | No interviewee can recall a draw released with a condition unmet | **Break** A-11 — the thesis loses its problem | Guide Q10, 10+ interviews | Week 4 |
| 5 | Bank vendor-risk teams decline at intake over SOC 2 | **Weaken** H-SEG-1 badly; funds become the default | Guide Q22–Q23 | Week 3 |
| 6 | Counsel finds fund-control licensing reaches authorization-only parties | **Pause** pilots pending structure review | Written counsel question | Week 4 |

---

## 11. Next validation actions

| # | Action | Answers | Cost | Time | Owner |
|---|--------|---------|------|------|-------|
| 1 | Verify Built Draw Agent + Land Gorilla enforcement model against official product docs | A-12, A-19, A-20 | $0 | 3h | Agent |
| 2 | 3 developer interviews on who controls disbursement (Q24) | A-6 | $0 | 3 days | Founder |
| 3 | Manually verify one C&D loan figure from FDIC QBP or Fed H.8 | A-18, resolves S-002/S-003 conflict | $0 | 30 min | Founder (fetch is blocked for the agent) |
| 4 | Search enforcement actions and court records for improper-release incidents | A-11 | $0 | 4h | Agent |
| 5 | Draft the counsel question on fund-control scope | A-27 | $0 | 1h | Founder |
| 6 | 6 interviews across lenders and funds | Segment comparison rows | $0 | 2 weeks | Founder |

**Single highest-value next action:** action #1. It is free, takes an afternoon, and could change what Vektrum sells rather than merely who it sells to — which makes it strictly upstream of segment choice.

---

## 12. Sources

| ID | Title | Publisher | Date | Type | Verification |
|----|-------|-----------|------|------|--------------|
| S-001 | Monthly Construction Spending, June 2026 | US Census Bureau | 2026-08-03 | Government release | UNVERIFIED-SNIPPET |
| S-002 | Risk Review 2026 | FDIC | 2026 | Government report | UNVERIFIED-SNIPPET |
| S-003 | C&D Loans, All Commercial Banks | Federal Reserve H.8 / FRED | 2026-03-25 | Government dataset | UNVERIFIED-SNIPPET |
| S-004 | Built Launches Draw Agent | Businesswire | 2025-11-04 | Press release | UNVERIFIED-SNIPPET |
| S-005 | Lending Software \| Built | Built Technologies | undated | Vendor page | UNVERIFIED-SNIPPET |
| S-006 | Construction Loan Management Platform | Land Gorilla | undated | Vendor page | UNVERIFIED-SNIPPET |
| S-007 | About the Escrow Law | California DFPI | undated | Regulator page | UNVERIFIED-SNIPPET |
| S-008 | NRS Ch. 627 Construction Controls | Nevada Legislature | current | Statute | UNVERIFIED-SNIPPET |
| S-009 | NIST SP 800-63B | NIST | 2017 | Standard | INACCESSIBLE |
| S-INT-001 | Site Positioning Source of Truth | Vektrum | 2026-04-25 | Internal doc | VERIFIED |
| S-INT-002 | gate-conditions.ts | Vektrum | — | Source code | VERIFIED |

Full detail, excerpts, and researcher notes: `research/SOURCE_LOG.csv`.

---

## Quality gate confirmation

| Gate | Result |
|------|--------|
| 1 Citation integrity | Pass — all URLs from search results, none constructed |
| 2 Numbers traceable | Pass — no derived numbers presented; sizing deferred |
| 3 Currency | Pass — competitor claims from 2025-11 onward |
| 4 Conflicts disclosed | Pass — S-002/S-003 contradiction surfaced in §7 |
| 5 Product vs market | Pass — handbook §23 explicitly labeled `[INTERNAL]`, not used as evidence |
| 6 Custody boundary | Pass — no banned phrase; no custody claim |
| 7 AI boundary | Pass — Vektrum AI described as precondition; competitor AI described from their own claims |
| 8 Role boundaries | Pass — funder identified as release authority; contractors not treated as buyers |
| 9 Sizing integrity | Pass — $2.17T explicitly labeled context, not addressable market |
| 10 Competitive consistency | **Partial** — only 2 alternatives examined, status quo not yet assessed. Disclosed rather than concealed; full matrix owed in Phase 4 |
| 11 Legal posture | Pass — CA/NV items written as questions for counsel |
| 12 Verification honesty | Pass — every source carries status; no `UNVERIFIED-SNIPPET` anchors the recommendation |
| 13 Pricing discipline | Pass — no pricing published or benchmarked |
| 14 Decision usefulness | Pass — declines to name a winner, but delivers an actionable sequence and one named next action |

**Revisions made before presenting:** the segment comparison in §5 originally reported weighted totals without evidence-coverage percentages, which made a 6-point noise gap look like a finding. Coverage percentages and hypothesis markers were added, and an explicit "do not act on these totals" warning was placed directly beneath the table.
