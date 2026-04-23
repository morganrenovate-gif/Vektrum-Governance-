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
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'notifications', label: 'Notifications',  icon: Bell,         comingSoon: true },
  { id: 'stripe',        label: 'Stripe Connect', icon: CreditCard,   hideForAdmin: true },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'danger',        label: 'Danger Zone',    icon: AlertTriangle },
]

export function SettingsShell({ profile, userEmail }: SettingsShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const visibleTabs = TABS.filter((tab) => {
    if (tab.hideForAdmin && profile.role === 'admin') return false
    if (tab.comingSoon) return false
    return true
  })

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page">
        {/* Page header */}
        <div className="pb-7 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-4 w-[3px] rounded-full bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-vektrum-blue">Settings</p>
          </div>
          <h1 className="type-page-title">
            Account Settings
          </h1>
          <p className="mt-2.5 text-[13px] text-white/45 leading-relaxed">
            Manage your profile, security, and platform preferences.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10 pt-2">
          {/* Sidebar nav */}
          <nav
            aria-label="Settings sections"
            className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:w-48 lg:flex-shrink-0"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap min-w-fit text-left',
                    isActive
                      ? 'bg-vektrum-blue/10 text-vektrum-blue border border-vektrum-blue/20'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05] border border-transparent'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={14} aria-hidden="true" />
                  {tab.label}
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
    </div>
  )
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────

function DangerTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-white">Danger Zone</h2>
        <p className="mt-1.5 text-[13px] text-white/45 leading-relaxed">
          Irreversible account actions. Proceed with caution.
        </p>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-surface-2">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Delete Account</p>
              <p className="mt-1.5 text-sm text-white/45 leading-relaxed max-w-md">
                Account deletion requires all active deals to be fully closed and all funds
                released or returned. This action is irreversible and permanently removes
                your deal history.
              </p>
            </div>
            <a
              href="mailto:support@vektrum.io?subject=Account%20Deletion%20Request"
              className="flex-shrink-0 inline-flex items-center min-h-[34px] rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
