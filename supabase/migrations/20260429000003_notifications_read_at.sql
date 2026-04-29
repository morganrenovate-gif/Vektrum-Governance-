-- ─── Add read_at column to notifications ─────────────────────────────────────
--
-- Tracks when a user dismissed/read an in-app notification.
-- NULL = unread.  Non-null = read (timestamp of the mark-read action).
--
-- read_at is updated by the server via the admin client only — never directly
-- by client-side code — so no new RLS UPDATE policy is needed.
--
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT NULL;

-- Fast unread-count lookup (recipient_user_id, read_at IS NULL)
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL AND read_at IS NULL;
