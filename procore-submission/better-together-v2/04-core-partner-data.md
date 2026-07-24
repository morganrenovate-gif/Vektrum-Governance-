# 04 — Core Partner Data (Official Template Block)

Generated first, per the Procore AI Instructions, as the source of truth for all slide content. Claim IDs reference `03-claim-ledger.md`.

## 1. Top three customer problems the joint solution addresses

1. **Draw decisions live outside the project record.** The project and cost record sits in one system, while the release decision for the capital funding it too often runs on emailed PDFs and manual sign-off. [C-02, P-01]
2. **Approval is not enforcement.** Teams track lien waivers, change orders, and contracts — but nothing structurally blocks a release when a required condition is unmet at the moment funds are authorized. [V-02, V-09]
3. **Proof is scattered and disputes over-freeze capital.** When lenders, LPs, auditors, or courts ask who authorized a release and on what basis, the evidence is spread across inboxes — and a single disputed line item can stall an entire project's funding. [V-05, V-08, V-12]

## 2. Top three Vektrum capabilities most relevant to Procore

1. **Deterministic 10-condition release gate**, enforced in UI, API, and database — all required conditions must pass before release authorization; admins, contractors, and partners cannot bypass it. AI-assisted pre-review informs; the gate decides. [V-02, V-06, V-07]
2. **Funder authorization with evidence-grade audit**: signed, immutable authorization records plus an append-only, hash-chained, tamper-evident audit trail for every pass and block. [V-05, V-10]
3. **Rail-neutral, non-custodial execution**: Vektrum authorizes; payment executes through Stripe Connect (one supported rail) or the customer's existing title, escrow, treasury, or banking process, with partner confirmation recorded via API. [V-03, V-04, V-11]

## 3. Top three benefits (customer language)

1. "A missing lien waiver or an open change order blocks **that draw** — before money is authorized, not after it's gone." [V-09]
2. "Every dollar released can be proven: what was authorized, by whom, on what evidence, at what time." [V-05, V-10]
3. "We keep Procore, and we keep our payment process. Vektrum adds the release enforcement in between." [V-03, V-04, J-05]

## 4. Hero metrics (1–3, each labeled)

| Metric | Label | Notes |
|---|---|---|
| **10 release conditions** deterministically enforced before any authorization | **Internal product metric** | Verified in code and tests [M-01] |
| **$2.18M simulated draw** governed end to end — blocked on an open change order and unapproved lien waiver, then authorized after both resolved | **Illustrative scenario** (simulated demo, fictional data) | From the /demo-live/procore prototype [M-02] |
| **$15K dispute isolated inside a $9M project** — one milestone locked, the rest keep flowing | **Illustrative scenario** (published Vektrum scenario, not customer data) | From vektrum.io/resources/construction-dispute-isolation [M-03] |

**Not available (stated, not fabricated):** joint customer data, cycle-time reductions, ROI percentages, adoption counts. There are **no joint Vektrum + Procore customers today**; Slide 5 uses only labeled illustrative scenarios.
