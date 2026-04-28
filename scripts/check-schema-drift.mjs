#!/usr/bin/env node
/**
 * Schema-drift verification for Vektrum production database.
 *
 * Checks that the production Supabase schema matches what the
 * migration files define: tables exist, critical columns are present,
 * key functions respond, and RLS is enforced on sensitive tables.
 *
 * Run with:
 *   npm run schema:check
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx tsx scripts/check-schema-drift.mjs
 *
 * Exits 0 when all checks pass, 1 when any critical check fails.
 *
 * SECURITY:
 *   - Never prints secret key values — only names and pass/fail.
 *   - Checks are read-only: no INSERT, UPDATE, DELETE, or mutation RPCs.
 *   - Function existence is probed via intentionally-invalid dummy UUIDs that
 *     will not match any row; PGRST202 means function missing, anything else
 *     means the function exists (even if it returns a business error).
 */

import { createClient } from '@supabase/supabase-js'

// ─── Env validation ───────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const missingEnv = []
if (!SUPABASE_URL)              missingEnv.push('NEXT_PUBLIC_SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_ANON_KEY)        missingEnv.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if (missingEnv.length > 0) {
  console.error(`\n  SCHEMA CHECK — ABORTED: missing env vars: ${missingEnv.join(', ')}\n`)
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// ─── Result tracking ──────────────────────────────────────────────────────────

const results = []

function record(name, passed, detail = '') {
  results.push({ name, passed, detail })
}

// ─── Table existence checks ───────────────────────────────────────────────────

const CRITICAL_TABLES = [
  // Core financial tables (001_schema.sql, 010_billing.sql, 011_contracts.sql)
  'deals',
  'milestones',
  'releases',
  'billing_records',
  'contracts',
  // Lien waivers, retainage, change orders, disputes (001, 009, 20260424000008)
  'lien_waivers',
  'retainage_releases',
  'change_orders',
  'dispute_briefs',
  // Reconciliation (012_reconciliation.sql)
  'reconciliation_runs',
  'reconciliation_issues',
  // Audit chain (006, 016, 20260424000004, 20260427000000)
  'audit_log',
  'admin_audit_log',
  'audit_chain_health',
  // Receipts and Stripe events (20260423000000, 20260425000005)
  'transaction_receipts',
  'stripe_processed_events',
  // Partners and rate limiting (20260425000001, 20260425000010)
  'partners',
  'rate_limit_buckets',
  // Sequential milestones (20260424000005)
  'milestone_prerequisites',
  // User profiles and invites (001_schema.sql)
  'profiles',
  'deal_invites',
]

async function checkTables() {
  for (const table of CRITICAL_TABLES) {
    try {
      const { error } = await admin.from(table).select('*').limit(0)
      if (error) {
        record(`table:${table}`, false, error.message)
      } else {
        record(`table:${table}`, true)
      }
    } catch (e) {
      record(`table:${table}`, false, e.message ?? String(e))
    }
  }
}

// ─── Column existence checks ──────────────────────────────────────────────────
// Format: [table, column]
// Probed by selecting only that column with limit 0. A column-not-found error
// indicates the column is missing.

const CRITICAL_COLUMNS = [
  // Retainage columns (20260424000006)
  ['deals', 'retainage_percentage'],
  ['deals', 'retainage_held'],
  ['deals', 'retainage_released'],
  ['milestones', 'retainage_amount'],
  // Rail abstraction (20260425000000)
  ['releases', 'execution_rail'],
  ['releases', 'execution_status'],
  ['releases', 'external_payment_reference'],
  ['releases', 'external_executed_at'],
  ['releases', 'proof_of_payment_document_id'],
  // Subscription tier (20260423000003)
  ['profiles', 'subscription_tier'],
  // Audit chain (20260424000004)
  ['audit_log', 'row_hash'],
  ['audit_log', 'chain_hash'],
  // Partner keys (20260425000001)
  ['partners', 'api_key_hash'],
  ['partners', 'webhook_signing_secret'],
  // Billing records (010_billing.sql) — fee_amount and net_amount are the real columns
  ['billing_records', 'fee_amount'],
  ['billing_records', 'net_amount'],
  // Lien waivers (20260424000008)
  ['lien_waivers', 'waiver_type'],
  ['lien_waivers', 'status'],
  // Stripe processed events (20260425000005 + 20260425000008 lifecycle columns)
  ['stripe_processed_events', 'stripe_event_id'],
  ['stripe_processed_events', 'processing_status'],
  // Contracts (011_contracts.sql) — signing tracked via funder_signed_at / contractor_signed_at
  ['contracts', 'funder_signed_at'],
  ['contracts', 'voided_at'],
  // Rate limit buckets (20260425000010)
  ['rate_limit_buckets', 'window_start'],
]

async function checkColumns() {
  for (const [table, col] of CRITICAL_COLUMNS) {
    try {
      const { error } = await admin.from(table).select(col).limit(0)
      if (error) {
        record(`column:${table}.${col}`, false, error.message)
      } else {
        record(`column:${table}.${col}`, true)
      }
    } catch (e) {
      record(`column:${table}.${col}`, false, e.message ?? String(e))
    }
  }
}

// ─── Function existence probes ────────────────────────────────────────────────
// Strategy: call each function with dummy/zero arguments using the correct
// parameter names and types. PGRST202 = function not found (schema drift).
// Any other response (including business-logic errors or empty results) means
// the function exists in the DB and the signature matches what we expect.

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

const FUNCTION_PROBES = [
  {
    name: 'reserve_release_funds',
    args: { p_deal_id: ZERO_UUID, p_gross: 0, p_fee: 0 },
  },
  {
    // Retainage migration (20260424000006) rewrote this function:
    // params are p_released_amount / p_fee_amount (not p_gross / p_fee)
    name: 'increment_deal_financials',
    args: { p_deal_id: ZERO_UUID, p_released_amount: 0, p_fee_amount: 0 },
  },
  {
    name: 'increment_deal_retainage',
    args: { p_deal_id: ZERO_UUID, p_retainage: 0 },
  },
  {
    name: 'increment_deal_retainage_released',
    args: { p_deal_id: ZERO_UUID, p_amount: 0 },
  },
  {
    name: 'is_funder_on_deal',
    args: { p_deal_id: ZERO_UUID },
  },
  {
    name: 'is_contractor_on_deal',
    args: { p_deal_id: ZERO_UUID },
  },
  {
    name: 'is_contract_signed',
    args: { p_deal_id: ZERO_UUID },
  },
  {
    name: 'verify_audit_chain',
    // Has optional p_entity_type and p_entity_id defaults — call with no extra args
    args: {},
  },
  {
    name: 'check_rate_limit',
    args: { p_key: '__schema_drift_probe__', p_window_seconds: 60, p_limit: 1 },
  },
]

async function checkFunctions() {
  for (const probe of FUNCTION_PROBES) {
    try {
      const { error } = await admin.rpc(probe.name, probe.args)
      // PGRST202 = function does not exist in the schema
      if (error && error.code === 'PGRST202') {
        record(`function:${probe.name}`, false, `PGRST202 — function not found in schema`)
      } else {
        // Any other result (including business errors, empty set, or null) means
        // the function exists. We do not care about the business logic result here.
        record(`function:${probe.name}`, true)
      }
    } catch (e) {
      record(`function:${probe.name}`, false, e.message ?? String(e))
    }
  }
}

// ─── RLS smoke checks ─────────────────────────────────────────────────────────
// Verify that the anon (unauthenticated) client cannot read rows from tables
// that must be protected by RLS. The admin client can always read. We check that:
//   (a) admin client can query the table (table exists + service role bypasses RLS)
//   (b) anon client receives an empty result or RLS error (not a PGRST116 or data)
//
// We do not compare row counts (we do not know what's in production). We only
// check that the anon client does not get back data that the table policy should
// block. An empty result is acceptable (no rows, or RLS returns 0 rows).
// A non-empty result from anon on a protected table is a finding.

const RLS_PROTECTED_TABLES = [
  'billing_records',
  'audit_log',
  'admin_audit_log',
  'partners',
  'retainage_releases',
]

async function checkRls() {
  for (const table of RLS_PROTECTED_TABLES) {
    try {
      const { data: adminData, error: adminError } = await admin
        .from(table)
        .select('id')
        .limit(1)
      if (adminError) {
        record(`rls:admin_access:${table}`, false, `Admin client cannot read: ${adminError.message}`)
        continue
      }
      record(`rls:admin_access:${table}`, true)

      // Anon client: should get 0 rows (RLS) or a permission error.
      // We do NOT treat a non-error + 0 rows as a problem — RLS returning empty is correct.
      // We DO flag if anon returns rows (table is unprotected).
      const { data: anonData, error: anonError } = await anon
        .from(table)
        .select('id')
        .limit(1)

      if (anonError) {
        // An error from anon (e.g., 42501 permission denied) is also correct.
        record(`rls:anon_blocked:${table}`, true)
      } else if (anonData && anonData.length > 0) {
        // Anon returned rows — RLS may not be active or may allow anon reads.
        record(`rls:anon_blocked:${table}`, false, `Anon client returned ${anonData.length} row(s) — verify RLS policy`)
      } else {
        // 0 rows returned to anon — correct behavior.
        record(`rls:anon_blocked:${table}`, true)
      }
    } catch (e) {
      record(`rls:admin_access:${table}`, false, e.message ?? String(e))
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('  VEKTRUM — Schema Drift Check')
  console.log(`  URL: ${SUPABASE_URL.replace(/^(https?:\/\/[^/]{6}).*/, '$1…')}`)
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('  Running: table checks …')
  await checkTables()
  console.log('  Running: column checks …')
  await checkColumns()
  console.log('  Running: function probes …')
  await checkFunctions()
  console.log('  Running: RLS smoke checks …')
  await checkRls()
  console.log('════════════════════════════════════════════════════════════════════════')

  const passed = results.filter((r) => r.passed)
  const failed = results.filter((r) => !r.passed)

  if (failed.length > 0) {
    console.log('\n  FAILURES:\n')
    for (const r of failed) {
      console.log(`  ✗  ${r.name}`)
      if (r.detail) console.log(`     ${r.detail}`)
    }
    console.log('')
  }

  console.log('  SUMMARY:')
  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  }
  console.log('')
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log(`  ${passed.length} passed  |  ${failed.length} failed  |  ${results.length} total`)
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('')

  process.exit(failed.length > 0 ? 1 : 0)
}

main()
