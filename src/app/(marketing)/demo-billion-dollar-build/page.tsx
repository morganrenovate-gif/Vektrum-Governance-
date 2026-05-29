'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, Brain,
  Shield, ChevronRight, Play, Pause, Lock, User,
  Zap, ArrowRight, Hash, Clock, Award, Layers,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
type AuthState = 'idle' | 'confirming' | 'authorized'

// ── Static demo data ──────────────────────────────────────────────────────────

const EVIDENCE_INITIAL = [
  { name: 'Inspection_Report_Steel_Erection.pdf', ok: true  },
  { name: 'Schedule_of_Values_Harbor_v3.pdf',     ok: true  },
  { name: 'Draw_Request_003.pdf',                 ok: true  },
  { name: 'Site_Photos_Steel_Frame.zip',          ok: true  },
  { name: 'Conditional Lien Waiver',              ok: false, missing: true },
]

const EVIDENCE_RESOLVED = [
  { name: 'Inspection_Report_Steel_Erection.pdf',   ok: true },
  { name: 'Schedule_of_Values_Harbor_v3.pdf',        ok: true },
  { name: 'Draw_Request_003.pdf',                    ok: true },
  { name: 'Site_Photos_Steel_Frame.zip',             ok: true },
  { name: 'LienWaiver_StructuralSteel_WBB.pdf',      ok: true, new: true },
]

const AI_FINDINGS_INITIAL = [
  { text: 'Inspection evidence supports Structural Steel Erection milestone.', type: 'ok' as const },
  { text: 'Schedule of Values matches requested draw amount: $2,180,000.',     type: 'ok' as const },
  { text: 'Contractor account and onboarding are verified.',                    type: 'ok' as const },
  { text: 'Potential blocker: conditional lien waiver not found for this draw.', type: 'warn' as const },
  { text: 'Recommendation: hold release authorization until lien waiver is attached and matched.', type: 'warn' as const },
]

const AI_FINDINGS_RECHECK = [
  { text: 'Lien waiver detected.',                                    type: 'ok' as const },
  { text: 'Waiver references Harbor Logistics Center.',               type: 'ok' as const },
  { text: 'Waiver amount matches Structural Steel Erection draw.',    type: 'ok' as const },
  { text: 'Waiver party matches Webb Construction Group.',            type: 'ok' as const },
  { text: 'No new exception detected.',                               type: 'ok' as const },
]

const GATE_CONDITIONS = [
  'Milestone approved by funder',
  'Protection status ready for release',
  'Funded balance covers disbursement',
  'Contractor payout readiness verified',
  'Contractor onboarding complete',
  'No prior release on this milestone',
  'No pending change orders',
  'Signed contract on file',
  'Sequential prerequisites satisfied',
  'Approved conditional lien waiver on file',
]

const AUDIT_EVENTS = [
  { seq: 1, action: 'Draw submitted',                                                         hash: 'a3f8c21d', actor: 'Marcus Webb',         ts: '2026-05-29T08:14:32Z' },
  { seq: 2, action: 'Perplexity AI review — score 78/100 — lien waiver missing',              hash: 'b94e71fa', actor: 'Perplexity sonar-pro', ts: '2026-05-29T08:14:45Z' },
  { seq: 3, action: 'Release gate failed — condition 10: lien waiver not found',              hash: 'c17d4b83', actor: 'Vektrum Gate v1',       ts: '2026-05-29T08:14:45Z' },
  { seq: 4, action: 'Lien waiver uploaded — LienWaiver_StructuralSteel_WBB.pdf',             hash: 'd6a92e05', actor: 'Marcus Webb',           ts: '2026-05-29T09:02:11Z' },
  { seq: 5, action: 'Perplexity AI re-check — score 91/100 — evidence sufficient',           hash: 'e38fb6c2', actor: 'Perplexity sonar-pro', ts: '2026-05-29T09:02:19Z' },
  { seq: 6, action: 'Release gate passed — 10/10 conditions verified',                       hash: 'f5c10d47', actor: 'Vektrum Gate v1',       ts: '2026-05-29T09:02:19Z' },
  { seq: 7, action: 'Funder authorization recorded — Sarah Chen',                            hash: '07b3e9a1', actor: 'Sarah Chen',            ts: '2026-05-29T09:04:55Z' },
  { seq: 8, action: 'Partner-controlled execution pending — execution rail notified',        hash: '1d82c4fe', actor: 'System',                ts: '2026-05-29T09:04:56Z' },
]

