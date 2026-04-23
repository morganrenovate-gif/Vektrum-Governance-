// Reusable coming-soon tab placeholder.
// Matches the locked card pattern established across the app.

import { Clock } from 'lucide-react'

interface ComingSoonTabProps {
  title: string
  description: string
}

export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-surface-3 p-8">
        <div className="flex flex-col items-center text-center gap-3 max-w-sm mx-auto">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/[0.08]">
            <Clock size={20} className="text-amber-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">{title}</p>
            <p className="mt-1.5 text-[13px] text-white/55 leading-relaxed">{description}</p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-3 py-1 text-[11px] font-semibold text-amber-400">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
