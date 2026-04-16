import Link from 'next/link'
import { Landmark, HardHat, Shield } from 'lucide-react'

const roles = [
  {
    role: 'Funder',
    name: 'Sarah Chen',
    company: 'Meridian Capital Partners',
    description: 'See portfolio overview, capital deployed, deal action queue, and AI draw review approvals.',
    href: '/demo-live/funder',
    icon: Landmark,
    badge: 'bg-vektrum-blue-subtle text-vektrum-blue border-vektrum-blue-border',
  },
  {
    role: 'Contractor',
    name: 'Marcus Webb',
    company: 'Webb Construction Group',
    description: 'See your deals, milestone status, draw request flow, and payment history.',
    href: '/demo-live/contractor',
    icon: HardHat,
    badge: 'bg-vektrum-green-bg text-vektrum-green border-vektrum-green-border',
  },
  {
    role: 'Admin',
    name: 'Platform Admin',
    company: 'Vektrum',
    description: 'See platform-wide stats, open disputes, user management, and audit log.',
    href: '/demo-live/admin',
    icon: Shield,
    badge: 'bg-vektrum-amber-bg text-vektrum-amber border-vektrum-amber-border',
  },
] as const

export default function DemoLivePage() {
  return (
    <div className="page-container section space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-vektrum-text sm:text-4xl">
          Vektrum &mdash; Interactive Demo
        </h1>
        <p className="mt-3 text-[15px] text-vektrum-muted max-w-md mx-auto">
          Choose a role to explore the platform. All data is simulated.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3 max-w-3xl mx-auto">
        {roles.map((r) => (
          <Link
            key={r.role}
            href={r.href}
            className="group rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
                <r.icon size={16} className="text-vektrum-blue" aria-hidden="true" />
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${r.badge}`}>
                {r.role}
              </span>
            </div>
            <p className="text-[15px] font-semibold text-vektrum-text">{r.name}</p>
            <p className="text-[12px] text-vektrum-faint">{r.company}</p>
            <p className="mt-3 text-[13px] text-vektrum-muted leading-relaxed">
              {r.description}
            </p>
            <div className="mt-4 text-[13px] font-medium text-vektrum-blue group-hover:text-vektrum-blue-hover transition-colors">
              Enter demo &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
