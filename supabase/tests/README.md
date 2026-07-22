# Supabase DB-level tests

Behavioural tests that exercise guarantees only the **database** can enforce —
append-only immutability triggers, CHECK constraints, uniqueness, foreign-key
binding integrity, and RLS deny-by-default. These complement the TypeScript
tests in `/tests`, which cover application logic but run without a database.

## Status

`phase1_gate_evaluations.test.sql` is **authored but not yet executed**: it was
written in an environment with no Postgres server. It is written against the
exact column/constraint/trigger definitions in the Phase 1 migrations
(`20260601000000_organizations.sql`, `20260601000001_gate_evaluations.sql`) and
the existing `authorization_tokens` / core schema. It **must** be run against a
real Postgres before those migrations are deployed.

## Running

Against a disposable/dev database (never production):

```bash
# 1. Apply migrations to a fresh local DB
supabase db reset

# 2. Run the Phase 1 DB checks (self-contained; ends in ROLLBACK)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_gate_evaluations.test.sql
```

The script seeds its own fixtures, asserts, prints `NOTICE` lines per check, and
**rolls back** — it leaves the database unchanged. A clean run ends with
`✅ ALL PHASE-1 DB CHECKS PASSED`. Any failed assertion aborts with a non-zero
exit (thanks to `ON_ERROR_STOP=1`).

## What it proves

| # | Guarantee | Migration source |
|---|-----------|------------------|
| 1 | `gate_evaluations` rejects UPDATE/DELETE (SQLSTATE 23001) | `deny_gate_record_modification` trigger |
| 2 | `gate_condition_results` rejects UPDATE/DELETE | same trigger |
| 3 | passed⇔no failure_codes, failed⇔≥1 failure_code | `gate_evaluations_outcome_consistent` CHECK |
| 4 | one row per (evaluation, condition_code) | `gate_condition_results_unique_code` |
| 5 | `not_applicable` outcome ⇔ `not_applicable` applicability | `..._applicability_consistent` CHECK |
| 6 | a token binds exactly one passing evaluation; bound evaluation cannot be deleted | `authorization_tokens.gate_evaluation_id` FK + immutability |
| 7 | one membership per (org, user) | `organization_memberships_unique` |
| 8 | an `authenticated` client cannot forge an evaluation or self-promote | RLS deny-by-default policies |

Check 8 is skipped with a `NOTICE` (not a false pass) if the `authenticated`
role is absent, i.e. when run outside a Supabase database.
