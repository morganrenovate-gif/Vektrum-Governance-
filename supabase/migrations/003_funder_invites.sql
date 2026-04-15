-- =============================================================================
-- Vektrum — Migration 003: Funder Invites
-- 
-- Adds a deal_invites table for secure one-time funder invite links.
-- 
-- Design decisions:
--   - Token is a server-generated cryptographically random UUID — never client-supplied
--   - One active (pending) invite per deal at a time to prevent link proliferation
--   - Tokens expire after 7 days (configurable via expires_at)
--   - Token is single-use: accepted_at is set atomically on acceptance
--   - The invite carries the deal_id and invited_by (contractor's user id)
--   - RLS: contractors can create/view invites for their own deals
--          anyone with the token can read it (needed for the accept page, pre-auth)
--          acceptance is handled by a service-role API route
--   - Audit log: invite created and accepted events written to audit_log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: deal_invites
-- ---------------------------------------------------------------------------
create table public.deal_invites (
  id              uuid        not null default gen_random_uuid(),
  deal_id         uuid        not null references public.deals(id) on delete cascade,
  invited_by      uuid        not null references public.profiles(id) on delete cascade,
  -- Secure random token — used as the URL slug
  -- gen_random_uuid() produces a cryptographically random V4 UUID
  token           uuid        not null default gen_random_uuid(),
  -- Optional: contractor can pre-fill the funder's email for display purposes
  -- This is NOT used to restrict who can accept — any authenticated funder can
  invited_email   text,
  -- Lifecycle
  status          text        not null default 'pending'
                  check (status in ('pending', 'accepted', 'revoked', 'expired')),
  accepted_by     uuid        references public.profiles(id) on delete set null,
  accepted_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint deal_invites_pkey         primary key (id),
  -- Token must be globally unique — it is the secret URL component
  constraint deal_invites_token_unique unique (token)
);

-- Only one PENDING invite per deal at a time
-- (accepted/revoked/expired invites are kept for the audit trail)
create unique index deal_invites_one_pending_per_deal
  on public.deal_invites (deal_id)
  where status = 'pending';

-- Fast lookup by token (the most common query — accept page)
create index deal_invites_token_idx on public.deal_invites (token);

-- Fast lookup of all invites for a deal
create index deal_invites_deal_id_idx on public.deal_invites (deal_id);

comment on table  public.deal_invites              is 'Secure one-time invite links for funders to join a deal.';
comment on column public.deal_invites.token        is 'Cryptographically random UUID used as the URL-safe invite token.';
comment on column public.deal_invites.invited_email is 'Optional pre-filled funder email — display only, does not restrict acceptance.';
comment on column public.deal_invites.status       is 'pending | accepted | revoked | expired';

-- updated_at trigger
create trigger trg_deal_invites_updated_at
  before update on public.deal_invites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.deal_invites enable row level security;

-- Contractors can see invites they created
create policy "invites_select_contractor"
  on public.deal_invites
  for select
  using (
    invited_by = auth.uid()
    or public.is_admin()
  );

-- Contractors can create invites for their own deals
create policy "invites_insert_contractor"
  on public.deal_invites
  for insert
  with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.deals
      where id = deal_id
        and contractor_id = auth.uid()
    )
  );

-- Only the service role (admin client) can update invites (accept, revoke, expire)
-- Direct updates from authenticated users are blocked
create policy "invites_update_service_only"
  on public.deal_invites
  for update
  using (false);

-- Only admins can delete (soft-delete via status = 'revoked' is preferred)
create policy "invites_delete_admin"
  on public.deal_invites
  for delete
  using (public.is_admin());
