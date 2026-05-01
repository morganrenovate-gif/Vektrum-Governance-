-- ─── design_partner_applications ─────────────────────────────────────────────
--
-- Captures public submissions from /design-partners. The form is public
-- (no auth required), so writes happen via the service-role admin client
-- in the API route. RLS denies all public access — no SELECT, no UPDATE,
-- no DELETE for anon or authenticated users; reads happen through the
-- admin dashboard or direct service-role queries only.
--
-- Why service-role only:
--   1. Public visitors must not be able to enumerate prior submissions.
--   2. The application contains contact info + UTM attribution that should
--      not be exposed to other applicants or to authenticated dashboard users.
--   3. We do not yet have a "marketing-admin" role — admin staff query this
--      table through ops dashboards that already use the admin client.
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.design_partner_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Applicant identity
  name                  text NOT NULL CHECK (char_length(name)      BETWEEN 1 AND 200),
  company               text NOT NULL CHECK (char_length(company)   BETWEEN 1 AND 200),
  role                  text NOT NULL CHECK (char_length(role)      BETWEEN 1 AND 200),
  email                 text NOT NULL CHECK (
                          char_length(email) BETWEEN 3 AND 320
                          AND email LIKE '%@%'
                        ),

  -- Qualifying answers
  audience_type         text NOT NULL CHECK (audience_type IN (
                          'Lender', 'Title / escrow', 'Builder',
                          'Developer', 'Fund control', 'Contractor', 'Other'
                        )),
  draw_exposure         text NOT NULL CHECK (draw_exposure IN (
                          'Yes', 'No', 'Not directly, but my team does'
                        )),
  biggest_bottleneck    text NOT NULL CHECK (char_length(biggest_bottleneck) BETWEEN 1 AND 2000),

  -- UTM / referrer attribution
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_content           text,
  utm_term              text,
  referrer              text,
  user_agent            text,

  -- Lifecycle
  status                text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'reviewing', 'invited', 'accepted', 'declined')),
  admin_email_sent_at   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Length caps on the optional UTM fields (defense-in-depth).
ALTER TABLE public.design_partner_applications
  ADD CONSTRAINT design_partner_applications_utm_lengths CHECK (
        (utm_source   IS NULL OR char_length(utm_source)   <= 200)
    AND (utm_medium   IS NULL OR char_length(utm_medium)   <= 200)
    AND (utm_campaign IS NULL OR char_length(utm_campaign) <= 200)
    AND (utm_content  IS NULL OR char_length(utm_content)  <= 200)
    AND (utm_term     IS NULL OR char_length(utm_term)     <= 200)
    AND (referrer     IS NULL OR char_length(referrer)     <= 2000)
    AND (user_agent   IS NULL OR char_length(user_agent)   <= 1000)
  );

-- ─── Row-Level Security ───────────────────────────────────────────────────────
--
-- No public access. Service-role bypasses RLS for the API route.

ALTER TABLE public.design_partner_applications ENABLE ROW LEVEL SECURITY;

-- Explicit deny — no SELECT/INSERT/UPDATE/DELETE policies for anon or
-- authenticated. With RLS enabled and no permissive policies, all access
-- through the public API is blocked. Only the service role can read/write.

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS design_partner_applications_created_at_idx
  ON public.design_partner_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS design_partner_applications_status_idx
  ON public.design_partner_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS design_partner_applications_email_idx
  ON public.design_partner_applications (lower(email));

-- ─── Comment ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.design_partner_applications IS
  'Public-form submissions from /design-partners. Service-role-only access.';
COMMENT ON COLUMN public.design_partner_applications.admin_email_sent_at IS
  'Set only after the admin alert email is successfully delivered.';
