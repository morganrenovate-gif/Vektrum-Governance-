-- =============================================================================
-- Vektrum — Construction Milestone-Payment Governance Platform
-- Migration: 001_schema.sql
-- Description: Full schema with enums, tables, RLS policies, triggers, and
--              audit logging functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";


-- ===========================================================================
-- ENUM TYPES
-- ===========================================================================

create type public.user_role as enum (
  'contractor',
  'funder',
  'admin'
);

create type public.deal_status as enum (
  'draft',
  'active',
  'in_progress',
  'completed',
  'disputed',
  'cancelled'
);

create type public.milestone_status as enum (
  'not_started',
  'in_progress',
  'ready_for_review',
  'approved',
  'released',
  'disputed'
);

create type public.protection_status as enum (
  'pending',
  'ready_for_release',
  'released',
  'disputed'
);

create type public.change_order_status as enum (
  'submitted',
  'approved',
  'rejected',
  'paid'
);

create type public.dispute_status as enum (
  'open',
  'resolved',
  'escalated'
);


-- ===========================================================================
-- TABLES
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- Extends auth.users. Created automatically via trigger on auth.users insert.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid        not null references auth.users(id) on delete cascade,
  role                  public.user_role not null default 'contractor',
  full_name             text,
  company_name          text,
  -- Stripe Connect fields (nullable — contractors only, but schema is generic)
  stripe_account_id     text,
  stripe_payouts_enabled boolean     not null default false,
  onboarding_complete   boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint profiles_pkey primary key (id)
);

-- NOTE: profiles has NO email column. Email lives exclusively in auth.users.

comment on table  public.profiles                      is 'User profiles, extending auth.users with role and Stripe data.';
comment on column public.profiles.stripe_account_id   is 'Stripe Connect account ID — set for contractors once onboarding is complete.';
comment on column public.profiles.stripe_payouts_enabled is 'True when Stripe has enabled payouts for this contractor account.';


-- ---------------------------------------------------------------------------
-- 2. DEALS
-- A deal links a contractor to a funder with a total escrow amount.
-- ---------------------------------------------------------------------------
create table public.deals (
  id              uuid            not null default gen_random_uuid(),
  contractor_id   uuid            not null references public.profiles(id) on delete restrict,
  funder_id       uuid            references public.profiles(id) on delete restrict,
  title           text            not null,
  description     text,
  total_amount    numeric(12, 2)  not null,
  funded_amount   numeric(12, 2)  not null default 0,
  released_amount numeric(12, 2)  not null default 0,
  status          public.deal_status not null default 'draft',
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now(),

  constraint deals_pkey              primary key (id),
  constraint deals_total_amount_pos  check (total_amount > 0),
  constraint deals_funded_lte_total  check (funded_amount >= 0 and funded_amount <= total_amount),
  constraint deals_released_lte_funded check (released_amount >= 0 and released_amount <= funded_amount)
);

comment on table public.deals is 'Escrow deals between a contractor and a funder.';


-- ---------------------------------------------------------------------------
-- 3. MILESTONES
-- Ordered work phases within a deal. Each milestone has its own amount.
-- ---------------------------------------------------------------------------
create table public.milestones (
  id                uuid                    not null default gen_random_uuid(),
  deal_id           uuid                    not null references public.deals(id) on delete cascade,
  title             text                    not null,
  description       text,
  amount            numeric(12, 2)          not null,
  position          integer                 not null,
  status            public.milestone_status not null default 'not_started',
  protection_status public.protection_status not null default 'pending',
  created_at        timestamptz             not null default now(),
  updated_at        timestamptz             not null default now(),

  constraint milestones_pkey        primary key (id),
  constraint milestones_amount_pos  check (amount > 0),
  -- Positions must be unique within a deal
  constraint milestones_position_unique unique (deal_id, position)
);

comment on table  public.milestones          is 'Individual work phases within a deal, each with an escrow amount.';
comment on column public.milestones.position is 'Zero-based ordering integer within the deal. Unique per deal.';


-- ---------------------------------------------------------------------------
-- 4. MILESTONE_DOCUMENTS
-- Evidence files (photos, docs, change orders) attached to milestones.
-- ---------------------------------------------------------------------------
create table public.milestone_documents (
  id           uuid        not null default gen_random_uuid(),
  milestone_id uuid        not null references public.milestones(id) on delete cascade,
  uploaded_by  uuid        not null references public.profiles(id) on delete restrict,
  file_url     text        not null,
  file_type    text,       -- 'photo' | 'document' | 'change_order'
  description  text,
  created_at   timestamptz not null default now(),

  constraint milestone_documents_pkey primary key (id)
);

