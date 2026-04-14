/**
 * Vektrum — Supabase Admin Client
 *
 * Creates a service-role Supabase client that bypasses Row-Level Security
 * (RLS) entirely. This client MUST only be used server-side (Server
 * Components, Route Handlers, Server Actions, background jobs).
 *
 * APPROVED USE CASES:
 *   - Writing to audit_log (RLS blocks direct authenticated-user inserts)
 *   - Creating releases (immutable insert — RLS blocks authenticated inserts)
 *   - Admin-only operations (user role changes, bulk queries, etc.)
 *   - Webhook handlers receiving Stripe events (no user session available)
 *
 * NEVER:
 *   - Import this file from any 'use client' component
 *   - Expose the service role key to the browser
 *   - Use this client for user-facing reads that should respect RLS
 *
 * USAGE:
 *   import { createAdminClient } from '@/lib/supabase/admin'
 *   const supabase = createAdminClient()
 *   await supabase.from('audit_log').insert({ ... })
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Disable automatic token refresh — the service role key never expires
        autoRefreshToken: false,
        // Do not persist a session; this is a stateless server-side client
        persistSession: false,
      },
    }
  )
}
