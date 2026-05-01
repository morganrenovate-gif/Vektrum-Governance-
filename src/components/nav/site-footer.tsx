/**
 * SiteFooter — shared public footer used by both the marketing layout
 * and the app (dashboard) layout.
 *
 * This component has zero auth dependencies. It must NOT import:
 *   - @/lib/supabase/server
 *   - cookies() / headers()
 *   - any auth-state-reading helper
 *
 * That contract is enforced by tests/marketing-layout-purity.test.ts
 * because this component is rendered inside the (marketing) tree.
 */

import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-surface-2">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <VektrumWordmark markSize={24} showTagline />
            <p className="text-[13px] leading-relaxed text-white/75 max-w-xs">
              Construction payment governance. Funds release only when work is verified.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-8 sm:gap-16">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                Platform
              </span>
              <Link href="/auth/signup" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Get started
              </Link>
              <Link href="/auth/login" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Sign in
              </Link>
              <Link href="/pricing" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Pricing
              </Link>
              <Link
                href={BOOK_CALL_URL}
                {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Book a call
                {BOOK_CALL_EXTERNAL && (
                  <span className="sr-only"> (opens in a new tab)</span>
                )}
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                For Funders &amp; Contractors
              </span>
              <Link href="/funders" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Funders
              </Link>
              <Link href="/contractors" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Contractors
              </Link>
              <Link
                href="/founders"
                className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Founders
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                Company
              </span>
              <Link href="/about" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                About
              </Link>
              <Link href="/careers" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Careers
              </Link>
              <Link href="/resources" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Resources
              </Link>
              <Link href="/help" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Help / FAQ
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                Legal
              </span>
              <Link href="/terms" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Privacy Policy
              </Link>
              <Link href="/security" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Security
              </Link>
              <Link href="/contact" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                Contact
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-[12px] text-white/75 flex-shrink-0">
            &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
          </p>
          <p className="text-[11px] text-white/65 leading-relaxed sm:max-w-lg sm:text-right">
            Vektrum is authorization infrastructure — not a bank, lender, or money transmitter.
            Vektrum does not hold or custody funds. Funds are held by Stripe (Stripe Connect deals)
            or the funder&apos;s institutional payment partner (external-rail deals).
            Data encrypted in transit and at rest.
          </p>
        </div>
      </div>
    </footer>
  )
}
