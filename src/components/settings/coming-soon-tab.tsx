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
        <h2 className="font-display text-lg font-bold text-vektrum-text">{title}</h2>
      </div>
      <div className="rounded-xl border border-dashed border-vektrum-border bg-vektrum-surface-alt p-8">
        <div className="flex flex-col items-center text-center gap-3 max-w-sm mx-auto">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-amber-bg">
            <Clock size={20} className="text-vektrum-amber" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-vektrum-text">{title}</p>
            <p className="mt-1.5 text-[13px] text-vektrum-muted leading-relaxed">{description}</p>
          </div>
          <span className="rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-3 py-1 text-[11px] font-semibold text-vektrum-amber">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
