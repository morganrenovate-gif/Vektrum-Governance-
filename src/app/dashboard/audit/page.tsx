import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";
import { Shield, Search, X } from "lucide-react";

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
  deal_lifecycle: ["deal_created", "deal_updated", "deal_funded"],
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
    "payment_confirmed",
    "stripe_account_created",
    "stripe_account_updated",
    "stripe_account_link_generated",
  ],
  admin: ["admin_role_granted", "admin_invite_sent"],
  disputes: [
    "dispute_opened",
    "dispute_escalated",
    "dispute_resolved_release",
    "dispute_resolved_write_off",
  ],
  ai: ["ai_draw_review"],
};

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "user_activity", label: "User Activity" },
  { key: "deal_lifecycle", label: "Deal Lifecycle" },
  { key: "milestone_activity", label: "Milestones" },
  { key: "payments", label: "Payments" },
  { key: "admin", label: "Admin" },
  { key: "disputes", label: "Disputes" },
  { key: "ai", label: "AI" },
];

// ─── Human-readable action labels ────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  funder_signed_up: "Funder Signed Up",
  contractor_signed_up: "Contractor Signed Up",
  admin_signed_up: "Admin Signed Up",
  user_signed_up: "User Signed Up",
  admin_role_granted: "Admin Role Granted",
  admin_invite_sent: "Admin Invite Sent",
  invite_created: "Funder Invite Created",
  funder_assigned: "Funder Assigned to Deal",
  deal_created: "Deal Created",
  deal_updated: "Deal Updated",
  deal_funded: "Deal Funded",
  milestone_created: "Milestone Created",
  status_transitioned: "Milestone Status Changed",
  document_uploaded: "Document Uploaded",
  change_order_created: "Change Order Created",
  amount_adjusted_via_change_order: "Amount Adjusted (Change Order)",
  change_order_approved: "Change Order Approved",
  change_order_rejected: "Change Order Rejected",
  funds_released: "Funds Released",
  release_failed: "Release Failed",
  payment_confirmed: "Payment Confirmed",
  stripe_account_created: "Stripe Account Created",
  stripe_account_updated: "Stripe Account Updated",
  stripe_account_link_generated: "Stripe Account Link Generated",
  dispute_opened: "Dispute Opened",
  dispute_escalated: "Dispute Escalated",
  dispute_resolved_release: "Dispute Resolved (Release)",
  dispute_resolved_write_off: "Dispute Resolved (Write-off)",
  ai_draw_review: "AI Draw Review",
};

// ─── Action badge variant ────────────────────────────────────────────────────

function actionVariant(action: string) {
  if (action.includes("release") || action.includes("funded") || action.includes("approved") || action.includes("signed_up"))
    return "success" as const;
  if (action.includes("dispute") || action.includes("reject") || action.includes("failed"))
    return "error" as const;
  if (action.includes("ai_draw")) return "info" as const;
  return "default" as const;
}

// ─── Actor role badge ────────────────────────────────────────────────────────

function roleBadgeClasses(role: string | null | undefined): string {
  switch (role) {
    case "contractor":
      return "bg-vektrum-amber-bg text-vektrum-amber";
    case "funder":
      return "bg-vektrum-blue-subtle text-vektrum-blue";
    case "admin":
      return "bg-vektrum-surface-alt text-vektrum-text";
    default:
      return "";
  }
}

// ─── URL builder (preserves all params) ──────────────────────────────────────