comment on table  public.milestone_documents          is 'Uploaded evidence files associated with a milestone.';
comment on column public.milestone_documents.file_type is 'Broad category: photo, document, change_order.';


-- ---------------------------------------------------------------------------
-- 5. CHANGE_ORDERS
-- Formal requests to adjust a milestone amount.
-- ---------------------------------------------------------------------------
create table public.change_orders (
  id           uuid                         not null default gen_random_uuid(),
  milestone_id uuid                         not null references public.milestones(id) on delete restrict,
  deal_id      uuid                         not null references public.deals(id) on delete restrict,
  amount       numeric(12, 2)               not null,
  description  text                         not null,
  status       public.change_order_status   not null default 'submitted',
  submitted_by uuid                         not null references public.profiles(id) on delete restrict,
  approved_by  uuid                         references public.profiles(id) on delete restrict,
  approved_at  timestamptz,
  created_at   timestamptz                  not null default now(),
  updated_at   timestamptz                  not null default now(),

  constraint change_orders_pkey primary key (id)
);

comment on table public.change_orders is 'Requests to adjust milestone amounts. Require funder or admin approval.';


-- ---------------------------------------------------------------------------
-- 6. DISPUTES
-- Formal dispute records when a milestone payment is contested.
-- ---------------------------------------------------------------------------
create table public.disputes (
  id               uuid                   not null default gen_random_uuid(),
  milestone_id     uuid                   not null references public.milestones(id) on delete restrict,
  deal_id          uuid                   not null references public.deals(id) on delete restrict,
  amount_in_dispute numeric(12, 2)        not null,
  reason           text                   not null,
  status           public.dispute_status  not null default 'open',
  opened_by        uuid                   not null references public.profiles(id) on delete restrict,
  resolved_by      uuid                   references public.profiles(id) on delete restrict,
  resolution       text,
  opened_at        timestamptz            not null default now(),
  resolved_at      timestamptz,

  constraint disputes_pkey                    primary key (id),
  constraint disputes_amount_in_dispute_pos   check (amount_in_dispute > 0)
);

comment on table public.disputes is 'Formal disputes raised against milestones. Append-only — never deleted.';


-- ---------------------------------------------------------------------------
-- 7. RELEASES
-- Immutable record of a milestone payment release to a contractor via Stripe.
-- ONE release per milestone enforced by the unique constraint on milestone_id.
-- NO UPDATE or DELETE policies are ever created for this table.
-- ---------------------------------------------------------------------------
create table public.releases (
  id               uuid        not null default gen_random_uuid(),
  milestone_id     uuid        not null references public.milestones(id) on delete restrict,
  deal_id          uuid        not null references public.deals(id) on delete restrict,
  amount           numeric(12, 2) not null,
  stripe_transfer_id text,
  idempotency_key  text        not null,
  released_at      timestamptz not null default now(),
  released_by      uuid        not null references public.profiles(id) on delete restrict,
  created_at       timestamptz not null default now(),

  constraint releases_pkey             primary key (id),
  -- Enforce exactly one release per milestone
  constraint releases_milestone_unique unique (milestone_id),
  -- Idempotency key must be globally unique
  constraint releases_idempotency_unique unique (idempotency_key)
);

comment on table  public.releases                is 'Immutable payment release records. No update or delete is permitted.';
comment on column public.releases.idempotency_key is 'Client-generated UUID used to prevent duplicate Stripe transfers.';


-- ---------------------------------------------------------------------------
-- 8. AUDIT_LOG
-- Append-only immutable event log for all significant entity changes.
-- NO UPDATE or DELETE policies are ever created for this table.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid        not null default gen_random_uuid(),
  -- entity_type: 'deal' | 'milestone' | 'release' | 'change_order' | 'dispute'
  entity_type text        not null,
  entity_id   uuid        not null,
  -- action: 'created' | 'updated' | 'status_changed' | 'released' | 'approved' | 'rejected' | 'funded'
  action      text        not null,
  actor_id    uuid        references public.profiles(id) on delete set null,
  old_values  jsonb,
  new_values  jsonb,
  metadata    jsonb,
  created_at  timestamptz not null default now(),

  constraint audit_log_pkey primary key (id)
);

-- Index for efficient per-entity lookups
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
-- Index for per-actor lookups
create index audit_log_actor_idx  on public.audit_log (actor_id);
-- Index for chronological queries
create index audit_log_created_at_idx on public.audit_log (created_at desc);

comment on table public.audit_log is 'Immutable, append-only event log. No update or delete permitted.';


