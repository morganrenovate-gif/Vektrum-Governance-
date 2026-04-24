import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { AuditTimestamp } from "@/components/ui/local-time";
import type { AuditLog } from "@/lib/types";
import { Shield, Search, X, Download } from "lucide-react";
import { PageHeader } from "@/components/layout";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// ─── Category → action mapping ───────────────────────────────────────────────

const CATEGORY_ACTIONS: Record<string, string[]> = {
  user_activity: [
    "funder_signed_up",
    "contractor_signed_up",
    "admin_signed_up",
    "user_signed_up",
    "admin_role_granted",
    "admin_invite_sent",
    "invite_created",
    "funder_assigned",
  ],
  deal_lifecycle: [
    "deal_created",
    "deal_updated",
    "deal_funded",
    "deal_status_changed",
    "funder_assigned",
  ],
  milestone_activity: [
    "milestone_created",
    "status_transitioned",
    "document_uploaded",
    "change_order_created",
    "amount_adjusted_via_change_order",
    "change_order_approved",
    "change_order_rejected",
  ],
  payments: [
    "funds_released",
    "release_failed",
    "release_created",
    "payment_confirmed",
    "transfer_confirmed",
    "transfer_failed",
    "milestone_payout_failed",
    "stripe_account_created",
    "stripe_account_updated",
    "stripe_account_link_generated",
    "stripe_account_conflict_attempted",
    "stripe_account_duplicate_resolved",
  ],
  admin: [
    "admin_role_granted",
    "admin_invite_sent",
    "admin_stripe_duplicate_scan",
  ],
  disputes: [
    "dispute_opened",
    "dispute_escalated",
    "dispute_resolved_release",
    "dispute_resolved_write_off",
  ],
  ai: ["ai_draw_review"],
};

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "all",              label: "All"           },
  { key: "user_activity",    label: "Users"         },
  { key: "deal_lifecycle",   label: "Deals"         },
  { key: "milestone_activity", label: "Milestones"  },
  { key: "payments",         label: "Payments"      },
  { key: "admin",            label: "Admin"         },
  { key: "disputes",         label: "Disputes"      },
  { key: "ai",               label: "AI"            },
];

// ─── Human-readable action labels ────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  funder_signed_up:                    "Funder Signed Up",
  contractor_signed_up:                "Contractor Signed Up",
  admin_signed_up:                     "Admin Signed Up",
  user_signed_up:                      "User Signed Up",
  admin_role_granted:                  "Admin Role Granted",
  admin_invite_sent:                   "Admin Invite Sent",
  invite_created:                      "Funder Invite Created",
  funder_assigned:                     "Funder Assigned",
  deal_created:                        "Deal Created",
  deal_updated:                        "Deal Updated",
  deal_funded:                         "Deal Funded",
  deal_status_changed:                 "Deal Status Changed",
  milestone_created:                   "Milestone Created",
  status_transitioned:                 "Milestone Status Changed",
  document_uploaded:                   "Document Uploaded",
  change_order_created:                "Change Order Created",
  amount_adjusted_via_change_order:    "Amount Adjusted (Change Order)",
  change_order_approved:               "Change Order Approved",
  change_order_rejected:               "Change Order Rejected",
  funds_released:                      "Funds Released",
  release_failed:                      "Release Failed",
  release_created:                     "Release Created",
  payment_confirmed:                   "Payment Confirmed",
  transfer_confirmed:                  "Transfer Confirmed",
  transfer_failed:                     "Transfer Failed",
  milestone_payout_failed:             "Payout Failed",
  stripe_account_created:              "Stripe Account Created",
  stripe_account_updated:              "Stripe Account Updated",
  stripe_account_link_generated:       "Stripe Link Generated",
  stripe_account_conflict_attempted:   "Stripe Conflict Blocked",
  stripe_account_duplicate_resolved:   "Stripe Duplicate Resolved",
  admin_stripe_duplicate_scan:         "Admin Stripe Scan",
  dispute_opened:                      "Dispute Opened",
  dispute_escalated:                   "Dispute Escalated",
  dispute_resolved_release:            "Dispute Resolved (Release)",
  dispute_resolved_write_off:          "Dispute Resolved (Write-off)",
  ai_draw_review:                      "AI Draw Review",
};

// ─── Badge variant ────────────────────────────────────────────────────────────

