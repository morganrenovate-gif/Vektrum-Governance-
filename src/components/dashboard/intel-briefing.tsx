import { Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function IntelBriefing() {
  return (
    <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.05] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/15">
          <Calendar size={16} className="text-vektrum-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            Weekly Portfolio Briefing
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/50">
            Stay ahead of your portfolio — review open draws, capital deployment pace,
            dispute risk, and contractor payout health from one place.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-vektrum-blue hover:text-white/70 transition-colors"
          >
            View portfolio summary
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
