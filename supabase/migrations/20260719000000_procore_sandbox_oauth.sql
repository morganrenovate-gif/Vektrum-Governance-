-- Phase 1A: isolated, sandbox-only Procore OAuth storage. No deal, release,
-- payment, or project data is stored here.
CREATE TABLE public.procore_oauth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  code_verifier_hash text NOT NULL,
  redirect_uri text NOT NULL,
  requested_scopes text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procore_oauth_transaction_expiry CHECK (expires_at > created_at)
);
CREATE INDEX procore_oauth_transactions_profile_expiry_idx ON public.procore_oauth_transactions(profile_id, expires_at DESC);

CREATE TABLE public.procore_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment = 'sandbox'),
  status text NOT NULL CHECK (status IN ('connected', 'verification_failed', 'disconnected')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_iv text,
  token_tag text,
  key_version text NOT NULL,
  token_expires_at timestamptz,
  provider_subject text,
  provider_display_name text,
  verified_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procore_connections_active_unique UNIQUE(profile_id, environment),
  CONSTRAINT procore_connections_connected_tokens CHECK (
    status <> 'connected' OR (access_token_ciphertext IS NOT NULL AND token_iv IS NOT NULL AND token_tag IS NOT NULL)
  )
);
CREATE TRIGGER trg_procore_connections_updated_at BEFORE UPDATE ON public.procore_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.procore_oauth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_connections ENABLE ROW LEVEL SECURITY;
-- Credentials and transactions are server-only. There are deliberately no
-- authenticated-user policies: sanitized status is served by a server route.
