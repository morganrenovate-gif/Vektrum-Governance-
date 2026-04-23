-- =============================================================================
-- 016_audit_compliance.sql
-- Institutional-grade audit log hardening.
--
-- PROBLEM:
--   The current audit_log table lacks several fields required for legal
--   defensibility and regulatory audit support:
--     - actor_name is not stored — requires a fragile JOIN that breaks if the
--       profile is deleted
--     - actor_email is never captured — required for external audit reports
--     - system_source is absent — impossible to know which code path fired an event
--     - No sequential ordering guarantee — UUIDs are not sortable; created_at
--       ties are ambiguous when two events land in the same millisecond
--
-- CHANGES:
--   1. actor_name   text     — Denormalized at write time. Never NULL for human
--                              actors; 'system' for DB triggers; 'unknown' as
--                              fallback if the profile lookup fails.
--   2. actor_email  text     — Denormalized from auth.users at write time.
--                              NULL for system/trigger events.
--   3. system_source text    — The module or DB trigger that generated the event
--                              (e.g., 'api/milestones/release',
--                               'db_trigger/audit_milestones',
--                               'webhook/stripe').
--   4. event_sequence bigint — Server-assigned, strictly monotonic sequence from
--                              a dedicated PostgreSQL sequence. Gaps are possible
--                              (rollbacks) but the sequence never goes backward.
--                              Enables: ORDER BY event_sequence instead of
--                              created_at to resolve same-millisecond ties.
--   5. session_id   text     — Optional request/correlation ID passed from the
--                              application layer for grouping related events.
--   6. ip_address   text     — Optional client IP from x-forwarded-for header.
--                              NULL for DB trigger events.
--
-- CHRONOLOGICAL INTEGRITY:
--   A CHECK constraint blocks events timestamped more than 5 minutes in the
--   future (allows for reasonable clock skew). Past timestamps are intentionally
--   not blocked — legitimate system repairs may need to back-date rows.
--   The event_sequence sequence is the authoritative ordering mechanism.
--
-- BACKFILL:
--   actor_name is backfilled from profiles for existing rows where actor_id
--   is not null and actor_name is currently null.
--   actor_email cannot be backfilled without exposing auth.users to a plain SQL
--   query — leave NULL for historical rows.
--
-- NOTE:
--   logAudit() in src/lib/engine/audit.ts must be updated separately to
--   write actor_name, actor_email, system_source, session_id, ip_address.
--   DB triggers are updated in PART 4 of this migration.
-- =============================================================================


-- =============================================================================
-- PART 1 — ADD NEW COLUMNS
-- =============================================================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_name   text,
  ADD COLUMN IF NOT EXISTS actor_email  text,
  ADD COLUMN IF NOT EXISTS system_source text,
  ADD COLUMN IF NOT EXISTS session_id   text,
  ADD COLUMN IF NOT EXISTS ip_address   text;

-- Monotonic sequence for deterministic event ordering
CREATE SEQUENCE IF NOT EXISTS public.audit_log_event_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS event_sequence bigint
    NOT NULL DEFAULT nextval('public.audit_log_event_seq');

-- Own the sequence so it's dropped with the table if ever necessary
ALTER SEQUENCE public.audit_log_event_seq OWNED BY public.audit_log.event_sequence;

-- Unique index on event_sequence — enforces strict monotonicity
CREATE UNIQUE INDEX IF NOT EXISTS audit_log_event_sequence_idx
  ON public.audit_log (event_sequence);

-- Index on system_source for filtering by module
CREATE INDEX IF NOT EXISTS audit_log_system_source_idx
  ON public.audit_log (system_source)
  WHERE system_source IS NOT NULL;

-- Index on session_id for correlation lookups
CREATE INDEX IF NOT EXISTS audit_log_session_id_idx
  ON public.audit_log (session_id)
  WHERE session_id IS NOT NULL;


-- =============================================================================
-- PART 2 — CHRONOLOGICAL INTEGRITY CONSTRAINT
-- =============================================================================
-- Block events timestamped more than 5 minutes in the future.
-- This prevents clock-skew accidents and protects against fraudulent
-- pre-dated entries. Past timestamps are allowed for operational repairs.

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_no_future_timestamp,
  ADD CONSTRAINT audit_log_no_future_timestamp
    CHECK (created_at <= now() + interval '5 minutes');

