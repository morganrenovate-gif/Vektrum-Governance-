# Vektrum — Buyer & Partner Demo Script

**Last updated:** 2026-04-28  
**Demo URL:** `/demo-live/funder?tour=1`  
**Audience:** Construction lenders, private credit funds, title companies, escrow companies, construction loan servicers, institutional partners  
**Core message:** Keep your payment process. Add release enforcement.

---

## Safety rules — say this, not that

| ✅ Say | ❌ Never say |
|---|---|
| Conditional authorization infrastructure | Payment processor |
| Release-control infrastructure | Escrow replacement / trust account |
| Selected rail executes | Vektrum moves money / moves wires |
| Your existing payment process | Vektrum holds funds |
| Tamper-evident, append-only audit trail | Tamper-proof |
| AI assists review — the gate decides | AI approves payments |
| Funder-authorized release | Instant payments |
| External/manual rail | Guaranteed fraud prevention |
| Stripe Connect rail | Contractor invoicing app |
| Governance fee / Vektrum Compliance Review Fee | Transaction fee / payment fee |

---

## 1. 30-second opener

Use when you have very little time — hallway, intro call, first 30 seconds of any meeting.

> "Vektrum sits between draw approval and payment execution.
> Before a construction payment releases, 10 conditions are verified server-side, simultaneously.
> We don't touch the money — Stripe Connect or your existing bank or escrow executes.
> We govern whether release is allowed and record every decision for audit."

**If they ask "so what does that mean for us?"** → go to the 90-second walkthrough.  
**If they say "how is that different from DocuSign?"** → "DocuSign collects signatures. Vektrum enforces conditions before funds move."

---

## 2. 90-second guided walkthrough

Start at: **`/demo-live/funder?tour=1`**

The `?tour=1` query param activates an inline guided walkthrough panel with 7 steps. Walk through it with the buyer:

| Step | Say |
|---|---|
| Step 1 — Simulated environment | "This is a demo — no real funds. The red banner confirms that. In production, this is Sarah's real portfolio." |
| Step 2 — Draw evidence | "A contractor submits a draw with supporting documents — invoice, inspection report, photos. The funder reviews before the gate runs." |
| Step 3 — AI review | "The AI pre-review flags risk signals and missing documents. It informs the funder — it cannot approve a release. The gate decides." |
| Step 4 — Release gate | "All 10 conditions must pass. No condition can be waived at will. Admins can't bypass it. Contractors can't self-approve." |
| Step 5 — Dispute isolation | "A disputed draw locks one milestone. The rest of the project keeps moving." |
| Step 6 — Activity log | "Every action is logged — actor, timestamp, proof. In production, it's hash-chained and append-only." |
| Step 7 — Your payment rail | "After authorization, your rail executes. We don't touch the money." |

Click "End Tour" → then go to the 5-minute demo flow.

---

## 3. 5-minute demo flow

### 3a. Portfolio dashboard (`/demo-live/funder`)

- Show the portfolio overview: 3 active deals, total capital deployed, release progress bars.
- Point to the Action Queue: "There's 1 item requiring funder action — a dispute on Harbor Logistics. We'll come back to that."
- Click "Review Draw" on Riverside → goes to the Riverside deal page.

### 3b. Riverside deal — milestone with evidence (`/demo-live/deal/riverside?from=funder`)

- Show the milestone list. Find MEP Rough-In — status "Ready for Review."
- Expand the milestone. Show the Supporting Documents panel.
- "A contractor uploaded an invoice, inspection report, and site photos. The checklist on the right shows suggested evidence — it's guidance, not a hard gate requirement. Upload requirements vary by contract."
- Click "Request AI Review." Show the AI review modal.
  - "AI score of 88/100. Two risk flags. This is pre-review — it informs the funder. The gate still has to run."
- Show the Release button. "The gate checks all 10 conditions before this executes. If any fail, the release is blocked and the reason is recorded."

### 3c. Harbor dispute (`/demo-live/deal/harbor-dispute?from=funder`)

- "HVAC Equipment Procurement — $487K in dispute."
- Show the disputed milestone. "Other milestones on this deal are still releasing normally — dispute isolation means one problem doesn't freeze the portfolio."
- Click "Resolve Dispute." Show the three options: reject, partial release, full release.
- Choose partial release. Enter an amount. "The funder decides how much, if any, releases. The rest stays held until evidence is provided."
- Point to the Demo Activity Log at the bottom. "Every action here is logged — in production, this is an append-only, hash-chained audit trail."

### 3d. Payment rail explanation (no specific page needed — explain verbally)

- "After the gate passes and the funder clicks Release, one of two things happens."
  - "Stripe Connect rail: Vektrum triggers a Stripe transfer. Funds move from a Stripe managed account to the contractor. We don't touch the money."
  - "External/manual rail: Vektrum fires a signed authorization signal to your system. Your bank, title company, escrow, or treasury executes payment through your existing process. You stay in control."

---

## 4. 10-minute buyer conversation flow

Use this for a structured discovery-and-demo meeting.

### Opening (2 min)

Ask:
- "How do draws get approved today — email, spreadsheet, LOS?"
- "Who has visibility into whether conditions were met before a payment went out?"
- "Has your team ever released a payment that came back later as a problem?"

