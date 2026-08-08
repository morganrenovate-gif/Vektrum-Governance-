# Vektrum Research Plan

**Version:** 1.0 · **Created:** 2026-08-08 · **Geography:** United States `[ASSUMPTION — U-1]` · **Horizon:** next 2 quarters, refreshed quarterly

---

## 1. Decisions this research must support

Research exists to move a decision. Each block below names the decision, who owns it, and what "done" looks like.

| ID | Decision | Owner | Why it's first | Evidence bar |
|----|----------|-------|---------------|--------------|
| **D-1** | Which customer segment do we pursue first? | Founder | Everything downstream — messaging, pilot design, integration priority — forks here | Medium+ confidence, ≥2 primary sources per segment, ≥6 interviews |
| **D-2** | Who is the economic buyer, user, blocker, and release authority in that segment? | Founder | You cannot sell to a segment; you sell to a person with budget and authority | ≥5 interviews confirming the same buying pattern |
| **D-3** | Which problem is urgent enough to fund a pilot? | Founder | Urgency, not interest, is what converts | ≥3 accounts describing the same recent incident unprompted |
| **D-4** | How large is the serviceable market? | Founder | Determines whether this is a company or a product | Bottom-up + top-down reconciled, all inputs sourced |
| **D-5** | What alternatives already cover this workflow, and does any of them *enforce*? | Founder | The enforcement-vs-record-keeping claim is the entire wedge. If it's false, positioning must change | Every named alternative verified against official product docs |
| **D-6** | How do we position without unsupported claims? | Founder + Copy Truth-Lock | Positioning that overclaims creates legal and credibility risk | Every positioning line traceable to a product fact |
| **D-7** | Which objections, adoption barriers, and regulatory questions must be resolved before a pilot? | Founder (+ counsel for legal items) | Unresolved blockers kill pilots after the work is done | Complete objection register with a named owner per item |
| **D-8** | What evidence would validate or invalidate the business thesis? | Founder | Pre-committing to falsification is what stops motivated reasoning | Written falsification tests per core hypothesis |
| **D-9** | What must we monitor continuously? | Founder | The competitive picture in this category is moving | Weekly watch list live and being maintained |

---

## 2. Research questions

Grouped by decision. Each is answerable, and each has a plausible source path.

### D-1 / D-2 — Segment and buying committee

- Q1.1 For each candidate segment, **who signs** for a governance/infrastructure tool — and is that the same person who owns draw-disbursement risk?
- Q1.2 How many organizations exist in each segment in the US, and how is that population distributed by construction lending or investment volume?
- Q1.3 What is a typical draw frequency and average draw size, by segment?
- Q1.4 Who performs fund control today in each segment — internal staff, an outsourced fund-control company, a title/escrow partner, or a software platform?
- Q1.5 **Does the segment hold release authority at all?** Specifically: can a real-estate developer, as borrower, buy an enforcement layer over disbursements the *lender* controls? (Kills or keeps H-SEG-3.)
- Q1.6 What does the procurement path look like — vendor risk review, SOC 2, security questionnaire, legal review? How long, and who can stop it?
- Q1.7 Which segment can run a pilot without a core-system integration?

### D-3 — Urgency

- Q3.1 What documented failure modes exist in construction disbursement — improper release, missing lien waiver, mechanics' lien loss, duplicate draw, fraud? Frequency and cost, from public enforcement actions, court records, and regulator material.
- Q3.2 What are lenders' actual *current* pain points as evidenced by job postings, conference agendas, regulator guidance, and examiner material?
- Q3.3 What does a payment delay cost the parties — and who bears it?
- Q3.4 Is there a compliance or examination trigger that forces action on a timetable? (Examiner findings are far stronger buying triggers than efficiency arguments.)

### D-4 — Sizing

- Q4.1 Total US construction value put in place, current, split residential / nonresidential / public.
- Q4.2 What share is externally financed, and by whom — banks, credit unions, non-bank lenders, private credit?
- Q4.3 Construction and land development loans outstanding, by holder type.
- Q4.4 How does loan *stock* convert to annual *draw flow*? (This conversion is the weakest link in every construction-fintech market model — treat it as a research target, not an assumption.)
- Q4.5 Number of draws per project per year, by project type.
- Q4.6 Count of potential customer organizations per segment.
- Q4.7 What overlap risks create double-counting between segments?

### D-5 — Competition and alternatives