-- ===========================================================================
-- HELPER: updated_at trigger function
-- Reusable trigger function that stamps updated_at = now() before any UPDATE.
-- ===========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Sets updated_at = now() on any row update. Attach via trigger.';

-- Attach updated_at trigger to all mutable tables
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger trg_milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

create trigger trg_change_orders_updated_at
  before update on public.change_orders
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- Runs SECURITY DEFINER so it can INSERT into public.profiles while
-- bypassing RLS (the trigger fires as the DB owner, not the end-user).
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    -- Use full_name from metadata if provided, otherwise email prefix
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- Default role; can be overridden in raw_user_meta_data
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'contractor'::public.user_role
    )
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Automatically creates a public.profiles row when a new auth.users row is inserted. Email is intentionally excluded — it lives in auth.users only.';

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ===========================================================================
-- TRIGGER: Audit log — deals
-- Fires after INSERT or UPDATE on deals.
-- Uses SECURITY DEFINER so it can write to audit_log bypassing RLS.
-- ===========================================================================
create or replace function public.audit_deals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action    text;
  v_old_vals  jsonb;
  v_new_vals  jsonb;
begin
  if (tg_op = 'INSERT') then
    v_action   := 'created';
    v_old_vals := null;
    v_new_vals := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    -- Detect status-only changes for a more descriptive action label
    if (old.status is distinct from new.status) then
      v_action := 'status_changed';
    elsif (old.funded_amount is distinct from new.funded_amount) then
      v_action := 'funded';
    else
      v_action := 'updated';
    end if;
    v_old_vals := to_jsonb(old);
    v_new_vals := to_jsonb(new);
  end if;

  insert into public.audit_log (
    entity_type, entity_id, action,
    actor_id,
    old_values,  new_values,
    metadata
  )
  values (
    'deal',
    new.id,
    v_action,
    -- auth.uid() is available even inside a SECURITY DEFINER function
    auth.uid(),
    v_old_vals,
    v_new_vals,
    jsonb_build_object('trigger', tg_name, 'op', tg_op)
  );

  return new;
end;
$$;

comment on function public.audit_deals() is 'Writes an audit_log entry after each INSERT or UPDATE on public.deals.';

create trigger trg_audit_deals
  after insert or update on public.deals
  for each row execute function public.audit_deals();


-- ===========================================================================
-- TRIGGER: Audit log — milestones
-- Fires after UPDATE on milestones (status changes, protection status, etc.)
-- ===========================================================================
create or replace function public.audit_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if (tg_op = 'INSERT') then
    v_action := 'created';
  elsif (tg_op = 'UPDATE') then
    if (old.status is distinct from new.status) then
      v_action := 'status_changed';
    else
      v_action := 'updated';
    end if;
  end if;

  insert into public.audit_log (
    entity_type, entity_id, action,
    actor_id,
    old_values,  new_values,
    metadata
  )
  values (
    'milestone',
    new.id,
    v_action,
    auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    jsonb_build_object(
      'trigger', tg_name,
      'op',      tg_op,
      'deal_id', new.deal_id
    )
  );

  return new;
end;
$$;

comment on function public.audit_milestones() is 'Writes an audit_log entry after each INSERT or UPDATE on public.milestones.';

create trigger trg_audit_milestones
  after insert or update on public.milestones
  for each row execute function public.audit_milestones();


-- ===========================================================================
-- TRIGGER: Audit log — releases
-- Fires after INSERT on releases (no UPDATE/DELETE ever occurs on releases).
-- ===========================================================================
create or replace function public.audit_releases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (
    entity_type, entity_id, action,
    actor_id,
    old_values,  new_values,
    metadata
  )
  values (
    'release',
    new.id,
    'released',
    auth.uid(),
    null,
    to_jsonb(new),
    jsonb_build_object(
      'trigger',            tg_name,
      'op',                 tg_op,
      'deal_id',            new.deal_id,
      'milestone_id',       new.milestone_id,
      'stripe_transfer_id', new.stripe_transfer_id
    )
  );

  return new;
end;
$$;

comment on function public.audit_releases() is 'Writes an audit_log entry after each INSERT on public.releases.';

create trigger trg_audit_releases
  after insert on public.releases
  for each row execute function public.audit_releases();


-- ===========================================================================
-- ROW-LEVEL SECURITY (RLS)
-- Enable RLS on every table, then add policies.
-- ===========================================================================

alter table public.profiles           enable row level security;
alter table public.deals              enable row level security;
alter table public.milestones         enable row level security;
alter table public.milestone_documents enable row level security;
alter table public.change_orders      enable row level security;
alter table public.disputes           enable row level security;
alter table public.releases           enable row level security;
alter table public.audit_log          enable row level security;


