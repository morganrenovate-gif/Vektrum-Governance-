import type { Metadata } from 'next'
import { Shield, BookOpen, Server, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security | Vektrum',
  description: 'Vektrum security architecture, SOC2 status, and data protection practices.',
}

export default function SecurityPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em]">
          Security at Vektrum
        </h1>

        {/* SOC2 Status Badge */}
        <div className="mt-8 rounded-xl border border-white/[0.08] bg-surface-2 p-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-vektrum-blue mb-2">
            SOC 2 Type I Audit
          </p>
          <p className="text-[15px] leading-relaxed text-white/55">
              SOC 2 Type I audit in progress. Security documentation available to institutional clients upon request.
          </p>
        </div>

        {/* Security Pillars */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            {
              icon: BookOpen,
              title: 'Immutable Audit Logs',
              desc: 'Every action writes to an append-only cryptographic ledger. Nothing is ever deleted or modified.',
            },
            {
              icon: Shield,
              title: 'Stripe Connect Custody Model',
              desc: 'Funds are held in Stripe Connect managed accounts — not by Vektrum. Vektrum governs disbursement rules; Stripe controls movement.',
            },
            {
              icon: Server,
              title: 'Server-Side Enforcement',
              desc: 'The 10-condition release gate runs server-side, atomically. Client state is display only.',
            },
            {
              icon: Users,
              title: 'Role-Based Access Control',
              desc: 'Funders, contractors, and admins have strictly enforced, non-elevatable permissions.',
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-xl border border-white/[0.08] bg-surface-2 p-6"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-blue/10">
                <pillar.icon size={18} className="text-vektrum-blue" />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-1">{pillar.title}</h3>
              <p className="text-[13px] leading-relaxed text-white/55">{pillar.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[15px] leading-relaxed text-white/55">
          {'For security inquiries, vendor due diligence packages, or penetration test scope discussions: '}
          <a href="mailto:operations@vektrum.io" className="text-vektrum-blue hover:underline">
            operations@vektrum.io
          </a>
        </p>
      </div>
    </div>
  )
}
