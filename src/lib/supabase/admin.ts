import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client using the service role key.
 * Bypasses RLS — only use server-side for trusted operations (audit log, releases).
 * No Database generic here to avoid type conflicts with immutable tables.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
// cache-bust 1776203703