function buildUrl(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

// ─── UUID check ──────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    category?: string;
    role?: string;
    action?: string;
    search?: string;
  }>;
}) {
  const {
    page: pageParam,
    category,
    role,
    action,
    search,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Admin guard
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // ── Build query ──────────────────────────────────────────────────────────

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("audit_log")
    .select(
      "*, actor:profiles!audit_log_actor_id_fkey(full_name, role)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  // Category filter
  if (category && category !== "all" && CATEGORY_ACTIONS[category]) {
    query = query.in("action", CATEGORY_ACTIONS[category]);
  }

  // Role filter
  if (role) {
    query = query.eq("actor_role", role);
  }

  // Exact action filter (deep-link drill-down)
  if (action) {
    query = query.eq("action", action);
  }

  // Search filter
  if (search && search.trim()) {
    const term = search.trim();
    if (UUID_RE.test(term)) {
      query = query.or(`action.ilike.%${term}%,entity_id.eq.${term}`);
    } else {
      query = query.ilike("action", `%${term}%`);
    }
  }

  query = query.range(from, to);

  const { data: logs, count } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const entries = (logs ?? []) as AuditLog[];

  // Current filter state for URL building
  const currentParams: Record<string, string | undefined> = {
    category,
    role,
    action,
    search,
  };

  const hasFilters = !!(
    (category && category !== "all") ||
    role ||
    action ||
    search
  );

  return (
    <div className="page-container section space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-vektrum-text">
            Audit Log
          </h1>
          <p className="text-sm text-vektrum-muted">
            All platform events — newest first
            {count !== null && ` · ${count.toLocaleString()} total`}
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORY_TABS.map((tab) => {
          const isActive =
            tab.key === "all"
              ? !category || category === "all"
              : category === tab.key;
          return (
            <Link
              key={tab.key}
              href={buildUrl(currentParams, {
                category: tab.key === "all" ? undefined : tab.key,
                page: undefined,
              })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-vektrum-blue text-white"
                  : "bg-vektrum-surface-alt text-vektrum-muted hover:bg-vektrum-border-subtle hover:text-vektrum-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Filter bar */}
      <form className="flex flex-wrap items-center gap-3">
        {/* Preserve category and action in hidden inputs */}
        {category && category !== "all" && (
          <input type="hidden" name="category" value={category} />
        )}
        {action && <input type="hidden" name="action" value={action} />}

        {/* Role dropdown */}
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-9 rounded-lg border border-vektrum-border bg-vektrum-surface px-3 pr-8 text-xs text-vektrum-text focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
        >
          <option value="">All Roles</option>
          <option value="contractor">Contractor</option>
          <option value="funder">Funder</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-vektrum-faint"
          />
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search action or entity ID..."
            className="h-9 w-64 rounded-lg border border-vektrum-border bg-vektrum-surface pl-8 pr-3 text-xs text-vektrum-text placeholder:text-vektrum-faint focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
          />
        </div>

        <button
          type="submit"
          className="h-9 rounded-lg bg-vektrum-blue px-3 text-xs font-medium text-white hover:bg-vektrum-blue-hover transition-colors"
        >
          Apply
        </button>

        {/* Clear filters */}
        {hasFilters && (
          <Link
            href="?"
            className="inline-flex items-center gap-1 text-xs text-vektrum-muted hover:text-vektrum-blue transition-colors"
          >
            <X size={12} />
            Clear filters
          </Link>
        )}
      </form>

      {/* Table */}
      <Card noPadding>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-vektrum-faint"
                  >
                    No audit events match your filters.
                  </td>
                </tr>
              ) : (
                entries.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-vektrum-border bg-vektrum-surface-alt px-4 py-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              currentParams={currentParams}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Audit row ────────────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const displayRole = log.actor_role ?? log.actor?.role ?? null;

  return (
    <tr className="hover:bg-vektrum-surface-alt transition-colors">
      {/* Timestamp */}
      <td className="whitespace-nowrap px-4 py-3 font-numeric tabular-nums text-xs text-vektrum-muted">
        {formatDate(log.created_at)}
      </td>

      {/* Actor */}
      <td className="px-4 py-3 text-xs text-vektrum-text">
        {log.actor ? (
          <div className="flex items-center gap-1.5">
            <span>{log.actor.full_name ?? "Unknown"}</span>
            {displayRole && (
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClasses(displayRole)}`}
              >
                {displayRole}
              </span>
            )}
          </div>
        ) : displayRole === "system" || !log.actor_id ? (
          <span className="italic text-vektrum-faint">System</span>
        ) : (
          <span className="text-vektrum-faint">Unknown</span>
        )}
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <Badge variant={actionVariant(log.action)}>
          {ACTION_LABELS[log.action] ?? log.action}
        </Badge>
      </td>

      {/* Entity */}
      <td className="px-4 py-3">
        <div className="text-xs">
          <span className="font-medium text-vektrum-text">
            {log.entity_type}
          </span>
          <br />
          <span className="font-mono text-vektrum-faint text-[10px]">
            {log.entity_id.slice(0, 8)}...
          </span>
        </div>
      </td>

      {/* Details */}
      <td className="px-4 py-3">
        {log.metadata ? (
          <details className="group cursor-pointer">
            <summary className="select-none list-none text-xs text-vektrum-blue hover:underline">
              View details
            </summary>
            <pre className="mt-2 max-w-xs overflow-auto rounded-md bg-vektrum-surface-alt border border-vektrum-border p-2 text-[10px] text-vektrum-text">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-xs text-vektrum-faint">&mdash;</span>
        )}
      </td>
    </tr>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  currentParams,
}: {
  page: number;
  totalPages: number;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <nav
      className="flex items-center justify-between"
      aria-label="Audit log pagination"
    >
      <p className="text-xs text-vektrum-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={buildUrl(currentParams, { page: String(page - 1) })}
            className="rounded-md border border-vektrum-border bg-vektrum-surface px-3 py-1.5 text-xs font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-colors"
          >
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildUrl(currentParams, { page: String(page + 1) })}
            className="rounded-md border border-vektrum-border bg-vektrum-surface px-3 py-1.5 text-xs font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-colors"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