function actionVariant(action: string) {
  if (
    action.includes("release") && !action.includes("failed") ||
    action.includes("funded") ||
    action.includes("approved") ||
    action.includes("signed_up") ||
    action.includes("confirmed")
  ) return "success" as const;
  if (
    action.includes("dispute") ||
    action.includes("reject") ||
    action.includes("failed") ||
    action.includes("conflict")
  ) return "error" as const;
  if (action.includes("ai_draw")) return "info" as const;
  return "default" as const;
}

// ─── Actor role badge ─────────────────────────────────────────────────────────

function roleBadgeClasses(role: string | null | undefined): string {
  switch (role) {
    case "contractor":
      return "bg-vektrum-amber/10 text-amber-400 border border-vektrum-amber/20";
    case "funder":
      return "bg-vektrum-blue/15 text-vektrum-blue border border-vektrum-blue/20";
    case "admin":
      return "bg-white/[0.08] text-white/60 border border-white/[0.1]";
    default:
      return "bg-white/[0.04] text-white/30 border border-white/[0.06]";
  }
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildUrl(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params  = new URLSearchParams();
  const merged  = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

// ─── UUID check ───────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?:     string;
    category?: string;
    role?:     string;
    action?:   string;
    search?:   string;
  }>;
}) {
  const { page: pageParam, category, role, action, search } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (!profile) redirect("/dashboard");

  const isAdmin     = profile.role === "admin";
  const isFunder    = profile.role === "funder";
  // Contractors + funders get a deal-scoped activity view; admins see everything.

  // ── Scope non-admin users to their own deals/milestones ──────────────────
  // For a contractor: deals where contractor_id = me.
  // For a funder:     deals where funder_id = me.
  // We collect their deal IDs + milestone IDs and use them as an entity_id filter.
  let scopedEntityIds: string[] = []

  if (!isAdmin) {
    const dealField = isFunder ? "funder_id" : "contractor_id";
    const { data: userDeals } = await supabase
      .from("deals")
      .select("id, milestones(id)")
      .eq(dealField, user.id);

    const dealIds      = userDeals?.map((d) => d.id) ?? [];
    const milestoneIds = userDeals?.flatMap(
      (d) => (d.milestones as { id: string }[] | null)?.map((m) => m.id) ?? []
    ) ?? [];
    scopedEntityIds = [...dealIds, ...milestoneIds];
  }

  // ── Build query ──────────────────────────────────────────────────────────
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  let query = supabase
    .from("audit_log")
    .select(
      // Fetch all compliance fields + profile joins for display
      `id, event_sequence, entity_type, entity_id, action,
       actor_id, actor_role, actor_name, actor_email,
       system_source, session_id, ip_address,
       old_values, new_values, metadata, created_at,
       actor:profiles!audit_log_actor_id_fkey(full_name, role),
       entity_profile:profiles!audit_log_entity_id_fkey(full_name, role)`,
      { count: "exact" },
    )
    // Order by event_sequence DESC — monotonic, resolves same-ms ties
    .order("event_sequence", { ascending: false });

  if (category && category !== "all" && CATEGORY_ACTIONS[category]) {
    query = query.in("action", CATEGORY_ACTIONS[category]);
  }
  if (role && isAdmin) query = query.eq("actor_role", role);  // role filter only for admins
  if (action) query = query.eq("action", action);
  if (search && search.trim()) {
    const term = search.trim();
    query = UUID_RE.test(term)
      ? query.or(`action.ilike.%${term}%,entity_id.eq.${term},actor_id.eq.${term}`)
      : query.or(`action.ilike.%${term}%,actor_name.ilike.%${term}%,actor_email.ilike.%${term}%,system_source.ilike.%${term}%`);
  }

  // Non-admins: restrict to events they were the actor of, OR events on their deals/milestones
  if (!isAdmin) {
    if (scopedEntityIds.length > 0) {
      query = query.or(`actor_id.eq.${user.id},entity_id.in.(${scopedEntityIds.join(",")})`);
    } else {
      // User has no deals yet — show only events where they are the actor
      query = query.eq("actor_id", user.id);
    }
  }

  query = query.range(from, to);

  const { data: logs, count } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries    = (logs ?? []) as unknown as AuditLog[];

  const currentParams: Record<string, string | undefined> = { category, role, action, search };
  const hasFilters = !!((category && category !== "all") || role || action || search);

  // Non-admins cannot filter by role (their results are already scoped)
  const visibleTabs = isAdmin
    ? CATEGORY_TABS
    : CATEGORY_TABS.filter((t) => t.key !== "admin");

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">

      {/* Header */}
      <PageHeader
        eyebrow="Audit Log"
        title={isAdmin ? "Platform Events" : "Activity Log"}
        description={
          isAdmin
            ? (count !== null
                ? `${count.toLocaleString()} immutable event${count !== 1 ? 's' : ''} · ordered by event_sequence · all timestamps UTC`
                : 'Append-only event log · all timestamps UTC')
            : (count !== null
                ? `${count.toLocaleString()} event${count !== 1 ? 's' : ''} on your deals · ordered by sequence · all timestamps UTC`
                : 'Events on your deals and milestones · all timestamps UTC')
        }
      />

      {/* Compliance notice */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] text-white/40">
        <Shield size={14} className="text-white/30 flex-shrink-0 mt-0.5" />
        <span>
          {isAdmin
            ? <>All timestamps are exact UTC (YYYY-MM-DD HH:MM:SS UTC). Events are ordered by
               monotonic <code className="font-mono text-white/50">event_sequence</code>, not
               wall-clock time, to resolve sub-millisecond ordering ambiguity. This log is
               append-only — no record can be modified or deleted.</>
            : <>Shows actions on your deals and milestones, plus your own account activity.
               Timestamps are exact UTC. This log is append-only — no record can be modified or deleted.</>
          }
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {visibleTabs.map((tab) => {
          const isActive = tab.key === "all"
            ? !category || category === "all"
            : category === tab.key;
          return (
            <Link
              key={tab.key}
              href={buildUrl(currentParams, {
                category: tab.key === "all" ? undefined : tab.key,
                page: undefined,
              })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-vektrum-blue text-white shadow-sm shadow-vektrum-blue/30"
                  : "bg-white/[0.05] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Filter bar */}
      <form className="flex flex-wrap items-center gap-3">
        {category && category !== "all" && (
          <input type="hidden" name="category" value={category} />
        )}
        {action && <input type="hidden" name="action" value={action} />}

        {/* Role filter — admin only (non-admins are already scoped to their own data) */}
        {isAdmin && (
          <select
            name="role"
            defaultValue={role ?? ""}
            className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 pr-8 text-xs text-white/70 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
          >
            <option value="">All Roles</option>
            <option value="contractor">Contractor</option>
            <option value="funder">Funder</option>
            <option value="admin">Admin</option>
            <option value="system">System</option>
          </select>
        )}

        {/* Search — now also matches actor_name, actor_email, system_source */}
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Action, actor name, email, or entity UUID…"
            className="h-9 w-72 rounded-lg border border-white/[0.1] bg-white/[0.05] pl-8 pr-3 text-xs text-white/70 placeholder:text-white/25 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
          />
        </div>

        <button
          type="submit"
          className="h-9 rounded-lg bg-vektrum-blue px-4 text-xs font-semibold text-white hover:bg-vektrum-blue-hover transition-colors shadow-sm shadow-vektrum-blue/30"
        >
          Apply
        </button>

        {hasFilters && (
          <Link
            href="?"
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-vektrum-blue transition-colors"
          >
            <X size={12} />
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-3.5 bg-white/[0.015] flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">
            Events · ordered by sequence desc
          </p>
          {count !== null && (
            <p className="text-[11px] text-white/25 tabular-nums">
              {count.toLocaleString()} total
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 whitespace-nowrap">
                  Seq / Event ID
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 whitespace-nowrap">
                  Timestamp (UTC)
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Source / Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-white/30">
                    No audit events match your filters.
                  </td>
                </tr>
              ) : (
                entries.map((log) => <AuditRow key={log.id} log={log} isAdmin={isAdmin} />)
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Pagination page={page} totalPages={totalPages} currentParams={currentParams} />
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── Audit row ────────────────────────────────────────────────────────────────

function AuditRow({ log, isAdmin }: { log: AuditLog; isAdmin: boolean }) {
  // Resolve actor display: prefer denormalized actor_name (migration 016),
  // fall back to joined profile, then to system/unknown labels.
  const displayRole = log.actor_role ?? log.actor?.role ?? null;

  const actorName = log.actor_name
    ?? log.actor?.full_name
    ?? (!log.actor_id && log.entity_type === "profile" ? log.entity_profile?.full_name : null)
    ?? (displayRole === "system" || !log.actor_id ? null : "Unknown");

  const isSystem = !log.actor_id || displayRole === "system" || actorName === "system";

  return (
    <tr className="hover:bg-white/[0.025] transition-colors align-top">

      {/* ── Seq / Event ID ─────────────────────────────────────────────── */}
      <td className="px-4 py-3 whitespace-nowrap">
        {log.event_sequence != null && (
          <p className="text-[12px] font-mono font-semibold text-white/60 tabular-nums">
            #{log.event_sequence.toLocaleString()}
          </p>
        )}
        <p className="text-[10px] font-mono text-white/20 mt-0.5" title={log.id}>
          {log.id.slice(0, 8)}…{log.id.slice(-4)}
        </p>
      </td>

      {/* ── Timestamp — exact UTC, never relative ──────────────────────── */}
      <td className="px-4 py-3 whitespace-nowrap">
        <AuditTimestamp iso={log.created_at} split className="text-[11px] text-white/50" />
      </td>

      {/* ── Actor ──────────────────────────────────────────────────────── */}
      <td className="px-4 py-3 text-xs">
        {isSystem ? (
          <div className="flex items-center gap-1.5">
            <span className="italic text-white/25">System</span>
            {log.system_source && (
              <span className="text-[10px] font-mono text-white/20 truncate max-w-[100px]"
                    title={log.system_source}>
                {log.system_source.split('/').pop()}
              </span>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/70 font-medium">
                {actorName ?? "Unknown"}
              </span>
              {displayRole && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClasses(displayRole)}`}>
                  {displayRole}
                </span>
              )}
            </div>
            {/* Email — compliance field, admin-only */}
            {isAdmin && log.actor_email && (
              <p className="text-[11px] text-white/30 mt-0.5 font-mono truncate max-w-[180px]">
                {log.actor_email}
              </p>
            )}
          </div>
        )}
      </td>

      {/* ── Action ─────────────────────────────────────────────────────── */}
      <td className="px-4 py-3">
        <Badge variant={actionVariant(log.action)}>
          {ACTION_LABELS[log.action] ?? log.action}
        </Badge>
      </td>

      {/* ── Entity ─────────────────────────────────────────────────────── */}
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-white/60">{log.entity_type}</p>
        <p className="text-[10px] font-mono text-white/25 mt-0.5" title={log.entity_id}>
          {log.entity_id.slice(0, 8)}…
        </p>
      </td>

      {/* ── Source + Details ───────────────────────────────────────────── */}
      <td className="px-4 py-3">
        {/* system_source tag */}
        {log.system_source && (
          <p className="text-[10px] font-mono text-white/25 mb-1 truncate max-w-[200px]"
             title={log.system_source}>
            {log.system_source}
          </p>
        )}

        {/* Metadata details */}
        {log.metadata && Object.keys(log.metadata).length > 0 ? (
          <details className="group cursor-pointer">
            <summary className="select-none list-none text-xs text-vektrum-blue hover:underline">
              View details
            </summary>
            <div className="mt-2 max-w-xs overflow-auto rounded-xl bg-white/[0.05] border border-white/[0.08] p-2.5">
              <dl className="space-y-1">
                {/* Session ID and IP address — admin-only operational fields */}
                {isAdmin && log.session_id && (
                  <DetailRow k="session_id" v={log.session_id} mono />
                )}
                {isAdmin && log.ip_address && (
                  <DetailRow k="ip_address" v={log.ip_address} mono />
                )}
                {Object.entries(log.metadata).map(([key, value]) => (
                  <DetailRow
                    key={key}
                    k={key}
                    v={typeof value === 'object' && value !== null
                      ? JSON.stringify(value)
                      : String(value ?? '—')}
                  />
                ))}
              </dl>
            </div>
          </details>
        ) : isAdmin && (log.session_id || log.ip_address) ? (
          <details className="group cursor-pointer">
            <summary className="select-none list-none text-xs text-vektrum-blue hover:underline">
              View details
            </summary>
            <div className="mt-2 max-w-xs overflow-auto rounded-xl bg-white/[0.05] border border-white/[0.08] p-2.5">
              <dl className="space-y-1">
                {log.session_id && <DetailRow k="session_id" v={log.session_id} mono />}
                {log.ip_address && <DetailRow k="ip_address" v={log.ip_address} mono />}
              </dl>
            </div>
          </details>
        ) : (
          <span className="text-xs text-white/20">&mdash;</span>
        )}
      </td>
    </tr>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px]">
      <dt className="font-medium text-white/40 capitalize whitespace-nowrap">
        {k.replace(/_/g, ' ')}:
      </dt>
      <dd className={`text-white/70 truncate ${mono ? 'font-mono text-[10px]' : ''}`}>
        {v}
      </dd>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page, totalPages, currentParams,
}: {
  page: number;
  totalPages: number;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <nav className="flex items-center justify-between" aria-label="Audit log pagination">
      <p className="text-xs text-white/35">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={buildUrl(currentParams, { page: String(page - 1) })}
            className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildUrl(currentParams, { page: String(page + 1) })}
            className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