Then: "Let me show you what Vektrum looks like in practice." → run the 5-minute demo flow.

### After demo (5 min)

Address what they reacted to most. Then:
- "The pattern here is: we sit between approval and execution. We don't replace your payment system."
- "For institutional customers on the external/manual rail, you keep your wire/ACH/title process. Vektrum adds the enforcement and audit layer before it runs."
- "We bill you separately — a governance fee. We don't skim from contractor payments."

### Discovery close (3 min)

Use the questions from Section 8.

---

## 5. Handling common objections

### "So are you escrow?"

> "No. Escrow holds funds on behalf of parties. Vektrum doesn't hold funds at all. For Stripe rail deals, Stripe holds funds. For external/manual rail deals, funds stay in your bank or your title company's account — they never touch Vektrum. We're the enforcement layer, not the custody layer."

### "Do you move the money?"

> "No. After Vektrum authorizes a release, your payment rail executes. On Stripe Connect, Stripe moves it. On external/manual rail, your bank, escrow, or treasury executes through your existing process. Vektrum fires the authorization signal and records the confirmation."

### "Does AI approve the payment?"

> "No. AI reviews the draw evidence and flags risks — it's pre-review, not approval. The 10-condition gate is deterministic: all conditions have to pass before any release. The funder triggers the release. The gate enforces it. AI informs; the gate decides."

### "What if we already use title/escrow?"

> "Perfect. You keep using them. On the external/manual rail, Vektrum enforces conditions and sends a signed authorization to your title company or escrow. They execute payment through their existing workflow. Nothing changes for them — they just get a verified authorization signal and a proof-of-audit record before they wire."

### "How do you get paid?"

> "We charge a governance fee — the Vektrum Compliance Review Fee — per verified disbursement. For institutional customers on the external/manual rail, we invoice you directly. We don't skim from contractor payments; your rail executes the full disbursement. The governance fee is a separate line."

### "What happens with change orders?"

> "Change orders are wired into the release gate. If a contractor submits a change order on a milestone, the gate blocks release on that milestone until you approve or reject it. Approved change orders update the milestone amount. Rejected ones let the release proceed at the original amount. The decision is recorded in the audit trail."

### "Who controls retainage?"

> "You do — the funder and the contract terms. Contractors can see how much is withheld per milestone, but they cannot release retainage. Only the authorized release party — you — can release it after verifying completion conditions. Vektrum records the retained amounts but does not hold the funds."

### "What documents are required?"

> "That depends on your contract and your review process. Vektrum shows contractors a suggested evidence checklist — invoice, inspection report, photos, receipts, change order backup — but it's guidance, not a hard gate requirement. The gate conditions that matter are the ones you configure: lien waivers, sequential ordering, signed contracts. You define the rules; Vektrum enforces them."

### "What happens if a payment fails?"

> "On Stripe rail: Stripe's transfer failure is caught by our reconciliation engine. The milestone status is preserved; the release is flagged for funder action. On external/manual rail: the funder records the failure, the reservation is freed, and the milestone stays in authorized state for admin review. The failure is logged with actor, timestamp, and reason. No auto-retry or auto-revert — those require funder or admin action."

---

## 6. Recommended demo path (quick reference)

```
1. /demo-live/funder?tour=1       → 90-second walkthrough (7 steps)
2. /demo-live/deal/riverside      → Evidence review, AI review, release gate
3. /demo-live/deal/harbor-dispute → Dispute isolation, partial release, activity log
4. (verbal)                       → External/manual rail explanation, billing model
```

Optional deep-dives:
- `/demo-live/audit` → Audit log / hash-chain evidence
- `/demo-live/admin` → Admin ops dashboard (no release authority)
- `/demo-live/funder/capital` → Capital deployment overview

---

## 7. Discovery questions — close of meeting

Ask these to qualify the deal and shape a proposal:

1. **"Who currently approves draws on your projects, and what does that process look like?"**  
   Listen for: manual email chains, spreadsheets, LOS gaps, compliance pain.

2. **"Where does release evidence live today — the inspection report, the lien waiver, the invoice?"**  
   Listen for: scattered across email, DocuSign, Dropbox, LOS — no single system of record.

3. **"Who executes the payment once a draw is approved? Your ops team, a title company, escrow?"**  
   Listen for: which rail model fits (Stripe Connect vs. external/manual).

4. **"What causes delays or disputes in your current draw process?"**  
   Listen for: missing documents, contractor disputes, change orders, duplicate payments, inspector scheduling.

5. **"What audit trail do you have today if a disbursement is questioned three years later?"**  
   Listen for: no trail, email archives, spreadsheets — compliance and regulatory risk.

6. **"Would an authorization layer — where conditions are verified and recorded before funds move — fit into your current process?"**  
   This is the close. If "yes" → book a pilot. If "we'd need to check with our ops/compliance team" → ask to get them on the next call.

---

## 8. Demo environment notes

- `/demo-live` is 100% client-side. No real data, no real accounts, no real payments.
- The Demo Mode banner at the top confirms the isolated environment.
- Clicking "Reset Demo" returns all state to defaults — safe to use in any meeting.
- Do not log in to the production dashboard during a demo meeting. Use `/demo-live` only.
- The `?tour=1` query param enables the guided walkthrough. Remove it for a free-form demo.
