# Vektrum ⇄ Procore — Integration Workflow Diagram (Step 2)

**Grain (confirmed):** Vektrum governs the **owner/lender draw against the Prime
Contract**. A Vektrum draw maps to the **Procore Project + Prime Contract Schedule of
Values (AIA G702/G703)** — *not* Commitments. Commitments are the GC→sub layer owned by
Procore Pay and Levelset; Vektrum stays cleanly in the **capital-into-the-project** lane,
**beside** Levelset, never on top of it.

**Legend for line styles:** solid = **live today**; dotted + `[PROPOSED]` = **not yet
built** (feasible on Vektrum's existing Partner API + webhook framework). Every
cross-system exchange is labeled with **direction** (`P→V` Procore→Vektrum, `V→P`
Vektrum→Procore) and a **CRUD** verb.

```mermaid
flowchart LR
  %% ============================================================= ACTORS (swimlane)
  subgraph ACTORS["ACTORS"]
    direction TB
    LO["Lender / Owner<br/>(capital source)"]
    GC["General Contractor<br/>(Procore user)"]
    ESC["Escrow / Fund Control"]
    SUB["Subcontractor"]
  end

  %% ============================================================= PROCORE (system of record)
  subgraph PROCORE["PROCORE — Project system of record"]
    direction TB
    P_PROJ["Project /<br/>Project Financials"]
    P_SOV["Prime Contract<br/>Schedule of Values<br/>(AIA G702 / G703)"]
    P_CO["Change Orders"]
    P_DOC["Documents / Photos"]
    P_LS["Levelset<br/>Lien Waivers"]
    P_PAY["Procore Pay<br/>GC to Sub payment"]
  end

  %% ============================================================= VEKTRUM (capital-in governance)
  subgraph VEKTRUM["VEKTRUM — Capital-in governance layer"]
    direction TB
    V_IN["Draw intake<br/>deal + SOV + evidence"]
    V_GATE{"Release Gate<br/>10 conditions<br/>server-side"}
    V_AUTH["Signed disbursement<br/>authorization"]
    V_RAIL["Disbursement rail<br/>Stripe Connect / external"]
    V_AUD["Hash-chained<br/>audit trail"]
  end

  %% ---- LIVE: existing human + Procore workflow ------------------------------
  LO -->|"funds loan / project"| P_PROJ
  GC -->|"submits draw, updates SOV"| P_SOV
  GC -->|"logs change orders"| P_CO

  %% ---- PROPOSED: Procore -> Vektrum (READ) ----------------------------------
  P_SOV -. "P->V  READ: SOV lines, % complete  [PROPOSED]" .-> V_IN
  P_CO  -. "P->V  READ: change orders  [PROPOSED]" .-> V_IN
  P_DOC -. "P->V  READ: evidence docs / photos  [PROPOSED]" .-> V_IN
  P_LS  -. "P->V  READ: lien-waiver status  [PROPOSED]" .-> V_IN

  %% ---- LIVE: Vektrum internal governance ------------------------------------
  V_IN --> V_GATE
  V_GATE -->|"BLOCKED: condition unmet -> back to GC / Owner"| GC
  V_GATE -->|"AUTHORIZED"| V_AUTH
  V_GATE --> V_AUD
  V_AUTH --> V_AUD
  V_AUTH --> V_RAIL

  %% ---- LIVE: disbursement on Vektrum-owned rails ----------------------------
  V_RAIL -->|"executes disbursement"| ESC
  ESC -->|"funds released into project"| GC

  %% ---- PROPOSED: Vektrum -> Procore (WRITE-BACK, non-invasive) ---------------
  V_AUD  -. "V->P  CREATE: audit / verification attachment on Prime Contract  [PROPOSED]" .-> P_DOC
  V_AUTH -. "V->P  UPDATE: draw-verification status (custom field)  [PROPOSED]" .-> P_PROJ

  %% ---- OUT OF VEKTRUM SCOPE: Procore Pay / Levelset lane --------------------
  P_PAY -->|"GC to Sub payment (NOT Vektrum)"| SUB

  classDef procore fill:#FFF1E8,stroke:#F0743C,color:#8A3E12;
  classDef vektrum fill:#E8EDF8,stroke:#1A3A96,color:#0D1B2A;
  classDef actor   fill:#F4F6FA,stroke:#5A6478,color:#141414;
  classDef oos     fill:#EFEFEF,stroke:#9AA3B5,color:#5A6478,stroke-dasharray:4 3;

  class P_PROJ,P_SOV,P_CO,P_DOC,P_LS procore;
  class P_PAY oos;
  class V_IN,V_GATE,V_AUTH,V_RAIL,V_AUD vektrum;
  class LO,GC,ESC,SUB actor;
```

---

## Written legend

### Actors (swimlane)
| Actor | Role in the flow |
|---|---|
| **Lender / Owner** | The capital source. Funds the loan/project; needs every draw verified before money is released. Vektrum's primary user. |
| **General Contractor** | The **Procore user**. Runs the project, submits the draw, maintains the SOV and change orders in Procore. |
| **Escrow / Fund Control** | Executes the disbursement on instruction once Vektrum authorizes (one supported external rail). |
| **Subcontractor** | Paid downstream via **Procore Pay / Levelset** — explicitly **outside** Vektrum's scope. |

### Systems
| System | Owns |
|---|---|
| **Procore** | Project system of record: Project Financials, **Prime Contract SOV**, Change Orders, Documents/Photos, Levelset waivers, Procore Pay (GC→sub). |
| **Vektrum** | Capital-in governance: draw intake, **10-condition release gate** (server-side), signed **disbursement authorization**, **hash-chained audit trail**, and the disbursement rail (Stripe Connect / external). |

### Named Procore tools/modules touched
- **Project / Project Financials** — parties + the write-back status field.
- **Prime Contract Schedule of Values (G702/G703)** — the draw's line-item source (READ) and the audit attachment target (CREATE).
- **Change Orders** — READ, to satisfy the "no unresolved change orders" gate condition.
- **Documents / Photos** — READ (draw evidence) and CREATE (verification attachment).
- **Levelset (Lien Waivers)** — READ status only; Vektrum sits beside it, never replaces it.
- **Procore Pay** — shown only to mark the GC→sub boundary Vektrum does **not** cross.

### Data exchanges (direction + CRUD + live/proposed)
| # | From → To | Direction | CRUD | Payload | Status |
|---|---|---|---|---|---|
| 1 | Prime Contract SOV → Vektrum | P→V | **Read** | SOV lines, revised value, % complete | `[PROPOSED]` |
| 2 | Change Orders → Vektrum | P→V | **Read** | change-order status/amounts | `[PROPOSED]` |
| 3 | Documents/Photos → Vektrum | P→V | **Read** | draw evidence | `[PROPOSED]` |
| 4 | Levelset → Vektrum | P→V | **Read** | lien-waiver status | `[PROPOSED]` |
| 5 | Vektrum → Prime Contract | V→P | **Create** | audit/verification attachment (hash-chained proof) | `[PROPOSED]` |
| 6 | Vektrum → Project | V→P | **Update** | draw-verification status (custom field) | `[PROPOSED]` |

**CRUD posture (by design):** the write-back is **Read-heavy, Create an attachment,
Update a status field — no Delete, and no writes into Procore's core financial tools.**
Vektrum adds a verification layer; it never mutates Procore's financial system of record.

### Live vs proposed at a glance
- **Live today (Vektrum-internal, verified in code):** draw intake, 10-condition gate,
  signed authorization tokens, hash-chained audit trail, Stripe Connect + external rails,
  DocuSign contract e-sign, lien-waiver gating, dispute isolation, and the Partner API +
  HMAC-signed webhook framework the connector would ride on.
- **Proposed (Procore-specific, not yet built):** OAuth app, all READ syncs (1–4), and
  both WRITE-backs (5–6).

*(A standalone copy of the chart is provided as `integration-diagram.mmd` for paste into
any Mermaid renderer.)*
