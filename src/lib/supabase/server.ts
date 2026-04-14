/**
 * Vektrum — Supabase Server Client
 *
 * Creates a server-side Supabase client for use in Next.js 15 App Router
 * server components, route handlers, and server actions.
 *
 * Uses @supabase/ssr which reads/writes auth tokens via the Next.js
 * `cookies()` API, keeping sessions synchronized between client and server
 * without any manual token passing.
 *
 * USAGE:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *   const { data, error } = await supabase.from('deals').select()
 *
 * NOTE: This client enforces Row-Level Security (RLS). For operations that
 * must bypass RLS (e.g., audit log writes), use the admin client instead.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  // next/headers cookies() is async in Next.js 15
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Returns all cookies so Supabase can reconstruct the session.
         */
        getAll() {
          return cookieStore.getAll()
        },

        /**
         * Persists updated auth tokens back into the cookie jar.
         * The try/catch silences errors thrown when called from a Server
         * Component (where cookies are read-only). Route handlers and Server
         * Actions can mutate cookies without issue.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Intentionally swallowed — see note above.
          }
        },
      },
    }
  )
}

// ─── Admin Client ─────────────────────────────────────────────────────────────
// Re-exported here for backwards compatibility with existing import paths.
// Bypasses RLS — server-side only.
import { createClient as _createAdminClient } from '@supabase/supabase-js'

export function createSupabaseAdminClient() {
  return _createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
