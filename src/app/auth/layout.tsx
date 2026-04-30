/**
 * Auth Layout — minimal passthrough.
 *
 * Auth pages (`/auth/login`, `/auth/signup`, `/auth/mfa/*`, `/auth/reset-password`)
 * each render their own self-contained chrome (brand mark + form). They use
 * `useSearchParams` for redirect-after-login and similar flows, which forces
 * a Suspense boundary at static prerender. Marking the subtree dynamic
 * sidesteps the prerender path entirely and matches the existing behavior:
 * auth pages are always rendered per-request because they read cookies for
 * session state.
 *
 * The brief says auth routes should "remain safe/minimal" — this layout
 * adds nothing visual; it exists solely to set the dynamic-rendering
 * directive for everything under /auth/.
 */

export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