const TOKEN_HASH   = '9e4a2f7b3c1d8e56f0a9b4c2d7e3f1a8b5c9d2e6f4a1b7c3d8e5f2a0b9c4d1e7'
const TOKEN_SIG    = 'ed25519:3d9f2a1c8b4e7f5a2d6c9e3b1f8a4d7c2e5b9f1a6d3c8e2b5f7a1d4c9e6b3f2a'

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEP_LABELS: Record<StepId, string> = {
  1: 'Draw arrives',
  2: 'AI review',
  3: 'Gate blocked',
  4: 'Evidence resolved',
  5: 'Gate passes',
  6: 'Authorization',
  7: 'Audit proof',
  8: 'Summary',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoBillionDollarBuild() {
  const [step, setStep]             = useState<StepId>(1)
  const [autoPlay, setAutoPlay]     = useState(false)
  const [authState, setAuthState]   = useState<AuthState>('idle')
  const [authChecked, setAuthChecked] = useState(false)

  // Streaming state for AI panels
  const [aiCount1, setAiCount1]     = useState(0)  // step 2 initial review
  const [aiCount4, setAiCount4]     = useState(0)  // step 4 re-check
  const streamedRef = useRef<Set<StepId>>(new Set())

  const totalSteps = 8

  // Stream AI findings when entering step 2 or step 4
  const streamFindings = useCallback((findings: typeof AI_FINDINGS_INITIAL, setter: (n: number) => void) => {
    findings.forEach((_, i) => {
      setTimeout(() => setter(i + 1), 400 + i * 480)
    })
  }, [])

  useEffect(() => {
    if (step === 2 && !streamedRef.current.has(2)) {
      streamedRef.current.add(2)
      setAiCount1(0)
      setTimeout(() => streamFindings(AI_FINDINGS_INITIAL, setAiCount1), 300)
    }
    if (step === 4 && !streamedRef.current.has(4)) {
      streamedRef.current.add(4)
      setAiCount4(0)
      setTimeout(() => streamFindings(AI_FINDINGS_RECHECK, setAiCount4), 300)
    }
  }, [step, streamFindings])

  // Auto-play: advance every 6s, pause on step 6 (requires human action)
  useEffect(() => {
    if (!autoPlay) return
    if (step === 6 || step === 8) { setAutoPlay(false); return }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, totalSteps) as StepId), 6000)
    return () => clearTimeout(t)
  }, [autoPlay, step])

  function advance() {
    if (step < totalSteps) setStep((s) => (s + 1) as StepId)
  }

  function reset() {
    setStep(1)
    setAutoPlay(false)
    setAuthState('idle')
    setAuthChecked(false)
    setAiCount1(0)
    setAiCount4(0)
    streamedRef.current.clear()
  }

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      {/* Competition banner */}
      <div className="bg-vektrum-blue/[0.15] border-b border-vektrum-blue/30 px-4 py-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-300/80">
          Competition demo — simulated data. No real funds, accounts, or payment execution.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400/70">
            Perplexity Billion Dollar Build
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Vektrum: The Authorization Layer<br className="hidden sm:block" /> Between Proof and Payment
          </h1>
          <p className="text-[13px] text-white/45 max-w-lg mx-auto">
            Perplexity understands the proof. Vektrum governs the authorization.
          </p>
        </div>

        {/* Step indicator */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">
              Step {step} of {totalSteps} — {STEP_LABELS[step]}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoPlay((p) => !p)}
                disabled={step === 8}
                className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-blue-300 transition-colors disabled:opacity-30"
              >
                {autoPlay ? <Pause size={12} /> : <Play size={12} />}
                {autoPlay ? 'Pause' : 'Auto'}
              </button>
              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={advance}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue hover:bg-vektrum-blue-hover px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
                >
                  Next step <ChevronRight size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[12px] text-white/60 hover:text-white transition-colors"
                >
                  Restart
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep((i + 1) as StepId)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 < step  ? 'bg-emerald-500/60' :
                  i + 1 === step ? 'bg-vektrum-blue' :
                  'bg-white/[0.08]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Draw arrives ─────────────────────────────────────────── */}
        {step >= 1 && (
          <StepCard
            icon={<FileText size={15} className="text-blue-400" />}
            title="Draw #3 — Structural Steel Erection"
            subtitle="Harbor Logistics Center · Webb Construction Group"
            badge={{ label: 'Draw Submitted', color: 'amber' }}
          >
            <div className="grid grid-cols-2 gap-3 text-[12px] mb-4">
              <InfoRow label="Amount"      value="$2,180,000" bold />
              <InfoRow label="Draw"        value="Draw #3 of 5" />
              <InfoRow label="Funder"      value="Sarah Chen" />
              <InfoRow label="Contractor"  value="Marcus Webb" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-2">Evidence package</p>
              <div className="space-y-1.5">
                {EVIDENCE_INITIAL.map((e, i) => (
                  <EvidenceRow key={i} {...e} />
                ))}
              </div>
            </div>
            <CalloutBox type="warn" className="mt-4">
              Conditional lien waiver not found. Evidence package is incomplete.
            </CalloutBox>
          </StepCard>
        )}

        {/* ── Step 2: Perplexity reviews ───────────────────────────────────── */}
        {step >= 2 && (
          <AiPanel
            title="Perplexity Draw Control Brief"
            subtitle="Draw #3 · Harbor Logistics Center · sonar-pro"
            findings={AI_FINDINGS_INITIAL}
            shownCount={aiCount1}
            score={78}
            risk="Medium"
            evidence="Incomplete"
            attribution="Perplexity informs. It does not approve payment."
          />
        )}

        {/* ── Step 3: Gate blocked ─────────────────────────────────────────── */}
        {step >= 3 && (
          <GatePanel passCount={9} failIndex={9} gateState="blocked" />
        )}

        {/* ── Step 4: Evidence resolved + re-check ────────────────────────── */}
        {step >= 4 && (
          <div className="space-y-4">
            <StepCard
              icon={<FileText size={15} className="text-emerald-400" />}
              title="Evidence updated"
              subtitle="Contractor uploaded missing document"
              badge={{ label: 'Document Added', color: 'emerald' }}
            >
              <div className="space-y-1.5">
                {EVIDENCE_RESOLVED.map((e, i) => (
                  <EvidenceRow key={i} {...e} />
                ))}
              </div>
            </StepCard>

            <AiPanel
              title="Perplexity Re-check"
              subtitle="LienWaiver_StructuralSteel_WBB.pdf · sonar-pro"
              findings={AI_FINDINGS_RECHECK}
              shownCount={aiCount4}
              score={91}
              risk="Low"
              evidence="Sufficient"
              attribution="Perplexity informs. It does not approve payment."
            />
          </div>
        )}

        {/* ── Step 5: Gate passes ──────────────────────────────────────────── */}
        {step >= 5 && (
          <GatePanel passCount={10} failIndex={-1} gateState="passed" />
        )}

        {/* ── Step 6: Human authorization ─────────────────────────────────── */}
        {step >= 6 && (
          <StepCard
            icon={<User size={15} className="text-blue-400" />}
            title="Funder Authorization"
            subtitle="Release authorization requires explicit funder action"
            badge={
              authState === 'authorized'
                ? { label: 'Release Authorized', color: 'emerald' }
                : { label: 'Awaiting Authorization', color: 'blue' }
            }
          >
            {authState !== 'authorized' && (
              <>
                <div className="grid grid-cols-2 gap-3 text-[12px] mb-4">
                  <InfoRow label="Authorized funder" value="Sarah Chen" bold />
                  <InfoRow label="Amount"            value="$2,180,000" />
                  <InfoRow label="Gate status"       value="10/10 conditions" />
                  <InfoRow label="Execution rail"    value="Partner-controlled" />
                </div>
                <CalloutBox type="info" className="mb-4">
                  Vektrum governs authorization and records proof. Funds remain with the selected payment provider or institutional partner until externally executed.
                </CalloutBox>
                {authState === 'idle' && (
                  <button
                    type="button"
                    onClick={() => setAuthState('confirming')}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-[14px] font-bold text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock size={15} />
                    Authorize Release — $2,180,000
                  </button>
                )}
              </>
            )}

            {authState === 'confirming' && (
              <ConfirmModal
                onConfirm={() => {
                  if (!authChecked) return
                  setAuthState('authorized')
                  if (step === 6) setTimeout(() => setStep(7), 800)
                }}
                onCancel={() => setAuthState('idle')}
                checked={authChecked}
                onCheck={setAuthChecked}
              />
            )}

            {authState === 'authorized' && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-center space-y-1">
                <CheckCircle2 size={28} className="text-emerald-400 mx-auto" />
                <p className="text-[15px] font-bold text-emerald-300">Release Authorized</p>
                <p className="text-[12px] text-white/50">
                  Authorization token issued · Audit proof recorded · Partner rail notified
                </p>
              </div>
            )}
          </StepCard>
        )}

        {/* ── Step 7: Token + audit chain ──────────────────────────────────── */}
        {step >= 7 && (
          <div className="space-y-4">
            {/* Token card */}
            <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/[0.04] overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-vektrum-blue/20 px-5 py-3">
                <Award size={14} className="text-blue-400" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-white">Authorization Token</p>
                <span className="ml-auto inline-flex items-center rounded-full bg-emerald-500/[0.12] border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  Authorized
                </span>
              </div>
              <div className="px-5 py-4 font-mono text-[11px] space-y-2">
                <TokenRow label="token_id"    value="AT-BDB-2180" highlight />
                <TokenRow label="policy"      value="10-condition-gate.v1" />
                <TokenRow label="amount"      value="$2,180,000" />
                <TokenRow label="actor"       value="Sarah Chen" />
                <TokenRow label="milestone"   value="Structural Steel Erection" />
                <TokenRow label="timestamp"   value="2026-05-29T09:04:55Z" />
                <TokenRow label="signature"   value={TOKEN_SIG} truncate />
                <TokenRow label="token_hash"  value={TOKEN_HASH} truncate />
              </div>
            </div>

            {/* Audit chain */}
            <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3">
                <Layers size={14} className="text-white/55" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-white">Audit Event Chain</p>
                <span className="ml-auto text-[11px] text-white/35">8 events · hash-chained · append-only</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {AUDIT_EVENTS.map((e) => (
                  <div key={e.seq} className="px-5 py-2.5 flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-vektrum-blue/[0.15] border border-vektrum-blue/20 flex items-center justify-center text-[9px] font-bold text-blue-300">
                      {e.seq}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75 leading-snug">{e.action}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-white/35">{e.actor}</span>
                        <span className="text-[10px] text-white/25 font-mono">{e.ts.replace('T', ' ').replace('Z', '')}</span>
                      </div>
                    </div>
                    <span className="flex-shrink-0 font-mono text-[10px] text-white/25 mt-0.5">
                      #{e.hash}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 8: Competition summary ───────────────────────────────────── */}
        {step >= 8 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Brain size={18} className="text-blue-400" />, title: 'Perplexity reviews messy evidence', body: 'sonar-pro reads draw packages, detects missing documents, and scores completeness — in seconds.' },
                { icon: <Shield size={18} className="text-white/70" />, title: 'Vektrum enforces release policy', body: 'A deterministic 10-condition gate decides whether release is permitted. AI informs; the gate decides.' },
                { icon: <User size={18} className="text-emerald-400" />, title: 'Humans retain authority', body: 'The authorized funder reviews and confirms every release. Authorization is explicit, logged, and immutable.' },
                { icon: <Zap size={18} className="text-amber-400" />, title: 'Existing rails execute payment', body: 'Stripe Connect, title, escrow, treasury, or bank — Vektrum authorizes; the partner executes.' },
              ].map((c, i) => (
                <div key={i} className="rounded-xl border border-white/[0.08] bg-surface-2 p-4 space-y-2">
                  {c.icon}
                  <p className="text-[13px] font-semibold text-white leading-snug">{c.title}</p>
                  <p className="text-[12px] text-white/45 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/[0.06] px-6 py-5 text-center space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400/70">
                AI reviews. Gate decides. Human authorizes. Partner rail executes.
              </p>
              <p className="text-[22px] font-bold text-white leading-tight">
                Vektrum is the authorization layer<br className="hidden sm:block" /> between proof and payment.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-white/50">
                  <Hash size={12} className="text-blue-400/60" />
                  10-condition gate · ed25519 token · hash-chained audit · partner-controlled execution
                </span>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-[12px] text-white/60 hover:text-white transition-colors mt-2"
              >
                Restart demo <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Persistent bottom tag */}
        <p className="text-center text-[11px] text-white/25 pb-4">
          vektrum.io · authorization infrastructure for construction disbursements
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepCard({
  icon, title, subtitle, badge, children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  badge?: { label: string; color: 'amber' | 'emerald' | 'blue' | 'red' }
  children?: React.ReactNode
}) {
  const badgeClass: Record<string, string> = {
    amber:   'bg-amber-500/[0.12] border-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/[0.12] border-emerald-500/20 text-emerald-400',
    blue:    'bg-vektrum-blue/[0.15] border-vektrum-blue/30 text-blue-300',
    red:     'bg-red-500/[0.12] border-red-500/20 text-red-400',
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className={`flex-shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass[badge.color]}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function EvidenceRow({ name, ok, missing, new: isNew }: { name: string; ok: boolean; missing?: boolean; new?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
      missing ? 'border border-red-500/20 bg-red-500/[0.05]' :
      isNew   ? 'border border-emerald-500/20 bg-emerald-500/[0.05]' :
                'border border-white/[0.06] bg-surface-3'
    }`}>
      <FileText size={12} className={missing ? 'text-red-400/70' : isNew ? 'text-emerald-400' : 'text-white/40'} />
      <span className={`flex-1 text-[12px] ${missing ? 'text-red-300/80' : isNew ? 'text-emerald-300' : 'text-white/65'}`}>
        {name}
      </span>
      {ok && !missing && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
      {missing && (
        <span className="text-[10px] font-semibold uppercase text-red-400/80">Missing</span>
      )}
      {isNew && (
        <span className="text-[10px] font-semibold uppercase text-emerald-400/80">New</span>
      )}
    </div>
  )
}

function AiPanel({
  title, subtitle, findings, shownCount, score, risk, evidence, attribution,
}: {
  title: string
  subtitle: string
  findings: { text: string; type: 'ok' | 'warn' }[]
  shownCount: number
  score: number
  risk: string
  evidence: string
  attribution: string
}) {
  return (
    <div className="rounded-xl border border-vektrum-blue/25 bg-vektrum-blue/[0.04] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-vektrum-blue/15 px-5 py-3.5">
        <Brain size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white">{title}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold text-blue-400/60 bg-vektrum-blue/[0.12] border border-vektrum-blue/20 rounded px-2 py-0.5 uppercase tracking-wide">
          Powered by Perplexity sonar-pro
        </span>
      </div>
      <div className="px-5 py-4 space-y-3">
        {/* Streaming findings */}
        <div className="space-y-1.5">
          {findings.slice(0, shownCount).map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              {f.type === 'ok'
                ? <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                : <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
              }
              <p className={`text-[12px] leading-snug ${f.type === 'ok' ? 'text-white/65' : 'text-amber-300/80'}`}>
                {f.text}
              </p>
            </div>
          ))}
          {shownCount < findings.length && (
            <span className="inline-block text-[12px] text-blue-300 animate-pulse ml-4">▌</span>
          )}
        </div>

        {/* Scores — only shown when streaming complete */}
        {shownCount >= findings.length && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
            <ScoreBadge label="Score" value={`${score}/100`} color={score >= 90 ? 'emerald' : 'amber'} />
            <ScoreBadge label="Risk" value={risk} color={risk === 'Low' ? 'emerald' : 'amber'} />
            <ScoreBadge label="Evidence" value={evidence} color={evidence === 'Sufficient' ? 'emerald' : 'amber'} />
            <span className="ml-auto text-[11px] text-white/35 italic">{attribution}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreBadge({ label, value, color }: { label: string; value: string; color: 'emerald' | 'amber' }) {
  const cls = color === 'emerald'
    ? 'bg-emerald-500/[0.10] border-emerald-500/20 text-emerald-400'
    : 'bg-amber-500/[0.10] border-amber-500/20 text-amber-400'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className="text-white/40 font-normal">{label}</span> {value}
    </span>
  )
}

function GatePanel({ passCount, failIndex, gateState }: {
  passCount: number
  failIndex: number
  gateState: 'blocked' | 'passed'
}) {
  return (
    <div className={`rounded-xl overflow-hidden border ${
      gateState === 'blocked' ? 'border-red-500/25' : 'border-emerald-500/25'
    }`}>
      {/* Status banner */}
      <div className={`px-5 py-4 flex items-center gap-3 ${
        gateState === 'blocked'
          ? 'bg-red-500/[0.10] border-b border-red-500/20'
          : 'bg-emerald-500/[0.08] border-b border-emerald-500/20'
      }`}>
        <div className={`flex-shrink-0 rounded-full p-1.5 ${
          gateState === 'blocked' ? 'bg-red-500/20' : 'bg-emerald-500/20'
        }`}>
          {gateState === 'blocked'
            ? <XCircle size={20} className="text-red-400" />
            : <CheckCircle2 size={20} className="text-emerald-400" />
          }
        </div>
        <div>
          <p className={`text-[16px] font-black tracking-wide uppercase ${
            gateState === 'blocked' ? 'text-red-300' : 'text-emerald-300'
          }`}>
            {gateState === 'blocked' ? 'RELEASE BLOCKED' : 'READY FOR FUNDER AUTHORIZATION'}
          </p>
          <p className="text-[11px] text-white/50 mt-0.5">
            {gateState === 'blocked'
              ? `The draw cannot be authorized because one required release condition failed. (${passCount}/10 passed)`
              : 'The release is not approved because AI said yes. It is ready because every required condition passed.'
            }
          </p>
        </div>
        <div className="ml-auto flex-shrink-0 text-right">
          <p className={`text-[22px] font-black tabular-nums ${
            gateState === 'blocked' ? 'text-red-300' : 'text-emerald-300'
          }`}>
            {passCount}<span className="text-white/30">/10</span>
          </p>
        </div>
      </div>

      {/* Conditions */}
      <div className={`px-5 py-3 ${gateState === 'blocked' ? 'bg-surface-2' : 'bg-surface-2'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={13} className="text-white/40" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
            Vektrum 10-Condition Release Gate — deterministic, not AI
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {GATE_CONDITIONS.map((cond, i) => {
            const passes = i < passCount && i !== failIndex
            return (
              <div key={i} className={`flex items-center gap-2 text-[12px] ${
                passes ? 'text-white/60' : 'text-red-300/90'
              }`}>
                {passes
                  ? <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                  : <XCircle size={12} className="text-red-400 flex-shrink-0" />
                }
                {i + 1}. {cond}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({
  onConfirm, onCancel, checked, onCheck,
}: {
  onConfirm: () => void
  onCancel: () => void
  checked: boolean
  onCheck: (v: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-3 p-5 space-y-4">
      <p className="text-[13px] font-semibold text-white">Confirm Release Authorization</p>
      <div className="space-y-2 text-[12px]">
        <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
          <span className="text-white/40">Amount</span>
          <span className="text-white font-semibold">$2,180,000</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
          <span className="text-white/40">Milestone</span>
          <span className="text-white">Structural Steel Erection</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
          <span className="text-white/40">Release basis</span>
          <span className="text-emerald-300 font-medium">10/10 conditions passed</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
          <span className="text-white/40">AI review</span>
          <span className="text-white">Perplexity score 91/100 · risk low</span>
        </div>
        <div className="flex justify-between py-1.5">
          <span className="text-white/40">Execution rail</span>
          <span className="text-white">Partner-controlled</span>
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-surface-0 accent-emerald-500 flex-shrink-0"
        />
        <span className="text-[12px] text-white/55 leading-relaxed group-hover:text-white/70 transition-colors">
          I understand Vektrum records authorization. Payment execution remains external.
        </span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/15 py-2.5 text-[13px] text-white/50 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!checked}
          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 text-[13px] font-bold text-white transition-colors"
        >
          Confirm Authorization
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-white/35 uppercase tracking-wide">{label}</p>
      <p className={`text-[13px] mt-0.5 ${bold ? 'text-white font-semibold' : 'text-white/65'}`}>{value}</p>
    </div>
  )
}

function TokenRow({ label, value, highlight, truncate }: { label: string; value: string; highlight?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-white/30 w-28 flex-shrink-0">{label}</span>
      <span className={`${highlight ? 'text-blue-300 font-semibold' : 'text-white/60'} ${truncate ? 'truncate max-w-[280px]' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function CalloutBox({ type, children, className = '' }: {
  type: 'warn' | 'info'
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg p-3 ${
      type === 'warn' ? 'border border-amber-500/20 bg-amber-500/[0.06]' : 'border border-blue-500/20 bg-blue-500/[0.05]'
    } ${className}`}>
      {type === 'warn'
        ? <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
        : <Clock size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
      }
      <p className={`text-[12px] leading-relaxed ${type === 'warn' ? 'text-amber-300/80' : 'text-blue-300/80'}`}>
        {children}
      </p>
    </div>
  )
}