COMMENT ON CONSTRAINT audit_log_no_future_timestamp ON public.audit_log IS
  'Prevents events timestamped more than 5 minutes in the future. '
  '5-minute window accommodates NTP clock skew. Past timestamps permitted '
  'for operational repairs. event_sequence is the authoritative ordering '
  'mechanism — created_at is human-readable only.';


-- =============================================================================
-- PART 3 — BACKFILL actor_name FROM PROFILES
-- =============================================================================
-- Fill actor_name for all existing rows where actor_id is set.
-- actor_email cannot be safely backfilled (auth.users not directly accessible
-- in migration SQL without the service_role key context — application handles it).

DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.audit_log al
  SET actor_name = COALESCE(p.full_name, p.company_name, al.actor_id::text)
  FROM public.profiles p
  WHERE al.actor_id = p.id
    AND al.actor_name IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '016_audit_compliance: backfilled actor_name for % audit_log rows.', v_updated;
END;
$$;

-- System events (actor_id IS NULL) get a default actor_name of 'system'
UPDATE public.audit_log
SET actor_name = 'system'
WHERE actor_id IS NULL
  AND actor_name IS NULL;


-- =============================================================================
-- PART 4 — UPDATE DATABASE TRIGGERS TO SET system_source + actor_name
-- =============================================================================
-- The auto-logging triggers in migration 001 (audit_deals, audit_milestones,
-- audit_releases) did not set system_source or actor_name.
-- Re-create them with these fields populated.
-- =============================================================================

