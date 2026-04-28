# Schema Drift Check — Vektrum

## What it does

`scripts/check-schema-drift.mjs` connects to the production Supabase project and
verifies that the live database schema matches what the migration files define.

It runs four categories of checks:

| Category | What is checked |
|---|---|
| **Table existence** | 21 critical tables exist and are accessible via the admin client |
| **Column existence** | 24 critical columns are present in their expected tables |
| **Function probes** | 9 key DB functions respond (non-PGRST202) with the expected parameter shapes |
| **RLS smoke** | Admin client can read sensitive tables; anon client returns 0 rows or a permission error |

All checks are **read-only**. No rows are inserted, updated, deleted, or mutated.

---

## When to run

- **Before every production deploy** — confirm no migration was missed.
- **After any schema migration** — confirm it applied cleanly.
- **After a Supabase project restore or point-in-time recovery** — confirm schema is intact.
- **Incident response** — quickly confirm which tables or functions are reachable.

---

## How to run

```bash
# Requires these env vars (use .env.local or Vercel env for values)
export NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...   # never commit; never print
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

npm run schema:check
```

Exit 0 = all checks pass.  
Exit 1 = one or more checks failed.

---

## What a failure looks like

```
════════════════════════════════════════════════════════════════════════
  VEKTRUM — Schema Drift Check
  URL: https://abcde…
════════════════════════════════════════════════════════════════════════
  FAILURES:

  ✗  table:retainage_releases
     relation "public.retainage_releases" does not exist

  ✗  function:reserve_release_funds
     PGRST202 — function not found in schema
════════════════════════════════════════════════════════════════════════
  43 passed  |  2 failed  |  45 total
════════════════════════════════════════════════════════════════════════
```

A PGRST202 error means PostgREST cannot find the function — typically because
a migration was not applied. A table error means the table was never created
or was dropped.

---

## Function probe strategy

Functions are probed using dummy UUID `00000000-0000-0000-0000-000000000000` and
zero-value numerics. The probe only checks whether the function exists in the
schema — it does not validate business logic.

| Result | Meaning |
|---|---|
| `PGRST202` | Function not found — migration missing |
| Any other response | Function exists (even if it returns a business error on the dummy input) |

---

## RLS smoke check logic

The RLS smoke check does **not** assert what specific rows are returned — it only
checks whether the anon client is blocked.

| Anon result | Verdict |
|---|---|
| Error (e.g., 42501 permission denied) | ✓ RLS enforced |
| 0 rows returned | ✓ RLS enforced (filters all rows for anon role) |
| 1+ rows returned | ✗ RLS may not be active — investigate |

The service-role admin client bypasses RLS by design (Supabase behavior).
If the admin client cannot read a table, the table itself is missing or broken.

---

## Env var security

The script prints only:
- The URL prefix (truncated: `https://abcde…`) — no secrets.
- Pass/fail status per check — no row data.
- Error messages from PostgREST — these may include table names, not values.

The script never prints `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
values. Do not add any `console.log(key)` calls to this script.

---

## Adding new checks

When adding a migration, add a corresponding check to `scripts/check-schema-drift.mjs`:

- **New table**: add to `CRITICAL_TABLES`
- **New critical column**: add to `CRITICAL_COLUMNS` as `[table, column]`
- **New function used by release gate, billing, or audit**: add to `FUNCTION_PROBES`
  with the correct parameter names and zero/dummy values

Run `npm run schema:check` after updating the script to confirm the new check passes.

---

## Static test

`tests/schema-drift.test.ts` contains static source-parse tests that verify the
script covers all expected areas without running it against a live database. This
test is included in `npm test` and runs in CI without any environment variables.
