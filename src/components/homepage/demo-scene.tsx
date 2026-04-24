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
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65">
        Deal created
      </p>
      {/* Deal header */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue/10">
              <FileText size={15} className="text-vektrum-blue" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Riverside Mixed-Use</p>
              <p className="text-[11px] text-white/65">4 milestones &middot; $2,400,000</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
            Active
          </span>
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        {[
          { label: 'Foundation & Site Prep', amount: '$480,000', status: 'released', icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Framing & Structural', amount: '$720,000', status: 'approved', icon: CheckCircle2, color: 'text-vektrum-blue' },
          { label: 'MEP Rough-In', amount: '$680,000', status: 'in progress', icon: Zap, color: 'text-amber-400' },
          { label: 'Finishes & Certificate', amount: '$520,000', status: 'not started', icon: Lock, color: 'text-white/65' },
        ].map((m) => (
          <div
            key={m.label}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-surface-3 px-3 py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <m.icon size={13} className={`flex-shrink-0 ${m.color}`} />
              <span className="text-[11px] sm:text-[12px] font-medium text-white truncate">{m.label}</span>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[11px] font-semibold tabular-nums text-white/55">{m.amount}</span>
              <span className="text-[10px] capitalize text-white/65">{m.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Funded progress */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">Funded</span>
          <span className="text-[12px] font-bold tabular-nums text-vektrum-blue">$2,400,000</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div className="absolute left-0 top-0 h-full w-4/5 rounded-full bg-vektrum-blue" />
          <div className="absolute left-0 top-0 h-full w-[20%] rounded-full bg-vektrum-green" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-white/65">
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65">
          AI draw review
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-blue/20 bg-vektrum-blue/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-vektrum-blue">
          Live
        </span>
      </div>

      {/* Milestone under review */}
      <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/5 p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue/15">
            <Shield size={14} className="text-vektrum-blue" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white">MEP Rough-In — $680,000</p>
            <p className="text-[10px] text-white/65">Submitted for review &middot; 3 documents</p>
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
              <CheckCircle2 size={12} className="flex-shrink-0 text-emerald-400" />
              <span className="text-[12px] text-white/55">{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI verdict */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-400">Pre-cleared for funder review</p>
            <p className="mt-1 text-[12px] text-white/55">
              All documents verified. No risk flags. Funder can approve immediately.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Scene 3: Dispute Isolation ───────────────────────────────────────────────

function Scene3() {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65">
        $15K dispute &mdash; $9M project unaffected
      </p>

      {/* Project total */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-3.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-white">Harbor Logistics Center</span>
        <span className="text-[13px] font-bold tabular-nums text-white">$9,000,000</span>
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        {/* Released milestone */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            <span className="text-[12px] font-medium text-white">Site Preparation</span>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tabular-nums text-emerald-400">$320,000 released</p>
          </div>
        </div>

        {/* Disputed milestone — isolated */}
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <span className="text-[12px] font-medium text-white">Concrete Sub-grade</span>
            </div>
            <span className="rounded-full bg-vektrum-red/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
              Disputed
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-red-400 font-semibold">$15,000 locked</p>
            <p className="text-[10px] text-white/65">Isolated &mdash; does not block others</p>
          </div>
        </div>

        {/* Other milestones proceeding */}
        {[
          { label: 'Structural Steel', amount: '$2,180,000', pct: 100 },
          { label: 'MEP Systems', amount: '$1,640,000', pct: 75 },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-white/[0.08] bg-surface-2 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Banknote size={13} className="text-vektrum-blue flex-shrink-0" />
                <span className="text-[12px] font-medium text-white">{m.label}</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-vektrum-blue">{m.amount}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
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
        <p className="mt-0.5 text-[11px] text-white/55">
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
      className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-xl shadow-vektrum-blue/5 overflow-hidden min-h-[720px] sm:min-h-[760px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.08] bg-surface-3">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => handleTabClick(i)}
            className={[
              'flex-1 px-2 sm:px-3 py-3 min-h-[52px] text-left transition-colors',
              active === i
                ? 'border-b-2 border-vektrum-blue bg-surface-2'
                : 'hover:bg-surface-2',
            ].join(' ')}
          >
            <p
              className={[
                'text-[11px] sm:text-[12px] font-semibold',
                active === i ? 'text-vektrum-blue' : 'text-white/55',
              ].join(' ')}
            >
              {s.label}
            </p>
            <p className="text-[10px] text-white/65 leading-snug hidden sm:block">{s.sublabel}</p>
          </button>
        ))}
      </div>

      {/* Scene label */}
      <div className="border-b border-white/[0.05] bg-surface-2 px-5 py-3">
        <p className="text-[13px] font-semibold text-white">{SCENES[active].label}</p>
        <p className="text-[11px] text-white/65">{SCENES[active].sublabel}</p>
      </div>

      {/* Active scene content */}
      <div className="p-5 min-h-[420px]">
        <ActiveScene />
      </div>

      {/* Auto-cycle indicator */}
      <div className="flex gap-1 justify-center pb-4" style={{ opacity: paused ? 0 : 1 }}>
        {SCENES.map((_, i) => (
          <div
            key={i}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === active ? 'w-6 bg-vektrum-blue' : 'w-1.5 bg-white/[0.08]',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
