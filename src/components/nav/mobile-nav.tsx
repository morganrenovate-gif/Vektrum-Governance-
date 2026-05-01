'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut, Settings, FileText, Shield, Briefcase, FileBox, DollarSign, HelpCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'

interface MobileNavProps {
  isLoggedIn?: boolean
  userName?: string | null
  userEmail?: string | null
  userRole?: string | null
}

export function MobileNav({ isLoggedIn = false, userName, userEmail, userRole }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Hold a ref to the hamburger button so we can return focus when the drawer
  // closes via Escape, backdrop click, or route change. Required for keyboard
  // and screen-reader users — focus must not be left in a hidden region.
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  // Tracks whether the drawer was just closed so we know whether to restore
  // focus. Avoids stealing focus on the initial server render.
  const wasOpen = useRef(false)

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Restore focus to the trigger when the drawer transitions from open → closed.
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close on Escape — keyboard accessibility for the drawer
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  // Get initials for mobile avatar
  function getInitials() {
    if (userName && userName.trim()) {
      const parts = userName.trim().split(/\s+/)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return parts[0][0].toUpperCase()
    }
    if (userEmail) return userEmail[0].toUpperCase()
    return 'U'
  }

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex sm:hidden items-center justify-center w-9 h-9 rounded-lg text-white/55 hover:text-white hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        aria-haspopup="menu"
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>

      {/* Backdrop — only when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-vektrum-canvas/80 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Drawer — always rendered in the DOM so the `aria-controls`
        target exists in server-rendered HTML at load. We hide it via
        the `hidden` attribute when closed (so AT correctly reports
        collapsed state) instead of conditionally rendering.
      */}
      <div
        id="mobile-nav-menu"
        hidden={!open}
        className="fixed inset-x-0 top-[65px] z-50 sm:hidden border-b border-white/[0.08] bg-surface-2 shadow-xl"
      >
        {open && (
          <nav className="flex flex-col px-4 py-4 gap-1" aria-label="Main menu">

              {isLoggedIn ? (
                // ── Logged-in drawer ────────────────────────────────────────
                <>
                  {/* User identity row */}
                  <div className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-vektrum-blue text-[13px] font-bold text-white select-none">
                      {getInitials()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">
                        {userName ?? 'Your account'}
                      </p>
                      <p className="text-[11px] text-white/55 truncate">
                        {userEmail ?? ''}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Dashboard
                  </Link>

                  {userRole === 'contractor' && (
                    <>
                      <Link
                        href="/dashboard/deals/new"
                        className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                        onClick={() => setOpen(false)}
                      >
                        <Briefcase size={16} aria-hidden="true" />
                        Deals
                      </Link>
                      <Link
                        href="/dashboard/contractor/documents"
                        className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                        onClick={() => setOpen(false)}
                      >
                        <FileBox size={16} aria-hidden="true" />
                        Documents
                      </Link>
                      <Link
                        href="/dashboard/contractor/payments"
                        className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                        onClick={() => setOpen(false)}
                      >
                        <DollarSign size={16} aria-hidden="true" />
                        Payments
                      </Link>
                    </>
                  )}

                  <Link
                    href="/dashboard/audit"
                    className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    <FileText size={16} aria-hidden="true" />
                    Audit Log
                  </Link>

                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    <Settings size={16} aria-hidden="true" />
                    Account Settings
                  </Link>

                  {userRole === 'admin' && (
                    <Link
                      href="/dashboard/admin"
                      className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                      onClick={() => setOpen(false)}
                    >
                      <Shield size={16} className="text-blue-400" aria-hidden="true" />
                      Admin Dashboard
                    </Link>
                  )}

                  <Link
                    href="/contact"
                    className="flex items-center gap-3 min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/80 hover:text-white hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                    onClick={() => setOpen(false)}
                  >
                    <HelpCircle size={16} aria-hidden="true" />
                    Support
                  </Link>

                  <div className="mt-2 pt-2 border-t border-white/[0.08]">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex items-center gap-3 w-full min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-red-400 hover:bg-red-500/[0.08] transition-all disabled:opacity-50"
                    >
                      <LogOut size={16} aria-hidden="true" />
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </>
              ) : (
                // ── Logged-out drawer ───────────────────────────────────────
                <>
                  <Link
                    href="/demo"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    How it works
                  </Link>
                  <Link
                    href="/funders"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Funders
                  </Link>
                  <Link
                    href="/contractors"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Contractors
                  </Link>
                  <Link
                    href="/pricing"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/demo-live"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Demo
                  </Link>
                  <Link
                    href="/resources"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Resources
                  </Link>
                  <Link
                    href="/auth/login"
                    className="flex items-center min-h-[48px] rounded-xl px-4 text-[15px] font-medium text-white/55 hover:text-white hover:bg-surface-3 transition-all"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                  <div className="mt-3 pt-3 border-t border-white/[0.08] flex flex-col gap-2">
                    <Link
                      href={BOOK_CALL_URL}
                      {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="flex items-center justify-center gap-2 min-h-[48px] w-full rounded-xl bg-vektrum-blue text-[15px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
                      onClick={() => setOpen(false)}
                    >
                      Book a call
                      {BOOK_CALL_EXTERNAL && (
                        <span className="sr-only">(opens in a new tab)</span>
                      )}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="flex items-center justify-center min-h-[48px] w-full rounded-xl border border-white/[0.08] bg-surface-3 text-[15px] font-medium text-white/70 hover:text-white hover:border-vektrum-blue/40 transition-all"
                      onClick={() => setOpen(false)}
                    >
                      Start a deal
                    </Link>
                  </div>
                </>
              )}
            </nav>
        )}
      </div>
    </>
  )
}
