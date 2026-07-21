# Vektrum + Procore — "Better Together" Solution Deck (Step 3)

Slide-by-slide outline with speaker-ready content. All product claims are grounded in
the Step 1 inventory. Metrics we don't yet have are marked `[FOUNDER TO CONFIRM: …]`
rather than fabricated. Integration steps are marked **Live** or `[PROPOSED]`.

**One-line thesis:** *Procore runs the project and the downstream payment. Vektrum
governs the capital coming **into** the project and proves every draw was verified before
a dollar moved.*

---

## Slide 1 — Title

**On slide:**
- **Vektrum + Procore: Governed Capital for Construction**
- Real-time draw verification and disbursement authorization for the capital funding
  Procore projects.
- Vektrum · Construction Payment Governance Infrastructure

**Speaker notes:** "Procore is the system of record for the project. Vektrum is the
governance layer for the money flowing into it. This isn't another payment tool — it's
the verification layer that sits in front of the draw."

---

## Slide 2 — The problem

**On slide:**
- Procore governs the *project*. The **capital funding the project is still ungoverned.**
- Lenders and owners approve draws on **email, PDFs, and trust** — with no real-time,
  enforced verification that release conditions were actually met.
- The result: **lien surprises, draw-fraud exposure, and frozen capital** when one
  milestone goes wrong.
- Approving a draw is not the same as *enforcing* the conditions behind it.

**Speaker notes:** "Everyone in the draw process tracks approvals. Almost no one can point
to the control that would have physically stopped a release if a condition failed. That
gap — between an approval in Procore and a wire from the lender — is where the losses
live. Owners feel it as a lien they didn't see coming."

---

## Slide 3 — Two platforms, one clean boundary

**On slide (two columns):**

| Procore owns | Vektrum owns |
|---|---|
| Project system of record | Capital-**in** governance |
| Prime Contract, SOV, Change Orders | Draw verification against release conditions |
| Documents, Photos, RFIs | **Deterministic 10-condition release gate** (server-side) |
| **Procore Pay** — GC → Sub payment | **Signed disbursement authorization** (lender/owner → project) |
| **Levelset** — lien-waiver management | **Hash-chained, append-only audit trail** |

- **The boundary:** Vektrum governs **lender/owner → project** capital. It does **not**
  touch **GC → sub** payment (Procore Pay) or replace lien-waiver management (Levelset) —
  it **reads** waiver status and sits beside them.
- Vektrum is **non-custodial**: it authorizes; the funder's rail (Stripe Connect or an
  institutional partner) moves the money.

**Speaker notes:** "This is the most important slide. We are deliberately *not* in
Procore Pay's lane or Levelset's lane. We govern the money coming in from the lender or
owner. We read Levelset waiver status; we don't replace it. Clean, additive, no overlap."

---

## Slide 4 — Integrated architecture

**On slide:**
- Insert the Mermaid workflow diagram (`integration-diagram.md` / `.mmd`).
- Callouts:
  - **Read from Procore** `[PROPOSED]`: Prime Contract SOV (G702/G703), Change Orders,
    Documents/Photos, Levelset waiver status.
  - **Vektrum governs (Live):** 10-condition gate → signed authorization → disbursement
    on the funder's rail → hash-chained audit.
  - **Write back to Procore** `[PROPOSED]`, non-invasive: **Create** a verification/audit
    attachment on the Prime Contract; **Update** a draw-verification status field the GC
    can see. **No writes into Procore's core financial tools; no Delete.**

**Speaker notes:** "Data flows one way in, decision happens in Vektrum, proof flows back.
We're read-heavy on Procore and we only add an attachment and a status. We never mutate
your financial system of record — that keeps this low-risk to approve."

---

## Slide 5 — Measurable mutual-customer outcomes

**On slide (each = concrete mechanism + metric to confirm):**

1. **Faster verified draws.**
   Mechanism (live): the draw's SOV and evidence run through a **server-side 10-condition
   gate** instead of manual PDF/email review; an authorized draw ships with its proof
   attached. *`[FOUNDER TO CONFIRM: draw cycle time, e.g., "from N days to M days"]`.*
2. **Audit-ready lender compliance, automatically.**
   Mechanism (live): every decision is written to an **append-only, SHA-256 hash-chained
   audit log**; a one-click **audit packet** (already emitted by Vektrum) attaches to the
   Procore Prime Contract. *`[FOUNDER TO CONFIRM: audit-prep time reduction]`.*
