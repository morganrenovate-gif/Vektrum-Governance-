/**
 * Vektrum — Supabase Browser Client
 *
 * Creates a browser-side Supabase client for use in Next.js 15 Client
 * Components ('use client'). The browser client manages auth state
 * automatically via localStorage / session cookies in the browser.
 *
 * The client is safe to call multiple times — @supabase/ssr caches the
 * singleton internally so you always get the same instance per browser tab.
 *
 * USAGE:
 *   'use client'
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *   const { data, error } = await supabase.from('deals').select()
 *
 * NOTE: This client enforces Row-Level Security (RLS). For operations that
 * must bypass RLS, the admin client must be called from a server context.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
