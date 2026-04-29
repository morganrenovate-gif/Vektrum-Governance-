# Vektrum Master Handbook

**Source-of-truth status:** Current as of 2026-04-29  
**Branch:** `claude/affectionate-satoshi-56db08` → `main`  
**Last major updates:** Homepage alignment · Pitch deck alignment · Demo-live Harbor Draw #3 · Ops dashboard test-mode clarity  
**Maintained by:** Adam Morgan, Co-Founder

---

## 0. How to Use This Handbook

This is the founder operating manual for Vektrum. Use it as your single source of truth before:

- **Partner meetings** — title companies, lenders, escrow, treasury operators
- **Investor calls** — Seed/Series A conversations, Peachscore profile, pitch prep
- **Product demos** — Harbor Draw #3 walkthrough, funder/contractor/admin personas
- **Build sessions with Claude** — exact positioning, feature truth, prompt templates
- **Copy reviews** — homepage, pitch deck, email templates, partner docs
- **Internal planning** — roadmap, pilot readiness, weekly rhythm

**How to navigate:** Every section header is anchor-linked in the Quick Index (Section 1). Use Cmd+F / Ctrl+F in any editor or browser to jump directly. Sections are self-contained — you do not need to read front-to-back.

**Discipline rules:**
- Section 5 is the definitive list of what is built vs. not built. Do not claim anything in "do not claim yet" as live.
- Section 16 contains the approved/banned language list. Use it before writing any copy.
- Section 7 has the exact 10-gate conditions. Do not paraphrase them differently anywhere.

---

## 1. Quick Index

