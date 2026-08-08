# VEKTRUM_CONTEXT — Research Source of Truth

**Purpose:** the single briefing document loaded by the Vektrum Market Research Agent before any external research. It states what Vektrum *is*, what may be *claimed*, and what is *unknown*, so that market research never invents product facts.

**Scope:** research context only. This file does not govern code, public copy, or legal posture. For public copy, `docs/site-positioning-source-of-truth.md` is binding. For product truth, `docs/VEKTRUM_MASTER_HANDBOOK.md` and the code are binding.

**Last updated:** 2026-08-08
**Maintainer:** founder (morganrenovate@gmail.com)
**Working research geography:** United States — **[ASSUMPTION]**, see §9.

---

## 0. Evidence labels used everywhere in this system

Every statement in this file, and in every research output, carries one of four labels. Nothing is unlabeled.

| Label | Meaning | May be published externally? |
|-------|---------|------------------------------|
| `[FACT]` | Directly supported by a logged, reliable source, or by inspected Vektrum code/docs. Traceable to a source ID or a file path. | Yes, with citation |
| `[INFERENCE]` | A conclusion logically derived from one or more `[FACT]`s. The derivation is stated. | Only with the reasoning shown |
| `[INTERNAL]` | Supplied by Vektrum, not independently verified. True *about the company's own intent or claims*, not verified about the world. | No — never as market evidence |
| `[HYPOTHESIS]` | An idea awaiting validation. | No |

**Hard rule:** an `[INTERNAL]` claim never becomes a `[FACT]` by being repeated. It becomes a `[FACT]` only when an external or code-level source is logged for it.

---

## 1. Product definition

`[FACT — docs/site-positioning-source-of-truth.md §1]`
Approved one-sentence positioning: **Vektrum is conditional authorization infrastructure for construction disbursements.** This exact sentence is the approved category statement. Do not substitute synonyms.

`[FACT — docs/site-positioning-source-of-truth.md §2]`
Vektrum enforces whether a construction draw is allowed to release. It decides yes or no. Payment execution happens elsewhere.

`[FACT — docs/VEKTRUM_MASTER_HANDBOOK.md §23]`
Vektrum self-describes as a **system of enforcement**, not a system of record: it blocks, authorizes, requires, prevents — as distinct from platforms that document, track, report, notify.

**Research framing rule:** when sizing a market or comparing alternatives, the unit of value is *an authorized (or blocked) release event*, not a construction project, not a loan, not a dollar of construction spend.

---

## 2. Funds-flow and authorization boundaries

`[FACT — docs/site-positioning-source-of-truth.md §3, §5, §6; docs/where-vektrum-plugs-in.md]`

Four architectural layers:

1. **Custody** — funds sit with Stripe-managed accounts, a bank, an escrow or title partner, lender treasury, or an institutional partner. Never in a Vektrum account.
2. **Authorization** — who approved what, under what authority, at what time.
3. **Governance gate** — deterministic, server-side release-condition evaluation.
4. **Execution** — Stripe Connect executes automated transfers, or a partner executes externally and confirms back.

Two supported execution rails:

| Rail code | Label | Who executes payment | Vektrum's role |
|-----------|-------|----------------------|----------------|
| `stripe_connect` | Stripe Connect automated execution | Stripe, on Vektrum's release instruction | Authorizes, then instructs |
| `external_manual` | External / manual execution | Funder, title company, escrow company, or treasury team — outside Vektrum entirely | Authorizes, records proof of what the partner did |

**Boundary statements that are true and may be relied on in research:**
- Vektrum does not hold funds in its own bank account.
- Vektrum does not act as escrow, and does not execute wires.
- On the external rail, funds never interact with Vektrum infrastructure.
- On the Stripe rail, funds are held in Stripe-managed accounts, and Vektrum's instruction initiates the transfer.
- Stripe Connect is **not** required for all deals.

