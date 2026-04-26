'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings, FileText, ChevronDown, Shield, Briefcase, FileBox, DollarSign, HelpCircle } from 'lucide-react'

interface UserMenuProps {
  name: string | null
  email: string | null
  role?: string | null
}

function getInitials(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return 'U'
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const initials = getInitials(name, email)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
    }
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-surface-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vektrum-blue text-[12px] font-bold text-white select-none">
          {initials}
        </div>
        <ChevronDown
          size={13}
          className={`text-white/55 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="User actions"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/[0.08] bg-surface-2 shadow-lg z-50 overflow-hidden"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <p className="text-[13px] font-semibold text-white truncate">
              {name ?? 'Your account'}
            </p>
            <p className="text-[11px] text-white/55 truncate mt-0.5">
              {email ?? ''}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
            >
              Dashboard
            </Link>

            {role === 'contractor' && (
              <>
                <Link
                  href="/dashboard/deals/new"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
                >
                  <Briefcase size={14} className="text-white/55" aria-hidden="true" />
                  Deals
                </Link>
                <Link
                  href="/dashboard/contractor/documents"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
                >
                  <FileBox size={14} className="text-white/55" aria-hidden="true" />
                  Documents
                </Link>
                <Link
                  href="/dashboard/contractor/payments"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
                >
                  <DollarSign size={14} className="text-white/55" aria-hidden="true" />
                  Payments
                </Link>
              </>
            )}

            <Link
              href="/dashboard/audit"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
            >
              <FileText size={14} className="text-white/55" aria-hidden="true" />
              Audit Log
            </Link>

            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
            >
              <Settings size={14} className="text-white/75" aria-hidden="true" />
              Account Settings
            </Link>

            <Link
              href="/contact"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
            >
              <HelpCircle size={14} className="text-white/75" aria-hidden="true" />
              Support
            </Link>

            {role === 'admin' && (
              <Link
                href="/dashboard/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-surface-3 transition-colors"
              >
                <Shield size={14} className="text-blue-400" aria-hidden="true" />
                Admin Dashboard
              </Link>
            )}
          </div>

          {/* Divider + sign out */}
          <div className="border-t border-white/[0.05] py-1">
            <button
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/[0.08] transition-colors disabled:opacity-50"
            >
              <LogOut size={14} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
