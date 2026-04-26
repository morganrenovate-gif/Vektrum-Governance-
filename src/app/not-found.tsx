import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '404 — Page Not Found — Vektrum',
}

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
        404
      </p>
      <h1 className="font-display text-3xl font-bold text-white tracking-tight mb-3">
        Page not found
      </h1>
      <p className="text-[15px] text-white/55 max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.10] hover:border-white/[0.20] transition-all"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to home
      </Link>
    </div>
  )
}