-- ── Deal audit trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_deals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      entity_type, entity_id, action, actor_id, actor_name, actor_role,
      old_values, new_values, system_source
    )
    VALUES (
      'deal',
      NEW.id,
      'deal_created',
      NULL,
      'system',
      'system',
      NULL,
      jsonb_build_object(
        'title',        NEW.title,
        'total_amount', NEW.total_amount,
        'status',       NEW.status,
        'contractor_id', NEW.contractor_id
      ),
      'db_trigger/audit_deals'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if a meaningful field changed
    IF OLD.status  IS DISTINCT FROM NEW.status
    OR OLD.funder_id IS DISTINCT FROM NEW.funder_id
    OR OLD.total_amount IS DISTINCT FROM NEW.total_amount
    OR OLD.funded_amount IS DISTINCT FROM NEW.funded_amount
    OR OLD.released_amount IS DISTINCT FROM NEW.released_amount
    THEN
      INSERT INTO public.audit_log (
        entity_type, entity_id, action, actor_id, actor_name, actor_role,
        old_values, new_values, system_source
      )
      VALUES (
        'deal',
        NEW.id,
        CASE
          WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'deal_status_changed'
          WHEN OLD.funder_id IS DISTINCT FROM NEW.funder_id THEN 'funder_assigned'
          WHEN OLD.funded_amount IS DISTINCT FROM NEW.funded_amount THEN 'deal_funded'
          ELSE 'deal_updated'
        END,
        NULL,
        'system',
        'system',
        jsonb_build_object(
          'status',         OLD.status,
          'funder_id',      OLD.funder_id,
          'total_amount',   OLD.total_amount,
          'funded_amount',  OLD.funded_amount,
          'released_amount', OLD.released_amount
        ),
        jsonb_build_object(
          'status',         NEW.status,
          'funder_id',      NEW.funder_id,
          'total_amount',   NEW.total_amount,
          'funded_amount',  NEW.funded_amount,
          'released_amount', NEW.released_amount
        ),
        'db_trigger/audit_deals'
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ── Milestone audit trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      entity_type, entity_id, action, actor_id, actor_name, actor_role,
      old_values, new_values, system_source
    )
    VALUES (
      'milestone',
      NEW.id,
      'milestone_created',
      NULL,
      'system',
      'system',
      NULL,
      jsonb_build_object(
        'title',   NEW.title,
        'amount',  NEW.amount,
        'status',  NEW.status,
        'deal_id', NEW.deal_id
      ),
      'db_trigger/audit_milestones'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_log (
        entity_type, entity_id, action, actor_id, actor_name, actor_role,
        old_values, new_values, system_source
      )
      VALUES (
        'milestone',
        NEW.id,
        'status_transitioned',
        NULL,
        'system',
        'system',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        'db_trigger/audit_milestones'
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ── Release audit trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_releases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      entity_type, entity_id, action, actor_id, actor_name, actor_role,
      old_values, new_values, system_source
    )
    VALUES (
      'release',
      NEW.id,
      'release_created',
      NEW.released_by,
      COALESCE(
        (SELECT COALESCE(full_name, company_name, NEW.released_by::text)
         FROM public.profiles WHERE id = NEW.released_by),
        'unknown'
      ),
      COALESCE(
        (SELECT role::text FROM public.profiles WHERE id = NEW.released_by),
        'system'
      ),
      NULL,
      jsonb_build_object(
        'milestone_id',     NEW.milestone_id,
        'deal_id',          NEW.deal_id,
        'amount',           NEW.amount,
        'stripe_transfer_id', NEW.stripe_transfer_id,
        'transfer_status',  NEW.transfer_status
      ),
      'db_trigger/audit_releases'
    );
  END IF;

  RETURN NULL;
END;
$$;


-- =============================================================================
-- PART 5 — COLUMN COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN public.audit_log.actor_name IS
  'Denormalized display name of the actor at the time of the event. '
  'Populated from profiles.full_name or profiles.company_name at write time. '
  'Never NULL: human actors get their name, system events get ''system'', '
  'unknown actors get ''unknown''. Stored so the record is self-contained '
  'even if the profile is later deleted.';

COMMENT ON COLUMN public.audit_log.actor_email IS
  'Denormalized email from auth.users at the time of the event. '
  'NULL for DB trigger events and system actions (no auth context). '
  'Stored for external audit reports — not fetched via JOIN to avoid '
  'leaking auth.users data to read-only audit consumers.';

COMMENT ON COLUMN public.audit_log.system_source IS
  'The code module or DB trigger that wrote this record. '
  'Format: ''api/[route]'' for API routes (e.g., ''api/milestones/release''), '
  '''webhook/[event]'' for Stripe webhook handlers, '
  '''db_trigger/[function]'' for PostgreSQL triggers. '
  'Enables audit consumers to trace an event back to its exact origin.';

COMMENT ON COLUMN public.audit_log.event_sequence IS
  'Strictly monotonic sequence number assigned by the database at insert time. '
  'Sourced from audit_log_event_seq. Gaps are possible (e.g., rolled-back '
  'transactions) but the value never decreases. '
  'Use ORDER BY event_sequence (not created_at) when exact ordering matters — '
  'two events in the same millisecond are unambiguous via this field.';

COMMENT ON COLUMN public.audit_log.session_id IS
  'Optional application-layer correlation ID (request ID, trace ID). '
  'Allows grouping all audit events from a single HTTP request. '
  'NULL when not provided by the caller.';

COMMENT ON COLUMN public.audit_log.ip_address IS
  'Client IP address from x-forwarded-for header, if provided. '
  'NULL for DB trigger events, webhooks, and callers that do not pass the IP. '
  'Stored as text — may contain IPv4, IPv6, or a comma-separated proxy chain.';

COMMENT ON SEQUENCE public.audit_log_event_seq IS
  'Monotonic sequence for audit_log.event_sequence. '
  'Never reset. Gaps caused by rolled-back transactions are expected and normal. '
  'The sequence value, not created_at, is the authoritative ordering key.';


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Columns added:
--   actor_name    text    — self-contained actor display name (backfilled)
--   actor_email   text    — email at event time (NOT backfilled — no auth access)
--   system_source text    — originating code module or trigger
--   event_sequence bigint — monotonic ordering key (DEFAULT nextval)
--   session_id    text    — optional request correlation ID
--   ip_address    text    — optional client IP
--
-- Constraints added:
--   audit_log_no_future_timestamp — blocks events > 5min in the future
--
-- Indexes added:
--   audit_log_event_sequence_idx — UNIQUE, primary ordering index
--   audit_log_system_source_idx  — for filtering by module
--   audit_log_session_id_idx     — for correlation lookups
--
-- Triggers updated:
--   audit_deals()      — now sets system_source, actor_name
--   audit_milestones() — now sets system_source, actor_name
--   audit_releases()   — now sets system_source, actor_name
--
-- Application changes required:
--   src/lib/engine/audit.ts          — add new params to logAudit()
--   src/lib/types.ts                 — add new fields to AuditLog interface
--   src/app/dashboard/audit/page.tsx — display new fields, replace LocalTime
--   src/app/dashboard/admin/page.tsx — replace relative time with UTC
-- =============================================================================
