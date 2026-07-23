# Milestone Isolation — a paired core capability

> Policy-based release governance determines **whether** a release unit is eligible.
> Milestone isolation determines **how narrowly** a failed or disputed unit affects
> the rest of the draw.

Vektrum contains the exception without freezing the project.
**Block the disputed milestone — not the entire draw.**

## Problem it solves

When draw documentation and approvals are managed as one interconnected package, a
dispute involving one milestone or SOV line can delay otherwise-eligible payments
because the workflow cannot cleanly separate the disputed amount, its supporting
evidence, its dependencies, and the release authority. (This is a workflow-coupling
problem — not a claim that every construction dispute always freezes every project
or all project funds.)

## Definition (controlled exception containment — not merely partial payment)

When a milestone / SOV release unit is disputed or fails a required release
condition, the system:

1. Identifies a stable, persisted **release unit** tied to the deal, draw,
   milestone/SOV line, payee, and amount.
2. Puts **only** the affected unit into a blocked/disputed state.
3. Preserves the exact **isolated amount** and prevents it from being authorized,
   executed, reassigned, or counted as available to another release.
4. Records the failed condition / dispute reason, evidence, actor, time, and
   resolution history (append-only).
5. Determines which downstream units are **genuinely dependent** on it.
6. Blocks dependent units when policy or explicit prerequisites require it.
7. Keeps unrelated units independently eligible for gate evaluation and funder
   authorization.
8. Generates an authorization scope that **cannot include** the isolated amount.
9. Maintains separate, append-only evaluation and authorization history.
10. Re-evaluates the isolated unit after a valid resolution **without rewriting**
    prior history.

## Where it lives in the codebase

| Concern | Implementation |
|---|---|
| Per-unit gate | `src/lib/engine/release-gate.ts` → `validateRelease(supabase, milestoneId, …)` is evaluated **per milestone**; each unit gets its own pass/fail. |
| Isolate one unit | `POST /api/disputes` (`src/app/api/disputes/route.ts`) sets **only** the disputed milestone's `protection_status='disputed'`, which fails gate Condition 2 for that unit alone. Every other milestone is untouched. Bounded by `amount_in_dispute ≤ milestone.amount`. |
| Isolated amount | Persisted as `disputes.amount_in_dispute` (append-only dispute row). |
| Dependencies | Gate Condition 9 (sequential ordering + explicit `milestone_prerequisites`) blocks genuinely-dependent downstream units; unrelated units stay independent. |
| Reconciliation & scope | `src/lib/engine/release-units.ts` — pure, invariant-checked `reconcileDraw()` / `deriveAuthorizationScope()` / `assertAuthorizationWithinScope()`. |
| Auditability | `logAudit(...)` writes `dispute_opened` / `dispute_resolved_release` / `dispute_resolved_write_off` / `dispute_escalated` with actor, reason, amount, evidence, and an explicit isolation note, into the append-only hash-chained `audit_log`. |
| Re-evaluation | `PATCH /api/disputes/[disputeId]/resolve` with `outcome='release'` restores `protection_status='ready_for_release'`; the unit re-enters the gate. Prior audit rows are never mutated. |

## Financial invariants (enforced in `release-units.ts`; proven in tests)

```
drawGross      = eligibleGross + isolatedGross + alreadyReleasedGross      (I1)
authorizedNet  ≤ eligibleNet   (isolated units are absent from the scope)  (I2)
every amount   ≥ 0                                                          (I3)
retainage      ≤ gross, per unit; never released by this module            (I4)
isolated (or released) unit id  ∉  authorization scope                      (I5)
```

Global hard stops are **never** bypassable by isolation: unauthorized actor,
frozen/inactive deal, insufficient **aggregate** funds, duplicate/active release,
and sequential prerequisites all still block. Isolation only narrows *isolatable
unit failures* (a single unit's dispute or unit-scoped condition), never these.

## Tests (proof, not snapshots)

- `tests/milestone-isolation.test.ts` (32 checks) — drives the **real**
  `validateRelease` + `release-units` with no DB: one disputed unit fails only its
  own condition while a neighbor passes; dependency + sequential blocking; global
  stops not bypassable; isolated amount unauthorizable; exact reconciliation
  ($2,180,000 = $1,870,000 eligible + $310,000 isolated); re-evaluation earns a
  separate authorization without mutating the first.
- `tests/release-gate.test.ts` (55) — per-unit gate parity (unchanged).
- `tests/demo-procore-prototype.test.ts` (91) — the guided demo's isolation flow.

## Limitations (honest)

- The **draw-level** isolation-aware reconciliation view (`release-units.ts`) is a
  pure module; the release routes still authorize per-milestone and have not yet
  been rewired to consume it at the write boundary (a deliberate later step). The
  invariants it enforces mirror, and are consistent with, the deal-ledger and SOV
  math already enforced in the database.
- `write_off` resolution closes a dispute without payout and leaves the milestone
  locked; any partial/refund handling is a manual funder action today.
- The Procore experience is a **simulated** demo (see below). It uses the real
  `release-units` engine for its numbers but does not call Procore, move funds, or
  persist to the production database.

## Simulated Procore demo

Route: `/demo-live/procore`. The Draw #07 SOV is shown as four release units; the
$310,000 structural-steel unit is isolated (CO-027 + conditional lien-waiver
deficiency) while the other three ($1,776,500 net) are authorized immediately; the
steel unit is then corrected at source, re-evaluated, and authorized **separately**
($294,500 net). Numbers are computed by `src/lib/engine/release-units.ts`. The demo
states plainly that no real funds are moved and that execution would flow through
the selected external rail.