| # | Section | Use When |
|---|---------|----------|
| [2](#2-one-page-vektrum-summary) | One-Page Summary | Partner intro, investor cold open, first email |
| [3](#3-what-vektrum-is) | What Vektrum Is | Category positioning, investor framing |
| [4](#4-what-vektrum-is-not) | What Vektrum Is Not | Objection handling, compliance posture |
| [5](#5-current-product-truth) | Current Product Truth | Build sessions, due diligence, pilot planning |
| [6](#6-core-product-workflow) | Core Workflow | Demo prep, partner meetings, pitch deck |
| [7](#7-the-10-condition-release-gate) | The 10-Condition Gate | Gate questions, security reviews, pitch Q&A |
| [8](#8-ai-draw-control-brief) | AI Draw Control Brief | AI framing, product questions, copy review |
| [9](#9-contract--docusign-flow) | Contract + DocuSign | Contract questions, partner integrations |
| [10](#10-schedule-of-values--milestone-linking) | Schedule of Values | Lender meetings, SOV questions |
| [11](#11-evidence-lien-waivers-change-orders) | Evidence + Lien Waivers | Fraud-risk framing, compliance conversations |
| [12](#12-payment-rails) | Payment Rails | Rail questions, Stripe confusion, non-custody |
| [13](#13-partner-api) | Partner API | Title/escrow/treasury partner meetings |
| [14](#14-audit-trail--security) | Audit Trail + Security | Security questions, institutional due diligence |
| [15](#15-demo-system) | Demo System | Before any demo, Harbor script |
| [16](#16-homepage-pitch-and-copy-rules) | Copy Rules | Before writing anything public |
| [17](#17-partner-types-and-value-propositions) | Partner Value Props | Meeting prep, one-pager customization |
| [18](#18-partner-meeting-playbook) | Meeting Playbook | Before any external meeting |
| [19](#19-scripts) | Scripts | Email drafts, intros, follow-ups |
| [20](#20-objection-handling) | Objection Handling | Q&A prep, investor questions |
| [21](#21-fraud-risk-reduction-framing) | Fraud-Risk Framing | Lender/title conversations |
| [22](#22-legal--compliance--non-custody-language) | Legal / Compliance | Copy review, investor diligence |
| [23](#23-competitive-positioning) | Competitive | Investor comparables, partner differentiation |
| [24](#24-product-packaging) | Packaging | Pricing conversations, pilot structure |
| [25](#25-current-build-status) | Build Status | Claude sessions, due diligence |
| [26](#26-what-is-missing--gaps) | Gaps | Roadmap planning, honest investor conversation |
| [27](#27-build-roadmap) | Build Roadmap | Pilot prep, investor milestone framing |
| [28](#28-pilot-onboarding-playbook) | Pilot Playbook | First customer setup |
| [29](#29-founder-weekly-operating-rhythm) | Weekly Rhythm | Monday planning, weekly review |
| [30](#30-glossary) | Glossary | Internal alignment, partner onboarding |
| [31](#31-claude-prompt-library) | Claude Prompts | Build sessions, copy tasks |
| [32](#32-appendix) | Appendix | Git, QA checklists, deployment |
| [33](#33-full-page-route-map) | Page Route Map | Navigation, smoke testing, partner links |
| [34](#34-api-integrations--credentials) | API Integrations | Credential setup, third-party services |
| [35](#35-public-site-source-of-truth) | Public Site Source of Truth | Before editing any public page |
| [36](#36-seogeo-foundation) | SEO/GEO Foundation | Metadata, robots, sitemap, llms.txt, structured data |
| [37](#37-citation-rules) | Citation Rules | Before writing any stat on a public page |
| [38](#38-resourcecontent-strategy) | Resource / Content Strategy | Article planning, /resources hub |
| [39](#39-open-graph--social-preview-standards) | OG / Social Preview Standards | OG image, share-card preview |
| [40](#40-accessibility-standards) | Accessibility Standards | A11y patterns, focus, headings, ARIA |
| [41](#41-funder-segmentation-rules) | Funder Segmentation | Private lender vs. institutional rail copy |
| [42](#42-contractor-referral--invite-flow) | Contractor Referral / Invite | Invite copy, "Tell your funder" path |
| [43](#43-public-copy-guardrails) | Public Copy Guardrails | Banned phrases, approved language, non-custody |
| [44](#44-content-publishing-checklist) | Content Publishing Checklist | Before publishing any new article |
| [45](#45-pre-merge-website-qa-checklist) | Pre-Merge Website QA | Before merging any public-page PR |

---

## 2. One-Page Vektrum Summary

### One Sentence

Vektrum is conditional authorization infrastructure for construction disbursements — it enforces release conditions before capital moves, and records proof of every authorization decision.

### One Paragraph

Construction draw releases are currently governed by memory, email, and spreadsheets. A funder approves a draw, and money moves — regardless of whether lien waivers are filed, change orders are resolved, contracts are signed, or evidence is sufficient. Vektrum sits between draw approval and payment execution. Before any disbursement is authorized, Vektrum evaluates 10 server-side conditions simultaneously: is the milestone approved, is the contract signed, is the balance sufficient, is the lien waiver on file, are change orders cleared? Only when all conditions pass does Vektrum issue an authorization signal. Execution then happens through Stripe Connect or the partner's existing treasury, title, escrow, or wire process. Vektrum never holds funds.

### One Minute (Spoken)

> "Construction lenders approve draws manually — by email, spreadsheet, or habit. The problem isn't that they don't care about conditions, it's that there's no system that enforces them. A lien waiver can be missing, a change order open, a contract unsigned — and the wire still goes out.
>
> Vektrum is the enforcement layer between approval and disbursement. Before funds move, we check 10 release conditions server-side: milestone approval, signed contract, lien waiver, no open change orders, funded balance, contractor account verified, no duplicate release. Every condition must pass. If one fails, release is blocked.
>
> We don't move the money. We tell the rail — Stripe or your existing title and treasury process — whether release is authorized. The execution stays with you. We just make sure the conditions were met and create an immutable record of the decision."

### Current Positioning

> Vektrum is **conditional authorization infrastructure** for construction disbursements.

Alternative framings (all approved):
- Release-control infrastructure
- Construction disbursement governance
- Authorization separated from execution
- The enforcement layer between draw approval and payment execution

### What Vektrum Does

- Verifies release conditions before authorizing disbursement
- Runs a 10-condition server-side release gate
- Manages the contract-to-authorization workflow (DocuSign → SOV → draw → evidence → gate → auth)
- Provides AI-assisted draw pre-review as a precondition (not an approver)
- Records authorization, proof, and audit evidence in an append-only hash-chained log
- Issues authorization signals to Stripe Connect or external payment rails
- Provides a Partner API for title, escrow, treasury, and institutional partners
- Gives funders, contractors, and admins role-appropriate dashboards

### What Vektrum Does Not Do

- Does not hold, custody, or escrow funds
- Does not execute wires, ACH, or direct bank transfers
- Does not replace title companies or escrow agents
- Does not act as a bank, lender, or money transmitter
- Does not use AI to approve or authorize releases
- Does not guarantee fraud prevention
- Does not replace project management software (Procore, Built, Rabbet)

---

## 3. What Vektrum Is

### Conditional Authorization Infrastructure

Vektrum's primary function is authorization — determining whether a specific disbursement is allowed to proceed at a specific moment in time, under specific conditions. The word "conditional" is important: authorization is not blanket approval of a project. It is a per-release, per-milestone evaluation that every condition is currently met.

### Release-Control Layer

Vektrum occupies a position between two existing systems:
- **Upstream:** Draw approval (funder review, milestone approval, AI pre-review)
- **Downstream:** Payment execution (Stripe Connect, wire, ACH, title/escrow process)

Vektrum controls the handoff between these two. It does not own approval (that's the funder's judgment) and does not own execution (that's the rail's job). It owns the gate.

### System of Enforcement

Most construction finance tools are systems of record — they track, store, document, route. Vektrum is a system of enforcement. It does not just record that conditions exist. It blocks release when conditions fail. The distinction matters to lenders and institutional partners because enforcement is what creates liability protection and audit proof.

### Authorization Separated from Execution

This is the core architectural principle:

```
[Funder Approval] → [Vektrum Gate] → [Authorization Signal] → [Execution Rail]
                          ↑
                   Vektrum owns this
```

The authorization (Vektrum) and the execution (Stripe, title, wire) are separate events with separate records. This is not incidental — it is by design, so that Vektrum never holds or transmits funds and so that partners can keep their existing execution infrastructure.

### Construction Disbursement Governance

Vektrum is purpose-built for construction finance. It understands draw cycles, SOVs, lien waivers, milestone sequencing, retainage, change orders, and contractor/funder/inspector roles. It is not a generic payments API retrofitted to construction.

---

## 4. What Vektrum Is Not

Use this section to preempt incorrect assumptions before they calcify.

### Not a Bank

Vektrum holds no deposit accounts, issues no credit, and is not chartered as a financial institution. There is no Vektrum bank account that funds pass through.

### Not Escrow

Vektrum does not receive funds from funders and hold them pending disbursement. Funds sit with Stripe (on the Stripe rail) or with the funder's existing title company, escrow agent, or institutional treasury (on the external rail). Vektrum's authorization signal is not an escrow release instruction — it is a release-condition verification that the partner acts upon.

### Not a Lender

Vektrum does not originate, underwrite, fund, or service construction loans. It does not decide whether a project should be financed. It governs whether an already-approved draw should be disbursed under current conditions.

### Not a Money Transmitter

Vektrum does not receive money from one party and transmit it to another. On the Stripe rail, Stripe Connect controls the movement of funds. On the external rail, the funder or their institutional partner controls movement. Vektrum issues an authorization signal, not a payment instruction.

### Not a Payment Processor

Payment processing (authorization of card/ACH transactions, settlement, merchant acquiring) is not what Vektrum does. Stripe Connect is the payment processor on the Stripe rail. Vektrum uses Stripe as an execution rail — it is not itself a Stripe replacement or equivalent.

### Not a Replacement for Title or Escrow

Title companies and escrow agents serve licensed functions — holding funds pending closing, ensuring clear title, managing disbursement schedules. Vektrum does not replace these functions. On the external rail, title and escrow partners keep their existing roles. Vektrum adds a release-condition check before they execute.

### Not AI-Only Approval

AI is a precondition that runs before the deterministic 10-condition gate. AI flags missing evidence, stale reviews, and critical risk. AI cannot authorize a release. The gate makes the enforcement decision. A passing AI review does not bypass any gate condition.

### Not Project Management Software

Vektrum is not Procore, Built, Rabbet, Land Gorilla, or any draw management platform. It does not track submittals, manage RFIs, create schedules, or route inspections. It is the enforcement layer that sits downstream of wherever those tools live.

### Not a Procore Clone

The confusion risk: construction + software = Procore comparison. The correct reframe: "Procore tracks what happened. Vektrum controls whether the money moves."

---

## 5. Current Product Truth

### Built and Real (Production-Grade)

| Feature | Status |
|---------|--------|
| Contract upload to deal | ✅ Built |
| DocuSign envelope creation + funder/contractor signing | ✅ Built |
| DocuSign signed-contract-on-file gate enforcement | ✅ Built |
| Schedule of Values (SOV) creation and management | ✅ Built |
| Milestone-to-SOV line item linking | ✅ Built |
| Evidence and milestone document uploads | ✅ Built |
| Lien waiver support (where required by deal config) | ✅ Built |
| AI Draw Control Brief (Perplexity-powered pre-review) | ✅ Built |
| 10-condition server-side release gate | ✅ Built |
| Deal Control Center / Release Readiness panel | ✅ Built |
| Funder-triggered release authorization | ✅ Built |
| Stripe Connect automated execution rail | ✅ Built |
| External/manual partner-controlled execution rail | ✅ Built |
| External release confirmation (method, proof, reference) | ✅ Built |
| SLA tracking on external releases | ✅ Built |
| Hash-chained append-only audit log | ✅ Built |
| Admin audit log with dual-logging and justification | ✅ Built |
| Hourly Stripe reconciliation (6-pass) | ✅ Built |
| Notifications center / activity feed | ✅ Built |
| Partner API (release fetch, confirm, fail) | ✅ Built |
| Admin ops dashboard (stuck releases, payout failures, webhook health) | ✅ Built |
| Ops release health with test/live mode awareness | ✅ Built |
| Role separation (funder-triggered, admin cannot release) | ✅ Built |
| MFA / AAL2 for privileged admin actions | ✅ Built |
| RLS row-level security on all tables | ✅ Built |
| Demo-live Harbor Draw #3 guided story | ✅ Built |
| Homepage aligned with actual release-control workflow | ✅ Built |
| /pitch deck aligned with current product truth | ✅ Built |

### Built but Needs QA

| Feature | Status |
|---------|--------|
| DocuSign void/cancel envelope flow | ⚠️ Built, needs full QA |
| Demo reset button (contractor state may not fully reset) | ⚠️ Known partial reset gap |
| `/auth/logout` route (verify no 404) | ⚠️ Needs smoke verification |
| Admin dashboard user-detail navigation | ⚠️ Needs route verification |
| Partner API outbound webhooks | ⚠️ Not implemented — docs must not claim live |

### Demo-Live Story (Demo Rail Only — Not Real Releases)

| Component | Status |
|-----------|--------|
| Harbor deal (Harbor Logistics, $9.1M) | ✅ Demo fixture |
| Harbor Draw #3 — Structural Steel — $2,180,000 | ✅ Demo fixture |
| Perplexity AI Draw Control Brief — score 91/100 | ✅ Demo fixture |
| 5-step workflow spine in harbor page | ✅ Demo fixture |
| DocuSign contract status card | ✅ Demo fixture |
| Evidence panel (4 docs including lien waiver) | ✅ Demo fixture |
| Audit timeline (15 events) | ✅ Demo fixture |
| Contractor Draw #3 status banner | ✅ Demo fixture |
| Funder Harbor Draw #3 hero action card | ✅ Demo fixture |

### Partially Built

| Feature | Status |
|---------|--------|
| Configurable lien-waiver requirement (per deal) | Partial — gate checks it, UI config incomplete |
| Retainage configuration | Partial — math helpers exist, full UI not exposed |
| Change order approval workflow | Partial — open CO blocks release; CO management UI minimal |
| Partner lifecycle management console | Partial — API keys exist, no full partner dashboard |
| Deal closeout / audit packet export | Not started |

### Future / Backlog

| Feature | Note |
|---------|------|
| Configurable governance policies per deal | Planned |
| Deal authority model (who can approve what amounts) | Planned |
| Evidence requirements matrix (what docs are required per milestone type) | Planned |
| Exception / waiver workflow | Planned |
| Dual-control approvals for high-value releases | Planned |
| External payment instruction metadata | Planned |
| Reconciliation lifecycle dashboard | Planned |
| Customer billing / invoicing | Planned |
| Production readiness runbooks | Planned |
| Reporting dashboard for funders | Planned |
| White-label / embedded / headless modes | Future |

### Do Not Claim Yet

- Outbound partner webhooks (planned, not implemented)
- Fraud prevention / fraud elimination (say "fraud-risk reduction")
- Tamper-proof audit log (say "tamper-evident" or "hash-chained")
- AI approves payments (AI informs only)
- Vektrum moves money / Vektrum executes wires
- All funds held by Stripe (external rail funds are not held by Stripe)
- Stripe required (external rail requires no Stripe account)
- Paying customers / live revenue (pre-revenue)

---

## 6. Core Product Workflow

Every draw release in Vektrum follows this sequence. This is the end-to-end story.

```
1. Contract Uploaded
   └─ Funder or admin uploads executed construction contract to the deal

2. DocuSign Executed
   └─ Vektrum sends DocuSign envelope to funder + contractor
   └─ Both parties complete embedded signing
   └─ Contract status becomes 'signed'
   └─ Gate condition 8 (signed contract on file) is now satisfiable

3. Schedule of Values Created
   └─ SOV created with line items matching contract scope
   └─ Each SOV line item carries: description, contract value, drawn amount, remaining
   └─ SOV is approved before draws can be linked

4. Milestone / Draw Linked to SOV
   └─ Draw milestone linked to a specific SOV line item
   └─ Ensures every disbursement traces to an approved contract value

5. Evidence + Lien Waiver Attached
   └─ Contractor uploads: inspection report, draw request, site photos
   └─ Conditional lien waiver uploaded where deal requires it
   └─ Gate condition 10 (approved lien waiver) is satisfiable

6. AI Draw Control Brief Generated
   └─ Perplexity AI reviews the draw package
   └─ Checks: document completeness, conflict detection, milestone readiness, risk score
   └─ Output: AI Draw Control Brief with risk level and recommendation
   └─ If risk is critical or review is stale (>48h): AI precondition blocks gate
   └─ AI informs — does not approve

7. 10-Condition Release Gate Evaluates
   └─ Server-side, atomic, all 10 conditions evaluated simultaneously
   └─ Any failure blocks release and returns all failures at once
   └─ No UI bypass, no role bypass, no feature flag bypass

8. Funder Authorizes
   └─ Funder reviews Release Readiness panel in Deal Control Center
   └─ Funder clicks "Authorize Release"
   └─ Authorization signal recorded with timestamp, actor, method, proof

9. Execution Rail
   └─ Stripe Connect: Vektrum instructs Stripe → Stripe transfers → contractor paid
   └─ External: Vektrum issues auth signal → funder/title/treasury executes → confirms in Vektrum

10. Audit Trail Records the Release
    └─ Every step above is recorded in the hash-chained audit log
    └─ Actor, timestamp, method, proof, state transition — permanently logged
```

---

## 7. The 10-Condition Release Gate

The gate is deterministic, server-side, and atomic. All 10 conditions must pass simultaneously. A failure on any condition blocks release and returns all failed conditions together. There is no partial pass. There is no UI path around the gate. There is no role that can bypass it.

### The 10 Conditions

| # | Condition | What it checks | Why it matters |
|---|-----------|----------------|----------------|
| 1 | **Milestone approved by funder** | `milestone.status === 'approved'` | Funder must have explicitly approved the milestone — not just created it |
| 2 | **Protection status cleared for release** | `milestone.protection_status === 'ready_for_release'` | Milestone must not be under a dispute hold or protection flag |
| 3 | **Funded balance covers disbursement + fee** | `funded_amount - released_amount - fees - reserved ≥ milestone_amount + fee` | Prevents releasing more than the deal holds — over-advancing protection |
| 4 | **Contractor payment account verified for selected rail** | Stripe payouts enabled (Stripe rail) or skipped (external rail) | Prevents releasing to an incomplete contractor Stripe account |
| 5 | **Contractor onboarding complete** | `contractor.onboarding_complete === true` | Contractor must have completed platform onboarding |
| 6 | **No existing active release on this milestone** | No `pending` or `confirmed` release exists | Prevents duplicate releases against the same milestone |
| 7 | **No unresolved change orders** | No change orders with `status: 'submitted'` on this milestone | Change orders must be resolved before funds move |
| 8 | **Signed contract on file** | A non-voided contract with `status === 'signed'` exists on the deal | DocuSign execution is a hard prerequisite for any release |
| 9 | **Sequential prerequisites satisfied** | Prior milestones released, explicit prerequisites met | Enforces sequential disbursement order where configured |
| 10 | **Approved conditional lien waiver on file where required** | If `deal.lien_waiver_required === true`, an approved conditional lien waiver exists | Lien exposure protection — prevents releasing without waiver coverage |

### Pre-Check (Not a Numbered Condition)

Before the 10 conditions evaluate, the gate runs a fast-path check: if `deal.status === 'frozen'`, the gate returns immediately with a frozen-deal block. This is not condition 10 or any numbered condition — it is a deal-level safety check that short-circuits before condition evaluation.

### Why the Gate Matters

Without the gate:
- A funder can approve a draw with an open change order and no lien waiver
- A duplicate release can be triggered concurrently
- Funds can be released to an incomplete contractor account
- A release can occur on a frozen deal

With the gate, all of these scenarios are blocked server-side — not just in the UI, but in the API. No role, no flag, no calling convention can bypass it.

### What the Gate Is Not

The gate is not:
- An AI decision engine (AI is a separate precondition that runs before the gate)
- A UI checklist (it is enforced at the API layer)
- An advisory system (it blocks, it does not warn)
- A fraud detector (it enforces conditions; it cannot detect fraud in uploaded documents)

### AI Precondition (Separate from the Gate)

The AI Draw Control Brief runs as a precondition before the gate:
- If AI risk level is `critical` → blocks gate evaluation
- If AI review is older than 48 hours → blocks gate evaluation
- If AI is unavailable → defaults to `critical` (fail-safe)
- If AI passes → gate evaluates normally

Admin can override the AI precondition with a 4-hour TTL override (requires AAL2 MFA, audit-logged).

---

## 8. AI Draw Control Brief

### What AI Reviews

The AI Draw Control Brief (powered by Perplexity) pre-screens the draw package before the deterministic gate runs. It reviews:

- **Document completeness** — are required documents present and readable?
- **Conflict detection** — are there inconsistencies between documents?
- **Milestone readiness score** — does the evidence support the stated completion percentage?
- **Risk level evaluation** — low / medium / high / critical

### What AI Can Flag

- Missing inspection reports or lien waivers
- Amount discrepancies between the draw request and SOV
- Evidence of scope changes not reflected in a change order
- Photo evidence that does not match claimed completion
- Stale evidence (uploaded months ago for a current draw)

### What Blocks the Gate

- **Critical risk level** — gate is blocked until admin reviews or overrides
- **Assessment older than 48 hours** — gate is blocked until a fresh review is run
- **Admin override** — available to admins with AAL2 MFA, time-boxed to 4 hours, audit-logged

### "AI Informs; the Gate Decides"

This is the exact architectural boundary. AI produces a risk assessment and recommendation. The deterministic 10-condition gate makes the enforcement decision. A clean AI review does not bypass any gate condition. A failed AI precondition does not skip gate evaluation — it blocks before the gate even runs.

### What Not to Claim

Do not say or write:
- "AI approves payments"
- "AI decides whether to release"
- "AI-powered release authorization"
- "Fully automated AI disbursement"
- "AI guarantees document accuracy"

Approved framing:
- "AI-assisted draw pre-review"
- "AI informs; the gate decides"
- "AI Draw Control Brief as a precondition"
- "AI screens the draw package before the gate evaluates"

---

## 9. Contract + DocuSign Flow

### Upload

A contract PDF is uploaded to the deal. Vektrum stores the document and sets the contract status to `pending_signatures`.

### Send Envelope

Vektrum creates a DocuSign envelope for the deal contract. The envelope includes:
- **Routing order 1:** Funder signs first
- **Routing order 2:** Contractor signs second
- Embedded signing URLs generated per party

### Signing States

| Status | Meaning |
|--------|---------|
| `pending_signatures` | Envelope sent, neither party signed |
| `funder_signed` | Funder completed; waiting for contractor |
| `contractor_signed` | Contractor completed; waiting for funder |
| `signed` | Both parties signed — gate condition 8 satisfiable |
| `voided` | Envelope voided — gate condition 8 fails |

### Why Signed Contract Blocks Release

Gate condition 8 requires a non-voided, fully signed contract on file. There is no release authorization possible on a deal with no signed contract. This is enforced at the API layer — no UI path or role bypass exists.

### If a Contract is Voided

If a contract is voided after releases have already occurred on the deal, the deal enters a `frozen` state. No further release is possible until admin reviews. This is the frozen-deal pre-check described in Section 7.

---

## 10. Schedule of Values + Milestone Linking

### What SOV Is

A Schedule of Values is a line-item breakdown of an executed construction contract. Each line item represents a scope of work with:
- Description (e.g., "Structural Steel Erection")
- Contract value (dollar amount allocated to that scope)
- Drawn to date (cumulative releases against that line)
- Remaining (contract value minus drawn)

### Why SOV Matters

In construction finance, the SOV is the authoritative bridge between the signed contract and the draw request. A draw without an SOV link cannot be traced to an approved contract value. Lenders use the SOV to verify that each disbursement corresponds to a contracted scope of work.

### Milestone-to-SOV Linking

Each draw milestone in Vektrum can be linked to a specific SOV line item. This creates a traceable chain:

```
Signed Contract → SOV Line Item → Milestone/Draw → Release Authorization
```

An unlinked milestone is visible in the SOV table with a "No SOV link" advisory. The gate does not block on missing SOV link (it is advisory, not a gate condition) — but it is surfaced prominently for the funder to review.

### Why It Matters to Lenders and Title/Escrow Partners

- Every disbursement is traceable to an approved contract scope
- Over-disbursement per line item is visible
- Title companies can confirm SOV alignment before authorizing a wire
- LP reporting can reference contract value vs. drawn vs. remaining per line item

---

## 11. Evidence, Lien Waivers, Change Orders

### Evidence Documents

Each milestone can have documents attached: inspection reports, site photos, draw requests, invoices, and lien waivers. Evidence is uploaded by the contractor and reviewed by the funder and AI before the gate evaluates.

Evidence types surfaced in the current product:
- Inspection reports
- Conditional lien waivers
- Draw requests
- Site photos / progress photos

### Lien Waiver Requirements

When a deal is configured with `lien_waiver_required: true`, gate condition 10 requires an approved conditional lien waiver to be on file before release is authorized. This is a hard gate condition — not advisory.

**Conditional vs. unconditional waivers:**
- Conditional (on payment) lien waivers are uploaded before the release
- Unconditional lien waivers are the gold standard but require payment first — the conditional form is the pre-release standard

**What Vektrum enforces:** Presence of an approved conditional lien waiver (where required). It does not validate the legal sufficiency of the document.

### Change Order Blockers

Gate condition 7 requires no unresolved change orders on the milestone. A change order with `status: 'submitted'` blocks release. The funder must either approve or reject the change order before release can proceed.

Change orders represent scope changes — releasing without resolving them creates ambiguity about what the disbursement covers.

### Fraud-Risk Reduction Framing

Vektrum's evidence and lien waiver requirements reduce fraud risk without eliminating it:

| Control | Risk it Addresses |
|---------|-------------------|
| Lien waiver required before release | Mechanic's lien exposure from contractor non-payment |
| Evidence documents attached | Unsupported disbursements without inspection evidence |
| Change order cleared before release | Payment for scope not yet approved |
| Signed contract required | Releases without an executed agreement |
| Role separation (funder-triggered) | Admin or contractor self-authorizing release |
| Hash-chained audit log | After-the-fact dispute about what was authorized |

**Do not claim:** Vektrum prevents fraud, eliminates lien risk, or guarantees document validity.

---

## 12. Payment Rails

### Stripe Connect Rail (Automated)

**How it works:**
1. Funder deposits capital into a Stripe-managed account (not Vektrum)
2. Vektrum runs the gate
3. On authorization, Vektrum instructs Stripe to transfer funds to the contractor's connected account
4. Stripe controls movement — Vektrum does not touch the funds
5. Transfer confirmed via Stripe webhook → ledger updated → audit entry written
6. Hourly reconciliation verifies DB ↔ Stripe ↔ ledger

**Gate condition 4 on Stripe rail:** Contractor Stripe payouts must be enabled (onboarding complete)

**Non-custody language for Stripe rail:**
> "Funds are held in Stripe-managed accounts, not by Vektrum. Vektrum instructs Stripe to transfer upon authorization. Stripe controls movement."

### External / Manual Rail (Partner-Controlled)

**How it works:**
1. Funder's capital sits in their existing treasury, escrow, title account, or bank (never Vektrum)
2. Vektrum runs the gate (gate condition 4 is skipped — no Stripe check)
3. On authorization, Vektrum issues an authorization signal
4. Funder (or their title/treasury partner) executes the wire, ACH, or check
5. Funder confirms execution in Vektrum: method, bank reference, proof document, actor
6. Confirmation recorded in audit log
7. SLA tracked — unconfirmed releases escalate after threshold

**Gate condition 4 on external rail:** Skipped (no Stripe payouts check required)

**Non-custody language for external rail:**
> "Funds never interact with Vektrum infrastructure at all. The funder or their institutional partner executes payment after Vektrum authorizes."

### What Vektrum Authorizes

- That all 10 release conditions are currently met
- That the AI precondition has been satisfied
- That the funder explicitly triggered the release

### What Vektrum Does Not Execute

- Wire transfers
- ACH transactions
- Check issuance
- Stripe payouts directly (Stripe Connect does this)
- Escrow disbursements

---

## 13. Partner API

### Who It Is For

The Partner API is for organizations that want to use Vektrum's release-condition verification before their own disbursement process. The intended partners are:

- Title companies with existing escrow/disbursement systems
- Construction lenders with internal treasury or treasury management platforms
- Escrow agents who manage construction disbursement
- Banking partners who process construction draws

### What the API Does

The Partner API gives execution-rail partners a programmatic interface to:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/milestones/[id]/release` | Fetch current release readiness state |
| `POST /api/milestones/[id]/authorize-external` | Run gate and record authorization (same as funder authorization) |
| `POST /api/releases/[id]/confirm-external` | Confirm payment executed (method, reference, proof) |
| `POST /api/releases/[id]/mark-external-failed` | Record execution failure with justification |

### Webhook Verification

Partner API endpoints use HMAC-based signature verification. Outbound webhooks to partners are planned but not yet implemented — do not claim them as live.

### Authentication

Partners authenticate with scoped API keys. Keys are hashed in the database; raw keys are shown only once at creation. Keys can be revoked per partner.

### The Long-Term Infrastructure Story

The Partner API positions Vektrum as the release-control layer that sits before any construction payment process. Rather than replacing existing payment infrastructure, it sits upstream and provides:

- Release-condition verification (gate has passed)
- Authorization proof (who authorized, when, under what conditions)
- Evidence receipt (what documents were attached)
- Audit log entry (permanent record of the release decision)

For title companies and lenders: you keep your existing disbursement process. Vektrum tells you whether the release is authorized before you execute.

---

## 14. Audit Trail + Security

### Hash-Chained Audit Log

Every significant action in Vektrum — authorization, confirmation, failure, override, status change — is written to an append-only audit log. Each entry contains:

- Event type and action
- Actor (who)
- Timestamp
- Target entity (deal, milestone, release)
- Previous state → new state
- Proof document or reference (where applicable)
- Hash of the previous entry (chain integrity)

**Why hash-chained:** Tampering with any entry breaks the chain from that point forward. The chain can be verified computationally. It is tamper-evident — not tamper-proof (the database is still under Vektrum's control, not a blockchain). Do not use the word "tamper-proof."

### Admin Audit Log

Admin-privileged write actions (protection changes, AI override, status manipulation) are separately logged with:
- Actor identity and role
- Justification text (≥ 20 characters required)
- AAL2 MFA verification at time of action
- Peer review attestation (reviewer ≠ actor, enforced at database layer)

### Role Separation

| Role | Can | Cannot |
|------|-----|--------|
| Funder | Approve milestones, trigger release, confirm external execution | Bypass gate |
| Contractor | Submit draws, upload evidence, receive payment | Release funds, self-approve milestones |
| Admin | Oversee operations, view audit log, apply time-boxed AI override | Release funds, modify financial records silently |
| Partner (API) | Fetch release state, confirm/fail external execution | Authorize Stripe releases, modify deal state |

**The most important security boundary:** Admin accounts cannot release funds. Admin compromise cannot become unauthorized disbursement.

### MFA / AAL2

Privileged admin actions require step-up MFA (AAL2):
- AI precondition override
- Protection status changes
- Any admin write that could affect release eligibility

### RLS (Row-Level Security)

Supabase RLS policies enforce tenant isolation at the database layer. Users can only access rows they are authorized to see based on their role and deal participation. Admin operations use a service-role client that bypasses RLS deliberately, with all actions audit-logged.

### Security Posture for Institutional Partners

Key claims that are true and can be stated in partner conversations:
- API keys hashed — raw keys shown once at creation, then never again
- No service-role secrets in the frontend
- Stripe webhooks HMAC-verified with event deduplication and idempotency
- Admin cannot release funds (hard enforcement at API layer)
- Audit log is append-only (no delete or update on audit entries)
- All admin writes dual-logged with justification

---

## 15. Demo System

### Overview

The demo-live system (`/demo-live`) runs entirely on client-side React state with no database calls. It simulates a complete deal workflow with three role perspectives: funder, contractor, and admin. All data is fixture data — no real Stripe calls, no real DocuSign calls, no real database writes.

The featured demo is **Harbor Draw #3** — a $2,180,000 disbursement for Structural Steel Erection on the Harbor Logistics deal ($9.1M total contract value).

### Demo Routes

| Route | Persona |
|-------|---------|
| `/demo-live/funder` | Funder portfolio view + Harbor Draw #3 hero action |
| `/demo-live/contractor` | Contractor dashboard + Draw #3 status banner |
| `/demo-live/admin` | Admin operations overview |
| `/demo-live/deal/harbor` | Harbor deal — full workflow story |
| `/demo-live/deal/harbor?from=funder` | Harbor deal from funder perspective |
| `/demo-live/deal/harbor?from=contractor` | Harbor deal from contractor perspective |

### 3-Minute Demo Script

**Setup (15 seconds):** "I'll show you a live deal — Harbor Logistics, structural steel. The contractor has submitted Draw #3 for $2.18M. Everything is in: signed contract, SOV, inspection report, lien waiver. The AI Draw Control Brief is complete. I want to show you what happens before that money moves."

---

**Step 1 — Contract Executed (30 seconds)**  
Open `/demo-live/deal/harbor`. Point to the 5-step workflow spine at the top.  
"Step 1 is contract execution. Harbor's construction agreement — $9.1M — was signed by both parties via DocuSign. You can see the envelope ID and both signature timestamps. Without this step, no release can be authorized on this deal. That's a hard gate condition."

---

**Step 2 — Schedule of Values (30 seconds)**  
Scroll to the SOV section.  
"Step 2 is the Schedule of Values. Five line items matching the contract scope. Structural steel — $1.95M contract value, $2.18M requested this draw. Each draw must be linked to an SOV line item, so every dollar can be traced to the signed contract. You can see which milestones are linked and which aren't."

---

**Step 3 — Evidence + Lien Waiver (30 seconds)**  
Point to the evidence panel.  
"Step 3 — evidence. The contractor submitted: inspection report confirming steel erection complete, a conditional lien waiver for Webb Construction, a draw request, and a site photo. The lien waiver is required by the deal configuration — the gate won't authorize without it."

---

**Step 4 — AI Draw Control Brief (30 seconds)**  
Scroll to the Perplexity AI brief section.  
"Step 4 — AI pre-review. Perplexity reviewed the draw package: document completeness, conflicts, milestone readiness. Score is 91 out of 100. No critical risk flags. This clears the AI precondition. The AI doesn't approve the release — it just tells us whether there are red flags before the gate evaluates."

---

**Step 5 — Release Readiness Gate (30 seconds)**  
Point to the Deal Control Center / Release Readiness section.  
"Step 5 — the release gate. 10 conditions, all green. Milestone approved. Contract signed. Balance covers the disbursement. Lien waiver on file. No open change orders. No duplicate release. All 10 pass simultaneously, server-side. If any one of these fails, nothing moves."

---

**Step 6 — Funder Authorization (30 seconds)**  
"Now the funder authorizes. One click — Authorize Release. That action is recorded with timestamp, actor, and the fact that all 10 conditions passed. The authorization signal goes to the execution rail."

On external rail: "In this case, the authorization signal goes to the title company. They execute the wire. They confirm back in Vektrum — method, bank reference, proof document. That confirmation is also logged."

---

**Step 7 — Audit Trail (15 seconds)**  
Scroll to the audit timeline.  
"Every step — contract signed, SOV submitted, evidence uploaded, AI review, gate passed, funder authorized — permanently logged. Hash-chained. If there's ever a dispute about whether conditions were met, this is the record."

---

**Close (15 seconds):** "That's the workflow. The money moved because the conditions were met and were verified. That's what Vektrum does — enforcement between approval and disbursement."

### Demo Reset

The demo can be reset via `/api/demo/reset` (POST) with env-gating — only active in non-production environments. The reset affects demo data only and is idempotent.

**Known gap:** Demo reset may not fully reset contractor button state. Do not rely on demo reset for live investor demos — reload the page instead.

---

## 16. Homepage, Pitch, and Copy Rules

### Approved Language

Use exactly:

| Context | Approved Phrase |
|---------|----------------|
| Category | "Conditional authorization infrastructure for construction disbursements" |
| What it does | "Enforces release conditions before capital moves" |
| Authorization posture | "Authorization separated from execution" |
| Funds posture | "Vektrum does not hold or custody funds" |
| Rail framing | "Stripe Connect or the partner's existing rail" |
| AI framing | "AI informs; the gate decides" |
| AI framing | "AI-assisted draw pre-review" |
| Release trigger | "Funder-triggered, system-enforced" |
| Audit log | "Append-only, hash-chained, tamper-evident audit log" |
| Admin safety | "Admin cannot release funds" |
| External rail | "Partner-controlled execution" or "external/manual rail" |
| Non-custody | "Vektrum does not replace title or escrow" |

### Banned Language

Never use:

| Banned | Why |
|--------|-----|
| "Vektrum moves money" | False — Vektrum authorizes; rails execute |
| "Vektrum executes wires" | False — Vektrum issues auth signals |
| "Vektrum holds funds" | False — never |
| "Escrow replacement" | Legal risk, factually wrong |
| "AI approves releases" | False — AI is a precondition, not an approver |
| "AI decides" | False |
| "Fully automated AI payments" | False |
| "Tamper-proof" | Overstatement — use "tamper-evident" |
| "Stripe required" | False — external rail requires no Stripe |
| "All funds held by Stripe" | False — external rail funds are not in Stripe |
| "Prevents fraud" | Overstatement — use "reduces fraud risk" |
| "Guarantee" (any form) | Legal risk |

### Homepage Message (Current, Aligned)

Current headline: *"The conditional authorization layer for construction draws"*

Current Section 4 (10-condition list) is now aligned with `validateRelease()` exactly. Do not modify the condition list without updating the gate logic and the homepage test.

The homepage now includes:
- Correct 10 conditions
- Workflow spine (Contract → DocuSign → SOV → Draw + Evidence → AI Draw Review → Release Readiness → Authorization Signal)
- DocuSign contract execution mention
- SOV and lien waiver mentions
- Non-custody language (does not replace title or escrow, does not execute wires, Stripe Connect is one supported rail)

### Pitch Route Message (Current, Aligned)

The `/pitch` deck now reflects:
- "Conditional authorization infrastructure for construction disbursements"
- "Enforce release conditions before capital moves"
- Workflow spine slide (10 steps, Contract to Audit)
- Harbor Draw #3 demo story slide with link
- "What Vektrum Is Not" slide
- Non-custody disclaimer in closing

### Non-Custody Disclaimer

Use this exactly in any external-facing document or footer:

> "Vektrum is authorization infrastructure — not a bank, lender, escrow company, payment processor, or money transmitter. Vektrum does not hold or custody funds; execution occurs through Stripe Connect or the partner's existing rail."

---

## 17. Partner Types and Value Propositions

### 17.1 Banks / Construction Lenders

**What they care about:** Draw management compliance, audit evidence for LP reporting, avoiding over-advancing, lien waiver tracking, regulatory posture.

**How Vektrum helps:** Enforces release conditions before each disbursement. Creates audit evidence for every release decision. Prevents releases without signed contracts, lien waivers, and change order resolution. Does not require replacing existing wire/ACH infrastructure.

**Lead with:** "You keep your wire process. We sit upstream and verify conditions are met before you execute."

**Do not say:** "We replace your draw management software." "We'll process your payments."

**Best demo path:** Show the release gate conditions, then show the audit trail. Skip the contractor workflow unless they ask.

**Discovery questions:**
- How do you currently verify conditions before a draw release?
- Do you have a checklist? Who enforces it?
- What's your process if a lien waiver is missing?
- Do you have open change orders block releases automatically?
- How do you document the authorization decision for LP reporting?

---

### 17.2 Title Companies / Escrow Agents

**What they care about:** Liability exposure, lien waiver compliance, clear authorization record before disbursing, not slowing down closings.

**How Vektrum helps:** Provides a release-authorization record before the title company disburses. Ensures lien waivers are on file, contracts are signed, and conditions are met. Title company keeps full control of execution — Vektrum provides the upstream verification.

**Lead with:** "You keep custody and execution. We give you a verified authorization record before you disburse — with the conditions documented."

**Do not say:** "We replace escrow." "We hold the funds." "You don't need title anymore."

**Best demo path:** Show the external rail flow. Show what the authorization confirmation record looks like.

**Discovery questions:**
- What verification do you currently receive before disbursing on a construction draw?
- Do funders send you a release instruction? What does it include?
- How do you handle missing lien waivers?
- What's your process when a change order is open?

---

### 17.3 Treasury Teams / Institutional Lenders

**What they care about:** Institutional controls, authorization documentation, reconciliation, audit trail, regulatory compliance.

**How Vektrum helps:** Provides a machine-readable authorization layer with full audit evidence. Every release decision is documented, time-stamped, and hash-chained. Partner API enables integration with treasury management systems.

**Lead with:** "Every disbursement decision is authorized against 10 conditions, recorded, and available via API. The authorization record integrates with your existing treasury system."

**Do not say:** "We'll replace your treasury platform."

**Best demo path:** Start with the Partner API documentation. Show the authorization record and audit trail.

**Discovery questions:**
- How do your construction draw authorizations currently flow into your treasury system?
- What documentation do you retain for each disbursement decision?
- Do you currently have a system that verifies conditions before the treasury instruction goes out?

---

### 17.4 Private Funders / Family Offices

**What they care about:** Deal visibility, protection from bad draws, clear documentation, simple workflow for their team.

**How Vektrum helps:** Gives the funder a dashboard of deal status, release readiness, and disbursement history. Enforces conditions before any draw — prevents the funder from being pressured into approving a deficient draw package.

**Lead with:** "You see exactly what conditions have been met before you authorize. One click to release — with everything documented."

**Best demo path:** Full Harbor draw demo from the funder persona. Show the Perplexity brief, the 10-condition panel, and the authorization button.

**Discovery questions:**
- How do you currently get visibility into draw conditions before approving?
- How do your contractors submit draws to you today?
- Do you manage lien waivers manually?

---

### 17.5 Construction Platforms (Built, Land Gorilla, Procore, etc.)

**What they care about:** Not being displaced, finding integration opportunities, serving their customers better.

**How Vektrum helps:** Vektrum is not a competitor for draw management workflow. It is the enforcement layer that can sit downstream of their platform. Embedded via Partner API.

**Lead with:** "Your platform manages the workflow. We sit downstream and enforce conditions before funds move. No conflict — we make your customers safer."

**Do not say:** "We replace your platform."

**Discovery questions:**
- Do your customers currently have a way to enforce release conditions programmatically?
- Do lenders using your platform have a way to get an authorization record for LP reporting?

---

### 17.6 Draw Inspectors

**What they care about:** Their report being used, timeline, payment for service.

**How Vektrum helps:** Inspector's report becomes a required evidence document. The gate does not authorize without it (when configured). The inspector's work matters — it is not bypassed by a checklist.

**Lead with:** "Your inspection report is a required input to the release gate. If it's not there, funds don't move."

---

### 17.7 Construction Attorneys

**What they care about:** Contract execution, lien exposure, change order documentation, audit trail for disputes.

**How Vektrum helps:** Signed contract is a hard gate condition. Lien waivers are required by gate. Change orders must be resolved before release. Audit trail provides documentation for dispute resolution.

**Lead with:** "Every release is against a signed contract, with lien waivers on file, and change orders resolved — and we have the record."

---

### 17.8 Contractors

**What they care about:** Getting paid, knowing what is required, not being surprised by delayed releases.

**How Vektrum helps:** Transparent draw requirements — the contractor knows exactly what to submit (evidence, lien waiver, draw request) before the funder can authorize. No hidden conditions.

**Lead with:** "You know what you need to submit before the release gate will pass. No surprises."

---

### 17.9 Developers / Owners / Borrowers

**What they care about:** Project completion, funder relationship, draw speed, avoiding disputes.

**How Vektrum helps:** Clear process reduces draw disputes. Audit trail helps resolve disagreements. Contractor payment is reliable when conditions are met.

---

### 17.10 Investors

**What they care about:** Market size, differentiation, moat, team, path to revenue, product-market fit signal.

**How Vektrum helps:** Construction draw management is a large, underserved market. Vektrum is infrastructure (high switching cost, embedding), not SaaS workflow (easily replaced). The release gate is deterministic code — it cannot be removed without removing the product.

**Lead with:** "We're not a workflow tool that got into payments. We're an enforcement layer that can't be removed without removing the protection. That's the moat."

---

## 18. Partner Meeting Playbook

### How to Open a Meeting (First 60 Seconds)

Do not pitch first. Ask first.

> "Before I tell you what we do — can I understand how your team handles draw releases today? Walk me from the moment a contractor submits a draw request to when you execute payment."

Listen for:
- Is there a checklist? Who enforces it?
- Is lien waiver tracking manual?
- Are change orders tracked?
- What's the authorization documentation?
- How are disputes handled?

### How to Explain Vektrum in 30 Seconds

> "We sit between draw approval and payment execution. Before your wire goes out, we verify 10 conditions — signed contract, lien waiver, no open change orders, balance sufficient. All 10 must pass. When they do, you get an authorization record. You execute how you always have. We just make sure the conditions were met and document the decision."

### What to Ask First

1. "How do draws flow through your organization today?"
2. "What documentation do you retain for each release decision?"
3. "Have you had a situation where a draw went out and a condition wasn't met?"
4. "Do lenders or LPs ask for release documentation?"

### How to Avoid Sounding Like a Vendor

- Ask more questions than you answer in the first meeting
- Use their vocabulary (draw, release, disbursement — not "payment")
- Reference your own construction experience
- Acknowledge what they do well before explaining the gap
- Never say "our platform" — say "the system" or "the gate"

### How to Ask for a Second Meeting

> "I'd like to map your current draw process against what we enforce. Can we do a 30-minute working session where I walk your actual process step by step against our gate conditions? That'll tell both of us quickly whether there's a fit."

### How to Follow Up

Within 24 hours. Subject line should reference something specific from the conversation — not "Following up" or "Next steps." Include:
- One specific pain point from their conversation
- One specific way Vektrum addresses it
- One concrete ask (meeting, call, intro to their operations team)

---

## 19. Scripts

### Walk-In Title Company

**Cold intro, 30 seconds:**

> "Hi — I'm Adam, founder of Vektrum. We build the authorization layer between draw approval and title disbursement. Before you release, we've verified the conditions — signed contract, lien waiver, change orders cleared. You keep your disbursement process. We just make sure the conditions were documented before the wire goes out. Is your operations head available for 10 minutes?"

---

### Bank Email Follow-Up (Post-Meeting)

**Subject:** [Bank Name] construction draw — release conditions documentation

> Hi [Name],
>
> Great to meet with your team. The gap you described — draw approvals moving by email without a documented record of conditions met — is exactly what we address.
>
> Vektrum sits before your existing wire process. Before a draw is authorized, we verify: signed contract, lien waiver filed, change orders resolved, balance sufficient. The authorization decision is recorded with timestamp, conditions, and the actor who approved.
>
> Your wire process doesn't change. You get a documented authorization record for LP reporting and any future dispute.
>
> Would a 30-minute working session to map your current draw process against our gate make sense?
>
> — Adam

---

### Title/Escrow Email

**Subject:** Release condition verification before construction disbursements

> Hi [Name],
>
> I'm Adam, founder of Vektrum. We provide the authorization verification layer that sits before construction disbursements.
>
> A title company using Vektrum would receive a verified authorization record — conditions met, lien waiver on file, contract signed — before executing the wire. You keep full control of disbursement and custody. We provide upstream verification and audit documentation.
>
> Would 20 minutes to discuss how this would work with your existing process be worthwhile?
>
> — Adam

---

### Lender Email (Cold)

**Subject:** Construction draw release controls — [Lender Name]

> Hi [Name],
>
> I'm reaching out because construction draw authorization is a gap I've seen across most lenders — approval happens, but the condition verification and documentation don't keep up.
>
> Vektrum enforces 10 release conditions before every disbursement: signed contract, lien waiver, no open change orders, balance verified. The gate is server-side — it can't be bypassed. Every authorization is documented for LP reporting.
>
> Happy to walk through a 5-minute demo of a real draw cycle if that's useful.
>
> — Adam Morgan, Co-Founder, Vektrum

---

### Contractor Conversation

> "As a contractor, here's what this means for you: you know exactly what you need to submit before the funder can release. Inspection report, lien waiver, draw request — when those are in and conditions are met, the gate passes automatically. No back-and-forth, no waiting for someone to check a spreadsheet."

---

### Investor Intro (Cold)

> "Vektrum is conditional authorization infrastructure for construction disbursements. Before a draw is released, we verify 10 conditions server-side — signed contract, lien waiver, balance, change orders. Execution happens through Stripe or the lender's existing wire process. We're pre-revenue, looking for design partners among construction lenders and title companies. Happy to share the deck."

---

### Demo Intro

> "What I'm going to show you is a real deal workflow — Harbor Logistics, structural steel draw, $2.18M. Everything is set up: signed contract, SOV, inspection report, lien waiver, AI review complete. I'll walk from where the contractor is today to the moment the funder authorizes — so you can see what the gate looks like in practice."

---

### After-Meeting Follow-Up

**Within 24 hours:**

> "Hi [Name] — thanks for the time today. The point you made about [specific thing they said] is the core gap we address. [One sentence on how Vektrum addresses it]. I'd like to set up a working session to map your draw process against our gate — 30 minutes. Does [date] work?"

---

### "What Do You Do?" Answer (Cocktail/Networking)

Short: "I'm building the enforcement layer for construction draw releases. Before a lender's wire goes out, we verify that 10 conditions are met — signed contract, lien waiver, balance — and document it permanently. Construction finance, but on the infrastructure side."

Longer: "Construction lenders release tens of millions of dollars on draws that get approved by email and habit. We're the system that verifies the conditions were actually met before the wire goes out. Not a workflow tool — an enforcement layer. The money can't move unless the gate passes."

---

## 20. Objection Handling

### "Are you replacing escrow?"

> "No. Escrow holds funds and executes disbursements — that's a licensed function and we're not in it. We sit upstream of escrow. We verify the conditions before the disbursement instruction goes to the escrow agent. Escrow stays in place and keeps its role. We give them a verified authorization record before they execute."

---

### "Do you move money?"

> "No. We authorize. The money moves through Stripe Connect or through your existing wire, title, or treasury process. We issue the authorization signal. We don't touch the funds."

---

### "Is this AI approving payments?"

> "No. AI reviews the draw package before the gate runs — completeness, conflicts, risk score. But the gate itself is deterministic: 10 specific conditions, server-side, all must pass. AI informs the review; the gate makes the enforcement decision. AI cannot authorize a release."

---

### "We already have a checklist."

> "Most teams do. The question is whether someone enforces it every time, or whether it's possible to skip a step under pressure. Our gate is server-side — it can't be bypassed. The authorization can't happen unless every condition passes. A checklist is advisory. The gate is enforcement."

---

### "We already use Procore / Built / Rabbet."

> "We don't replace those. They manage the workflow — submittals, documents, approvals. We sit downstream, at the moment of release. When you click 'release this draw,' we're the system that checks whether the conditions for that release were actually met. No conflict — we make those platforms safer."

---

### "Will this slow payments?"

> "When conditions are met, authorization is instant — the gate evaluates in real time. The delays happen when conditions aren't met, which is exactly when you want a delay. A missing lien waiver shouldn't be a 'we'll get it later' — it should block the release until it's there."

---

### "Who is liable if a bad release happens?"

> "Liability doesn't transfer to Vektrum. We enforce the conditions you configure. If a lien waiver is required and it's on file, the gate passes. If it's not on file, the gate blocks. Whether the lien waiver is legally valid is outside our scope — we verify presence and approval status, not legal sufficiency. Legal counsel should advise on your specific liability posture."

---

### "What happens if Stripe goes away?"

> "That's why we have the external rail. If you don't want to use Stripe, or Stripe isn't available, you use your existing wire, escrow, or treasury process. Vektrum is rail-agnostic. The gate is identical on both paths."

---

### "Can we use our own rail?"

> "Yes. That's the external/manual rail. You authorize through Vektrum, then execute however you normally would — wire, ACH, check, title disbursement. You confirm execution back in Vektrum and we record the proof."

---

### "Can we override the gate?"

> "The gate conditions are enforced. There is no bypass path in the release flow. There is one admin-level override: the AI precondition can be overridden with a time-boxed (4-hour) MFA-verified action that is audit-logged. The 10 gate conditions themselves cannot be bypassed."

---

### "Who owns the data?"

> "Your deal data, milestone data, and audit records belong to you. We're infrastructure — not a marketplace or data aggregator. Audit records are portable. This is something we should put in writing for any pilot agreement."

---

## 21. Fraud-Risk Reduction Framing

### The Right Framing

Vektrum reduces fraud risk by enforcing conditions. It does not prevent fraud, detect fabricated documents, or guarantee lien waiver legal validity. The correct claim is: "Vektrum makes it harder for fraud to succeed by enforcing conditions that fraudulent releases typically bypass."

### How Each Control Reduces Risk

| Control | Fraud Pattern It Addresses |
|---------|--------------------------|
| Signed contract required | Releasing funds without an executed agreement |
| Lien waiver required | Paying a contractor who then fails to pay subs, creating mechanic's liens |
| Change order clearance | Releasing on scope not approved, creating cost overruns or disputes |
| Duplicate release guard | Double-paying the same milestone |
| Balance check | Over-advancing beyond funded amount |
| Funder-triggered only | Contractor or admin self-authorizing release |
| No bypass on gate | Social engineering or urgency-based release without conditions |
| Audit trail | After-the-fact dispute about what was authorized and under what conditions |

### What to Say to Lenders

> "We don't claim to prevent fraud. But the typical construction disbursement fraud bypasses conditions — releases happen without lien waivers, with open change orders, or through duplicate requests. Our gate blocks all of those by default. It's harder to have a bad release when every condition must pass server-side."

### What Not to Say

- "Vektrum prevents fraud"
- "Vektrum eliminates lien risk"
- "We detect fraudulent documents"
- "Our AI catches fraud"

---

## 22. Legal / Compliance / Non-Custody Language

### Money Transmission Posture

Vektrum is not a licensed money transmitter. On the Stripe rail, Stripe Connect is the licensed entity that moves funds. On the external rail, funds never touch Vektrum infrastructure. Vektrum issues authorization signals — not payment instructions to banks.

This distinction is important. Do not describe Vektrum in any way that implies it receives funds from one party and forwards them to another.

### Non-Custody Language

Required framing in any partner conversation, document, or marketing material:

> "Vektrum does not hold or custody funds. On the Stripe Connect rail, funds are held in Stripe-managed accounts. On the external rail, funds are held by the funder's existing institutional partner — title, escrow, treasury, or bank. Vektrum's role is authorization verification and audit, not custody or execution."

### Escrow and Title Relationship

Vektrum does not have an escrow license or title license. It does not attempt to perform escrow or title functions. The correct framing:

> "Vektrum verifies release conditions before the licensed escrow agent or title company disburses. The licensed function stays with the licensed entity. Vektrum provides upstream verification."

### Role of Legal Counsel

For any pilot agreement, partner contract, or institutional relationship, Vektrum should obtain legal review. Key areas:
- Money transmission analysis in relevant jurisdictions
- Data ownership and portability provisions
- Liability posture for release decisions
- API terms for partner integrations
- Non-disclosure and information security provisions

### Claims to Avoid (Legal Risk)

- Escrow replacement (escrow is a licensed function in many states)
- Trust account provider
- Money transmitter services
- Bank or financial institution
- Guarantee of any kind
- "Tamper-proof" (tamper-evident is accurate; tamper-proof is not)

---

## 23. Competitive Positioning

### Built / Land Gorilla / Rabbet

**What they are:** Draw management platforms. Document collection, inspection routing, approval workflows, lien waiver tracking dashboards.

**The gap:** They track and manage. They do not enforce. A user can approve a draw with a missing lien waiver by clicking through a warning. The approval is advisory. Our gate is not advisory.

**How to position:** "They're the system of record. We're the enforcement layer downstream. No conflict — we make their platform stronger."

### Procore

**What they are:** Construction project management. Submittals, RFIs, schedules, budgets, change orders.

**The gap:** Procore is not a disbursement authorization system. It does not enforce release conditions at the payment rail layer.

**How to position:** "Procore manages the project. Vektrum controls whether the draw payment is authorized. Different layers."

### Lender-Internal Systems

**What they are:** Spreadsheets, email chains, internal loan management software with manual checklist workflows.

**The gap:** Manual, not enforced, not documented, not auditable.

**How to position:** "Your internal process is a checklist. Our gate is enforcement. The difference is whether a condition can be skipped."

### Spreadsheets / Email / Status Quo

**The gap:** No enforcement, no audit trail, no duplicate detection, no automated condition verification.

**How to position:** "The status quo means conditions are checked by memory and habit. When pressure is applied — a contractor who needs to make payroll — conditions get skipped. Our gate doesn't respond to pressure."

### Why Vektrum Is Different

Vektrum is a system of enforcement, not a system of record. The distinction:
- Systems of record: document, track, report, notify
- Systems of enforcement: block, authorize, require, prevent

The moat is not the UI. It is the gate logic and the authorization-execution separation. A competitor could build a better dashboard. They cannot easily replicate the architecture without rebuilding from scratch.

---

## 24. Product Packaging

### Current Packaging (Conceptual — Not Formally Productized)

**Vektrum Direct**
- Funder uses Vektrum directly with Stripe Connect rail
- Self-service onboarding
- Per-release governance fee: 1.00% (minimum $50)
- For: private lenders, family offices, small credit funds

**Vektrum Partner Rail**
- Funder uses Vektrum with external/manual execution rail
- Partner keeps existing wire/title/treasury process
- Per-release governance fee (negotiated)
- For: institutional lenders, title companies, treasury operators

**Vektrum API**
- Partner integrates Vektrum gate via API into existing platform
- Platform keeps UI; Vektrum provides gate logic and audit
- Per-release or volume pricing
- For: construction platforms, enterprise lenders, embedded finance

### Future Packaging (Do Not Claim Live)

- White-label / headless mode — partner-branded release gate
- Embedded release gate — iframe or API-driven gate in partner platform
- Enterprise tier with custom governance policies per deal

### Pricing Tiers (Current)

| Tier | Rate | Model |
|------|------|-------|
| Standalone | 1.00% | No retainer, self-service |
| Institutional | 0.70% | Retainer-backed, volume pricing |
| Enterprise | 0.65% | Negotiated annually, integration-led |
| Minimum | $50 | Per release |
| Contractor cost | $0 | Always free |

Billed to: funder (on top of milestone disbursement).

---

## 25. Current Build Status

### Main Branch Source of Truth

Branch: `claude/affectionate-satoshi-56db08` → target `main`

The working tree is clean. Recent completed work:
- Homepage aligned with `validateRelease()` 10 conditions
- `/pitch` deck rewritten to reflect current product truth
- Demo-live Harbor Draw #3 guided story (DocuSign, SOV, evidence, AI brief, release)
- Ops dashboard test/live mode clarity for stuck releases and webhook health
- Tests: 280+ static source checks across all major features

### Production-Ready

The following are production-grade and can be demonstrated to investors and partners:
- 10-condition release gate (server-side, no bypass)
- Stripe Connect automated rail (full end-to-end)
- External/manual rail (confirm, fail, SLA tracking)
- DocuSign contract execution (funder + contractor signing)
- Schedule of Values with milestone linking
- Evidence and lien waiver uploads
- AI Draw Control Brief (Perplexity)
- Hash-chained audit log
- Partner API (release fetch, confirm, fail)
- Admin ops dashboard
- Notifications center
- Demo-live Harbor Draw #3 story

### Still Needs QA

- DocuSign void flow
- Demo reset (contractor state partial reset)
- `/auth/logout` route (verify no 404)
- Admin dashboard user-detail navigation

---

## 26. What Is Missing / Gaps

Use this section for honest investor conversations and internal planning. These are real gaps — do not paper over them.

| Gap | Impact |
|-----|--------|
| Configurable governance policies per deal | Each deal currently uses the same 10 conditions. No per-deal rule configuration. |
| Deal authority model | Who can approve what amounts? No tiered authority yet. |
| Evidence requirements matrix | What documents are required per milestone type? Currently freeform. |
| Exception / waiver workflow | No structured process for a waived condition with documented reason. |
| Dual-control approvals | High-value releases with no second-authorizer requirement. |
| External payment instruction metadata | No structured field for wire instructions / ACH details to partner. |
| Reconciliation lifecycle dashboard | Reconciliation runs; no funder-visible dashboard of reconciliation state. |
| Partner lifecycle console | API keys exist; no partner management UI beyond key creation. |
| Customer billing / invoicing | Governance fee tracked but no invoicing system. |
| Legal/security/compliance packet | No formal SOC 2, MSA template, or data processing agreement. |
| Deal closeout / audit packet export | No formal deal-close export or audit package. |
| Reporting dashboard | No funder portfolio-level disbursement reporting. |
| Production readiness runbooks | No documented incident response, on-call, or rollback procedure. |
| Pilot onboarding workflow | No structured first-customer onboarding playbook in the product. |

---

## 27. Build Roadmap

### Before Serious Pilots (Next 60 Days)

**P0 — Verification**
- Verify `/auth/logout` no 404
- Verify admin dashboard user-detail navigation
- Verify demo reset fully resets contractor state
- Verify partner API docs do not overclaim outbound webhooks
- Add route/navigation smoke tests

**P0 — Gate Regression Suite**
- All 10 gate conditions covered by tests
- Duplicate release blocked (test)
- Admin/contractor bypass blocked (test)
- Lien waiver required condition covered (test)

**P1 — Pilot Readiness**
- Basic pilot onboarding workflow (account creation, deal config, rail config, user invite)
- Legal/non-disclosure template for pilot agreements
- Deal authority configuration (basic)

### Before Institutional Partner Rollout (60–120 Days)

- Configurable governance policies per deal
- Evidence requirements matrix
- Exception / waiver workflow
- Partner lifecycle console (API key management UI)
- Deal closeout / audit packet export
- Reporting dashboard (funder portfolio view)
- Outbound partner webhooks (release authorized, release confirmed, release failed)
- Dual-control approvals (high-value releases)

### Scale / Infrastructure Maturity (120+ Days)

- SOC 2 Type II audit
- MSA template and data processing agreement
- Enterprise white-label / headless mode
- Reconciliation lifecycle dashboard
- Production incident runbooks
- Partner program documentation

---

## 28. Pilot Onboarding Playbook

### Step 1 — Identify the Buyer

Before setting up an account:
- Who is the funder/lender? Do they have a construction deal ready?
- What rail do they want — Stripe Connect or external?
- Do they have a contractor with a completed Stripe account (Stripe rail)?
- Is lien waiver tracking required?
- What's the first deal (project name, amount, milestones)?

### Step 2 — Create Customer Account

- Create funder profile in Supabase (or via invite token)
- Assign role: `funder`
- Verify email and MFA setup

### Step 3 — Configure Rail

**Stripe rail:**
- Funder connects or creates Stripe Connect account
- Funder deposits capital
- Contractor creates Stripe Connect account (verify payouts enabled)

**External rail:**
- No Stripe account needed
- Confirm partner understands confirmation workflow (execute externally, confirm in Vektrum)

### Step 4 — Configure Deal Authority

- Who can approve milestones?
- Are there amount thresholds?
- Is lien waiver required?
- Is retainage applicable?

### Step 5 — Configure Lien Waiver and Retainage

- Set `lien_waiver_required` on deal (if applicable)
- Confirm retainage percentage if applicable (UI config in progress)

### Step 6 — Invite Users

- Invite contractor (role: contractor)
- Invite any admin/ops users

### Step 7 — Upload Contract

- Funder uploads executed construction contract
- Send DocuSign envelope to both parties
- Confirm both parties sign (contract status → `signed`)

### Step 8 — Create SOV and Milestones

- Create SOV with line items matching contract
- Create milestone/draw records
- Link milestones to SOV line items

### Step 9 — Run Test Release / Dry Run

- Submit a test draw
- Upload evidence and (if required) conditional lien waiver
- Run AI Draw Control Brief
- Verify all 10 gate conditions pass
- Authorize release (test)
- Confirm execution (external rail) or verify Stripe transfer (Stripe rail)

### Step 10 — Go Live

- Confirm all parties understand their role
- Remove any test data
- Run first real release

---

## 29. Founder Weekly Operating Rhythm

### Monday — Plan and Outreach

- Review CRM / contact list: who to follow up with this week
- Draft 2–3 outreach emails (lender, title, investor)
- Review Claude build backlog: what's the highest-value build this week?
- Review any open GitHub PRs or branch status

### Tuesday — Demos and Meetings

- Schedule demos and partner conversations on Tuesday/Thursday when possible
- Run demo practice if a meeting is this week (use Harbor Draw #3 script from Section 15)
- Review any objections encountered in last week's conversations

### Wednesday — Product and Build

- Claude build session: one focused task from the backlog
- Run `npm test` and `npm run build` after any build session
- Review `docs/ai/BACKLOG.md` — reprioritize if needed
- Write or update any tests for changed behavior

### Thursday — Meetings and Research

- Partner/investor meetings
- Perplexity research: competitive intel, market news, lender regulatory updates
- Review `/pitch` or homepage copy for any needed updates after conversations

### Friday — Review, Write, Update

- Weekly review: what did I learn this week?
- Update this handbook if anything changed
- Write any follow-up emails from this week's meetings
- Update `HANDOFF_NOTES` for any Claude sessions
- Plan next week's outreach list

### Daily Habits

- Before any external meeting: read Section 2 (one-page summary) and the relevant partner value prop from Section 17
- Before any demo: read Section 15 demo script
- Before any Claude build session: read Section 31 (prompt library) and Section 5 (product truth)

---

## 30. Glossary

**Release gate**  
The server-side, deterministic system that evaluates 10 conditions before authorizing a construction disbursement. All 10 must pass simultaneously. No UI bypass or role bypass exists.

**Release readiness**  
The state in which all 10 gate conditions are currently satisfied for a given milestone. Displayed in the Deal Control Center. A prerequisite for funder authorization.

**Schedule of Values (SOV)**  
A line-item breakdown of an executed construction contract mapping scope of work to dollar amounts. Each draw milestone in Vektrum can be linked to a specific SOV line item, creating a traceable chain from signed contract to disbursement.

**Draw request**  
A contractor's formal request for a milestone disbursement. Includes the amount requested, the milestone, and supporting evidence.

**External rail**  
The partner-controlled execution path. Funder's capital stays with their existing title, escrow, treasury, or bank partner. Vektrum issues an authorization signal; the partner executes and confirms. Funds never interact with Vektrum infrastructure.

**Authorization signal**  
The output of the release gate when all conditions pass and the funder authorizes. Recorded with timestamp, actor, conditions met, and proof. Sent to the execution rail to trigger disbursement.

**Execution rail**  
The system that moves funds after Vektrum authorizes. Either Stripe Connect (automated) or external/manual (partner-controlled). Vektrum does not own the execution rail.

**Lien waiver**  
A legal document in which a contractor or subcontractor waives their right to file a mechanic's lien on a property, typically in exchange for payment. Conditional lien waivers are signed before payment (conditional on payment); unconditional waivers after. Vektrum's gate condition 10 requires an approved conditional lien waiver where configured.

**Retainage**  
A percentage of each draw withheld until project completion or defined milestones. Used by lenders and owners as a performance incentive and risk buffer. Vektrum has partial retainage support (UI config in progress).

**Audit trail**  
The append-only, hash-chained log of every action in Vektrum — authorizations, confirmations, status changes, admin actions. Used for dispute resolution, LP reporting, and compliance documentation.

**AI precondition**  
The AI Draw Control Brief review that runs before the 10-condition gate. If the AI risk level is critical or the review is stale (>48h), the gate is blocked. AI cannot authorize a release — it can only block it or clear it.

**Partner API**  
The API interface for execution-rail partners (title, escrow, treasury, lender) to fetch release state, authorize external releases, confirm execution, and record failures. Scoped API keys, HMAC-verified.

---

## 31. Claude Prompt Library

Use these prompts verbatim or as starting templates for Claude build sessions.

### Update Homepage Copy

```
Inspect src/app/page.tsx. Verify the 10-condition list matches validateRelease() 
in src/lib/engine/release-gate.ts exactly. If any condition is wrong, inaccurate, 
or missing, fix it. Do not change the gate logic. Update or create 
tests/homepage-alignment.test.ts. Run npm test and npm run build. Commit: 
"fix(site): align homepage conditions with release gate"
```

### Update /pitch Deck

```
Inspect src/app/pitch/page.tsx. Update copy to reflect current Vektrum positioning: 
conditional authorization infrastructure for construction disbursements. Use exact 
10 gate conditions. Do not claim AI approves releases. Do not claim Vektrum moves 
money. Preserve non-custody disclaimer. Update or create tests/pitch-alignment.test.ts. 
Run npm test and npm run build.
```

### Build a Feature Safely

```
Task: [describe feature]
Rules:
- Do not modify release gate logic in src/lib/engine/release-gate.ts
- Do not modify Stripe/payment execution
- Do not modify auth, RLS, MFA, audit log, or DocuSign logic
- Write tests first (TDD)
- Run npm test and npm run build after
- Summarize changed files and any security/custody implications
```

### Audit Product Alignment

```
Read the current src/app/page.tsx, src/app/pitch/page.tsx, and 
src/lib/engine/release-gate.ts. Compare the 10-condition lists in the homepage 
and pitch against the actual validateRelease() function. Report any mismatches, 
overclaims, or banned language (Vektrum moves money, AI approves, tamper-proof, 
Stripe required). Output a report — no file changes.
```

### Create Tests for a Feature

```
Inspect [file path]. Create a static source-parse test file at tests/[feature].test.ts 
that verifies: [list of checks]. Wire it into package.json npm test script. 
Run it and confirm all checks pass. Do not modify the source file.
```

### Inspect Branch Status

```
Run git status, git diff --stat, and git log --oneline -10. Report: 
working tree clean or dirty, files changed, recent commits. 
Do not make any changes.
```

### Prepare Partner Meeting

```
I have a meeting with [partner type] on [date]. They [brief description 
of what they do]. Read Section 17 of docs/VEKTRUM_MASTER_HANDBOOK.md for 
their value prop. Draft: (1) opening question, (2) 30-second explanation, 
(3) 3 discovery questions, (4) follow-up email for after the meeting.
```

### Write a Partner Email

```
Write a cold outreach email to [partner type] at [company]. 
Use the approved language from Section 16 of the handbook. 
Do not claim AI approves, Vektrum moves money, or escrow replacement. 
Lead with a discovery question, not a pitch. Keep under 150 words.
```

### Update Docs (Non-Code)

```
Update [doc file path]. Changes needed: [describe]. 
Do not modify any source code, routes, APIs, or test files. 
Documentation only. Report what changed.
```

### Run Release Gate Safety Check

```
Inspect src/lib/engine/release-gate.ts and src/app/api/milestones/[milestoneId]/release/route.ts. 
Verify: (1) gate is called before any Stripe execution, (2) admin role is rejected, 
(3) all 10 conditions are present, (4) no bypass flag exists, (5) AI precondition 
runs before gate. Report findings — no file changes.
```

---

## 32. Appendix

### Git Commands

```bash
# Current branch and status
git status
git log --oneline -10
git branch

# What changed since main
git diff main...HEAD --stat

# Stage and commit
git add [files]
git commit -m "type(scope): description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# Do not force-push to main
# Do not use --no-verify
# Do not amend; create a new commit
```

### Production QA Checklist

Before any PR to main:

- [ ] `npm run build` passes (zero errors)
- [ ] `npm test` passes (all static checks)
- [ ] No real API keys in any changed file
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` exposed to frontend
- [ ] No `sk_live_` keys in code or docs
- [ ] Working tree clean
- [ ] No unrelated files in the commit
- [ ] Changed files reviewed for security/custody implications
- [ ] Partner API docs do not claim unimplemented outbound webhooks

### Manual Supabase SQL Discipline

- Never run destructive SQL directly on production without a backup
- Never disable RLS in production
- Never share the service role key
- All schema changes should be in migration files, not ad-hoc SQL
- Test migrations on a shadow database before applying to production

### Deployment Checklist (Vercel)

- [ ] Environment variables verified in Vercel dashboard
- [ ] `NEXT_PUBLIC_APP_URL` set correctly
- [ ] `STRIPE_SECRET_KEY` is `sk_live_` on production, `sk_test_` on preview
- [ ] `STRIPE_WEBHOOK_SECRET` matches the active Vercel endpoint
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-side only (not `NEXT_PUBLIC_`)
- [ ] DocuSign credentials verified
- [ ] Demo reset env flag disabled in production
- [ ] Build logs reviewed for warnings

### Vercel QA Checklist (Post-Deploy)

- [ ] Homepage loads (`/`)
- [ ] `/pitch` loads
- [ ] `/demo-live/deal/harbor` loads
- [ ] `/demo-live/funder` loads
- [ ] `/demo-live/contractor` loads
- [ ] `/dashboard` redirects to login if unauthenticated
- [ ] `/auth/logout` works (no 404)
- [ ] Admin ops dashboard loads for admin user
- [ ] Stripe webhook endpoint is active in Stripe dashboard

---

---

## 33. Full Page Route Map

All routes are Next.js App Router pages (`src/app/`) unless noted as server-only (no UI). Routes marked **🔒 auth required** redirect to `/auth/login` if the user is not authenticated.

---

### 33.1 Public Marketing Pages

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/` | Homepage | 10-condition gate card, 7-step workflow spine, Section 4 condition list, DocuSign/SOV/lien waiver mentions |
| `/about` | About page | Company/mission copy |
| `/careers` | Careers | Job listings or "coming soon" |
| `/contact` | Contact | Contact form or mailto link |
| `/contractors` | Contractor landing | Explains contractor experience, Stripe onboarding, payment visibility |
| `/founders` | Founders page | Team / founding story |
| `/funders` | Funder landing | Release readiness portfolio view, deal-level control framing |
| `/help` | Help / FAQ | Support content |
| `/lenders` | Lenders landing | Construction lender positioning |
| `/partners` | Partner landing | Title, escrow, treasury, institutional partner pitch |
| `/partners/docs` | Partner API docs | REST API reference for external execution rail partners |
| `/partners/placement` | Placement page | Partner program / referral framing |
| `/pitch` | Pitch deck | 20-slide investor deck (CoverSlide → ClosingSlide), internal only |
| `/pricing` | Pricing | Packaging / tiers |
| `/privacy` | Privacy policy | Legal |
| `/security` | Security page | Auth, audit, encryption, RLS posture |
| `/terms` | Terms of service | Legal |

---

### 33.2 Demo Pages (No Auth Required)

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/demo` | Static demo | Earlier/lightweight demo, may redirect to `/demo-live` |
| `/demo-live` | Live demo hub | Entry point, persona selector (funder / contractor / admin / audit) |
| `/demo-live/deal/harbor` | Harbor Logistics deal | **Primary demo deal** — Draw #3, Structural Steel Erection, $2.18M, AI score 91 |
| `/demo-live/deal/riverside` | Riverside demo deal | Secondary deal fixture |
| `/demo-live/deal/westside` | Westside demo deal | Secondary deal fixture |
| `/demo-live/deal/harbor-dispute` | Harbor dispute scenario | Dispute resolution demo |
| `/demo-live/deal/[id]` | Dynamic deal view | Handles arbitrary demo deal IDs |
| `/demo-live/funder` | Funder persona view | Portfolio + deal dashboard from funder perspective |
| `/demo-live/funder/capital` | Capital/funding view | Funding allocation demo |
| `/demo-live/contractor` | Contractor persona view | Contractor payment history, docs, Stripe status |
| `/demo-live/admin` | Admin persona view | Admin ops panel demo |
| `/demo-live/audit` | Audit persona view | Hash-chained audit log demo |

> **Demo reset:** `POST /api/demo/reset` — requires `DEMO_RESET_ENABLED=true` in env. Production flag defaults to `false`. Never enable in live production unless on a dedicated demo tenant.

---

### 33.3 Auth Routes

| Route | Type | What It Does |
|-------|------|-------------|
| `/auth/login` | Page | Email/password login form. Redirects to `/dashboard` on success. |
| `/auth/signup` | Page | New user registration. |
| `/auth/reset-password` | Page | Password reset form (requires reset token from Supabase email). |
| `/forgot-password` | Page | Sends password reset email via Supabase. |
| `/auth/mfa/enroll` | Page 🔒 | TOTP MFA enrollment (QR code + confirm). Required for funders and admins. |
| `/auth/mfa/verify` | Page | MFA code entry after password login. |
| `/auth/callback` | Server route | Supabase OAuth callback — exchanges code for session, sets cookies. |
| `/auth/logout` | Server route | Clears Supabase session cookies and redirects to `/`. |
| `/invite/[token]` | Page | Invite acceptance — validates token, routes to login or signup. |

---

### 33.4 Dashboard — Funder / General

All dashboard routes require authentication (`🔒`). Role-specific routes enforce RBAC server-side.

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/dashboard` | Main dashboard 🔒 | Deal list, release readiness overview, notifications banner |
| `/dashboard/deals/[dealId]` | Deal control center 🔒 | Milestone grid, gate status, SOV, lien waivers, change orders, contracts, audit feed |
| `/dashboard/deals/new` | New deal wizard 🔒 | Create deal — title, address, contract value, funding amount |
| `/dashboard/audit` | Audit log 🔒 | Full append-only audit log with hash-chain display |
| `/dashboard/billing` | Billing 🔒 | Subscription status, invoice history, usage |
| `/dashboard/notifications` | Notifications 🔒 | Inbox — release authorized, payout failed, contract signed, etc. |
| `/dashboard/settings` | Settings 🔒 | Profile, email, password, MFA, API keys |
| `/dashboard/receipts/[receiptId]` | Receipt viewer 🔒 | Authorization receipt for a completed release |
| `/dashboard/receipts/[receiptId]/print` | Printable receipt 🔒 | Print-optimized receipt layout (dedicated layout, no nav) |

---

### 33.5 Dashboard — Contractor

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/dashboard/contractor/onboarding` | Stripe onboarding 🔒 | Stripe Connect account setup, status, re-link |
| `/dashboard/contractor/payments` | Payment history 🔒 | Released milestones, amounts, statuses, receipts |
| `/dashboard/contractor/documents` | Documents 🔒 | Uploaded milestone documents, lien waivers |

---

### 33.6 Dashboard — Funder Onboarding

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/dashboard/funder/onboarding` | Funder onboarding 🔒 | MFA enrollment, profile completion, deal creation primer |

---

### 33.7 Dashboard — Admin

All admin routes require `admin` role. Promotion is disabled by default (`ADMIN_PROMOTION_ENABLED=false`).

| Route | What It Is | Notes |
|-------|-----------|-------|
| `/dashboard/admin` | Admin main 🔒 | User list, deal overview, integration panel, partner links |
| `/dashboard/admin/ops` | Ops dashboard 🔒 | Release health (stuck/failed), webhook health, audit chain health |
| `/dashboard/admin/partners` | Partner management 🔒 | Create/manage partner accounts, view scoped API keys |
| `/dashboard/admin/subscriptions` | Subscriptions 🔒 | Manage tenant subscription tiers |
| `/dashboard/admin/users/[userId]` | User detail 🔒 | Selected user's profile, role, associated deals, audit trail |

---

### 33.8 API Routes — Internal (Require Auth Session)

#### Deals

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/deals` | List deals for authenticated user |
| POST | `/api/deals` | Create a new deal |
| GET | `/api/deals/[dealId]` | Get deal detail |
| PATCH | `/api/deals/[dealId]` | Update deal |
| GET | `/api/deals/[dealId]/milestones` | List milestones |
| POST | `/api/deals/[dealId]/milestones` | Create milestone |
| GET | `/api/deals/[dealId]/sov` | Get Schedule of Values |
| POST | `/api/deals/[dealId]/sov` | Add SOV line item |
| PATCH | `/api/deals/[dealId]/sov/[itemId]` | Update SOV item |
| DELETE | `/api/deals/[dealId]/sov/[itemId]` | Remove SOV item |
| GET | `/api/deals/[dealId]/contract` | Get active contract |
| POST | `/api/deals/[dealId]/contract` | Upload contract PDF |
| POST | `/api/deals/[dealId]/contract/send-envelope` | Send DocuSign envelope (funder → contractor routing) |
| POST | `/api/deals/[dealId]/contract/sign` | Mark contract signed (manual / non-DocuSign) |
| GET | `/api/deals/[dealId]/contracts` | List all contracts for deal |
| POST | `/api/deals/[dealId]/fund` | Commit funding to deal |
| GET | `/api/deals/[dealId]/readiness` | Run release-readiness pre-check |
| GET | `/api/deals/[dealId]/billing` | Get billing data |
| GET | `/api/deals/[dealId]/billing/export` | Download billing CSV |
| GET | `/api/deals/[dealId]/audit/export` | Download audit log CSV |
| GET | `/api/deals/[dealId]/audit-packet` | Full deal audit packet (JSON) |
| POST | `/api/deals/[dealId]/retainage/release` | Release retainage held funds |
| GET/POST | `/api/deals/[dealId]/milestones/[milestoneId]/lien-waiver` | Get or upload lien waiver |

#### Milestones

| Method | Route | What It Does |
|--------|-------|-------------|
| POST | `/api/milestones/[milestoneId]/transition` | Transition milestone status (e.g. submitted → approved) |
| POST | `/api/milestones/[milestoneId]/release` | **Release gate** — runs all 10 conditions, creates release if all pass |
| POST | `/api/milestones/[milestoneId]/release/retry` | Retry a failed release |
| POST | `/api/milestones/[milestoneId]/authorize-external` | Authorize external rail execution (skips condition 4 Stripe check) |
| GET | `/api/milestones/[milestoneId]/documents` | List milestone evidence documents |
| POST | `/api/milestones/[milestoneId]/documents` | Add document record |
| POST | `/api/milestones/[milestoneId]/documents/upload` | Upload document to Supabase Storage |
| GET | `/api/milestones/[milestoneId]/sov-links` | List SOV → milestone links |
| POST | `/api/milestones/[milestoneId]/sov-links` | Link SOV item to milestone |
| DELETE | `/api/milestones/[milestoneId]/sov-links/[linkId]` | Remove SOV link |

#### Releases

| Method | Route | What It Does |
|--------|-------|-------------|
| POST | `/api/releases/[releaseId]/confirm-external` | Funder confirms external execution completed |
| POST | `/api/releases/[releaseId]/mark-external-failed` | Funder marks external execution failed |
| GET | `/api/releases/[releaseId]/receipt` | Fetch release receipt |
| POST | `/api/releases/[releaseId]/receipt/resend` | Resend receipt email via Resend |

#### Lien Waivers

| Method | Route | What It Does |
|--------|-------|-------------|
| POST | `/api/lien-waivers/[waiverId]/approve` | Approve a submitted lien waiver |
| POST | `/api/lien-waivers/[waiverId]/reject` | Reject a submitted lien waiver |
| GET | `/api/lien-waivers/[waiverId]/signed-url` | Get temporary signed download URL from Supabase Storage |
| POST | `/api/lien-waivers/[waiverId]/upload` | Upload signed waiver document |

#### Change Orders

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/change-orders` | List change orders |
| POST | `/api/change-orders` | Create change order |
| PATCH | `/api/change-orders/[changeOrderId]` | Approve / reject / update change order |
| DELETE | `/api/change-orders/[changeOrderId]` | Delete change order |

#### Disputes

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/disputes` | List disputes |
| POST | `/api/disputes` | Open a dispute |
| POST | `/api/disputes/[disputeId]/resolve` | Resolve dispute |

#### Invites

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/invites` | List pending invites |
| POST | `/api/invites` | Create invite (sends email via Resend) |
| GET | `/api/invites/[token]` | Validate invite token (public) |
| POST | `/api/invites/[token]/accept` | Accept invite and link user |

#### Notifications

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/notifications` | Get notification inbox for current user |
| POST | `/api/notifications/mark-read` | Mark notifications read |

#### Onboarding

| Method | Route | What It Does |
|--------|-------|-------------|
| POST | `/api/onboarding` | Complete funder onboarding step |

---

### 33.9 API Routes — AI

| Method | Route | What It Does | Auth |
|--------|-------|-------------|------|
| POST | `/api/ai/draw-review` | AI Draw Control Brief — Perplexity → Anthropic → OpenAI fallback chain | Session |
| POST | `/api/analyze-contract` | AI contract analysis | Session |
| POST | `/api/assistant` | General AI assistant (in-app queries) | Session |

---

### 33.10 API Routes — Stripe

| Method | Route | What It Does | Auth |
|--------|-------|-------------|------|
| POST | `/api/stripe/connect` | Create Stripe Connect account or generate onboarding link | Session |
| GET | `/api/stripe/diagnose` | Diagnose Stripe Connect account status for a contractor | Session |
| POST | `/api/stripe/webhook` | **Inbound Stripe webhook** — HMAC verified with `STRIPE_WEBHOOK_SECRET` | Webhook sig |
| POST | `/api/contractor/stripe/status/refresh` | Force-refresh contractor's Stripe Connect status | Session |

---

### 33.11 API Routes — DocuSign Webhook

| Method | Route | What It Does | Auth |
|--------|-------|-------------|------|
| POST | `/api/webhooks/docusign` | **Inbound DocuSign Connect webhook** — HMAC verified with `DOCUSIGN_WEBHOOK_SECRET`. Updates contract status on envelope events. | Webhook sig |

---

### 33.12 API Routes — Admin (Require Admin Role)

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/admin/audit-log` | Full audit log with filtering |
| PATCH | `/api/admin/audit-log/[id]/review` | Mark an audit entry reviewed |
| GET | `/api/admin/audit-chain-health` | Check hash-chain integrity |
| PATCH | `/api/admin/deals/[dealId]/unfreeze` | Unfreeze a frozen deal |
| GET | `/api/admin/env-health` | Environment variable health report (no values — presence + shape only) |
| POST | `/api/admin/invite` | Admin-generated invite |
| PATCH | `/api/admin/milestones/[milestoneId]/override-ai-review` | Override stale AI review (emergency only, TTL-limited) |
| GET | `/api/admin/ops/alerts` | Current ops alerts |
| GET | `/api/admin/ops/external-releases` | External/manual release list |
| GET | `/api/admin/ops/release-health` | Stuck releases + failed payouts + `stripe_mode` |
| GET | `/api/admin/ops/search` | Cross-entity ops search |
| GET | `/api/admin/ops/webhook-health` | Webhook feed health + stale transfers + `stripe_mode` |
| GET | `/api/admin/partners` | List partner accounts |
| POST | `/api/admin/partners` | Create partner account |
| GET | `/api/admin/partners/[partnerId]` | Partner detail |
| PATCH | `/api/admin/partners/[partnerId]` | Update partner |
| DELETE | `/api/admin/partners/[partnerId]` | Delete partner |
| GET | `/api/admin/partners/[partnerId]/deals` | Deals associated with partner |
| POST | `/api/admin/promote` | Promote user to admin — **disabled by default** (`ADMIN_PROMOTION_ENABLED=false`) |
| GET | `/api/admin/reconciliation` | Reconciliation issue list |
| PATCH | `/api/admin/reconciliation/[issueId]` | Update reconciliation issue |
| GET | `/api/admin/stripe/duplicates` | Stripe duplicate account scan |
| PATCH | `/api/admin/subscriptions/[profileId]/tier` | Update tenant subscription tier |

---

### 33.13 API Routes — Partner (API Key Auth)

These routes are the external execution rail integration surface. Partners authenticate with a scoped API key (hashed at rest, shown once at creation).

| Method | Route | What It Does |
|--------|-------|-------------|
| GET | `/api/partner/releases/[releaseId]` | Get release status and authorization details |
| POST | `/api/partner/releases/[releaseId]/confirm` | Confirm external execution completed |
| POST | `/api/partner/releases/[releaseId]/fail` | Mark external execution failed |

---

### 33.14 API Routes — Cron Jobs

Cron routes are called by Vercel Cron. They require `Authorization: Bearer {CRON_SECRET}` header.

| Method | Route | Frequency | What It Does |
|--------|-------|-----------|-------------|
| POST | `/api/cron/reconcile` | Scheduled | Reconciliation sweep — checks unconfirmed transfers, flags stale releases, records findings |
| POST | `/api/cron/audit-chain-health` | Scheduled | Verifies audit hash-chain integrity end-to-end |

---

### 33.15 API Routes — Demo

| Method | Route | What It Does | Guard |
|--------|-------|-------------|-------|
| POST | `/api/demo/reset` | Reset demo data to canonical state | `DEMO_RESET_ENABLED=true` required. No-op in production by default. |

---

## 34. API Integrations & Credentials

This section documents every third-party service Vektrum integrates with, what it is used for, where to find credentials, and a fill-in section for each environment. **Never commit real credentials to git. Use `.env.local` locally and Vercel environment variables for deployed environments.**

---

### 34.1 Supabase

**What it does:** Database (PostgreSQL), authentication (email/password + MFA), row-level security (RLS), storage (document/lien waiver uploads), real-time (notifications). This is the primary data layer.

**Dashboard:** https://supabase.com/dashboard

**Docs:** https://supabase.com/docs

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | Your project URL, e.g. `https://abcxyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser + server) | Anon key — enforces RLS. Safe to expose client-side. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Service-role JWT — bypasses RLS for admin/cron writes. Never expose to browser. |
| `SUPABASE_AUTH_WEBHOOK_SECRET` | Server only | HMAC secret for `/api/auth/webhook` Supabase auth events (optional but recommended in production) |

**Where to find:** Supabase Dashboard → Project → Settings → API

---

**LOCAL (`.env.local`)**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUTH_WEBHOOK_SECRET=
```

> Username / Project: ______________________________
> Password / DB password: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUTH_WEBHOOK_SECRET=
```

> Supabase Project Ref: ______________________________
> Vercel project linked: ______________________________

---

### 34.2 Stripe

**What it does:** Stripe Connect for contractor account creation, onboarding, and payout execution (Stripe rail only). Webhook events confirm transfer status. Vektrum does not hold funds — Stripe is the execution layer, not Vektrum.

**Dashboard:** https://dashboard.stripe.com

**Docs:** https://stripe.com/docs/connect

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `STRIPE_SECRET_KEY` | Server only | `sk_test_…` in development/preview, `sk_live_…` in production |
| `STRIPE_WEBHOOK_SECRET` | Server only | `whsec_…` — HMAC secret for `/api/stripe/webhook`. Get from Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret. |

**Webhook endpoint to register:** `https://your-domain.com/api/stripe/webhook`

**Events to subscribe to:** `account.updated`, `transfer.created`, `transfer.failed`, `payout.paid`, `payout.failed`

---

**LOCAL (`.env.local`)**

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

> Stripe account email: ______________________________
> Test mode / Live mode: ______________________________
> Webhook ID (for reference): ______________________________

---

**PRODUCTION (Vercel env vars)**

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

> Live Stripe account: ______________________________
> Webhook endpoint ID: ______________________________

---

### 34.3 DocuSign eSign

**What it does:** Contract PDF routing and signing. Vektrum creates envelopes with two routing order signers (funder first, contractor second). DocuSign Connect webhooks update contract status in real time. Contract signature is gate condition 8.

**Dashboard:** https://developers.docusign.com (sandbox) / https://admin.docusign.com (production)

**Docs:** https://developers.docusign.com/docs/esign-rest-api/

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `DOCUSIGN_INTEGRATION_KEY` | Server only | OAuth client ID from DocuSign app |
| `DOCUSIGN_USER_ID` | Server only | DocuSign user UUID (impersonation target) |
| `DOCUSIGN_ACCOUNT_ID` | Server only | DocuSign account UUID |
| `DOCUSIGN_PRIVATE_KEY` | Server only | RSA private key, base64-encoded (single line). Generate keypair in DocuSign app settings. |
| `DOCUSIGN_OAUTH_HOST` | Server only | `account-d.docusign.com` (sandbox) or `account.docusign.com` (production) |
| `DOCUSIGN_BASE_PATH` | Server only | `https://demo.docusign.net/restapi` (sandbox) or `https://na3.docusign.net/restapi` (production) |
| `DOCUSIGN_WEBHOOK_SECRET` | Server only | HMAC secret registered in DocuSign Connect configuration |
| `DOCUSIGN_WEBHOOK_DEV_BYPASS` | Server only | `true` only in local dev when testing without a real HMAC secret. Never set in deployed environments. |

**Setup steps:**
1. Create an app at https://developers.docusign.com → Apps and Keys
2. Generate RSA keypair in app settings → Download private key → `base64 -i key.pem | tr -d '\n'`
3. Grant consent once: `https://{DOCUSIGN_OAUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri={APP_URL}/auth/docusign/callback`
4. In DocuSign Admin → Connect → add webhook: `https://your-domain.com/api/webhooks/docusign` with your HMAC key

**Webhook endpoint to register:** `https://your-domain.com/api/webhooks/docusign`

---

**LOCAL (`.env.local`)**

```
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_PRIVATE_KEY=
DOCUSIGN_OAUTH_HOST=account-d.docusign.com
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=
DOCUSIGN_WEBHOOK_DEV_BYPASS=false
```

> DocuSign Developer account email: ______________________________
> App name: ______________________________
> Sandbox / Production: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_PRIVATE_KEY=
DOCUSIGN_OAUTH_HOST=account.docusign.com
DOCUSIGN_BASE_PATH=https://na3.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=
```

> Production DocuSign account: ______________________________
> Connect configuration ID: ______________________________

---

### 34.4 Resend (Email)

**What it does:** Transactional email — release receipts, invite emails, payout failure alerts, milestone notifications, contract signing prompts.

**Dashboard:** https://resend.com/

**Docs:** https://resend.com/docs

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `RESEND_API_KEY` | Server only | `re_…` — API key from Resend dashboard |
| `EMAIL_FROM` | Server only | Verified sender, e.g. `Vektrum <noreply@vektrum.io>` |
| `ADMIN_EMAIL` | Server only | Comma-separated operator email addresses for critical alerts |

**Domain verification:** Resend → Domains → Add `vektrum.io` → Add DNS records

---

**LOCAL (`.env.local`)**

```
RESEND_API_KEY=
EMAIL_FROM=Vektrum <noreply@vektrum.io>
ADMIN_EMAIL=
```

> Resend account email: ______________________________
> Verified domain: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
RESEND_API_KEY=
EMAIL_FROM=Vektrum <noreply@vektrum.io>
ADMIN_EMAIL=
```

> Sending domain verified: ________ yes / no
> DKIM/SPF records added: ________ yes / no

---

### 34.5 Perplexity AI (Primary AI Provider)

**What it does:** Primary provider for AI Draw Control Brief (draw review), contract analysis, and assistant queries. Uses `sonar-pro` model. Falls back to Anthropic if unavailable.

**Dashboard:** https://www.perplexity.ai/settings/api

**Model used:** `sonar-pro`

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `PERPLEXITY_API_KEY` | Server only | `pplx-…` — API key from Perplexity settings |

**Also required in:** Supabase Edge Functions secrets (`analyze-contract`, `generate-dispute-brief`) — set separately in Supabase Dashboard → Settings → Edge Functions → Secrets.

---

**LOCAL (`.env.local`)**

```
PERPLEXITY_API_KEY=
```

> Perplexity account email: ______________________________

---

**PRODUCTION (Vercel env vars + Supabase Edge Function secrets)**

```
PERPLEXITY_API_KEY=
```

> Supabase Edge Function secret set: ________ yes / no

---

### 34.6 Anthropic (First AI Fallback)

**What it does:** First fallback provider when Perplexity is unavailable. Used for draw review, contract analysis, and assistant. Uses `claude-sonnet-4-20250514`.

**Dashboard:** https://console.anthropic.com/

**Model used:** `claude-sonnet-4-20250514`

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | Server only | `sk-ant-…` — API key from Anthropic console |

---

**LOCAL (`.env.local`)**

```
ANTHROPIC_API_KEY=
```

> Anthropic account email: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
ANTHROPIC_API_KEY=
```

---

### 34.7 OpenAI (Second AI Fallback)

**What it does:** Second fallback provider when both Perplexity and Anthropic are unavailable. Uses `gpt-4o`. The full provider chain is: Perplexity → Anthropic → OpenAI. At least one must be configured for AI draw review to function.

**Dashboard:** https://platform.openai.com/

**Model used:** `gpt-4o`

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | Server only | `sk-…` — API key from OpenAI platform |

---

**LOCAL (`.env.local`)**

```
OPENAI_API_KEY=
```

> OpenAI account email: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
OPENAI_API_KEY=
```

---

### 34.8 AI Provider Tuning

These variables control the AI fallback chain timing and admin override behavior. They have safe defaults and are optional.

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER_TIMEOUT_MS` | `10000` | Per-provider timeout (ms) before chain moves to next provider |
| `AI_ADMIN_OVERRIDE_TTL_HOURS` | `4` | TTL for admin AI-review overrides (emergency bypass, time-limited) |

---

**LOCAL + PRODUCTION**

```
AI_PROVIDER_TIMEOUT_MS=10000
AI_ADMIN_OVERRIDE_TTL_HOURS=4
```

---

### 34.9 Vercel (Deployment + Cron)

**What it does:** Hosts the Next.js application. Runs scheduled cron jobs (`/api/cron/reconcile`, `/api/cron/audit-chain-health`) with HMAC-style bearer authentication.

**Dashboard:** https://vercel.com/dashboard

**Docs:** https://vercel.com/docs/cron-jobs

**Required variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `CRON_SECRET` | Server only | High-entropy random secret (min 24 chars). Vercel injects this automatically for cron invocations when set in project settings. |
| `NEXT_PUBLIC_APP_URL` | Public | Full app URL, e.g. `https://vektrum.io`. Used for email deep-links and Stripe onboarding return URLs. |
| `APP_URL` | Server | Same as `NEXT_PUBLIC_APP_URL` in server-only contexts. |

**Cron configuration:** Defined in `vercel.json`. Vercel sets `Authorization: Bearer {CRON_SECRET}` automatically.

---

**LOCAL (`.env.local`)**

```
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

> Cron secret generated: ______________________________

---

**PRODUCTION (Vercel env vars)**

```
CRON_SECRET=
NEXT_PUBLIC_APP_URL=https://vektrum.io
APP_URL=https://vektrum.io
```

> Vercel project name: ______________________________
> Vercel team: ______________________________
> Domain configured: ______________________________

---

### 34.10 Feature Flags & Safety Toggles

These are not third-party services — they are env-controlled feature gates built into the app.

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_RESET_ENABLED` | `false` | Set `true` only on a dedicated demo tenant. Enables `POST /api/demo/reset`. Never `true` in production unless intentional. |
| `ADMIN_PROMOTION_ENABLED` | `false` | Set `true` only during a deliberate admin promotion operation. Revert immediately after. Enables `POST /api/admin/promote`. |
| `ADMIN_ALLOWED_IPS` | unset | Comma-separated IPv4 or CIDR allowlist for admin routes. Optional but recommended in production. Example: `203.0.113.0/24,198.51.100.5` |
| `DOCUSIGN_WEBHOOK_DEV_BYPASS` | `false` | Local dev only. Never set in any deployed environment. |

---

**LOCAL (`.env.local`)**

```
DEMO_RESET_ENABLED=false
ADMIN_PROMOTION_ENABLED=false
ADMIN_ALLOWED_IPS=
DOCUSIGN_WEBHOOK_DEV_BYPASS=false
```

---

**PRODUCTION (Vercel env vars)**

```
DEMO_RESET_ENABLED=false
ADMIN_PROMOTION_ENABLED=false
ADMIN_ALLOWED_IPS=
```

---

### 34.11 Full `.env` Template

Copy this to `.env.local` for local development. Fill in values from the service dashboards above. Do not commit this file.

```bash
# ── Supabase ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUTH_WEBHOOK_SECRET=

# ── Stripe ─────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ── DocuSign ───────────────────────────────────────────────────────────────────
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_PRIVATE_KEY=
DOCUSIGN_OAUTH_HOST=account-d.docusign.com
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=
DOCUSIGN_WEBHOOK_DEV_BYPASS=false

# ── Email (Resend) ─────────────────────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=Vektrum <noreply@vektrum.io>
ADMIN_EMAIL=

# ── AI Providers ───────────────────────────────────────────────────────────────
# Chain: Perplexity sonar-pro → Anthropic claude-sonnet-4-20250514 → OpenAI gpt-4o
PERPLEXITY_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# ── AI Tuning ──────────────────────────────────────────────────────────────────
AI_PROVIDER_TIMEOUT_MS=10000
AI_ADMIN_OVERRIDE_TTL_HOURS=4

# ── App URL ────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000

# ── Cron ───────────────────────────────────────────────────────────────────────
CRON_SECRET=

# ── Feature flags ──────────────────────────────────────────────────────────────
DEMO_RESET_ENABLED=false
ADMIN_PROMOTION_ENABLED=false
ADMIN_ALLOWED_IPS=
```

---

### 34.12 Integration Health Check

Use `/api/admin/env-health` (admin route) to verify all integrations are configured correctly in any environment. This endpoint returns presence, length, and shape of every variable — never values. Run it after any deployment or credential rotation.

```bash
curl -H "Authorization: Bearer {admin_jwt}" https://your-domain.com/api/admin/env-health
```

Fields returned: `ok`, `environment`, `errors[]`, `warnings[]`, `variables` (presence + length map)

---

---

## 35. Public Site Source of Truth

This section is the canonical statement of what the **public site** says, what it does **not** say, and where each claim lives. Before editing any page in `src/app/(public)`, read this section.

### 35.1 What the Public Site Now Has (Built)

| Capability | Where it lives |
|------------|---------------|
| Per-page metadata (title, description, canonical) | `metadata` exports on every public page |
| Open Graph + Twitter Card metadata | Root layout defaults + per-page overrides |
| 1200×630 branded OG image | `public/og-image.png` (regen: `node scripts/build-og-image.mjs`) |
| robots.txt | `src/app/robots.ts` — allows public, disallows `/auth/`, `/dashboard/`, `/api/`, `/pitch`, `/invite/` |
| sitemap.xml | `src/app/sitemap.ts` — 18 public pages including `/resources` and the first article |
| `/llms.txt` | `src/app/llms.txt/route.ts` — machine-readable product summary for AI/LLM crawlers |
| Organization + WebSite JSON-LD | Root layout |
| `SoftwareApplication` JSON-LD | Homepage |
| `FAQPage` JSON-LD | `/help` (all 27 Q&A entries) |
| `Article` JSON-LD | `/resources/construction-dispute-isolation` |
| Skip link + `<main id="main-content">` | Root layout |
| Mobile nav `aria-controls` + drawer `id` | `src/components/nav/mobile-nav.tsx` |
| `/resources` content hub | `src/app/resources/page.tsx` |
| First resource article | `/resources/construction-dispute-isolation` |
| Funder segmentation (Private Lenders vs. Institutional Rails) | `src/app/funders/page.tsx` |
| Contractor invite-flow explanation + "Tell your funder" CTA | `src/app/contractors/page.tsx` |
| Quick Answer paragraphs | `/`, `/funders`, `/contractors`, `/help` |

### 35.2 What the Public Site Does **Not** Have Yet (Backlog)

- Per-article OG images (currently all use the default `og-image.png`)
- Live RSS / Atom feed for `/resources`
- More than one resource article
- A formal Press / Newsroom page
- A live FAQ search index
- Multi-language / locale variants
- Verified canonical URLs for every cited source (5 of 6 article sources still pending — see Section 37)

---

## 36. SEO/GEO Foundation

GEO = Generative Engine Optimization (LLM/AI crawler readability). This section codifies the patterns required to keep the public site indexable, citable, and AI-readable.

### 36.1 Per-Page Metadata Pattern (Required)

Every public page **must** export a `metadata` object containing at minimum:

```ts
export const metadata: Metadata = {
  title: '<Page-specific title>',           // omitted | template applied by root layout
  description: '<155–160 char summary>',
  alternates: { canonical: 'https://vektrum.io/<path>' },
  openGraph: {
    title: '<...>',
    description: '<...>',
    url: 'https://vektrum.io/<path>',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: '<...>',
    description: '<...>',
  },
}
```

The root layout sets `metadataBase: new URL('https://vektrum.io')` and a `title.template = '%s | Vektrum'`, so per-page `title` does not need the brand suffix.

### 36.2 robots.txt Rules

`src/app/robots.ts` is the single source of truth.

- **Allow:** `/`, `/about`, `/careers`, `/contact`, `/contractors`, `/demo`, `/demo-live`, `/founders`, `/funders`, `/help`, `/lenders`, `/partners`, `/pricing`, `/privacy`, `/resources`, `/security`, `/terms`, `/llms.txt`
- **Disallow:** `/auth/`, `/dashboard/`, `/api/`, `/pitch`, `/demo-live/admin`, `/demo-live/audit`, `/invite/`, `/forgot-password`
- **Sitemap:** `https://vektrum.io/sitemap.xml`

When adding a new public page: add it to `sitemap.ts`, add it to the `allow` list in `robots.ts`, run `npm run build`, and confirm it appears in build output.

### 36.3 Structured Data Inventory

| Page | Schema |
|------|--------|
| Root layout | `Organization`, `WebSite` |
| Homepage `/` | `SoftwareApplication` |
| `/help` | `FAQPage` (auto-built from `FAQ` + `TRUST_FAQ` arrays) |
| `/resources/<article>` | `Article` |

When adding a schema, render via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />`. Never inline-stringify — JSX text-escaping breaks `@context` URLs.

### 36.4 GEO / LLM Readability

`/llms.txt` is the machine-readable product summary served at `https://vektrum.io/llms.txt`. It contains:
- Company name + contact
- Category statement: "Conditional authorization infrastructure for construction disbursements"
- Core positioning ("Workflow tools track. Vektrum enforces.")
- What Vektrum does + what Vektrum does **not** do
- The 10-condition gate enumerated
- Buyer segments
- Positioning clarifications (especially what we are NOT)
- Key URLs
- Non-custody disclaimer

Update `LLMS_CONTENT` in `src/app/llms.txt/route.ts` whenever positioning shifts. Treat it like the homepage hero — small surface, high impact on how AI search systems describe Vektrum.

### 36.5 Page Naming for Discoverability

For any new page, the URL path **and** title should match search intent:
- `/resources/construction-dispute-isolation` — matches "construction dispute" search intent
- `/funders`, `/contractors`, `/lenders`, `/partners` — buyer-segment direct matches
- `/help` — utility intent

Avoid clever URL slugs that hide the page's purpose.

---

## 37. Citation Rules

This is the discipline that protects Vektrum from publishing unsupported statistics. **Every numeric or factual claim on a public page must satisfy one of three conditions:**

### 37.1 The Three Acceptable States for a Claim

1. **Cited.** Real source, verifiable URL or canonical citation, and the source actually supports the exact claim being made.
2. **Softened.** Stated qualitatively without a number ("multi-trillion-dollar industry," "common in construction lending") when no source is available.
3. **Removed.** Deleted entirely if the claim cannot be supported and softening would make the sentence empty.

There is **no fourth option**. "Citation placeholder," "TODO citation," "[source needed]," and similar markers are not allowed in shipped public pages — they fail the `seo-accessibility-audit.test.ts` test.

### 37.2 Source Quality Tiers

| Tier | Examples | Use |
|------|----------|-----|
| **A — Primary regulation / law** | FAR, OCC corporate decisions, California Civil Code, FDIC working papers | Best — cite directly. URLs are stable. |
| **B — Industry standards / contracts** | AIA Contract Documents, ALTA endorsements | Good. Cite as authoritative reference. |
| **C — Peer-reviewed / govt research** | FDIC working papers with named authors, ACFE reports | Good when sample size and methodology are stated. |
| **D — Trade-press analysis** | Bank Director, National Law Review (Allen Matkins) | Acceptable when supporting a structural observation, not a precise number. |
| **E — Vendor / competitor reports** | Rabbet's $280B figure, vendor whitepapers | **Use carefully.** Never as the only proof on an acquisition page. Acceptable in a partner brief targeting a non-overlapping segment. |

### 37.3 Vendor / Competitor Sources — Special Rules

- Do **not** cite a competitor's report as primary proof of a claim on `/funders`, `/contractors`, `/lenders`, or the homepage.
- Do **not** cite a competitor on `/pricing` or `/help` unless you are explicitly attributing them.
- Acceptable use: a partner brief or institutional one-pager where the competitor's customer base is non-overlapping.
- When in doubt: soften the claim instead.

### 37.4 What Was Removed (Historical)

These stats appeared in earlier copy and were removed because no real source supported them:

| Removed claim | Replaced with |
|---------------|---------------|
| `$3.1B lost annually to contractor fraud and payment disputes` | `$250K median construction occupational fraud loss (ACFE, 2024)` |
| `87% of construction projects have payment timing conflicts` | `12% of construction draw requests denied (FDIC, 2023)` |
| `$2.19 trillion industry` (precise, uncited) | `multi-trillion-dollar industry` (softened) |

### 37.5 Currently Verified Sources

Used in `/resources/construction-dispute-isolation`:

| # | Source | Used for | URL status |
|---|--------|----------|------------|
| 1 | FDIC working paper, *Bank Monitoring with On-Site Inspections* (Aug 2022 / Jul 2023) | 12% draw denial across 355,890 draws | Pending verification |
| 2 | Allen Matkins via NLR, *California Civil Code 8850* (Apr 2026) | Disputed/undisputed payment logic | Pending verification |
| 3 | Bank Director, *How Spreadsheets Add Risk to Construction Lending* (Apr 2019) | 35–50 loan administrator capacity | Pending verification |
| 4 | OCC Corporate Decision #2001-27 (Sep 2001) | Lender lien-status knowledge required before draw | Pending verification |
| 5 | FAR 52.232-5 + 52.232-27 | Itemized substantiation + 14-day prompt-payment timing | **Linked** — `acquisition.gov/far/52.232-5` and `52.232-27` |
| 6 | AIA Contract Documents, *Lien Waivers & Payment Bond Releases in Construction: A Guide* (Mar 2026) | Lien-clear confirmation per draw | Pending verification |

Pending entries are marked with `TODO(canonical-url)` JSX comments in `src/app/resources/construction-dispute-isolation/page.tsx`. An operator must verify each before publication.

---

## 38. Resource / Content Strategy

### 38.1 The /resources Hub

`src/app/resources/page.tsx` is the article index. Every new article must:
1. Be added as an entry in the `ARTICLES` array on this page
2. Have its own page at `src/app/resources/<slug>/page.tsx`
3. Be added to `src/app/sitemap.ts`
4. Be added to the `allow` list in `src/app/robots.ts` if not already covered by `/resources`
5. Include `Article` JSON-LD on the page

### 38.2 Article Anatomy (Required)

Every resource article follows this structure:

1. **Hero** — category eyebrow, read time, h1 headline, h2-style subhead/lede
2. **Body sections** — h2 per section, evidence-backed paragraphs
3. **Inline citations** — `<sup><a href="#source-N">[N]</a></sup>` superscripts at the end of any sentence containing a numeric claim
4. **Sources section** with `id="sources"` and 4+ numbered references
5. **Editorial note** — short disclaimer reaffirming non-custody and clarifying that Vektrum does not prevent fraud / eliminate disputes / guarantee compliance
6. **Related links** — cross-links to `/funders`, `/help`, and `/demo-live/deal/harbor` minimum

### 38.3 Article Voice Rules

- Lead with a structural observation, not a stat. Stats support the observation; they do not lead it.
- Quote regulation directly when possible (e.g., "FAR 52.232-27 requires…"). It carries authority that paraphrase loses.
- Compare without naming competitors by name on acquisition pages.
- Avoid "we believe," "we think," "we feel" — replace with cited fact or remove.
- Never use the word "guarantee" except in the negative ("Vektrum does not guarantee…").

### 38.4 Article Pipeline (Built / Backlog)

**Built:**
- `Why a $15K Construction Dispute Shouldn't Freeze a $9M Project` — milestone isolation case for the dispute-handling pattern

**Backlog (next priority order):**
1. *How Pre-Disbursement Evidence Became a Standard* — using OCC, FAR, AIA, ALTA sources from research CSV
2. *Construction Retainage Without the Spreadsheet Tax* — using FAR 32.103, Wipfli sources
3. *What "Authorization Infrastructure" Means in Construction Lending* — definitional / category-defining piece
4. *Title Disbursement and Conditional Authorization* — for institutional rails / partner audience
5. *Why Workflow Tools Track and Vektrum Enforces* — explanatory of the core positioning

### 38.5 Frequency Discipline

- Quality over cadence. One thoroughly-cited article per quarter beats four under-cited ones.
- An article is not "done" until its Sources section has zero `TODO(canonical-url)` markers — see test 72 in `seo-accessibility-audit.test.ts`.

---

## 39. Open Graph / Social Preview Standards

### 39.1 The Default OG Image

`public/og-image.png` is the default Open Graph image. Every public page references it via the root layout's `openGraph.images[0].url`.

**Specs:**
- 1200 × 630 px
- ≤ 100 KB (current: ~42 KB)
- PNG format
- Dark navy background (`#070D18` → `#0D1B2A` radial)
- Vektrum geometric V-mark + wordmark in upper-left
- "Workflow tools track. **Vektrum enforces.**" headline
- Subhead: "Construction draw release authorization before funds move."
- Support line: "AI informs. The gate decides. The funder authorizes. The rail executes."
- Right-side milestone-isolation diagram (approved cards continuing forward, one disputed card held at the gate)
- Non-custody disclaimer at bottom-left
- `vektrum.io` URL at bottom-right

### 39.2 Regenerating the OG Image

```bash
node scripts/build-og-image.mjs
```

The script writes both `public/og-image.png` (PNG via `sharp`) and `public/og-image.svg` (SVG fallback / source). Edit the SVG inside `scripts/build-og-image.mjs` and re-run.

### 39.3 Per-Article OG Images (Future)

Per-article OG images are not built yet. When adding them:
- Use the same 1200×630 dimensions and dark-navy palette
- Path convention: `public/og/<article-slug>.png`
- Reference in the article's `metadata.openGraph.images`
- Build script convention: `scripts/build-og-<article-slug>.mjs`

### 39.4 Banned OG Image Content

Do not put on any OG image:
- "Vektrum moves money"
- "AI approves"
- "Escrow replacement"
- "Funds stay in Stripe"
- "Tamper-proof"
- A faked customer logo wall
- Any pricing number that isn't currently published on `/pricing`

---

## 40. Accessibility Standards

### 40.1 Built-Now Foundations

| Pattern | Implementation |
|---------|---------------|
| Skip link | `<a href="#main-content">Skip to main content</a>` in root layout, visible only on `:focus` |
| Main content target | `<main id="main-content">` in root layout |
| Mobile nav ARIA | Hamburger has `aria-expanded`, `aria-label`, `aria-controls="mobile-nav-menu"`; drawer has `id="mobile-nav-menu"` and `aria-label="Mobile navigation"` |
| Focus visibility | Global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` in `globals.css` |
| Heading hierarchy | Every page has exactly one `<h1>`. Sections under it use `<h2>`. Cards/items under sections use `<h3>`. |
| Contrast guard | `tests/contrast-vektrum-blue.test.ts` enforces no `text-vektrum-blue` on dark backgrounds |
| Semantic landmarks | Every page wraps content in `<main>`. Footer is `<footer>`. Nav is `<nav>`. |

### 40.2 Heading Hierarchy Rules

- Exactly **one `<h1>`** per page.
- `<h2>` under `<h1>`. `<h3>` under `<h2>`. **No skipping levels.**
- The `/help` page was repaired to insert a `<h2>General questions</h2>` so the FAQ items (`<h3>`) no longer attach directly under the page `<h1>`.
- Card titles inside a labeled section are `<h3>`. Card titles in an unlabeled grid should still be `<h3>` if the surrounding section has no `<h2>` — but prefer adding the `<h2>`.

### 40.3 Link & Button Discipline

- Use `<Link>` for in-app navigation (Next.js App Router).
- Use `<a target="_blank" rel="noopener noreferrer">` for external links. This is enforced by `seo-accessibility-audit.test.ts` checks 69–70 for the resource article's Sources section.
- Buttons that don't navigate use `<button type="button">`. Submit buttons inside forms can omit `type` only when they are the form's submit button.
- Icon-only buttons require `aria-label`.
- Decorative icons inside text-bearing elements use `aria-hidden="true"`.

### 40.4 Color Contrast

`text-vektrum-blue` resolves to `#1A3A96` and is **only** allowed on light backgrounds. The `contrast-vektrum-blue.test.ts` guard:
- Hard-fails any other file using `text-vektrum-blue`
- Hard-fails any `text-vektrum-blue` outside the documented light-section line ranges in `page.tsx`

If the homepage is restructured, the `LIGHT_RANGES` array in that test must be updated. The test file documents how to re-derive ranges via `grep -n "<section className"`.

### 40.5 Form Field Contrast

Form input placeholders use `placeholder:text-white/55` on dark surfaces, hitting a ~4.2:1 ratio (WCAG AA for ≥18px). For smaller placeholder text, use `placeholder:text-white/65` or higher.

### 40.6 Backlog (Future A11y Work)

- Programmatic skip-link target verification on every dashboard route
- ARIA live regions for the dashboard's notification bell badge
- Reduced-motion variants for the homepage hero animations
- Keyboard-trap audit on the mobile drawer when open
- Screen-reader testing with NVDA + VoiceOver on the deal control center

---

## 41. Funder Segmentation Rules

`/funders` separates two distinct buyer messages. **Do not collapse them into a single tier card.** They have different rails, different fee structures, and different objections.

### 41.1 Private Lenders & Direct Deals

**Audience:** Private lenders, fix-and-flip operators, construction bridge lenders, direct lending funds without existing treasury infrastructure.

**Rail:** Stripe Connect (automated rail) — Vektrum triggers a Stripe Connect transfer after authorization; funds are held in Stripe-managed accounts, not by Vektrum.

**Pricing:** 1% governance fee per authorized release, no annual retainer.

**Pitch frame:**
- "Automated disbursement after release authorization"
- "Contractor onboarding in minutes"
- "1% fee per authorized release, $0 until then"
- "No treasury infrastructure required"

### 41.2 Institutional Rails & Portfolio Lenders

**Audience:** Construction loan servicers, credit funds, banks, title companies, escrow companies, fund managers with licensed payment infrastructure.

**Rail:** External / manual — Vektrum issues an authorization signal; the customer's existing wire/ACH/title disbursement/check process executes payment.

**Pricing:** Annual retainer for portfolio onboarding + per-release governance fee (invoiced separately, not deducted from contractor disbursements).

**Pitch frame:**
- "Add release-condition enforcement to your existing payment process"
- "No Stripe required"
- "Partner API for programmatic confirmation by title/escrow systems"
- "Dedicated onboarding + audit support"

### 41.3 Above-Fold Non-Custody Trust Strip

`/funders` displays a non-custody trust strip immediately below the hero, before any benefit cards. It says:

> "Vektrum does not hold funds, act as escrow, or execute wires. For Stripe Connect deals, funds are held in Stripe-managed accounts. For institutional deals, your existing bank, title company, escrow company, or treasury executes payment. Vektrum enforces release conditions and records authorization proof."

This block is non-negotiable. Any restructure of `/funders` must preserve this language above the fold.

### 41.4 Forbidden Funder Copy

Never say on `/funders`:
- "We move funds for you"
- "Your funds stay in Stripe" (technically inaccurate for institutional deals)
- "We replace your treasury process"
- "We replace your title or escrow partner"
- "AI approves your draws"

---

## 42. Contractor Referral / Invite Flow

`/contractors` is the contractor-acquisition surface. It must explain how a contractor actually starts using Vektrum, and provide a referral path for contractors whose funder is not yet on the platform.

### 42.1 The Invite Flow (How Contractors Join)

The page explains, in order:
1. Funder invites the contractor to a deal via a secure invite link
2. Contractor accepts the invite and creates a free account
3. If the deal runs on Stripe Connect, the contractor completes Stripe onboarding for direct deposit
4. If the deal runs on an institutional rail, no Stripe onboarding is required
5. No subscription fees, no per-milestone charges, no onboarding costs for contractors — ever

### 42.2 The Referral CTA — "Tell Your Funder About Vektrum"

A blue-bordered referral block sits between the Quick Answer and the benefit cards. It addresses the contractor whose funder is not yet on Vektrum. The CTA text is:

> "Working with a funder who isn't on Vektrum yet? Send them this link and ask them to add you to your next project. Setup takes minutes. Contractors always join free."

The button label is **"Tell your funder about Vektrum"** and links to `/funders`.

### 42.3 Why This Matters

Contractors are not the buyer, but they are the most likely first point of word-of-mouth. A contractor who finishes a Vektrum draw cycle is the strongest referral source for the funder economy. The referral CTA gives them a frictionless way to help.

### 42.4 Forbidden Contractor Copy

Never say on `/contractors`:
- "Get paid faster" — Vektrum doesn't speed payment; it determines when authorization is appropriate
- "Vektrum pays you" — the rail pays; Vektrum authorizes
- "AI approves your milestone" — AI informs; the gate decides; the funder authorizes
- "Guaranteed dispute resolution"
- Any pricing implying the contractor pays anything, ever

---

## 43. Public Copy Guardrails

A consolidated banned-and-approved list. This is the rule sheet to put next to anyone writing public copy, including AI assistants.

### 43.1 Banned Phrases (Never On Any Public Page)

| Banned phrase | Why |
|---------------|-----|
| "Vektrum moves money" | Vektrum does not execute payment |
| "Vektrum holds funds" | Stripe or partner rail holds funds |
| "AI approves [releases / payments / draws]" | The deterministic gate decides; AI only informs |
| "Escrow replacement" | Vektrum is additive, not a replacement |
| "Funds stay in Stripe" | Inaccurate for institutional rails; misleads on Stripe rail too |
| "Tamper-proof" | We say *tamper-evident*. Application-level modification is blocked; sophisticated infrastructure attacks remain theoretically possible |
| "Fully automated AI payments" | Authorization is deterministic; AI is a precondition |
| "Vektrum prevents fraud" | We add structured checks; we do not prevent |
| "Vektrum eliminates disputes" | Disputes are isolated, not eliminated |
| "Vektrum guarantees compliance" | Compliance is enforced by the gate's conditions; we do not guarantee |
| "Bank-grade" / "lender-grade" / "institutional-grade" | Marketing fluff — say what we actually do |
| "Construction's Stripe" / "Stripe for construction" | Misframes the product |

### 43.2 Approved Core Phrases

| Phrase | Use |
|--------|-----|
| "Conditional authorization infrastructure for construction disbursements" | Category statement |
| "Workflow tools track. Vektrum enforces." | Headline / hero / OG |
| "AI informs; the gate decides; the funder authorizes; the rail executes." | Process explanation |
| "Vektrum does not hold funds, act as escrow, or execute wires." | Non-custody disclaimer |
| "10-condition release gate" | Always with the number |
| "Hash-chained, append-only audit trail" | Audit framing |
| "Tamper-evident" (not tamper-proof) | Audit framing |
| "Release conditions" / "release authorization" | Core product noun |
| "AI Draw Control Brief" / "Perplexity Draw Control Brief" | Specific to AI precondition |

### 43.3 Non-Custody Standard Language

This block, or a near-equivalent, should appear at least once on every acquisition page (homepage, /funders, /contractors, /lenders, /partners) and at the bottom of the resource article:

> "Vektrum is authorization infrastructure — not a bank, lender, or money transmitter. Vektrum does not hold or custody funds. Funds are held by Stripe (Stripe Connect deals) or the funder's institutional payment partner (external-rail deals). Data is encrypted in transit and at rest."

### 43.4 Statistics Discipline

- **Real source or no number.** See Section 37.
- **Vendor / competitor stats** — never as primary proof on acquisition pages.
- **Round numbers without source** — softened ("multi-trillion-dollar" instead of "$2.19 trillion").
- **Stats that imply a guarantee** ("100% of releases authorized correctly") — never.

---

## 44. Content Publishing Checklist

Use this every time a new article or major copy change is added to the public site. The article does not ship until every box is checked.

### 44.1 Pre-Write

- [ ] Topic is on the Section 38.4 backlog or has been added to it
- [ ] Buyer audience identified (private lenders / institutional / contractors / partners)
- [ ] Sources researched in advance — no "I'll find a source for this stat later"
- [ ] Each numbered/factual claim has a planned citation tier (A/B/C/D/E from Section 37.2)

### 44.2 Article Body

- [ ] Hero block: category eyebrow, read time, h1, lede
- [ ] Section headings are `<h2>`; sub-points are `<h3>`
- [ ] Every numeric claim has an inline `<sup>` link to a numbered source
- [ ] No "[Citation placeholder]" text anywhere
- [ ] No "[citation needed]" text anywhere
- [ ] No competitor name used as primary proof
- [ ] No banned phrase from Section 43.1 appears
- [ ] Non-custody disclaimer appears in the editorial note or body
- [ ] Internal links to `/funders`, `/help`, and a relevant demo URL

### 44.3 Sources Section

- [ ] `id="sources"` set on the wrapping `<section>`
- [ ] At least 4 distinct sources
- [ ] Each source is a `<li id="source-N">` with publisher, title, date, and the specific claim it supports
- [ ] External links use `target="_blank" rel="noopener noreferrer"`
- [ ] No `href="#"`, `href="example.com"`, or `href="TODO"` placeholders
- [ ] Unverified URLs are wrapped in a `<span>` (not an `<a>`) and tagged with a `TODO(canonical-url)` JSX comment
- [ ] Editorial note disclaims fraud-prevention / dispute-elimination / compliance-guarantee claims

### 44.4 Metadata + SEO

- [ ] Page exports a `metadata` object
- [ ] `alternates.canonical` set to the full `https://vektrum.io/<path>`
- [ ] `openGraph.title`, `description`, `url`, and `images` set
- [ ] `twitter.title` and `description` set
- [ ] `Article` JSON-LD injected via `<script type="application/ld+json">`
- [ ] Page slug added to `src/app/sitemap.ts`
- [ ] If outside `/resources`, add to `robots.ts` allow list

### 44.5 Tests

- [ ] `npx tsx tests/seo-accessibility-audit.test.ts` — all checks pass
- [ ] `npm test` — full suite green
- [ ] `npm run build` — clean build

### 44.6 Final Read

- [ ] Read the article aloud once at normal pace. Anywhere you stumble is a place to cut or rewrite.
- [ ] Have a non-construction reader read the lede. They should understand the problem in two sentences.

---

## 45. Pre-Merge Website QA Checklist

Run this every time a public-page PR is opened. This is the bar before merge, not just before deploy.

### 45.1 Build & Test

- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `npx tsx tests/seo-accessibility-audit.test.ts` exits 0
- [ ] `npx tsx tests/contrast-vektrum-blue.test.ts` exits 0
- [ ] No new TypeScript errors introduced
- [ ] No new ESLint errors introduced

### 45.2 Visual Smoke

- [ ] Homepage `/` loads, hero CTA visible
- [ ] `/funders` loads, non-custody trust strip visible above fold
- [ ] `/funders` shows both Private Lenders and Institutional Rails sections
- [ ] `/contractors` loads, "Tell your funder about Vektrum" CTA visible
- [ ] `/help` loads, FAQ items render (>20 entries)
- [ ] `/pricing` loads, fee structure cards render
- [ ] `/demo-live/deal/harbor` loads, milestone state visible
- [ ] `/resources` loads, at least one article listed
- [ ] `/resources/construction-dispute-isolation` loads with Sources section
- [ ] `/llms.txt` returns plain text with company summary
- [ ] `/robots.txt` returns and references sitemap.xml
- [ ] `/sitemap.xml` returns and includes new pages
- [ ] `/auth/logout` works (no 404)

### 45.3 Mobile / Accessibility

- [ ] Tab from page top — first focus is the skip link
- [ ] Skip link Enter jumps focus to main content
- [ ] Mobile hamburger opens drawer; `aria-expanded` toggles
- [ ] Mobile drawer is closable via Escape key
- [ ] No `text-vektrum-blue` on a dark background
- [ ] Heading hierarchy: exactly one `<h1>`, no level skips
- [ ] All images have `alt` attributes (decorative ones use empty `alt=""`)

### 45.4 Copy / Truth-Lock

- [ ] No banned phrases from Section 43.1 appear in changed files
- [ ] Non-custody disclaimer present where Section 43.3 requires it
- [ ] Any new statistic has a real source from Section 37
- [ ] No competitor name appears as primary proof on an acquisition page
- [ ] All numeric claims either cite or are softened

### 45.5 Metadata

- [ ] Each new page has its own `metadata` export
- [ ] Each new page has its own canonical URL in `alternates.canonical`
- [ ] OG image referenced correctly (defaults to `/og-image.png`)
- [ ] Sitemap updated if new public page added
- [ ] robots.ts updated if new disallow path added

### 45.6 Deploy Readiness

- [ ] No real secrets in changed files
- [ ] No `console.log` debug statements left in production paths
- [ ] No commented-out code left over from drafts
- [ ] Branch up to date with `main`
- [ ] PR description summarizes what changed and why

---

*End of Vektrum Master Handbook*  
*Maintained by Adam Morgan — update after major product changes, new partner conversations, or positioning shifts.*  
*Do not distribute externally without redacting pilot details, pricing, and internal build status.*
