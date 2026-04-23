-- =============================================================================
-- Vektrum — Migration 011: Contract Layer
--
-- Adds a signed-contract requirement to the deal lifecycle.
-- No deal can be funded or have milestones released without a fully-executed
-- contract on file.
--
-- Signing flow:
--   1. Contractor uploads contract PDF → stored in Supabase Storage
--   2. Vektrum creates a DocuSign envelope (2 signers)
--   3. Funder signs  (routing order 1)
--   4. Contractor countersigns (routing order 2)
--   5. status → 'signed'; funding is now unblocked
--
-- Status machine:
--   pending_signatures → funder_signed → signed
--   pending_signatures → contractor_signed → signed
--   * → voided
--
-- Storage:
--   Supabase Storage bucket: 'contracts' (private)
--   Path pattern: {dealId}/{uuid}-{originalFilename}
--   NOTE: Create the 'contracts' bucket in Supabase Storage before deploying.
--         Dashboard → Storage → New bucket → name: contracts, private: true
--         Or run: SELECT storage.create_bucket('contracts', '{"public": false}');
-- =============================================================================


-- ── Step 1: contracts table ───────────────────────────────────────────────────

CREATE TABLE public.contracts (
  id                   uuid           NOT NULL DEFAULT gen_random_uuid(),
  deal_id              uuid           NOT NULL REFERENCES public.deals(id)     ON DELETE RESTRICT,
  uploaded_by          uuid           NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,

  -- ── Document storage (Supabase Storage) ──────────────────────────────────
  -- Path inside the 'contracts' bucket, e.g. "{dealId}/{uuid}-original.pdf"
  -- Full URL reconstructed as: STORAGE_URL/contracts/{storage_path}
  storage_path         text           NOT NULL,
  document_name        text           NOT NULL,    -- original filename shown in UI
  document_size_bytes  bigint,

  -- ── DocuSign ──────────────────────────────────────────────────────────────
  docusign_envelope_id text,                       -- set after envelope is created
  -- Path to the final composite signed PDF stored in Supabase Storage.
  -- Populated by the DocuSign webhook when the envelope reaches 'completed'.
  signed_storage_path  text,

  -- ── Signing timestamps ────────────────────────────────────────────────────
  funder_signed_at     timestamptz,
  contractor_signed_at timestamptz,

  -- ── Status ────────────────────────────────────────────────────────────────
  -- pending_signatures → (funder_signed | contractor_signed) → signed
  -- Any state → voided
  status               text           NOT NULL DEFAULT 'pending_signatures',

  created_at           timestamptz    NOT NULL DEFAULT now(),
  updated_at           timestamptz    NOT NULL DEFAULT now(),
  voided_at            timestamptz,
  void_reason          text,

  CONSTRAINT contracts_pkey           PRIMARY KEY (id),
  -- One contract per deal. A new envelope requires voiding the existing one first.
  CONSTRAINT contracts_deal_unique    UNIQUE (deal_id),
  -- Enforces the status machine values
  CONSTRAINT contracts_status_valid   CHECK (
    status IN (
      'pending_signatures',
      'funder_signed',
      'contractor_signed',
      'signed',
      'voided'
    )
  ),
  -- A signed contract must have both timestamps
  CONSTRAINT contracts_signed_has_timestamps CHECK (
    status != 'signed'
    OR (funder_signed_at IS NOT NULL AND contractor_signed_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.contracts IS
  'One row per deal. Tracks the contract PDF upload and dual-party eSignature status. '
  'A deal cannot be funded or have milestones released without status = ''signed''.';

COMMENT ON COLUMN public.contracts.storage_path IS
  'Path within the Supabase Storage ''contracts'' bucket. '
  'Use the admin client to generate signed read URLs.';

COMMENT ON COLUMN public.contracts.docusign_envelope_id IS
  'DocuSign envelope ID. Set after the envelope is created via the DocuSign eSign API. '
  'Null if the DocuSign integration is not yet configured.';

COMMENT ON COLUMN public.contracts.signed_storage_path IS
  'Path to the final combined signed PDF in Supabase Storage. '
  'Populated by the DocuSign webhook handler when the envelope reaches ''completed'' status.';

COMMENT ON COLUMN public.contracts.status IS
  'Signing lifecycle: pending_signatures → funder_signed or contractor_signed → signed. '
  'Voided contracts require a new upload to restart the flow.';

-- Indexes
CREATE INDEX contracts_deal_id_idx      ON public.contracts (deal_id);
CREATE INDEX contracts_envelope_id_idx  ON public.contracts (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;
CREATE INDEX contracts_status_idx       ON public.contracts (status);


-- ── Step 2: RLS for contracts ─────────────────────────────────────────────────

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Both parties see the contract for their deal; admins see all.
CREATE POLICY "contracts_select"
  ON public.contracts
  FOR SELECT
  USING (public.is_deal_participant(deal_id) OR public.is_admin());

-- Contractors can insert (upload) their deal's contract.
-- Only the contractor who created the deal may upload — enforced in the route handler.
-- The route uses the user-scoped client, so RLS confirms deal participation.
CREATE POLICY "contracts_insert_contractor"
  ON public.contracts
  FOR INSERT
  WITH CHECK (public.is_deal_participant(deal_id));

-- Updates are performed by the service role (DocuSign webhook handler).
-- The webhook uses createSupabaseAdminClient() which bypasses RLS.
-- No user-level UPDATE policy — prevents tampering with signing timestamps.
-- *** No UPDATE policy ***
-- *** No DELETE policy ***


-- ── Step 3: Audit trigger for contracts ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    entity_type, entity_id, action,
    actor_id,
    old_values,  new_values,
    metadata
  )
  VALUES (
    'contract',
    NEW.id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'contract_uploaded'
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'contract_status_changed'
      ELSE 'contract_updated'
    END,
    auth.uid(),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    jsonb_build_object(
      'trigger',               tg_name,
      'deal_id',               NEW.deal_id,
      'docusign_envelope_id',  NEW.docusign_envelope_id,
      'status',                NEW.status,
      'funder_signed_at',      NEW.funder_signed_at,
      'contractor_signed_at',  NEW.contractor_signed_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_contracts_insert
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_contracts();

CREATE TRIGGER trg_audit_contracts_update
  AFTER UPDATE ON public.contracts
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.funder_signed_at IS DISTINCT FROM NEW.funder_signed_at
    OR OLD.contractor_signed_at IS DISTINCT FROM NEW.contractor_signed_at
    OR OLD.docusign_envelope_id IS DISTINCT FROM NEW.docusign_envelope_id
  )
  EXECUTE FUNCTION public.audit_contracts();


-- ── Step 4: Helper function — is_contract_signed(deal_id) ────────────────────
--
-- Used by the fund route and release gate to check contract status.
-- Returns true only if the deal has a fully-executed contract.

CREATE OR REPLACE FUNCTION public.is_contract_signed(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contracts
    WHERE deal_id = p_deal_id
      AND status  = 'signed'
  );
$$;

COMMENT ON FUNCTION public.is_contract_signed(uuid) IS
  'Returns true if the deal has a fully-executed (status = ''signed'') contract. '
  'Used by the fund route and release gate before allowing financial operations.';


-- ── Step 5: updated_at trigger for contracts ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_contracts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_contracts_updated_at();