-- ---------------------------------------------------------------------------
-- HELPER: is_admin() — checks if the calling user has the 'admin' role.
-- SECURITY DEFINER so it can read profiles even if profile RLS would block it.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is 'Returns true if the calling auth user has the admin role.';


-- ---------------------------------------------------------------------------
-- HELPER: is_deal_participant(deal_id uuid)
-- Returns true if the calling user is the contractor or funder on a deal.
-- ---------------------------------------------------------------------------
create or replace function public.is_deal_participant(p_deal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.deals
    where id = p_deal_id
      and (contractor_id = auth.uid() or funder_id = auth.uid())
  );
$$;

comment on function public.is_deal_participant(uuid) is 'Returns true if the calling user is the contractor or funder on the given deal.';


-- ===========================================================================
-- RLS POLICIES — PROFILES
-- ===========================================================================

-- Users can read their own profile only.
create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid() or public.is_admin());

-- Users can update their own profile, but CANNOT change their own role.
-- (Role changes must go through a privileged server-side process.)
create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Prevent role escalation: the new role must equal the existing role
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Only the service role (admin client) or triggers may INSERT profiles.
-- Regular users cannot insert — the handle_new_user trigger does it for them.
create policy "profiles_insert_service_only"
  on public.profiles
  for insert
  with check (false); -- blocked for authenticated users; trigger uses SECURITY DEFINER

-- No user-facing delete.
create policy "profiles_no_delete"
  on public.profiles
  for delete
  using (false);


-- ===========================================================================
-- RLS POLICIES — DEALS
-- ===========================================================================

-- Contractors see their own deals.
-- Funders see deals where they are the funder.
-- Admins see all deals.
create policy "deals_select"
  on public.deals
  for select
  using (
    contractor_id = auth.uid()
    or funder_id   = auth.uid()
    or public.is_admin()
  );

-- Contractors can create deals (they become the contractor).
create policy "deals_insert_contractor"
  on public.deals
  for insert
  with check (contractor_id = auth.uid());

-- Deal participants and admins can update deals.
create policy "deals_update"
  on public.deals
  for update
  using (
    contractor_id = auth.uid()
    or funder_id   = auth.uid()
    or public.is_admin()
  );

-- Only admins can hard-delete deals (normally deals are cancelled, not deleted).
create policy "deals_delete_admin"
  on public.deals
  for delete
  using (public.is_admin());


-- ===========================================================================
-- RLS POLICIES — MILESTONES
-- ===========================================================================

-- Deal participants and admins can read milestones.
create policy "milestones_select"
  on public.milestones
  for select
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Contractors on the deal can create milestones.
create policy "milestones_insert"
  on public.milestones
  for insert
  with check (
    exists (
      select 1 from public.deals
      where id = deal_id
        and contractor_id = auth.uid()
    )
    or public.is_admin()
  );

-- Deal participants and admins can update milestones.
create policy "milestones_update"
  on public.milestones
  for update
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Only admins can delete milestones.
create policy "milestones_delete_admin"
  on public.milestones
  for delete
  using (public.is_admin());


-- ===========================================================================
-- RLS POLICIES — MILESTONE_DOCUMENTS
-- ===========================================================================

-- Deal participants and admins can view documents.
create policy "milestone_documents_select"
  on public.milestone_documents
  for select
  using (
    exists (
      select 1 from public.milestones m
      where m.id = milestone_id
        and (public.is_deal_participant(m.deal_id) or public.is_admin())
    )
  );

-- Deal participants can upload documents.
create policy "milestone_documents_insert"
  on public.milestone_documents
  for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.milestones m
      where m.id = milestone_id
        and (public.is_deal_participant(m.deal_id) or public.is_admin())
    )
  );

-- The uploader or an admin can update the document metadata.
create policy "milestone_documents_update"
  on public.milestone_documents
  for update
  using (uploaded_by = auth.uid() or public.is_admin());

-- The uploader or an admin can delete a document.
create policy "milestone_documents_delete"
  on public.milestone_documents
  for delete
  using (uploaded_by = auth.uid() or public.is_admin());


-- ===========================================================================
-- RLS POLICIES — CHANGE_ORDERS
-- ===========================================================================

create policy "change_orders_select"
  on public.change_orders
  for select
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Contractors on the deal or admins may submit change orders.
create policy "change_orders_insert"
  on public.change_orders
  for insert
  with check (
    submitted_by = auth.uid()
    and (public.is_deal_participant(deal_id) or public.is_admin())
  );

