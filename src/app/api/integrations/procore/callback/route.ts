import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { getProcoreConfig } from '@/lib/integrations/procore/config'
import { encryptTokens } from '@/lib/integrations/procore/crypto'
import { hash } from '@/lib/integrations/procore/oauth'
import { verifyIdentity } from '@/lib/integrations/procore/client'
import { logAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

function callbackRedirect(request: NextRequest, result: 'connected' | 'error' | 'invalid_callback') {
  return NextResponse.redirect(new URL(`/dashboard/funder/integrations/procore?procore=${result}`, request.url))
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!code || !state) return callbackRedirect(request, 'invalid_callback')

  let userId: string | null = null
  let stage = 'session'
  try {
    const { user, profile } = await getAuthUser(request)
    requireRole(profile, 'funder')
    userId = user.id
    const config = getProcoreConfig()
    const admin = createSupabaseAdminClient()

    stage = 'state_validation'
    const { data: transaction } = await admin.from('procore_oauth_transactions').select('*')
      .eq('state_hash', hash(state)).is('consumed_at', null).gt('expires_at', new Date().toISOString()).single()
    if (!transaction || transaction.profile_id !== user.id) throw new Error('OAuth state validation failed.')
    const { error: consumeError } = await admin.from('procore_oauth_transactions')
      .update({ consumed_at: new Date().toISOString() }).eq('id', transaction.id).is('consumed_at', null)
    if (consumeError) throw new Error('OAuth state was already used.')

    stage = 'token_exchange'
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri }), cache: 'no-store',
    })
    if (!tokenResponse.ok) throw new Error(`Token exchange failed (${tokenResponse.status}).`)
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
    if (!tokens.access_token) throw new Error('Token exchange returned no access token.')

    stage = 'token_persistence'
    const encrypted = encryptTokens(tokens.access_token, tokens.refresh_token, config.encryptionKey)
    let identity: { subject: string; displayName: string } | null = null
    let identityError: string | null = null
    try {
      stage = 'identity_verification'
      identity = await verifyIdentity(tokens.access_token)
    } catch {
      // The token has already been issued by Procore. Retain the connection so
      // project listing can establish whether the sandbox grants API access.
      identityError = 'Identity verification is pending.'
    }

    stage = 'connection_persistence'
    const { error: connectionError } = await admin.from('procore_connections').upsert({
      ...encrypted, profile_id: user.id, environment: 'sandbox', status: 'connected', key_version: config.keyVersion,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      provider_subject: identity?.subject ?? null, provider_display_name: identity?.displayName ?? null,
      procore_company_id: config.companyId, verified_at: identity ? new Date().toISOString() : null,
      last_sync_status: 'not_started', last_error: identityError, reconnect_required: false, disconnected_at: null,
    }, { onConflict: 'profile_id,environment' })
    if (connectionError) throw new Error('Connection persistence failed.')
    await logAudit({ entity_type: 'profile', entity_id: user.id, action: 'procore_connected', actor_id: user.id, actor_role: profile.role, system_source: 'api/integrations/procore/callback', metadata: { environment: 'sandbox', identity_verified: Boolean(identity) } })
    return callbackRedirect(request, 'connected')
  } catch (error) {
    if (error instanceof NextResponse) return error
    if (userId) {
      const admin = createSupabaseAdminClient()
      await admin.from('procore_connections').upsert({ profile_id: userId, environment: 'sandbox', status: 'verification_failed', key_version: process.env.PROCORE_TOKEN_ENCRYPTION_KEY_VERSION ?? '1', last_error: `OAuth failed during ${stage}.`, reconnect_required: true }, { onConflict: 'profile_id,environment' })
      await logAudit({ entity_type: 'profile', entity_id: userId, action: 'procore_oauth_failed', actor_id: userId, system_source: 'api/integrations/procore/callback', metadata: { environment: 'sandbox', stage } })
    }
    return callbackRedirect(request, 'error')
  }
}
