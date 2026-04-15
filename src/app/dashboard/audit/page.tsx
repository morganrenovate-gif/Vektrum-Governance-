import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";
import { Shield } from "lucide-react";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Admin guard
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: string } | null };

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const entries = (logs ?? []) as AuditLog[];

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

      {/* Table */}
      <Card noPadding>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Actor
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
                    No audit events yet.
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
            <Pagination page={page} totalPages={totalPages} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Audit row ────────────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const actionVariant = (action: string) => {
    if (action.includes("release")) return "success" as const;
    if (action.includes("dispute") || action.includes("reject"))
      return "error" as const;
    if (action.includes("approve")) return "info" as const;
    if (action.includes("fund")) return "info" as const;
    return "default" as const;
  };

  return (
    <tr className="hover:bg-vektrum-surface-alt transition-colors">
      {/* Timestamp */}
      <td className="whitespace-nowrap px-4 py-3 font-numeric tabular-nums text-xs text-vektrum-muted">
        {formatDate(log.created_at)}
      </td>

      {/* Entity */}
      <td className="px-4 py-3">
        <div className="text-xs">
          <span className="font-medium text-vektrum-text">{log.entity_type}</span>
          <br />
          <span className="font-mono text-vektrum-faint text-[10px]">
            {log.entity_id.slice(0, 8)}…
          </span>
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
      </td>

      {/* Actor */}
      <td className="px-4 py-3 text-xs text-vektrum-text">
        {log.actor ? (
          <span>
            {log.actor.full_name}
            <br />
            <span className="text-vektrum-faint">{log.actor.email}</span>
          </span>
        ) : (
          <span className="text-vektrum-faint">System</span>
        )}
      </td>

      {/* Details — expandable JSON */}
      <td className="px-4 py-3">
        {log.details ? (
          <details className="group cursor-pointer">
            <summary className="select-none list-none text-xs text-vektrum-blue hover:underline">
              View details
            </summary>
            <pre className="mt-2 max-w-xs overflow-auto rounded-md bg-vektrum-surface-alt border border-vektrum-border p-2 text-[10px] text-vektrum-text">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-xs text-vektrum-faint">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
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
          <a
            href={`?page=${page - 1}`}
            className="rounded-md border border-vektrum-border bg-vektrum-surface px-3 py-1.5 text-xs font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-colors"
          >
            Previous
          </a>
        )}
        {page < totalPages && (
          <a
            href={`?page=${page + 1}`}
            className="rounded-md border border-vektrum-border bg-vektrum-surface px-3 py-1.5 text-xs font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-colors"
          >
            Next
          </a>
        )}
      </div>
    </nav>
  );
}