**Boundary statements that are NOT established and must not be asserted:**
- That this architecture determines Vektrum's legal classification under any money-transmission, escrow, or fund-control statute. The architecture is a *fact*; the legal consequence is an *open question for counsel*. See §8.

---

## 3. Known actors and permissions

`[FACT — docs/site-positioning-source-of-truth.md §8; docs/VEKTRUM_MASTER_HANDBOOK.md §14; docs/role-permission-matrix.md]`

| Actor | Can trigger release? | Notes |
|-------|---------------------|-------|
| **Funder** | **Yes** — releases are funder-initiated | Subject to the gate; the funder is the release-authority actor |
| **Admin** | **No** | Admins have privileged management capability but are excluded from the release trigger path by design. Privileged admin actions require AAL2 MFA, actor justification, and audit logging |
| **Contractor** | No | Recipient / evidence supplier |
| **Partner (API)** | No | Can *confirm or fail* execution after Vektrum authorizes. Cannot bypass the gate |
| **AI** | No | Precondition only. AI informs; the gate decides |

**Research rule — do not conflate roles:** contractors, general contractors, subcontractors, inspectors, title participants, and project administrators are **users or stakeholders**, not automatically **buyers**. The buyer, the champion, the user, the blocker, the compliance reviewer, and the release authority must be tracked as separate people in every segment analysis. `[FACT — user brief 2026-08-08 + role separation above]`

---

## 4. Confirmed product capabilities

Verified against code and repo docs on 2026-08-08.

### The release gate

`[FACT — docs/VEKTRUM_MASTER_HANDBOOK.md §7; docs/where-vektrum-plugs-in.md]`
The **public 10-condition gate**, in approved lender-facing wording:

1. Milestone status approved (by the funder)
2. Protection status ready for release
3. Sufficient funded balance covering disbursement + fee
4. Payout readiness verified for the selected rail
5. Contractor onboarding complete where required
6. No existing active release for this milestone
7. No open change orders on this milestone
8. Signed contract on file
9. Sequential-release prerequisites satisfied where required
10. Approved conditional lien waiver on file where required

`[FACT — src/lib/engine/gate-conditions.ts]`
The code registry `CONDITIONS` defines **14** stable condition codes, not 10: the ten above plus `ACTOR_AUTHORIZED`, `DEAL_NOT_FROZEN`, `SOV_BALANCE_VALID`, and `AI_PRECONDITION_SATISFIED`. Gate engine version `gate-engine.v1`; policy identity `vektrum_standard_release v1`.

`[FACT — docs/VEKTRUM_MASTER_HANDBOOK.md §7]`
The handbook reconciles part of this: the frozen-deal check is an unnumbered fast-path pre-check, and the AI review is an explicitly separate precondition, not a numbered condition.

**Unreconciled:** `ACTOR_AUTHORIZED` and `SOV_BALANCE_VALID` are evaluated checks not represented in the public list of 10. See conflict **C1** in §10. **Research and external materials must continue to say "10-condition gate" and must never say "14".**

### AI precondition

`[FACT — docs/VEKTRUM_MASTER_HANDBOOK.md §7, §8]`
- AI risk level `critical` blocks gate evaluation.
- AI review older than 48 hours blocks gate evaluation.
- AI unavailable defaults to `critical` (fail-safe).
- Admin may override the AI precondition with a 4-hour TTL, requiring AAL2 MFA, audit-logged.

**This is the single most competitively load-bearing product fact.** It is what distinguishes Vektrum's AI from an AI approval agent. Any competitive analysis that describes a rival's "AI draw approval" must contrast it against *this* mechanism specifically, not against "AI in general."

### Audit

`[FACT — docs/site-positioning-source-of-truth.md §10]`
Append-only, hash-chained, **tamper-evident** (never "tamper-proof"). Updates and deletes blocked at the database-trigger layer. Records actor, timestamp, before/after values.

### Partner API

