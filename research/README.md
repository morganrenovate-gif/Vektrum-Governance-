# Vektrum Market Research System

An evidence-first research workspace. Everything here is designed so that a claim can be traced back to a source, a number back to a formula, and a recommendation back to the evidence that would overturn it.

**Research budget: $0.** Public, lawful, freely accessible sources only. No paywall bypass, no authentication bypass, no robots-restriction bypass.

---

## What lives here

| Path | What it is |
|------|-----------|
| `../VEKTRUM_CONTEXT.md` | Product source of truth. Read first, always. Governs every product statement research makes |
| `../.claude/agents/vektrum-market-researcher.md` | The agent definition — operating loop, source hierarchy, sizing rules, quality gates |
| `RESEARCH_PLAN.md` | Decisions to support, questions, hypotheses, research order, completion criteria |
| `ASSUMPTIONS_AND_QUESTIONS.md` | Live register — every assumption, its confidence, and how it gets validated |
| `SOURCE_LOG.csv` | Every source ever used, with verification status. The spine of the whole system |
| `templates/` | Reusable output formats |
| `briefs/` | Completed decision briefs, `YYYY-MM-DD-<slug>.md` |

---

## How to invoke the agent

In Claude Code:

```
Use the vektrum-market-researcher agent to answer: <your research question>
```

Or by name:

```
@vektrum-market-researcher <your research question>
```

The agent has `Read`, `Grep`, `Glob`, `Write`, `Edit`, `WebSearch`, and `WebFetch`. It writes only inside `research/` (plus `VEKTRUM_CONTEXT.md` when product truth changes). It has no `Bash`, no ability to run code, and no outreach capability of any kind.

### What makes a good input

A good research request names a **decision**. A bad one names a **topic**.

| Weak | Strong |
|------|--------|
| "Research construction lenders" | "Which of construction lenders vs. private credit funds should we approach for the first pilot, and what evidence do we still need?" |
| "How big is the market?" | "What is the bottom-up serviceable draw volume for US non-bank construction lenders under $500M AUM, and what's the sensitivity range?" |
| "Who are our competitors?" | "Does any current draw-management platform *enforce* release conditions server-side, or do they all advise? Verify against product docs" |

Include, when you know them: the geography, the time horizon, the decision deadline, and how reversible the decision is. A cheap reversible decision needs less evidence than an expensive irreversible one, and the agent will calibrate.

Say so explicitly if you want the agent to stop short of a recommendation and just gather evidence.

### What you get back

The twelve-section format in the agent definition §10 — answer first, research diary last or not at all. Every number traceable to a source ID in `SOURCE_LOG.csv`.

---

## How to read confidence levels

The agent uses four levels, and they mean specific things:

| Level | What it means | What you should do |
|-------|--------------|-------------------|
| **High** | Multiple verified primary sources agree. Counterevidence was sought and is weak | Act on it |
| **Medium** | Directionally supported. Some sources unverified or single-sourced. Counterevidence exists but doesn't overturn | Act if the decision is cheap or reversible; otherwise validate first |
| **Low** | Mostly inference and hypothesis. Key inputs unverified | Don't commit spend or headcount. Run the named validation action |
| **Insufficient** | The evidence doesn't support any recommendation | Don't force it. The agent will tell you exactly what would resolve it |

**"Insufficient" is a real answer and a good one.** The system is deliberately built so the agent can decline to pick a winner. If you find yourself pushing it to choose anyway, you are asking it to guess, and it will tell you that's what's happening.

### Verification status matters as much as confidence

Sources carry a status in `SOURCE_LOG.csv`:

- `VERIFIED` — the page was fetched and read in context. Can support a `[FACT]`.
- `UNVERIFIED-SNIPPET` — search returned a title and snippet, but the page could not be opened. **Can never support a `[FACT]`**, and can never anchor a recommendation.
- `INACCESSIBLE` — paywalled, gated, or blocked. Unusable.

This distinction is not pedantry. In this environment, network egress policy blocks direct fetching of many high-value domains — census.gov, fred.stlouisfed.org, leg.state.nv.us, and nist.gov all returned `EGRESS_BLOCKED` during the 2026-08-08 build. So a lot of otherwise excellent government sourcing currently lands as `UNVERIFIED-SNIPPET`. That is a real limit on current confidence, and the honest way to handle it is to show it rather than round it up.

**If you need a `VERIFIED` government figure today, the practical path is to open the URL yourself, read it, and paste the figure with its context** — then the agent logs it as verified-by-founder with the date.

---

## Evidence labels

Every substantive statement carries one:

- `[FACT]` — logged source or inspected code, with a source ID or file path
- `[INFERENCE]` — derived from stated facts, derivation shown
- `[INTERNAL]` — Vektrum-supplied, not independently verified. Never market evidence
- `[HYPOTHESIS]` — awaiting validation, with a validation method

An `[INTERNAL]` claim does not become a `[FACT]` by being repeated confidently. This is the guard against the most common failure in founder-led research: believing your own pitch deck.

---

## How to update the agent's knowledge safely

**Product truth changed** (new capability shipped, boundary moved, pricing confirmed):
1. Edit the relevant section of `../VEKTRUM_CONTEXT.md`.
2. Add a row to its change log with the date and what changed.
3. Check §10 — did this resolve a recorded conflict? Mark it resolved.
4. Do **not** put market findings in this file. Market findings live in `briefs/`.

**New evidence found:**
1. Append to `SOURCE_LOG.csv` — never edit an existing row's URL or excerpt. Supersede with a new row and note it.
2. If it changes an assumption, update `ASSUMPTIONS_AND_QUESTIONS.md` and adjust the confidence.
3. If it contradicts an existing brief, add a dated note at the top of that brief. Briefs are historical records; don't silently rewrite conclusions.

**An assumption got validated or killed:**
Update its status in `ASSUMPTIONS_AND_QUESTIONS.md`, record what validated it, and check whether any brief that relied on it now needs a correction note.

**Pricing gets confirmed:**
Update `VEKTRUM_CONTEXT.md` §7, then — and only then — the agent may model revenue with real rates instead of the `<VEKTRUM_RATE>` placeholder.

---

## What the agent will not do

- Contact anyone, ever. It drafts outreach; a human sends it, with explicit authorization
- Publish anything, anywhere
- Make purchases or create accounts
- Bypass paywalls, logins, or robots restrictions
- Touch product code, tests, or migrations
- Give legal advice or state legal conclusions — legal matters come back as questions for counsel
- Publish or benchmark the unconfirmed 0.70% / 0.65% / $50 pricing figures
- Describe Vektrum as holding or moving funds, or AI as approving releases
