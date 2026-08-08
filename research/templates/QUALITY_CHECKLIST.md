# Research Quality Checklist

Run before presenting **any** research output. **If a report fails a gate, revise it before presenting it** — do not present it with an apology attached. A caveat is not a fix.

Each gate below states what it catches and what failure actually looks like, because a checklist of abstractions is easy to pass without reading.

---

## Gate 1 — Citation integrity

- [ ] Every source cited exists, at the URL given, with the title given
- [ ] No URL was constructed, guessed, or pattern-matched from a known domain
- [ ] Every quote is verbatim from a source actually read
- [ ] Every date is the source's real publication or update date, not an inference from context
- [ ] Every source ID resolves to a row in `SOURCE_LOG.csv`

> **Failure looks like:** a plausible-looking government URL that 404s. A quote that is a paraphrase presented in quotation marks. A date inferred from a copyright footer. This is the worst failure mode available — everything downstream inherits the fabrication, and one bad citation destroys the credibility of a whole brief.

## Gate 2 — Numbers are traceable

- [ ] Every material number carries a source ID
- [ ] Every derived number shows its formula and each input's source
- [ ] Units, currency, geography, and date are stated for every figure
- [ ] Precision matches the worst input — no three-significant-figure output from ±40% inputs
- [ ] Flow and stock are never mixed in one arithmetic chain

> **Failure looks like:** "the serviceable market is $4.7B" with no visible arithmetic. Or multiplying a loan *stock* by a fee rate to get annual revenue.

## Gate 3 — Currency of claims

- [ ] Claims about the present rest on current sources, not model memory
- [ ] Competitor capability claims were re-verified this cycle, not carried forward
- [ ] Market figures carry their as-of date visibly
- [ ] Anything stale is flagged as stale

> **Failure looks like:** describing a competitor's AI as "document extraction only" using a source from before their agentic product launched.

## Gate 4 — Conflicting evidence disclosed

- [ ] Contradictory sources are shown, not dropped
- [ ] Internal inconsistencies within a source are named
- [ ] The counterevidence section says what was searched for and not found, not just what was found
- [ ] Single-sourced claims say "single-sourced" in words

> **Failure looks like:** picking the C&D loan figure that supports the bigger market and not mentioning the one that doesn't. See S-002/S-003, which openly contradict each other.

## Gate 5 — Product facts vs market facts

- [ ] Vektrum capability claims cite code or repo docs, not market sources
- [ ] Market claims cite external sources, not Vektrum documents
- [ ] `[INTERNAL]` claims are never used as evidence that a market need exists
- [ ] No `[INTERNAL]` claim was promoted to `[FACT]` by repetition

> **Failure looks like:** citing the Vektrum handbook as evidence that competitors don't enforce release conditions. That is Vektrum's belief about competitors, not evidence about them.

## Gate 6 — Custody boundary

- [ ] Vektrum is never described as holding, moving, transmitting, or taking custody of funds
- [ ] Vektrum is never called a bank, escrow provider, lender, payment processor, money transmitter, title company, trustee, or fiduciary
- [ ] Both rails are represented accurately where execution is described
- [ ] No banned phrase from `VEKTRUM_CONTEXT.md` §6 appears anywhere, including in tables, footnotes, and file names

> **Failure looks like:** "Vektrum never touches money" — banned, because on the Stripe rail Vektrum's instruction initiates the transfer.

## Gate 7 — AI boundary

- [ ] AI is described as a precondition that informs, never as approving, clearing, or deciding
- [ ] The gate, not the AI, is described as making the decision
- [ ] Competitor AI is described using *their* verified authority model, not ours

> **Failure looks like:** "AI-powered releases." Also: assuming a competitor's AI is advisory because ours is.

## Gate 8 — Role boundaries

- [ ] Admins are never portrayed as release authorities
- [ ] The funder is identified as the release trigger
- [ ] Users and stakeholders are not silently reclassified as buyers
- [ ] The buying committee keeps buyer, champion, user, blocker, compliance reviewer, and release authority distinct

> **Failure looks like:** "contractors are a key customer segment." Contractors are users who pay nothing (`VEKTRUM_CONTEXT.md` §7).

## Gate 9 — Market sizing integrity

- [ ] Total construction spending is never presented as the addressable market
- [ ] All seven ladder rungs are distinct and separately sourced
- [ ] Double-counting risks are named specifically, not waved at
- [ ] Bottom-up and top-down are reconciled, and the gap is explained
- [ ] Sensitivity ranges are stated
- [ ] Revenue uses `<VEKTRUM_RATE>` until pricing is confirmed

> **Failure looks like:** "$2.2T construction market." That is rung 1 of 7 and is not addressable by anyone. The repo already has precedent here — a precise "$2.19 trillion" claim was softened for lack of a source (`docs/VEKTRUM_MASTER_HANDBOOK.md` §2738/§2768).

## Gate 10 — Competitive consistency

- [ ] Every alternative evaluated against identical criteria
- [ ] No company labeled a competitor on the strength of an article or listicle
- [ ] Capability claims verified against official product materials
- [ ] The status quo appears as a named alternative
- [ ] Unverified candidates are labeled `unverified_candidate`

> **Failure looks like:** a matrix where Vektrum is scored on enforcement and rivals are scored on UI.

## Gate 11 — Legal posture

- [ ] Every legal item is a question or a risk, never a conclusion
- [ ] No statement asserts what Vektrum "is not required to" do under any law
- [ ] Items needing counsel are named as such with a written question
- [ ] The architecture is described accurately without implying its legal consequence

> **Failure looks like:** "because Vektrum never holds funds, money transmission licensing does not apply." That is a legal conclusion, and it is not ours to draw.

## Gate 12 — Verification honesty

- [ ] Every source carries a verification status
- [ ] No `UNVERIFIED-SNIPPET` source carries a `[FACT]` label
- [ ] No `UNVERIFIED-SNIPPET` source anchors a recommendation
- [ ] Blocked or inaccessible sources are logged as such, not quietly dropped
- [ ] The brief states plainly which figures still need manual verification

> **Failure looks like:** presenting a search-snippet figure as an established government statistic because the domain was `census.gov`.

## Gate 13 — Pricing discipline

- [ ] The unconfirmed 0.70% / 0.65% / $50 figures are not published, benchmarked, or recommended
- [ ] Published pricing is described as *published*, never as *validated*
- [ ] Competitor pricing comes from official pages, filings, or procurement records

## Gate 14 — Decision usefulness

- [ ] The output answers a decision, not a topic
- [ ] The answer leads; the diary does not
- [ ] Confidence is stated and justified
- [ ] Assumptions are named with register IDs
- [ ] Falsification tests are pre-registered and specific
- [ ] Next actions are ranked, with **one** named as highest value
- [ ] If evidence is insufficient, the brief says so instead of manufacturing a winner

> **Failure looks like:** a well-cited, comprehensive, beautifully formatted document that leaves the reader unable to decide anything. Length and citation count are not the deliverable — a decision is.

---

## Sign-off

| Gate | Pass | Revision required |
|------|------|-------------------|
| 1 Citation integrity | | |
| 2 Numbers traceable | | |
| 3 Currency | | |
| 4 Conflicts disclosed | | |
| 5 Product vs market | | |
| 6 Custody boundary | | |
| 7 AI boundary | | |
| 8 Role boundaries | | |
| 9 Sizing integrity | | |
| 10 Competitive consistency | | |
| 11 Legal posture | | |
| 12 Verification honesty | | |
| 13 Pricing discipline | | |
| 14 Decision usefulness | | |

**Revisions made before presenting:** <list, or "none">
