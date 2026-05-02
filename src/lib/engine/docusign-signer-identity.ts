/**
 * DocuSign signer-identity resolver.
 *
 * DocuSign embedded signing matches the recipient-view request against the
 * envelope's stored recipient by EXACT (name + email + clientUserId). If
 * createEnvelope() and the later /contract/sign recipient-view request
 * disagree on any of the three values — even by a single character — DocuSign
 * returns USER_LACKS_PERMISSIONS and the signing URL fails.
 *
 * Two latent bugs caused the production error:
 *
 *   1. The fallback name differed:
 *        envelope:    profile.full_name ?? profile.company_name ?? 'Funder' | 'Contractor'
 *        sign route:  profile.full_name ?? profile.company_name ?? 'Signer'
 *      A signer with no full_name/company_name produced 'Contractor' on the
 *      envelope and 'Signer' in the recipient view → identity mismatch.
 *
 *   2. send-envelope previously read profiles via the RLS-bound session
 *      client, which can return null when one party reads the other party's
 *      row. That silently dropped a real name to the fallback. The sign
 *      route reads the SIGNER's own profile, so a contractor calling sign
 *      could resolve a real name even though the envelope was stamped with
 *      the fallback.
 *
 * This module exposes a single resolver that:
 *   - Always reads via the admin client (RLS-bypass), so cross-party reads
 *     succeed.
 *   - Always uses the role-specific fallback ('Funder' / 'Contractor').
 *   - Returns null on any missing precondition (auth user / email) so the
 *     caller can produce a deterministic error response.
 */

import type { DocuSignSigner } from '@/lib/engine/docusign'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export type SignerRole = 'funder' | 'contractor'

export interface SignerResolveInput {
  /** The platform user UUID (auth.users.id) for the signer. */
  userId:        string
  /** Whether this signer is the funder (routingOrder 1) or the contractor (2). */
  role:          SignerRole
}

export type SignerResolveResult =
  | { ok: true;  signer: DocuSignSigner }
  | { ok: false; error: string; missing: 'auth_user' | 'email' | 'unknown' }

const ROLE_TO_ROUTING: Record<SignerRole, 1 | 2> = {
  funder:     1,
  contractor: 2,
}

const ROLE_TO_FALLBACK: Record<SignerRole, string> = {
  funder:     'Funder',
  contractor: 'Contractor',
}

/**
 * Resolve a signer's DocuSign identity from the platform user UUID.
 *
 * Used by both:
 *   - createEnvelope (send-envelope route)
 *   - getSigningUrl  (sign route)
 *
 * Both code paths MUST resolve identity through this function so the
 * recipient-view request matches the embedded recipient exactly.
 */
export async function resolveSignerIdentity(
  input: SignerResolveInput,
): Promise<SignerResolveResult> {
  const { userId, role } = input
  const admin = createSupabaseAdminClient()

  // Email comes from auth.users (the canonical address used for the envelope).
  const authUserResult = await admin.auth.admin.getUserById(userId)
  if (authUserResult.error || !authUserResult.data.user) {
    return {
      ok:      false,
      error:   `Could not retrieve auth record for ${role}.`,
      missing: 'auth_user',
    }
  }
  const email = authUserResult.data.user.email
  if (!email) {
    return {
      ok:      false,
      error:   `Could not retrieve email for ${role}.`,
      missing: 'email',
    }
  }

  // Display name comes from profiles. Fall back to the role-specific default
  // when neither full_name nor company_name is set — matching the envelope's
  // historical fallback so any in-flight envelopes still match the
  // recipient-view request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', userId)
    .maybeSingle()

  const name =
    profile?.full_name ??
    profile?.company_name ??
    ROLE_TO_FALLBACK[role]

  return {
    ok:     true,
    signer: {
      name,
      email,
      clientUserId: userId,
      routingOrder: ROLE_TO_ROUTING[role],
    },
  }
}
