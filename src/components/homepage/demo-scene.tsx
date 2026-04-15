'use client'

import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2,
  Lock,
  AlertCircle,
  FileText,
  Banknote,
  Shield,
  Zap,
} from 'lucide-react'

// ─── Scene 1: Deal Creation ───────────────────────────────────────────────────

function Scene1() {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
        Deal created
      </p>
      {/* Deal header */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue/10">
              <FileText size={15} className="text-vektrum-blue" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-vektrum-text">Riverside Mixed-Use</p>
              <p className="text-[11px] text-vektrum-faint">4 milestones &middot; $2,400,000</p>
            </div>
          </div>
          <span className="rounded-full bg-vektrum-green-bg px-2.5 py-0.5 text-[11px] font-medium text-vektrum-green">
            Active
          </span>
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        {[
          { label: 'Foundation & Site Prep', amount: '$480,000', status: 'released', icon: CheckCircle2, color: 'text-vektrum-green' },
          { label: 'Framing & Structural', amount: '$720,000', status: 'approved', icon: CheckCircle2, color: 'text-vektrum-blue' },
          { label: 'MEP Rough-In', amount: '$680,000', status: 'in progress', icon: Zap, color: 'text-vektrum-amber' },
          { label: 'Finishes & Certificate', amount: '$520,000', status: 'not started', icon: Lock, color: 'text-vektrum-faint' },
        ].map((m) => (
          <div
            key={m.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-vektrum-border-subtle bg-vektrum-surface-alt px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <m.icon size={13} className={`flex-shrink-0 ${m.color}`} />
              <span className="text-[12px] font-medium text-vektrum-text">{m.label}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold tabular-nums text-vektrum-muted">{m.amount}</span>
              <span className="text-[10px] capitalize text-vektrum-faint">{m.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Funded progress */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">Funded</span>
          <span className="text-[12px] font-bold tabular-nums text-vektrum-blue">$2,400,000</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-vektrum-surface-alt">
          <div className="absolute left-0 top-0 h-full w-4/5 rounded-full bg-vektrum-blue" />
          <div className="absolute left-0 top-0 h-full w-[20%] rounded-full bg-vektrum-green" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-vektrum-faint">
          <span>$480K released</span>
          <span>$1,920K remaining</span>
        </div>
      </div>
    </div>
  )
}

// ─── Scene 2: AI Draw Review ──────────────────────────────────────────────────

function Scene2() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
          AI draw review
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-medium text-vektrum-amber">
          Coming soon
        </span>
      </div>

      {/* Milestone under review */}
      <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/5 p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue/15">
            <Shield size={14} className="text-vektrum-blue" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-vektrum-text">MEP Rough-In — $680,000</p>
            <p className="text-[10px] text-vektrum-faint">Submitted for review &middot; 3 documents</p>
          </div>
        </div>

        {/* AI check results */}
        <div className="space-y-2">
          {[
            { label: 'Lien waiver present', pass: true },
            { label: 'Inspection report attached', pass: true },
            { label: 'No open change orders', pass: true },
            { label: 'Contractor Stripe active', pass: true },
          ].map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              <CheckCircle2 size={12} className="flex-shrink-0 text-vektrum-green" />
              <span className="text-[12px] text-vektrum-muted">{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI verdict */}
      <div className="rounded-xl border border-vektrum-green-border bg-vektrum-green-bg p-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
          <div>
            <p className="text-[13px] font-semibold text-vektrum-green">Pre-cleared for funder review</p>
            <p className="mt-1 text-[12px] text-vektrum-muted">
              All documents verified. No risk flags. Funder can approve immediately.
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-vektrum-faint text-center">
        AI pre-clearance reduces funder review time by an estimated 60%
      </p>
    </div>
  )
}

// ─── Scene 3: Dispute Isolation ───────────────────────────────────────────────

function Scene3() {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
        $15K dispute &mdash; $9M project unaffected
      </p>

      {/* Project total */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-3.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-vektrum-text">Harbor Logistics Center</span>
        <span className="text-[13px] font-bold tabular-nums text-vektrum-text">$9,000,000</span>
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        {/* Released milestone */}
        <div className="rounded-lg border border-vektrum-green-border bg-vektrum-green-bg px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-vektrum-green flex-shrink-0" />
            <span className="text-[12px] font-medium text-vektrum-text">Site Preparation</span>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tabular-nums text-vektrum-green">$320,000 released</p>
          </div>
        </div>

        {/* Disputed milestone — isolated */}
        <div className="rounded-lg border border-vektrum-red-border bg-vektrum-red-bg px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} className="text-vektrum-red flex-shrink-0" />
              <span className="text-[12px] font-medium text-vektrum-text">Concrete Sub-grade</span>
            </div>
            <span className="rounded-full bg-vektrum-red/10 px-2 py-0.5 text-[10px] font-medium text-vektrum-red">
              Disputed
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-vektrum-red font-semibold">$15,000 locked</p>
            <p className="text-[10px] text-vektrum-faint">Isolated &mdash; does not block others</p>
          </div>
        </div>

        {/* Other milestones proceeding */}
        {[
          { label: 'Structural Steel', amount: '$2,180,000', pct: 100 },
          { label: 'MEP Systems', amount: '$1,640,000', pct: 75 },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-vektrum-border bg-vektrum-surface px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Banknote size={13} className="text-vektrum-blue flex-shrink-0" />
                <span className="text-[12px] font-medium text-vektrum-text">{m.label}</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-vektrum-blue">{m.amount}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-vektrum-surface-alt">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-vektrum-blue"
                style={{ width: `${m.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Key insight */}
      <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/5 px-4 py-3">
        <p className="text-[12px] font-semibold text-vektrum-blue">
          $8,985,000 continues flowing
        </p>
        <p className="mt-0.5 text-[11px] text-vektrum-muted">
          The $15K dispute is isolated to its milestone. Every other payment proceeds on schedule.
        </p>
      </div>
    </div>
  )
}

// ─── Demo Scene Tabs ──────────────────────────────────────────────────────────

const SCENES = [
  {
    id: 1,
    label: 'Deal Creation',
    sublabel: 'Set up and fund a deal',
    Component: Scene1,
  },
  {
    id: 2,
    label: 'AI Draw Review',
    sublabel: 'Pre-clearance before funder sees it',
    Component: Scene2,
  },
  {
    id: 3,
    label: 'Dispute Isolation',
    sublabel: '$15K dispute, $9M unaffected',
    Component: Scene3,
  },
]

export function DemoScene() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (paused) return
    intervalRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % SCENES.length)
    }, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [paused])

  const handleTabClick = (i: number) => {
    setActive(i)
    setPaused(true)
  }

  const ActiveScene = SCENES[active].Component

  return (
    <div
      className="rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-xl shadow-vektrum-blue/5 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Tab bar */}
      <div className="flex border-b border-vektrum-border bg-vektrum-surface-alt">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => handleTabClick(i)}
            className={[
              'flex-1 px-3 py-3 text-left transition-colors',
              active === i
                ? 'border-b-2 border-vektrum-blue bg-vektrum-surface'
                : 'hover:bg-vektrum-surface',
            ].join(' ')}
          >
            <p
              className={[
                'text-[12px] font-semibold truncate',
                active === i ? 'text-vektrum-blue' : 'text-vektrum-muted',
              ].join(' ')}
            >
              Scene {s.id}
            </p>
            <p className="text-[10px] text-vektrum-faint truncate">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Scene label */}
      <div className="border-b border-vektrum-border-subtle bg-vektrum-surface px-5 py-3">
        <p className="text-[13px] font-semibold text-vektrum-text">{SCENES[active].label}</p>
        <p className="text-[11px] text-vektrum-faint">{SCENES[active].sublabel}</p>
      </div>

      {/* Active scene content */}
      <div className="p-5">
        <ActiveScene />
      </div>

      {/* Auto-cycle indicator */}
      {!paused && (
        <div className="flex gap-1 justify-center pb-4">
          {SCENES.map((_, i) => (
            <div
              key={i}
              className={[
                'h-1 rounded-full transition-all duration-300',
                i === active ? 'w-6 bg-vektrum-blue' : 'w-1.5 bg-vektrum-border',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
