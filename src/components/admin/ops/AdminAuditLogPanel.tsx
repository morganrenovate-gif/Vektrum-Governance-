"use client";

import { useState, useCallback, useTransition } from "react";
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatAuditTimestamp } from "@/lib/engine/audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminAuditEntry {
  id:                      string;
  event_sequence:          number;
  entity_type:             string;
  entity_id:               string;
  action:                  string;
  actor_id:                string | null;
  actor_role:              string | null;
  actor_name:              string | null;
  actor_email:             string | null;
  system_source:           string | null;
  ip_address:              string | null;
  created_at:              string;
  admin_justification:     string;
  authorization_reference: string | null;
  reviewed_by:             string | null;
  reviewed_at:             string | null;
  old_values:              Record<string, unknown> | null;
  new_values:              Record<string, unknown> | null;
  metadata:                Record<string, unknown> | null;
}

interface AdminAuditLogPanelProps {
  initialData: {
    entries:           AdminAuditEntry[];
    total:             number;
    unreviewed_total:  number;
  };
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface Filters {
  action:      string;
  unreviewed:  boolean;
  start_date:  string;
  end_date:    string;
}

const DEFAULT_FILTERS: Filters = {
  action:     "",
  unreviewed: false,
  start_date: "",
  end_date:   "",
};

// ─── Panel ────────────────────────────────────────────────────────────────────

export function AdminAuditLogPanel({ initialData }: AdminAuditLogPanelProps) {
  const [entries, setEntries]               = useState<AdminAuditEntry[]>(initialData.entries);
  const [total, setTotal]                   = useState(initialData.total);
  const [unreviewedTotal, setUnreviewedTotal] = useState(initialData.unreviewed_total);
  const [filters, setFilters]               = useState<Filters>(DEFAULT_FILTERS);
  const [offset, setOffset]                 = useState(0);
  const [loading, startTransition]          = useTransition();
  const [reviewingId, setReviewingId]       = useState<string | null>(null);
  const [reviewError, setReviewError]       = useState<string | null>(null);
  const [expandedId, setExpandedId]         = useState<string | null>(null);

  const LIMIT = 20;

  // ── Fetch entries ────────────────────────────────────────────────────────
  const fetchEntries = useCallback(
    async (newFilters: Filters, newOffset: number) => {
      startTransition(async () => {
        const params = new URLSearchParams();
        if (newFilters.action)    params.set("action",     newFilters.action);
        if (newFilters.unreviewed) params.set("unreviewed", "true");
        if (newFilters.start_date) params.set("start_date", newFilters.start_date);
        if (newFilters.end_date)   params.set("end_date",   newFilters.end_date);
        params.set("limit",  String(LIMIT));
        params.set("offset", String(newOffset));

        try {
          const res  = await fetch(`/api/admin/audit-log?${params.toString()}`);
          const json = await res.json() as { entries: AdminAuditEntry[]; total: number };
          if (res.ok) {
            setEntries(json.entries ?? []);
            setTotal(json.total ?? 0);
          }
        } catch { /* non-fatal — keep existing data */ }

        // Refresh unreviewed count separately
        try {
          const res  = await fetch("/api/admin/audit-log?unreviewed=true&limit=1");
          const json = await res.json() as { total: number };
          if (res.ok) setUnreviewedTotal(json.total ?? 0);
        } catch { /* non-fatal */ }
      });
    },
    [],
  );

  const applyFilters = (newFilters: Filters) => {
    setFilters(newFilters);
    setOffset(0);
    fetchEntries(newFilters, 0);
  };

  // ── Mark reviewed ────────────────────────────────────────────────────────
  const markReviewed = async (entryId: string) => {
    setReviewingId(entryId);
    setReviewError(null);

    try {
      const res  = await fetch(`/api/admin/audit-log/${entryId}/review`, { method: "PATCH" });
      const json = await res.json() as { error?: string; reviewed_by?: string; reviewed_at?: string };

      if (!res.ok) {
        setReviewError(json.error ?? "Review failed — please try again.");
        setReviewingId(null);
        return;
      }

      // Optimistic update
      setEntries(prev =>
        prev.map(e =>
          e.id === entryId
            ? { ...e, reviewed_by: json.reviewed_by ?? "you", reviewed_at: json.reviewed_at ?? new Date().toISOString() }
            : e,
        ),
      );
      setUnreviewedTotal(t => Math.max(0, t - 1));
    } catch {
      setReviewError("Network error — please try again.");
    } finally {
      setReviewingId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Summary strip ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/50">
          <span className="font-semibold text-white">{total}</span>
          total entries
        </div>
        {unreviewedTotal > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400 font-medium">
            <AlertTriangle size={12} />
            {unreviewedTotal} unreviewed
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-400">
            <CheckCircle2 size={12} />
            All reviewed
          </div>
        )}
        <button
          onClick={() => fetchEntries(filters, offset)}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.14] bg-white/[0.06] text-[12px] text-white/75 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-[10px] uppercase tracking-widest text-white/65 font-semibold">Action</span>
          <input
            type="text"
            placeholder="e.g. admin_invite_sent"
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            className="bg-white/[0.02] border border-white/[0.14] rounded-lg px-3 py-1.5 text-[13px] text-white placeholder:text-white/55 focus:outline-none focus:border-vektrum-blue focus:ring-2 focus:ring-vektrum-blue/30"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] uppercase tracking-widest text-white/65 font-semibold">From</span>
          <input
            type="date"
            value={filters.start_date}
            onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
            className="bg-white/[0.02] border border-white/[0.14] rounded-lg px-3 py-1.5 text-[13px] text-white focus:outline-none focus:border-vektrum-blue focus:ring-2 focus:ring-vektrum-blue/30"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] uppercase tracking-widest text-white/65 font-semibold">To</span>
          <input
            type="date"
            value={filters.end_date}
            onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
            className="bg-white/[0.02] border border-white/[0.14] rounded-lg px-3 py-1.5 text-[13px] text-white focus:outline-none focus:border-vektrum-blue focus:ring-2 focus:ring-vektrum-blue/30"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none self-end mb-1.5">
          <input
            type="checkbox"
            checked={filters.unreviewed}
            onChange={e => setFilters(f => ({ ...f, unreviewed: e.target.checked }))}
            className="w-3.5 h-3.5 accent-vektrum-blue"
          />
          <span className="text-[12px] text-white/85">Unreviewed only</span>
        </label>

        <div className="flex gap-2 self-end">
          <button
            onClick={() => applyFilters(filters)}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-vektrum-blue text-white text-[12px] font-medium hover:brightness-110 transition-all disabled:opacity-40"
          >
            Apply
          </button>
          <button
            onClick={() => { setFilters(DEFAULT_FILTERS); applyFilters(DEFAULT_FILTERS); }}
            className="px-3 py-1.5 rounded-lg border border-white/[0.16] bg-white/[0.04] text-[12px] text-white/85 hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Review error banner ─────────────────────────────────────── */}
      {reviewError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-400">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {reviewError}
          <button onClick={() => setReviewError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-8 text-center text-[13px] text-white/70">
          No admin audit log entries match your filters.
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium">Timestamp</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium">Action</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium">Actor</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium">Justification</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium">Review</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/65 font-semibold font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const isUnreviewed = entry.reviewed_by === null;
                const isExpanded   = expandedId === entry.id;
                const isReviewing  = reviewingId === entry.id;

                return (
                  <>
                    <tr
                      key={entry.id}
                      className={[
                        "border-b border-white/[0.05] transition-colors",
                        isUnreviewed ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.05]" : "hover:bg-white/[0.02]",
                        i === entries.length - 1 ? "border-b-0" : "",
                      ].join(" ")}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className="font-mono text-white/75">
                          {formatAuditTimestamp(entry.created_at)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 align-top">
                        <code className="text-vektrum-blue bg-vektrum-blue/[0.12] border border-vektrum-blue/20 px-1.5 py-0.5 rounded text-[11px] font-mono">
                          {entry.action}
                        </code>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 align-top">
                        <div className="text-white/90 font-medium">{entry.actor_name ?? entry.actor_id ?? "—"}</div>
                        {entry.actor_email && (
                          <div className="text-white/65 text-[11px]">{entry.actor_email}</div>
                        )}
                        {entry.ip_address && (
                          <div className="text-white/60 text-[11px] font-mono">{entry.ip_address}</div>
                        )}
                      </td>

                      {/* Justification */}
                      <td className="px-4 py-3 align-top max-w-[260px]">
                        <p className="text-white/80 leading-relaxed line-clamp-2">
                          {entry.admin_justification}
                        </p>
                        {entry.authorization_reference && (
                          <span className="inline-block mt-1 text-[10px] text-white/70 bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded">
                            ref: {entry.authorization_reference}
                          </span>
                        )}
                      </td>

                      {/* Review status / button */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {entry.reviewed_by ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                            <CheckCircle2 size={12} />
                            Reviewed
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                              <Clock size={12} />
                              Pending review
                            </div>
                            <button
                              onClick={() => markReviewed(entry.id)}
                              disabled={isReviewing}
                              className="mt-1 px-2.5 py-1 rounded-md bg-vektrum-blue/10 border border-vektrum-blue/20 text-vektrum-blue text-[11px] font-medium hover:bg-vektrum-blue/20 transition-colors disabled:opacity-40"
                            >
                              {isReviewing ? "Marking…" : "Mark Reviewed"}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Expand toggle */}
                      <td className="px-3 py-3 align-top">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="text-white/65 hover:text-white transition-colors"
                          title={isExpanded ? "Collapse" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${entry.id}-detail`} className="border-b border-white/[0.05]">
                        <td colSpan={6} className="px-4 py-3 bg-white/[0.02]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-white/65 font-semibold mb-1">Entity</p>
                              <p className="text-white/80 font-mono">
                                {entry.entity_type} / {entry.entity_id}
                              </p>
                            </div>
                            {entry.system_source && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-white/65 font-semibold mb-1">Source</p>
                                <p className="text-white/80 font-mono">{entry.system_source}</p>
                              </div>
                            )}
                            {entry.new_values && (
                              <div className="sm:col-span-2">
                                <p className="text-[10px] uppercase tracking-widest text-white/65 font-semibold mb-1">New Values</p>
                                <pre className="text-white/85 bg-black/30 border border-white/[0.06] rounded p-2 overflow-x-auto text-[10px] leading-relaxed">
                                  {JSON.stringify(entry.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.reviewed_at && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-white/65 font-semibold mb-1">Reviewed At</p>
                                <p className="text-white/80">{formatAuditTimestamp(entry.reviewed_at)}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {total > LIMIT && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-white/70">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); fetchEntries(filters, o); }}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] text-[12px] text-white/70 hover:text-white transition-colors disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => { const o = offset + LIMIT; setOffset(o); fetchEntries(filters, o); }}
              disabled={offset + LIMIT >= total || loading}
              className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] text-[12px] text-white/70 hover:text-white transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