- Q5.1 For each of Built, Land Gorilla, Rabbet, and comparable platforms: does the product **enforce** release conditions server-side, or route and advise?
- Q5.2 What is each one's AI role — advisory, approving, or gating? **Has this changed recently?**
- Q5.3 What custody or funds-flow role does each take?
- Q5.4 What do outsourced fund-control companies actually do, what do they charge, and are they a competitor or a channel?
- Q5.5 What do title and escrow companies already enforce on construction disbursements?
- Q5.6 What does the status-quo stack look like, and what does switching from it cost?
- Q5.7 Which alternatives are already embedded in the target segment's core systems — and what does that do to displacement odds?

### D-6 / D-7 — Positioning, objections, regulation

- Q6.1 What language do buyers in this segment use for this problem? (Category creation is expensive; using their words is cheaper.)
- Q7.1 What are the top objections, and what evidence answers each?
- Q7.2 Which regulatory questions from `VEKTRUM_CONTEXT.md` §8 are pilot-blocking versus scale-blocking?
- Q7.3 What do state fund-control / joint-control / construction-control regimes require, and of whom?
- Q7.4 What vendor-security bar must be cleared, and does the absence of SOC 2 certification block a pilot?

---

## 3. Initial segment hypotheses

All `[HYPOTHESIS]` until evidence is logged.

**H-SEG-1 — Construction lenders (banks, credit unions, non-bank construction lenders)**
Buying authority is institutional and identifiable; draw disbursement is a supervised, examined activity, which creates the compliance trigger that makes governance purchasable. Expected buyer: Chief Credit Officer or Head of Construction Lending. Expected champion: construction loan administration lead. Expected blocker: vendor risk / infosec, where SOC 2 status bites. Expected release authority: the lender — which **matches Vektrum's funder-triggered model**.
*Priors: strongest authority match, hardest procurement.*

**H-SEG-2 — Private construction-credit funds, debt funds, family offices**
Smaller buying committee, faster decisions, fewer legacy systems, more likely to adopt the Stripe Connect rail without integration work. Expected buyer: principal or head of asset management. Expected champion: fund controller or ops lead. Expected blocker: cost sensitivity, and "we only do a few deals."
*Priors: fastest to pilot, smallest per-account volume, hardest population to count from public sources.*

**H-SEG-3 — Real-estate developers / owner-borrowers**
Feels the pain of slow draws most acutely and is easiest to reach. **But** the developer is typically the borrower, not the funder, and Vektrum's release authority sits with the funder (`VEKTRUM_CONTEXT.md` §3).
*Priors: highest pain, weakest authority. If a developer cannot buy enforcement over a lender's disbursement decision, this segment is a demand-generation channel and not a beachhead. That is the cheapest high-value test in the plan.*

**Cross-cutting hypothesis H-X-1:** the real incumbent is the status quo — spreadsheets, email, checklists — not a named platform. If true, the competitive frame is "why change at all," not "why us instead of Built."

**Cross-cutting hypothesis H-X-2:** the enforcement-vs-record-keeping distinction is real *and* legible to buyers. These are two separate claims and both need testing. A distinction can be true and still fail to sell.

---

## 4. Research order

Sequenced so that the cheapest question that could kill the most work runs first.

**Phase 0 — Kill tests (days 1–3).** Cheap questions with high destructive potential.
1. Q1.5 — can a developer buy enforcement over a funder-controlled release? *(Kills or keeps a whole segment.)*
2. Q5.1 / Q5.2 — does any major platform already enforce, or gate with AI? *(Tests the wedge itself. Built shipped an AI "Draw Agent" in Nov 2025 — S-004 — so this is live, not theoretical.)*
3. Q7.3 — do fund-control regimes reach an authorization-only party? *(Could impose a licensing question before any pilot.)*

**Phase 1 — Segment structure (week 1).** Q1.1–Q1.4, Q1.6, Q1.7. Output: `MARKET_MAP.md` + populated `ICP_SCORECARD.csv`.

**Phase 2 — Urgency and failure modes (week 2).** Q3.1–Q3.4. Output: ranked urgency findings with cited incidents.

**Phase 3 — Sizing (week 2–3).** Q4.1–Q4.7, bottom-up first, then top-down, then reconcile. Output: auditable model with sensitivity ranges.

**Phase 4 — Competition (week 3).** Q5.1–Q5.7. Output: `COMPETITOR_MATRIX.csv`, consistent criteria, verification status per row.

