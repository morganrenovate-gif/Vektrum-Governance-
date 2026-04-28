-- ─── Notifications table ──────────────────────────────────────────────────────
--
-- Persistent records of every notification Vektrum attempts to deliver.
-- Provides an auditable trail of what was sent, to whom, and whether it
-- succeeded — independent of whether the upstream email provider confirms delivery.
--
-- Columns
--   recipient_user_id  — the Vektrum profile that should see this notification.
--                        Nullable for outbound-only events where the recipient
--                        is not yet a platform user (e.g. invite to a new funder).
--   recipient_email    — email address used for delivery. Denormalized so the record
--                        remains accurate even if the profile email changes later.
--   deal_id            — deal context for the event. Nullable for platform-level events.
--   entity_type        — the type of the primary entity (e.g. 'change_order', 'invite').
--   entity_id          — the UUID or token of that entity.
--   notification_type  — machine-readable event name (e.g. 'change_order_submitted').
--   channel            — delivery channel: 'email' | 'in_app'.
--   status             — delivery lifecycle: 'pending' | 'sent' | 'failed' | 'skipped'.
--                        'skipped' means the channel was intentionally not attempted
--                        (e.g. RESEND_API_KEY not configured, recipient opted out).
--   subject            — email subject line or in-app notification title.
--   body_summary       — short plain-text summary of the notification body.
--                        Never contains secrets, API keys, tokens, or PII beyond name.
--   error_message      — populated on 'failed' status with provider error detail.
--   sent_at            — timestamp of successful delivery handoff to the email provider.
--
-- RLS
--   SELECT: users can read only their own notifications (recipient_user_id = auth.uid()).
--   INSERT/UPDATE/DELETE: only service-role (admin client) — never direct user writes.
--   Admins use the admin client (bypasses RLS) for ops visibility.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email   text,
  deal_id           uuid        REFERENCES public.deals(id) ON DELETE SET NULL,
  entity_type       text        NOT NULL,
  entity_id         text        NOT NULL,
  notification_type text        NOT NULL,
  channel           text        NOT NULL DEFAULT 'email'
                                CHECK (channel IN ('email', 'in_app')),
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  subject           text,
  body_summary      text,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users may only read notifications addressed to them.
-- Inserts and updates are service-role only (admin client bypasses RLS).
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (recipient_user_id = auth.uid());

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Notification inbox lookup (user sees their own notifications, newest first)
CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

-- Deal-scoped notification lookups (admin/ops view)
CREATE INDEX notifications_deal_id_idx
  ON public.notifications (deal_id, created_at DESC)
  WHERE deal_id IS NOT NULL;

-- Delivery status sweep (pending → sent / failed cron)
CREATE INDEX notifications_status_idx
  ON public.notifications (status, created_at DESC);
