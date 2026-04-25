-- =============================================================================
-- Migration 20260425000010 — Application-level rate limiting
--
-- Adds a Supabase-backed fixed-window rate limiter. Because Vektrum runs on
-- Vercel serverless functions (each invocation is an isolated process), in-
-- memory counters are per-instance and do not aggregate across concurrent
-- requests. Supabase is the only shared state, so rate limit state lives here.
--
-- DESIGN
-- ------
-- Fixed-window counter: the request counter for key K is stored in a single
-- row keyed by (key, window_start). window_start is the floor of the current
-- Unix timestamp to the window size. The counter is incremented atomically via
-- INSERT ... ON CONFLICT DO UPDATE (one round-trip, no lock escalation).
--
-- Key format used by the application:
--   user:{userId}:{policyName}        — authenticated user actions
--   partner:{partnerId}:{policyName}  — partner API key calls
--   ip:{ip}:{policyName}              — unauthenticated / cron endpoints
--
-- CLEANUP
-- -------
-- The check_rate_limit() function deletes buckets for the same key that are
-- older than one prior window (per-key cleanup, not a full-table scan).
-- For a full table purge, run:
--   DELETE FROM rate_limit_buckets WHERE window_start < NOW() - INTERVAL '1 day';
-- Consider scheduling this via Supabase pg_cron or a Vercel Cron function.
--
-- PERFORMANCE
-- -----------
-- The PRIMARY KEY index on (key, window_start) covers both the INSERT...ON
-- CONFLICT lookup and the cleanup DELETE. No additional index is needed for
-- normal operation.
-- =============================================================================


-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key           TEXT        NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INTEGER     NOT NULL DEFAULT 0,

  CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key, window_start),
  CONSTRAINT rate_limit_buckets_count_positive CHECK (request_count > 0)
);

COMMENT ON TABLE public.rate_limit_buckets IS
  'Fixed-window rate limit counters. One row per (key, window_start) pair. '
  'Incremented atomically by check_rate_limit(). '
  'Key format: user:{userId}:{policy} | partner:{partnerId}:{policy} | ip:{ip}:{policy}. '
  'Old rows are pruned per-key inside check_rate_limit(); for full cleanup run: '
  'DELETE FROM rate_limit_buckets WHERE window_start < NOW() - INTERVAL ''1 day'';';

COMMENT ON COLUMN public.rate_limit_buckets.key IS
  'Composite rate limit key: <subject_type>:<subject_id>:<policy_name>';

COMMENT ON COLUMN public.rate_limit_buckets.window_start IS
  'Floor of current Unix time / window_seconds * window_seconds. '
  'Uniquely identifies the fixed window for this key.';

-- Index for bulk cleanup queries (purge old windows efficiently)
CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_start_idx
  ON public.rate_limit_buckets (window_start);

-- RLS: written exclusively by the server via service_role (admin client).
-- No user-facing read access needed.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limit_buckets_service_only
  ON public.rate_limit_buckets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── check_rate_limit() ───────────────────────────────────────────────────────
--
-- Atomically increments the counter for (p_key, current_window) and returns
-- whether the request is within the allowed limit.
--
-- Parameters:
--   p_key            TEXT     — composite rate limit key (see above)
--   p_window_seconds INTEGER  — window size in seconds (e.g. 60 = 1 minute)
--   p_limit          INTEGER  — maximum requests allowed per window
--
-- Returns (single row):
--   allowed       BOOLEAN     — true if current_count <= limit (allow the request)
--   current_count INTEGER     — count AFTER incrementing (includes this request)
--   limit_val     INTEGER     — the limit that was applied (= p_limit)
--   reset_at      TIMESTAMPTZ — when the current window expires
--
-- Atomicity:
--   INSERT ... ON CONFLICT DO UPDATE is a single atomic operation in Postgres.
--   No explicit transaction or lock is required; concurrent calls on the same
--   key are serialised by the row-level UPDATE lock.
--
-- Cleanup:
--   Deletes buckets for p_key that are older than one prior window after each
--   call. This is bounded to the rows for this key (not a full-table scan).

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_window_seconds INTEGER,
  p_limit          INTEGER
)
RETURNS TABLE(
  allowed       BOOLEAN,
  current_count INTEGER,
  limit_val     INTEGER,
  reset_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_reset_at     TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  -- Calculate the start of the current fixed window by flooring the Unix
  -- epoch to the nearest multiple of p_window_seconds.
  v_window_start := to_timestamp(
    FLOOR(EXTRACT(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  -- Atomic increment: insert a new bucket starting at 1, or increment the
  -- existing one. The RETURNING clause captures the post-increment value.
  INSERT INTO public.rate_limit_buckets (key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET request_count = rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_count;

  -- Per-key cleanup: remove buckets older than one prior window.
  -- This is O(rows for this key with old windows) — not a full-table scan.
  DELETE FROM public.rate_limit_buckets
  WHERE  key          = p_key
    AND  window_start < v_window_start - make_interval(secs => p_window_seconds);

  RETURN QUERY
  SELECT
    v_count    <= p_limit  AS allowed,
    v_count                AS current_count,
    p_limit                AS limit_val,
    v_reset_at             AS reset_at;
END;
$$;

COMMENT ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) IS
  'Atomically checks and increments a fixed-window rate limit counter. '
  'Returns allowed=true if the post-increment count is within the limit. '
  'Uses INSERT ... ON CONFLICT DO UPDATE for atomicity — one round-trip. '
  'Cleans up expired buckets for the same key after each call. '
  'Called exclusively by the application via service_role (admin client).';


-- =============================================================================
-- End of migration 20260425000010_rate_limit_buckets.sql
-- =============================================================================