`[FACT — docs/where-vektrum-plugs-in.md; docs/api/partner-api.md]`
- `GET /api/partner/releases/:id` — release status, rail, milestone, amount, confirmation state
- `POST /api/partner/releases/:id/confirm` — confirm external execution (method, reference, proof, actor, timestamp). Idempotent.
- `POST /api/partner/releases/:id/fail` — mark execution failed; cancels balance reservation, preserves audit visibility.

Scoped partner API keys, hashed, raw key shown once; rate-limited; every call audit-logged; no direct fund movement through the API.

**Outbound webhooks: contested.** See conflict **C4** in §10. Treat outbound `release.authorized` webhooks as **not confirmed live** for research purposes.

### Security posture

`[FACT — docs/site-positioning-source-of-truth.md §8; docs/VEKTRUM_MASTER_HANDBOOK.md §14]`
AAL2 step-up MFA for privileged admin actions; RLS at the database layer; role separation enforced at API and database layers.

`[FACT — docs/site-positioning-source-of-truth.md §12]`
**Not SOC 2 certified.** "SOC 2 certified" is a banned phrase. A SOC 2 readiness review exists in-repo (`vektrum-soc2-readiness-review.md`); readiness ≠ certification. This matters directly to institutional buyer research: SOC 2 is a common procurement gate and its absence is an adoption barrier to be researched, not hidden.

---

## 5. Target customer hypotheses

All of the following are `[HYPOTHESIS]` until interview or documentary evidence is logged. The repo contains partner-type value propositions (`docs/VEKTRUM_MASTER_HANDBOOK.md §17`) — those are *internal sales framing*, i.e. `[INTERNAL]`, not market evidence.

**Primary buyer candidates (to be researched first):**

| ID | Segment | Buying-authority hypothesis | Rail fit |
|----|---------|----------------------------|----------|
| H-SEG-1 | Construction lenders (banks, credit unions, non-bank construction lenders) | Chief Credit Officer / Head of Construction Lending buys; loan-administration lead champions | External/manual, or API |
| H-SEG-2 | Private construction-credit funds, debt funds, family offices | Principal / Head of Asset Management buys; fund controller champions | Stripe Connect or external |
| H-SEG-3 | Real-estate developers / owner-borrowers | Development or finance lead buys — **but** may lack authority over release, which is the funder's | Uncertain — see below |

**Structural concern to test, not assume — `[HYPOTHESIS]`:** Vektrum's release authority sits with the *funder*. A developer is typically the *borrower*, not the funder. If so, a developer cannot buy the core enforcement value for their own draws; they can at most request it. This is the most important early falsification test in the whole plan, and it is why H-SEG-3 is not ranked equal to H-SEG-1/2 on priors.

**Stakeholder (not buyer) candidates:** contractors, general contractors, subcontractors, draw inspectors, title/escrow participants, project administrators, construction attorneys.

---

## 6. Prohibited or unverified claims

Binding list: `docs/site-positioning-source-of-truth.md §12`. Reproduced here in condensed form because research outputs are a common leak path.

**Never describe Vektrum as:** payment processor · escrow company or agent · bank or depository institution · lender or credit provider · money transmitter · title company or agent · trust account holder · fiduciary · AI decision-maker.

**Never write:** "tamper-proof" · "impossible to modify" · "forever" (as retention guarantee) · "AI approves" · "AI clears" · "AI decides" · "AI-powered releases" · "fully automated AI payments" · "Vektrum holds funds" · "Vektrum never touches money" · "Vektrum moves money" · "Vektrum executes wires" · "Vektrum is non-custodial" (standalone) · "Stripe is required" · "Stripe holds all funds" · "Project Trust Account" · "Vektrum Project Trust Agreement" · "trust account" (of any Vektrum account) · "SOC 2 certified" · "8-condition gate" · "7-condition gate" · "coming soon" (unapproved) · "authorise/authorisation" (use US spelling).