-- Deal participants and admins can update change orders (approve/reject).
create policy "change_orders_update"
  on public.change_orders
  for update
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Only admins can delete change orders.
create policy "change_orders_delete_admin"
  on public.change_orders
  for delete
  using (public.is_admin());


-- ===========================================================================
-- RLS POLICIES — DISPUTES
-- ===========================================================================

create policy "disputes_select"
  on public.disputes
  for select
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Any deal participant can open a dispute.
create policy "disputes_insert"
  on public.disputes
  for insert
  with check (
    opened_by = auth.uid()
    and (public.is_deal_participant(deal_id) or public.is_admin())
  );

-- Deal participants and admins can update disputes (resolve, escalate).
create policy "disputes_update"
  on public.disputes
  for update
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Disputes are never deleted — no delete policy.


-- ===========================================================================
-- RLS POLICIES — RELEASES
-- CRITICAL: NO UPDATE and NO DELETE policies are defined. Ever.
-- ===========================================================================

-- Deal participants and admins can read releases.
create policy "releases_select"
  on public.releases
  for select
  using (public.is_deal_participant(deal_id) or public.is_admin());

-- Releases are created only by the server-side release function (admin client).
-- Authenticated users cannot insert directly — the service role bypasses RLS.
-- We explicitly block direct inserts from authenticated users.
create policy "releases_insert_service_only"
  on public.releases
  for insert
  with check (false);

-- *** No UPDATE policy ***
-- *** No DELETE policy ***
-- This enforces immutability at the database layer.


-- ===========================================================================
-- RLS POLICIES — AUDIT_LOG
-- CRITICAL: NO UPDATE and NO DELETE policies are defined. Ever.
-- ===========================================================================

-- Admins can read the full audit log.
-- Deal participants can read audit entries for their deals and milestones.
create policy "audit_log_select"
  on public.audit_log
  for select
  using (
    public.is_admin()
    or (
      -- The actor is the calling user
      actor_id = auth.uid()
    )
    or (
      -- The entity is a deal the user participates in
      entity_type = 'deal'
      and public.is_deal_participant(entity_id)
    )
    or (
      -- The entity is a milestone or release on a deal the user participates in
      entity_type in ('milestone', 'release', 'change_order', 'dispute')
      and exists (
        select 1 from public.milestones m
        where m.id = entity_id
          and public.is_deal_participant(m.deal_id)
        union all
        select 1 from public.releases r
        where r.id = entity_id
          and public.is_deal_participant(r.deal_id)
        union all
        select 1 from public.change_orders co
        where co.id = entity_id
          and public.is_deal_participant(co.deal_id)
        union all
        select 1 from public.disputes d
        where d.id = entity_id
          and public.is_deal_participant(d.deal_id)
      )
    )
  );

-- Inserts are performed exclusively by SECURITY DEFINER trigger functions
-- and the admin service-role client. Direct inserts from authenticated
-- users are blocked at the policy level.
create policy "audit_log_insert_service_only"
  on public.audit_log
  for insert
  with check (false);

-- *** No UPDATE policy ***
-- *** No DELETE policy ***
-- Audit log is immutable by design.


-- ===========================================================================
-- INDEXES — performance for common query patterns
-- ===========================================================================

create index deals_contractor_id_idx on public.deals (contractor_id);
create index deals_funder_id_idx     on public.deals (funder_id);
create index deals_status_idx        on public.deals (status);

create index milestones_deal_id_idx  on public.milestones (deal_id, position);
create index milestones_status_idx   on public.milestones (status);

create index milestone_documents_milestone_id_idx on public.milestone_documents (milestone_id);

create index change_orders_deal_id_idx      on public.change_orders (deal_id);
create index change_orders_milestone_id_idx on public.change_orders (milestone_id);
create index change_orders_status_idx       on public.change_orders (status);

create index disputes_deal_id_idx       on public.disputes (deal_id);
create index disputes_milestone_id_idx  on public.disputes (milestone_id);
create index disputes_status_idx        on public.disputes (status);

create index releases_deal_id_idx on public.releases (deal_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Atomic Increment of Deal Released Amount
-- Called by the release endpoint to avoid read-modify-write race conditions.
-- Uses an atomic UPDATE ... SET released_amount = released_amount + p_amount.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.increment_deal_released_amount(
  p_deal_id uuid,
  p_amount  numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deals
  set
    released_amount = released_amount + p_amount,
    updated_at      = now()
  where id = p_deal_id
    and (released_amount + p_amount) <= funded_amount;  -- enforce constraint atomically

  if not found then
    raise exception 'Deal % could not be updated: either it does not exist or releasing $% would exceed the funded amount.', p_deal_id, p_amount;
  end if;
end;
$$;
