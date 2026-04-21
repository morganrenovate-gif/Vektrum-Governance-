-- =============================================================================
-- Vektrum — Migration 009: dispute_briefs table
-- AI-generated dispute analysis briefs linked to milestones and deals.
-- =============================================================================

create type dispute_brief_status as enum ('OPEN', 'RESOLVED');

create table dispute_briefs (
  id                        uuid primary key default gen_random_uuid(),
  milestone_id              uuid not null references milestones(id) on delete cascade,
  deal_id                   uuid not null references deals(id) on delete cascade,
  dispute_reason            text not null,
  dispute_context           text,
  submitted_items           jsonb not null default '[]'::jsonb,
  missing_items             jsonb not null default '[]'::jsonb,
  condition_gaps            jsonb not null default '[]'::jsonb,
  resolution_steps          jsonb not null default '[]'::jsonb,
  estimated_resolution_time text,
  project_status_summary    text,
  status                    dispute_brief_status not null default 'OPEN',
  raw_response              text,
  model_version             text,
  created_at                timestamptz not null default now(),
  resolved_at               timestamptz
);

create index dispute_briefs_milestone_id_idx on dispute_briefs(milestone_id);
create index dispute_briefs_deal_id_idx      on dispute_briefs(deal_id);
create index dispute_briefs_status_idx       on dispute_briefs(status);

-- RLS: funders and contractors can read briefs for deals they participate in
alter table dispute_briefs enable row level security;

create policy "Participants can read dispute briefs for their deals"
  on dispute_briefs for select
  using (
    deal_id in (
      select id from deals
      where funder_id = auth.uid() or contractor_id = auth.uid()
    )
  );

-- Only Edge Functions (service role) can insert or update
create policy "Service role can manage dispute briefs"
  on dispute_briefs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
