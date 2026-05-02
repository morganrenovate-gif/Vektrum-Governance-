// ─── Admin — Design Partner Applications ─────────────────────────────────────
//
// Read-only review surface for the public design-partner application form
// (see src/app/(marketing)/design-partners/ + src/app/api/design-partner-
// applications/route.ts). The table itself is locked behind RLS — only the
// service-role can read or write — so this page reads via the admin client
// after the session-bound role gate confirms the viewer is an admin.
//
// Why read-only for v1:
//   - The application table has a CHECK constraint on `status`
//     (new / reviewing / invited / accepted / declined). A status mutation
//     needs its own auth-checked server action + audit log; that's the
//     shape of every other admin write on the platform. We ship the read
//     surface first so leads stop accumulating in Supabase Studio.
//   - Manual status updates are still possible via Supabase Studio for ops
//     until the mutation flow ships. Documented in
//     docs/PRODUCTION_SMOKE_TEST.md follow-up.
//
// Security:
//   - Server component, no client-side data fetch.
//   - createClient() (RLS-bound) verifies the viewer is auth'd.
//   - profile.role === 'admin' is checked server-side; non-admins redirect
//     to /dashboard.
//   - createSupabaseAdminClient() is used ONLY here, after the role gate,
//     to read the lead table that public users cannot see.
//   - No service-role key is ever exposed to the client (no client component
//     imports SUPABASE_SERVICE_ROLE_KEY; the admin client lives in the
//     server-only @/lib/supabase/server module).

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  createClient,
  createSupabaseAdminClient,
} from '@/lib/supabase/server'
import {
  Mail, Building2, ArrowLeft, ExternalLink, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'

export const metadata = {
  title: 'Design partner applications — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// ─── Status taxonomy ──────────────────────────────────────────────────────────
//
// MUST match the CHECK constraint in the migration:
//   supabase/migrations/20260430000000_design_partner_applications.sql
//
//   CHECK (status IN ('new', 'reviewing', 'invited', 'accepted', 'declined'))

const STATUS_VALUES = ['new', 'reviewing', 'invited', 'accepted', 'declined'] as const
type Status = typeof STATUS_VALUES[number]

const STATUS_TONE: Record<Status, string> = {
  new:        'bg-vektrum-blue/[0.12] text-blue-300 border-vektrum-blue/30',
  reviewing:  'bg-amber-500/[0.10] text-amber-300 border-amber-500/30',
  invited:    'bg-blue-500/[0.10] text-blue-300 border-blue-500/30',
  accepted:   'bg-emerald-500/[0.10] text-emerald-400 border-emerald-500/30',
  declined:   'bg-white/[0.06] text-white/45 border-white/[0.10]',
}

// ─── Row type ─────────────────────────────────────────────────────────────────

interface Application {
  id:                  string
  name:                string
  company:             string
  role:                string
  email:               string
  audience_type:       string
  draw_exposure:       string
  biggest_bottleneck:  string
  utm_source:          string | null
  utm_medium:          string | null
  utm_campaign:        string | null
  utm_content:         string | null
  utm_term:            string | null
  referrer:            string | null
  user_agent:          string | null
  status:              Status
  admin_email_sent_at: string | null
  created_at:          string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function shortPreview(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DesignPartnerApplicationsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/admin/design-partner-applications')

  // Server-side role gate (matches existing /dashboard/admin pattern).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profileData || profileData.role !== 'admin') {
    redirect('/dashboard')
  }

  // Read the lead table via the service-role client. RLS denies all public
  // access; only this code path can see rows.
  const admin = createSupabaseAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin as any)
    .from('design_partner_applications')
    .select(
      'id, name, company, role, email, audience_type, draw_exposure, ' +
      'biggest_bottleneck, utm_source, utm_medium, utm_campaign, utm_content, ' +
      'utm_term, referrer, user_agent, status, admin_email_sent_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  const applications = (rows ?? []) as Application[]

  // Aggregate counts by status for the summary strip.
  const counts: Record<Status, number> = {
    new: 0, reviewing: 0, invited: 0, accepted: 0, declined: 0,
  }
  for (const a of applications) {
    if (counts[a.status] !== undefined) counts[a.status] += 1
  }
  const total = applications.length

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          Back to admin
        </Link>

        <PageHeader
          eyebrow="Admin Tools"
          title="Design partner applications"
          description={`${total} total · public form submissions from /design-partners`}
        />

        {/* Status summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STATUS_VALUES.map((s) => (
            <div
              key={s}
              className={`rounded-xl border bg-surface-2 px-4 py-3 ${STATUS_TONE[s]}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                {s.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">
                {counts[s]}
              </p>
            </div>
          ))}
        </div>

        {/* Error / empty / list */}
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-semibold text-red-400">
                  Could not load design partner applications.
                </p>
                <p className="mt-1 text-[12px] text-white/55 font-mono">
                  {error.message ?? 'Unknown error'}
                </p>
              </div>
            </div>
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-white">No applications yet.</p>
            <p className="mt-2 text-[13px] text-white/55">
              Submissions to the public form at{' '}
              <Link href="/design-partners" className="underline hover:text-white">
                /design-partners
              </Link>{' '}
              will appear here, newest first.
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Recent applications
              </p>
              <p className="ml-auto text-[11px] text-white/40">
                Newest first · up to 200 rows
              </p>
            </div>

            <ul className="divide-y divide-white/[0.05]">
              {applications.map((a) => (
                <li key={a.id}>
                  <details className="group">
                    <summary
                      className="cursor-pointer list-none px-5 py-4 hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-vektrum-blue transition-colors"
                    >
                      {/* Top row: name · company · status · created_at */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-1.5">
                        <span className="text-[14px] font-semibold text-white">
                          {a.name}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-white/65">
                          <Building2 size={11} aria-hidden="true" />
                          {a.company}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[a.status]}`}
                        >
                          {a.status.replace(/_/g, ' ')}
                        </span>
                        {a.admin_email_sent_at ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80"
                            title={`Admin alert sent ${formatTimestamp(a.admin_email_sent_at)}`}
                          >
                            <CheckCircle2 size={10} aria-hidden="true" />
                            Email sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/80" title="Admin alert email was NOT successfully delivered">
                            <AlertCircle size={10} aria-hidden="true" />
                            Email pending
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-white/40 tabular-nums">
                          {formatTimestamp(a.created_at)}
                        </span>
                      </div>

                      {/* Second row: role · email · audience · draw_exposure */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/55">
                        <span>{a.role}</span>
                        <span aria-hidden="true">·</span>
                        <a
                          href={`mailto:${a.email}`}
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail size={11} aria-hidden="true" />
                          {a.email}
                        </a>
                        <span aria-hidden="true">·</span>
                        <span>{a.audience_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>Deals with draws: {a.draw_exposure}</span>
                      </div>

                      {/* Third row: bottleneck preview + UTM tags */}
                      <p className="mt-2 text-[12px] text-white/65 leading-relaxed">
                        “{shortPreview(a.biggest_bottleneck)}”
                      </p>

                      {(a.utm_source || a.utm_campaign) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/45">
                          {a.utm_source && (
                            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono">
                              utm_source={a.utm_source}
                            </span>
                          )}
                          {a.utm_campaign && (
                            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono">
                              utm_campaign={a.utm_campaign}
                            </span>
                          )}
                        </div>
                      )}
                    </summary>

                    {/* Expanded detail */}
                    <div className="border-t border-white/[0.05] bg-surface-3 px-5 py-4 space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-1.5">
                          Biggest draw-release bottleneck
                        </p>
                        <p className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap">
                          {a.biggest_bottleneck}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-1.5">
                          Attribution
                        </p>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[11px]">
                          {([
                            ['utm_source',   a.utm_source],
                            ['utm_medium',   a.utm_medium],
                            ['utm_campaign', a.utm_campaign],
                            ['utm_content',  a.utm_content],
                            ['utm_term',     a.utm_term],
                            ['referrer',     a.referrer],
                            ['user_agent',   a.user_agent],
                          ] as const).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <dt className="w-28 flex-shrink-0 text-white/45">{key}</dt>
                              <dd className="text-white/75 break-all">{value ?? '—'}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px] text-white/45 font-mono">
                        <span>id: {a.id}</span>
                        {a.admin_email_sent_at && (
                          <span>email_sent_at: {a.admin_email_sent_at}</span>
                        )}
                        <a
                          href={`mailto:${a.email}?subject=Vektrum design partner program — ${a.company}`}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                          <Mail size={11} aria-hidden="true" />
                          Reply by email
                          <ExternalLink size={10} aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer note: status mutation guidance */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
          <p className="text-[11px] text-white/45 leading-relaxed">
            Status changes are read-only here for now. Allowed values:{' '}
            <span className="font-mono text-white/65">{STATUS_VALUES.join(' · ')}</span>.
            Update via Supabase Studio until the in-app mutation ships. The
            public form does not write status — only the admin path can.
          </p>
        </div>
      </div>
    </div>
  )
}