3. **Fewer mechanics liens reaching owners.**
   Mechanism (live): release is **blocked** unless an approved **conditional lien waiver**
   is on file (gate Condition 10), reading Levelset status. *`[FOUNDER TO CONFIRM: lien
   incidence reduction]`.*
4. **A dispute no longer freezes the whole project.**
   Mechanism (live): **dispute isolation** blocks the affected milestone only; the rest of
   the schedule keeps releasing. *`[FOUNDER TO CONFIRM: capital-continuity metric]`.*

**Speaker notes:** "Procore weights outcomes heavily, so each of these is a mechanism
that's already live in the product, with the number left for us to fill from customer
data. Even without the numbers, the mechanism is concrete: a bad draw is refused before
money moves, and the proof lands back in Procore."

---

## Slide 6 — Ideal mutual-customer profile

**On slide:**
- A **construction lender, private credit fund, or owner** running **fund control** on
  projects that a **GC manages in Procore.**
- Adjacent fit: **title / escrow / fund-control firms** administering draws for those
  projects.
- Trigger conditions: multi-draw projects, lender covenants requiring verified draws,
  lien-waiver compliance obligations.
- Project profile: *`[FOUNDER TO CONFIRM: project size band, asset types, # draws/project]`.*

**Speaker notes:** "The sweet spot is a Procore GC whose project is funded by an outside
lender or owner doing fund control. Procore already has the GC; we bring the lender/fund-
control relationship. Same project, two systems, no overlap."

---

## Slide 7 — GTM / joint motion

**On slide:**
- **Marketplace:** list Vektrum in the **Procore App Marketplace** as a capital-in
  governance app (beside Levelset / Pay, not competing).
- **Co-sell:** target Procore accounts where an **external lender/owner funds the draw**;
  Vektrum brings the lender/fund-control side, Procore brings the project footprint.
- **Bi-directional referral:** Procore refers lender-funded projects needing draw
  governance; Vektrum refers its lenders' GCs onto Procore.
- **Proof of no conflict:** Vektrum is non-custodial and reads (not replaces) Levelset;
  it does not compete with Procore Pay.
- Launch design partners / pilots: *`[FOUNDER TO CONFIRM: named pilots or "in
  conversations with N lenders"]`.*

**Speaker notes:** "The joint motion is natural because our buyer (the lender/owner) is
the one party Procore doesn't sell to directly. We expand Procore's surface into the
capital stack without touching its payment revenue."

---

## Slide 8 — Roadmap (live vs proposed)

**On slide:**

**Live today (verified in Vektrum's codebase):**
- 10-condition server-side release gate; signed disbursement authorization tokens.
- Hash-chained, append-only audit trail + exportable audit packet.
- Stripe Connect + external/manual institutional rails (non-custodial).
- DocuSign contract e-sign; SOV (AIA G702/G703); lien-waiver gating; dispute isolation.
- **Partner API + HMAC-signed webhook framework** — the foundation the connector rides on.

**Phase 1 — Read sync `[PROPOSED]`:**
- Procore **OAuth** app; **Read** Prime Contract SOV, Change Orders, Documents/Photos into
  a Vektrum draw. *(No OAuth app registered today.)*

**Phase 2 — Write-back `[PROPOSED]`:**
- **Create** verification/audit attachment on the Prime Contract; **Update** draw-
  verification status field. Non-invasive; no core-financial writes.

**Phase 3 — Compliance depth + GA `[PROPOSED]`:**
- **Read** Levelset lien-waiver status into gate Condition 10; Procore Marketplace GA;
  event-driven re-verification via webhooks.

**Speaker notes:** "Everything in the governance core is already built and running. The
Procore-specific work is a well-scoped connector on top of an integration framework we
already ship — OAuth, read sync, then a light write-back. We're labeling honestly:
nothing Procore-facing is live yet, and that's exactly what a feasibility review should
see."

---

### Appendix — claim provenance (for internal use, do not present)
- 10-condition gate, authorization tokens, dispute isolation, lien-waiver Condition 10,
  hash-chained audit, SOV G702/G703, DocuSign, Stripe + external rails, Partner API +
  webhooks: all verified in `00-integration-inventory.md` with source-file citations.
- No Procore OAuth/REST/webhook code exists — every Procore-facing item is `[PROPOSED]`.
