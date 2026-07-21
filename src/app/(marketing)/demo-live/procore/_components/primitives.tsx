/**
 * Procore × Vektrum prototype — shared presentational primitives.
 * Pure/props-driven. Status is always conveyed by icon + text + aria, never color alone.
 */
import {
  CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock, FileCheck2,
  FlaskConical,
} from 'lucide-react';
import type { StatusKind } from '../_lib/types';

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

interface StatusMeta { label: string; Icon: typeof CheckCircle2; cls: string; aria: string; }

export const STATUS: Record<StatusKind, StatusMeta> = {
  passed:         { label: 'Passed',         Icon: CheckCircle2,  cls: 'text-vektrum-green border-vektrum-green-border bg-vektrum-green-bg',   aria: 'Passed' },
  blocked:        { label: 'Blocked',        Icon: XCircle,       cls: 'text-vektrum-red border-vektrum-red-border bg-vektrum-red-bg',         aria: 'Blocked — does not currently satisfy the selected lender policy' },
  warning:        { label: 'Warning',        Icon: AlertTriangle, cls: 'text-vektrum-amber border-vektrum-amber-border bg-vektrum-amber-bg',   aria: 'Warning' },
  not_applicable: { label: 'Not applicable', Icon: MinusCircle,   cls: 'text-vektrum-muted border-vektrum-border bg-vektrum-surface-alt',       aria: 'Not applicable — not evaluated for this rail' },
  pending:        { label: 'Pending',        Icon: Clock,         cls: 'text-vektrum-muted border-vektrum-border bg-vektrum-surface-alt',       aria: 'Pending' },
  issued:         { label: 'Issued',         Icon: FileCheck2,    cls: 'text-vektrum-blue border-vektrum-blue-border bg-vektrum-blue-subtle',   aria: 'Issued — simulated' },
  confirmed:      { label: 'Confirmed',      Icon: CheckCircle2,  cls: 'text-vektrum-green border-vektrum-green-border bg-vektrum-green-bg',   aria: 'Confirmed — simulated' },
  simulated:      { label: 'Simulated',      Icon: FlaskConical,  cls: 'text-vektrum-muted border-vektrum-border bg-vektrum-surface-alt',       aria: 'Simulated' },
};

export function StatusBadge({ status, labelOverride }: { status: StatusKind; labelOverride?: string }) {
  const m = STATUS[status];
  const { Icon } = m;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.cls}`}
      role="status"
    >
      <Icon size={13} aria-hidden={true} />
      <span>{labelOverride ?? m.label}</span>
      <span className="sr-only">{m.aria}</span>
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-vektrum-blue">
      {children}
    </p>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-vektrum-border bg-vektrum-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-vektrum-faint">{k}</dt>
      <dd className="text-[14px] font-semibold text-vektrum-text">{v}</dd>
    </div>
  );
}

/** Visibly-inert mock reference chip (DEMO-/MOCK-/SIM-). */
export function InertRef({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-vektrum-surface-alt px-1.5 py-0.5 font-mono text-[12px] text-vektrum-muted">
      {children}
    </code>
  );
}
