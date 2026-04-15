import { Calendar } from 'lucide-react'

export function IntelBriefing() {
  return (
    <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/15">
          <Calendar size={16} className="text-vektrum-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-vektrum-text">
              Weekly Intelligence Briefing
            </p>
            <span className="inline-flex items-center rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2 py-0.5 text-[10px] font-medium text-vektrum-amber flex-shrink-0">
              Coming soon
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-vektrum-muted">
            Your weekly portfolio briefing is being prepared. When live, you&rsquo;ll receive:
            milestone approvals needed, capital deployment pace, dispute risk trends, and
            contractor Stripe health — all in one digest.
          </p>
        </div>
      </div>
    </div>
  )
}