**Phase 5 — Interviews (weeks 3–6).** Runs in parallel from week 3. Only phase that produces primary demand evidence.

**Phase 6 — Synthesis (week 6).** Decision brief for D-1 through D-3, with falsification tests pre-registered.

**Continuous — Weekly watch** from week 1.

> Phases 1–4 can only reach *Medium* confidence. Desk research establishes structure and constrains possibilities; it cannot establish willingness to pay. Only Phase 5 moves D-1 to High.

---

## 5. Evidence requirements

| Claim type | Minimum bar |
|-----------|-------------|
| Market size input | Primary source (government or filing), `VERIFIED`, with date, geography, currency, and units |
| Competitor capability | Official product documentation, `VERIFIED`, plus one corroborating source. Never a listicle or a comparison page authored by a rival |
| Competitor pricing | Official pricing page, filing, or public procurement record only |
| Buyer behaviour | ≥3 independent interviews, or documented procurement records |
| Urgency | A documented, dated incident or regulator action — not a vendor-authored statistic |
| Regulatory | The statute, regulation, or regulator publication itself. Cited as a question, never as a conclusion |
| Any single-sourced claim | Explicitly flagged as single-sourced in the brief |

**Triangulation:** two independent sources for every material claim, at least one primary, where reasonably possible. Where not possible, say so — in the brief, not only in the log.

**Verification:** `UNVERIFIED-SNIPPET` sources may inform direction but may never anchor a recommendation or carry a `[FACT]` label. Given current egress restrictions on census.gov, fred.stlouisfed.org, leg.state.nv.us, and nist.gov, expect a meaningful share of government sourcing to sit at this status until a human verifies it manually.

---

## 6. Recommended interview program

**Target: 15–20 conversations over 4 weeks.** No outreach happens without explicit founder authorization, and the agent never sends any of it.

| Group | Count | Purpose | Access path |
|-------|-------|---------|------------|
| Construction loan administrators (bank/CU) | 5 | Day-to-day workflow, where releases actually go wrong | Warm intros; industry associations; conferences |
| Chief Credit Officers / construction lending heads | 3 | Buying authority, budget, examination pressure | Warm intros only |
| Private credit / debt fund principals or controllers | 4 | Speed of decision, rail preference, volume reality | Direct network |
| Draw inspectors / fund-control operators | 3 | What breaks in the field; competitor or channel? | Trade groups |
| Title / escrow construction-disbursement staff | 2 | What they already enforce; partnership potential | Local, walk-in is viable |
| Developers / borrowers | 3 | Pain intensity — **and whether they hold any authority** | Easiest to reach |

**Rules:**
- Ask about the **last real incident**, never about hypothetical interest. "Walk me through the last draw you held up" beats any preference question.
- Never describe Vektrum before eliciting the workflow — describing it first contaminates everything after.
- Record who *decides*, who *executes*, who *gets blamed*, and who *signs the contract*. These are frequently four different people.
- Log every interview as a source with its own ID.
- Use `templates/INTERVIEW_GUIDE.md`. Do not improvise leading questions.

**Falsification target:** at least 5 interviews should be actively looking for reasons this fails — talk to people you expect to say no.

---

## 7. Completion criteria

**Phase 0 complete when:** each of the three kill tests has a documented answer or a documented reason it cannot be answered from public sources.

**D-1 (segment selection) complete when:**
- All three segments scored on the same rubric with per-criterion evidence
- ≥6 interviews across ≥2 segments
- Buying committee mapped with a named role per position for the leading segment
- Sizing model reconciles bottom-up and top-down within a stated range
- Competitive matrix complete with verification status on every capability claim
- Falsification tests pre-registered
- Counterevidence section is substantive, not decorative

**D-4 (sizing) complete when:** every rung of the seven-rung ladder is separately sourced and dated, double-counting risks are named, sensitivity ranges are stated, and revenue uses `<VEKTRUM_RATE>` until pricing is confirmed.

**D-5 (competition) complete when:** every named alternative is verified against official product materials, evaluated on identical criteria, and the status quo is included as a named alternative.

**The whole program is complete when the founder can answer, in one page, with citations: who we sell to, who signs, what breaks today, how big it is, who else does this, what would prove us wrong.**

**Explicit non-goal:** producing a market report. If the output reads like a report rather than a decision, it has failed regardless of length or citation count.
