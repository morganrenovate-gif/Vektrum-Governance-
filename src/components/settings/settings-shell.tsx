'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ProfileTab } from './profile-tab'
import { SecurityTab } from './security-tab'
import { StripeTab } from './stripe-tab'
import { ComingSoonTab } from './coming-soon-tab'
import { Bell, User, CreditCard, Shield, AlertTriangle } from 'lucide-react'

interface SettingsShellProps {
  profile: Profile
  userEmail: string
}

type TabId = 'profile' | 'notifications' | 'stripe' | 'security' | 'danger'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  hideForAdmin?: boolean
  comingSoon?: boolean
}

const TABS: Tab[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell,         comingSoon: true },
  { id: 'stripe',        label: 'Stripe Connect',  icon: CreditCard,  hideForAdmin: true },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'danger',        label: 'Danger Zone',   icon: AlertTriangle },
]

export function SettingsShell({ profile, userEmail }: SettingsShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const visibleTabs = TABS.filter((tab) => {
    // Stripe tab: relevant for contractors and funders, not admins
    if (tab.hideForAdmin && profile.role === 'admin') return false
    return true
  })

  return (
    <div className="page-container section">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-vektrum-text">Account Settings</h1>
        <p className="mt-1 text-sm text-vektrum-muted">
          Manage your profile, security, and platform preferences.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Sidebar nav */}
        <nav
          aria-label="Settings sections"
          className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:w-52 lg:flex-shrink-0"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap min-w-fit',
                  isActive
                    ? 'bg-vektrum-blue-subtle text-vektrum-blue border border-vektrum-blue-border'
                    : 'text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt border border-transparent'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={15} aria-hidden="true" />
                {tab.label}
                {tab.comingSoon && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-vektrum-amber bg-vektrum-amber-bg border border-vektrum-amber-border rounded-full px-1.5 py-0.5">
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} userEmail={userEmail} />
          )}
          {activeTab === 'notifications' && (
            <ComingSoonTab
              title="Notifications"
              description="Milestone approval alerts, draw request updates, and funder activity notifications. Get notified the moment action is required on any of your deals."
            />
          )}
          {activeTab === 'stripe' && (
            <StripeTab profile={profile} />
          )}
          {activeTab === 'security' && (
            <SecurityTab />
          )}
          {activeTab === 'danger' && (
            <DangerTab />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────
// Advisor 9 (Skeptical Investor): Self-serve deletion is dangerous without
// proper financial reconciliation. Lock it down with a clear explanation.
// Advisor 6 (Attorney): Audit trail must be preserved — no soft-delete shortcut.

function DangerTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-vektrum-text">Danger Zone</h2>
        <p className="mt-1 text-sm text-vektrum-muted">
          Irreversible account actions. Proceed with caution.
        </p>
      </div>

      <div className="rounded-xl border border-vektrum-red-border bg-vektrum-surface opacity-60 cursor-not-allowed select-none">
        <div className="pointer-events-none p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-vektrum-text">Delete Account</p>
              <p className="mt-1 text-[13px] text-vektrum-muted leading-relaxed max-w-md">
                Account deletion requires all active deals to be fully closed and all funds
                released or returned. This action is irreversible and permanently removes
                your deal history. Contact support to initiate.
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
