# Assumptions and Questions Register

**Created:** 2026-08-08 · **Last updated:** 2026-08-08

Every assumption the research system is standing on. If an assumption is wrong, everything built on it is wrong — so each one carries an importance, an owner, its evidence, a confidence level, a validation method, and a status.

**Status values:** `OPEN` (unvalidated, in use) · `TESTING` (validation underway) · `VALIDATED` (evidence logged) · `KILLED` (disproven — and what replaced it) · `BLOCKED` (needs an answer we can't get ourselves)

**Confidence:** High / Medium / Low / None (assumed for progress only)

---

## A. Scope and framing assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-1** | Research geography is the United States | **Critical** — every sizing input and legal question depends on it | Founder | No repo doc states geography. Inferred from Stripe Connect, DocuSign, state lien-waiver logic, USD pricing, US-format addresses | Medium `[INFERENCE]` | Founder confirms in one sentence | `OPEN` — Q1 to founder |
| **A-2** | The unit of value is an authorized/blocked **release event**, not a project, loan, or construction dollar | **Critical** — wrong unit invalidates all sizing | Agent | Per-release fee model (`handbook §24`); gate evaluates per milestone release | High `[FACT]` | Confirmed by pricing model structure | `VALIDATED` |
| **A-3** | No live paying pilot exists today | High — decides whether ROI evidence can be gathered or must be modeled | Founder | Handbook §24: packaging "Conceptual — Not Formally Productized"; backlog is pre-pilot readiness | Medium `[INFERENCE]` | Founder confirms | `OPEN` — Q2 to founder |
| **A-4** | The time horizon is the next 2 quarters | Medium — affects whether slow-procurement segments are viable | Founder | Pre-pilot readiness framing in `docs/pre-pilot-readiness-checklist.md` | Low `[HYPOTHESIS]` | Founder confirms | `OPEN` |

---

## B. Segment and buyer assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-5** | Release authority sits with the **funder**, not the borrower, in target deals | **Critical** — determines who can buy at all | Agent | `[FACT]` — positioning source of truth §8; `ACTOR_AUTHORIZED` in `gate-conditions.ts`; funder-triggered release throughout | High `[FACT]` | Verified in code and docs | `VALIDATED` (product fact) |
| **A-6** | Therefore developers/borrowers **cannot** buy the core enforcement value for draws a lender controls | **Critical** — kills or keeps H-SEG-3 | Agent | `[INFERENCE]` from A-5. Not yet tested against a real developer-funded structure (e.g. developer as equity funder of its own subcontractor draws) | Low `[INFERENCE]` | 3 developer interviews + 2 lender interviews on who controls disbursement | `OPEN` — **Phase 0 kill test #1** |
| **A-7** | Construction lenders have institutional buying authority and a compliance trigger that makes governance purchasable | High — underpins ranking H-SEG-1 first | Agent | None external yet. Plausible from supervised-lending structure | None `[HYPOTHESIS]` | Examiner guidance + 3 CCO interviews | `OPEN` |
| **A-8** | Private credit funds decide faster and pilot sooner than banks | High — trades volume for speed | Agent | Handbook §17.4 `[INTERNAL]` sales framing only | Low `[HYPOTHESIS]` | 4 fund interviews; compare stated procurement cycles | `OPEN` |
| **A-9** | Vendor risk review / SOC 2 is a gating step for bank buyers, and Vektrum is not certified | High — could block the highest-authority segment | Agent | `[FACT]` on the certification status: "SOC 2 certified" is a banned phrase; readiness review exists, certification does not | Medium | Ask directly in every bank interview: "what's your vendor security bar?" | `OPEN` |
| **A-10** | The buying committee has ≥4 distinct roles (buyer, champion, blocker, release authority) | Medium — shapes the sales motion | Agent | `[HYPOTHESIS]` from B2B fintech norms | Low | Map from interviews | `OPEN` |

---

## C. Problem and urgency assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-11** | Improper or unsupported releases happen often enough to be a funded problem | **Critical** — the whole thesis | Agent | None external yet. Repo asserts it `[INTERNAL]` | None `[HYPOTHESIS]` | Enforcement actions, court records, examiner findings, interviews | `OPEN` — thesis-critical |
| **A-12** | Existing controls are advisory (clickable-through) rather than enforced | **Critical** — the wedge | Agent | `[INTERNAL]` handbook §23 asserts this of Built/Land Gorilla/Rabbet. **Not independently verified** | None `[HYPOTHESIS]` | Verify against each vendor's official product docs | `OPEN` — **Phase 0 kill test #2** |
| **A-13** | The status quo (spreadsheets/email) is the real incumbent, not a named platform | High — changes the entire competitive frame | Agent | `[HYPOTHESIS]` | Ask every interviewee what they use today, before naming any vendor | `OPEN` |
| **A-14** | Urgency comes from compliance/examination pressure more than from efficiency | Medium — decides the message | Agent | `[HYPOTHESIS]` | Compare response to both framings in interviews | `OPEN` |

---

## D. Market sizing assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-15** | Loan **stock** can be converted to annual draw **flow** with a defensible multiplier | **Critical** — the weakest link in the sizing chain | Agent | None. This conversion is where construction-fintech models usually break | None `[HYPOTHESIS]` | Find a sourced draw-cycle statistic; else derive from typical construction duration and draw cadence, with a wide stated range | `OPEN` |
| **A-16** | Bank-held C&D loans and private-credit construction lending can be separated without double-counting | High — double-counting inflates the market | Agent | Not yet analyzed. Participations and syndications create real overlap | None `[HYPOTHESIS]` | Explicit overlap analysis before any addition | `OPEN` |
| **A-17** | US construction spending is roughly $2.1–2.2T SAAR as of mid-2026 | Medium — top-down anchor only, never the addressable market | Agent | S-001 `UNVERIFIED-SNIPPET` — census.gov fetch blocked | Low | Founder opens census.gov C30 release and confirms | `BLOCKED` — needs manual verification |
| **A-18** | Bank C&D loans outstanding are roughly $450B | Medium | Agent | S-002/S-003 `UNVERIFIED-SNIPPET`, **and internally inconsistent** — one snippet reports $450.6B for all commercial banks while also reporting $427.4B large + $304.8B small, which cannot both be true | Low | Manual verification against FDIC QBP tables or Fed H.8 | `BLOCKED` — conflict recorded |

---

## E. Competitive assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-19** | No current platform enforces release conditions server-side with no bypass | **Critical** — if false, the wedge is gone | Agent | `[INTERNAL]` only | None `[HYPOTHESIS]` | Official product docs for each vendor; ask users directly whether they can click past a warning | `OPEN` — **Phase 0 kill test #2** |
| **A-20** | Competitor AI is advisory, not gating | **Critical** — and **actively at risk**: Built launched an agentic "Draw Agent" in Nov 2025 claiming policy enforcement and sub-3-minute draw approval (S-004, `UNVERIFIED-SNIPPET`) | Agent | S-004, S-005 | None — **trending against us** | Verify Draw Agent's actual authority model from official docs. Does it *recommend* or *decide*? | `OPEN` — highest-risk competitive assumption |
| **A-21** | Incumbents are channel partners rather than pure competitors | Medium — determines partnership strategy | Agent | `[INTERNAL]` handbook §23 | Low `[HYPOTHESIS]` | Test in partner conversations | `OPEN` |
| **A-22** | Outsourced fund-control companies are a channel, not a competitor | Medium | Agent | Unexamined. They already perform conditional disbursement, sometimes under licence — arguably the closest true analog | None `[HYPOTHESIS]` | Research their service scope and pricing; 3 interviews | `OPEN` |

---

## F. Pricing and commercial assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-23** | 1.00% per authorized release is published but unvalidated | High | Founder | `[FACT]` published — `/pricing` page metadata. `[HYPOTHESIS]` that it is right | Medium | Price-sensitivity questions in interviews | `OPEN` |
| **A-24** | 0.70% / 0.65% / $50 minimum are internal and must not be benchmarked | **Critical** — instruction compliance | Founder | Founder brief 2026-08-08 | High `[INTERNAL]` | Founder confirms publication status | `OPEN` — Q3 to founder. See conflict C2 |
| **A-25** | The funder pays; contractors are free | Medium | Founder | Published: "Contractors always free" | High `[FACT]` (as published) | — | `VALIDATED` (as a published position) |
| **A-26** | A percentage-of-disbursement fee is acceptable to institutional funders | High — a per-seat or per-loan model may fit lender budgeting better | Agent | None | None `[HYPOTHESIS]` | Ask how comparable vendors are budgeted in interviews | `OPEN` |

---

## G. Regulatory assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-27** | Authorization without custody is materially different from fund control for licensing purposes | **Critical** — a licensing requirement would reshape the model | Counsel | **Open question, not an assumption we may rely on.** CA joint-control and NV construction-control regimes exist and reach parties in this workflow (S-007, S-008, both `UNVERIFIED-SNIPPET`) | None — **question for counsel** | Written question to qualified counsel | `BLOCKED` — needs counsel |
| **A-28** | The Stripe rail and external rail have the same regulatory posture | High — Vektrum's instruction initiates the Stripe transfer, which may differ from pure authorization | Counsel | Open question | None | Same counsel question | `BLOCKED` — needs counsel |
| **A-29** | An AI precondition that can block a disbursement is not automated decision-making under any applicable framework | Medium | Counsel | Open question | None | Counsel + monitor AI governance developments | `BLOCKED` — needs counsel |
| **A-30** | State lien-waiver form variation does not require per-state gate logic | Medium — product scope implication | Founder + Agent | Statutory waiver forms vary materially by state | Low `[HYPOTHESIS]` | Survey statutory forms in the 5 target states | `OPEN` |

---

## H. Environment and method assumptions

| ID | Assumption | Importance | Owner | Evidence | Confidence | Validation method | Status |
|----|-----------|-----------|-------|----------|-----------|-------------------|--------|
| **A-31** | Government primary sources can be fetched and verified by the agent | High — determines achievable confidence | Agent | **KILLED.** `WebFetch` returned `EGRESS_BLOCKED` for census.gov, fred.stlouisfed.org, leg.state.nv.us, pages.nist.gov on 2026-08-08 | — | — | `KILLED` → replaced by A-32 |
| **A-32** | Government primary sources currently reach only `UNVERIFIED-SNIPPET` unless a human opens and confirms them | High | Agent | Direct observation, 2026-08-08 | High `[FACT]` | — | `VALIDATED` — drives the verification-status discipline |

---

## Open questions for the founder

Answers here unblock the most work, in priority order.

1. **Geography** — is the US the right and only research geography for now? (A-1)
2. **Live pilots** — is there any paying customer or live pilot today, or is this pre-revenue? (A-3)
3. **Pricing publication** — the founder brief calls 1.00% / 0.70% / 0.65% / $50 internal and unvalidated, but 1%, the minimum, and contractor-free are **already live on the public pricing page**. Which is current? (A-24, conflict C2)
4. **Gate condition count** — the code registry defines 14 condition codes; public materials say 10. Handbook explains 2 of the 4 extras. Is "10 public + 4 internal checks" the intended framing? (conflict C1)
5. **Outbound partner webhooks** — memory files say don't claim them live; `docs/api/partner-api.md` describes signed `release.authorized` delivery as available. Which is true today? (conflict C4)

---

## Questions for counsel — not for the agent

Written as questions, never answered internally. See `VEKTRUM_CONTEXT.md` §8 for the full list.

1. Does authorizing (but never holding or transmitting) construction disbursements implicate state money transmission licensing? Under what facts would the analysis change?
2. Do state fund-control / joint-control / construction-control regimes reach an authorization-only party? Specifically California Escrow Law joint-control provisions and Nevada NRS Ch. 627.
3. Does the Stripe Connect rail — where Vektrum's instruction initiates the transfer — change that analysis versus the external rail?
4. Does an AI precondition capable of blocking a disbursement constitute automated decision-making under any framework applicable to lender vendors?
5. How should release authority and liability be allocated contractually when the gate blocks — or fails to block — a release?

---

## Maintenance

Update this file at the end of every research assignment. When an assumption changes status, record what changed it and check whether any brief that relied on it needs a correction note. A register nobody updates is worse than none, because it looks like diligence.