**Additional research-specific prohibitions:**
- Never present total construction spending as Vektrum's addressable market. See `docs/VEKTRUM_MASTER_HANDBOOK.md` §2738/§2768 — a precise "$2.19 trillion" claim was previously softened to "multi-trillion-dollar" for lack of a source. That precedent is binding on all sizing work.
- Never state a market number without a formula, source ID, date, currency, and geography.
- Never assert that a company is a competitor because an article, listicle, or search snippet says so.
- Never state a legal conclusion. Legal matters are logged as *questions* and *risks*.

---

## 7. Known pricing hypotheses

**Status: partly published, wholly unvalidated as market-appropriate.**

| Concept | Value | Publication status | Label |
|---------|-------|--------------------|-------|
| Standalone / self-service rate | 1.00% per authorized release | **Already public** on the pricing page | `[FACT]` that it is published; `[HYPOTHESIS]` that it is correct |
| Institutional rate | 0.70%, retainer-backed | Internal only (`docs/VEKTRUM_MASTER_HANDBOOK.md §24`) | `[INTERNAL]` |
| Enterprise rate | 0.65%, negotiated annually | Internal only | `[INTERNAL]` |
| Minimum per release | $50 | Appears in handbook §24 as "Minimum $50"; public page states a minimum | `[INTERNAL]` / partly public |
| Contractor cost | $0 | **Already public** — "Contractors always free" | `[FACT]` that it is published |
| Billed to | Funder, on top of milestone disbursement | Internal | `[INTERNAL]` |

**Rules for the research agent:**
1. Do **not** publish, benchmark, defend, or recommend the 0.70% / 0.65% / $50 figures until the founder confirms them. `[INTERNAL]`
2. Do **not** treat the published 1% as validated. It is published, which is not the same as tested.
3. Competitor pricing research is in scope and encouraged — but must come from official pricing pages, filings, or public procurement records, and must be reported *without* a side-by-side against unconfirmed Vektrum tiers.
4. If a research task requires a Vektrum price, use a placeholder (`<VEKTRUM_RATE>`) and note the dependency.

See conflict **C2** in §10 — the founder brief describes these as internal, while some are already live on the public site.

---

## 8. Regulatory questions — open, not answered

`[FACT]` that these are open questions. **No item below is a legal conclusion, and this file does not provide legal advice.**

1. Does authorization-without-custody implicate state money transmission licensing in any jurisdiction? Under what facts would it?
2. Do state **fund control / joint control / construction control** regimes reach a party that authorizes but never disburses? (California Escrow Law, Fin. Code Div. 6 §17000 et seq. and joint-control provisions; Nevada NRS Ch. 627 Construction Controls, among others — see `research/SOURCE_LOG.csv`.)
3. Where the Stripe rail is used and Vektrum's instruction initiates a transfer, does the analysis differ from the external rail?
4. State prompt-payment statutes: do enforced hold conditions create timing exposure for the funder?
5. Statutory lien-waiver forms vary by state. Does gate condition 10 need per-state form logic?
6. Identity and authentication expectations for release authority (AAL2 posture) in regulated lender environments.
7. Data security, auditability, and record-retention obligations of bank customers flowing down to Vektrum as a vendor (including SOC 2 and vendor-risk review).
8. AI governance: does an AI precondition that can *block* a disbursement constitute automated decision-making under any applicable framework?
9. Contractual allocation of release authority and liability when the gate blocks — or fails to block — a release.

**Escalation rule:** any of these that becomes decision-relevant is escalated to qualified counsel with a written question, not resolved by the agent.

---

## 9. Unknowns requiring confirmation

| ID | Unknown | Why it matters | Current working assumption |
|----|---------|----------------|---------------------------|
| U-1 | Research geography | Changes every sizing input and every legal question | United States `[ASSUMPTION]` — implied by Stripe Connect, DocuSign, state lien-waiver logic, USD pricing; not stated explicitly in any repo doc |
| U-2 | Whether any paying customer or live pilot exists today | Determines whether ROI evidence is available or must be constructed | Assume **no live paying pilot**; handbook §24 calls packaging "Conceptual — Not Formally Productized" |
| U-3 | Whether the funder in target deals is an institution or an individual | Changes the buying centre entirely | Both in play; H-SEG-1/2 institutional |
| U-4 | Confirmed pricing | Blocks all revenue modelling | Use `<VEKTRUM_RATE>` placeholder |
| U-5 | Outbound partner webhook live status | Affects integration-complexity scoring for platform partners | Treat as not live |
| U-6 | Whether developers can be buyers given funder-held release authority | Decides whether H-SEG-3 survives | Open — highest-value early test |
| U-7 | Target deal size / draw frequency the product is tuned for | Bottom-up sizing input | Unknown — must be elicited |

---

## 10. Material conflicts found in existing materials

Recorded on 2026-08-08 during system build. Resolution rule applied: prefer the most recent authoritative source (code > repo docs > memory files), and record every conflict rather than silently choosing.

| ID | Conflict | Sources | Resolution applied |
|----|----------|---------|--------------------|
| **C1** | Gate condition count: 10 (public) vs 14 codes (registry) | `docs/site-positioning-source-of-truth.md §9`, `docs/VEKTRUM_MASTER_HANDBOOK.md §7` vs `src/lib/engine/gate-conditions.ts` | Public = **10 lender-facing conditions**; registry = 14 evaluated checks including pre-checks and the AI precondition. Handbook explains 2 of the 4 extras. `ACTOR_AUTHORIZED` and `SOV_BALANCE_VALID` remain unexplained in public framing. **Keep saying 10.** Needs founder confirmation |
| **C2** | Pricing described as internal/unvalidated in the founder brief, but 1%, $0-until-release, and contractor-free are **already published** on `/pricing` | Founder brief 2026-08-08 vs `src/app/(marketing)/pricing/page.tsx` metadata | Treat 1% / $50 / contractor-free as **published**; treat 0.70% / 0.65% as internal. Do not benchmark any of them |
| **C3** | Working branch recorded as `site-truth-lock`; repo default is `main` with feature branches merging in | `docs/ai/MASTER_CONTEXT.md` vs `git branch -a` | Memory file is stale. Non-material to research; flagged for Memory Steward |
| **C4** | Outbound partner webhooks: memory says do not claim live unless implemented (open P0 item); partner API doc describes signed `release.authorized` delivery as available per-integration | `docs/ai/MASTER_CONTEXT.md`, `docs/ai/BACKLOG.md` P0 #3 vs `docs/api/partner-api.md` §Webhooks (Outbound) | **Unresolved.** Research treats outbound webhooks as **not confirmed**. Vektrum's own docs are not evidence of Vektrum's capability |
| **C5** | AAL2 described as "current working requirement" in founder brief vs "✅ Built" for privileged admin actions in handbook §14 | Founder brief vs handbook | Low materiality. Treat as: built for privileged admin actions; broader AAL2 posture is a working requirement |
| **C6** | `docs/site-positioning-source-of-truth.md` last-updated 2026-04-25 vs founder brief 2026-08-08 | — | Where the founder brief and positioning doc agree, no issue; they do agree on every custody, AI, and role boundary. No override needed |

---

## 11. Change log

| Date | Change | By |
|------|--------|-----|
| 2026-08-08 | Initial creation. Product truth extracted from `docs/site-positioning-source-of-truth.md`, `docs/VEKTRUM_MASTER_HANDBOOK.md`, `docs/where-vektrum-plugs-in.md`, `docs/ai/MASTER_CONTEXT.md`, `docs/api/partner-api.md`, and `src/lib/engine/gate-conditions.ts`. Six material conflicts recorded (C1–C6). Seven unknowns opened (U-1–U-7) | Market Research Agent build |

**Update protocol:** this file changes only when *product truth* changes. Market findings never edit this file — they live in `research/`. When product truth does change, add a change-log row, update the affected section, and re-check whether any conflict in §10 is now resolved.
