import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { logAudit } from "@/lib/engine/audit";

export const dynamic = 'force-dynamic';

/**
 * Auth callback handler for:
 * - Email confirmation links
 * - OAuth flows (if added later)
 * - Magic link sign-in
 *
 * Supabase redirects to /auth/callback?code=… after the user clicks the
 * confirmation/magic-link in their email.
 *
 * After session exchange, checks if the user needs onboarding (Stripe setup).
 * First-time contractors/funders are redirected to their onboarding page.
 * Admins are never gated.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Optional: where to redirect after sign-in (default: /dashboard)
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      // Determine the base URL for redirects
      const baseUrl = isLocalEnv
        ? origin
        : forwardedHost
          ? `https://${forwardedHost}`
          : origin;

      // Check if user needs onboarding (Stripe setup)
      let redirectPath = next;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rawProfile } = await (supabase as any)
            .from("profiles")
            .select("role, stripe_account_id, full_name, company_name")
            .eq("id", user.id)
            .single();

          const profile = rawProfile as Pick<Profile, "role" | "stripe_account_id" | "full_name" | "company_name"> | null;

          if (profile && !profile.stripe_account_id) {
            // If next is an invite path, preserve it — the invite flow takes priority
            // over Stripe onboarding. The user can complete onboarding after accepting.
            const isInviteRedirect = next.startsWith("/invite/");
            if (!isInviteRedirect) {
              // Admins are never gated
              if (profile.role === "contractor") {
                redirectPath = "/dashboard/contractor/onboarding";
              } else if (profile.role === "funder") {
                redirectPath = "/dashboard/funder/onboarding";
              }
            }
          }

          // ── Audit: log sign-in at the session exchange moment ─────────────
          // This is the correct place to capture sign-in events. We do NOT log
          // in getAuthUser() because that is called on every API request —
          // logging there would generate hundreds of 'user_login' entries per
          // session, polluting the audit trail and adding a DB write to every
          // authenticated request. This callback fires exactly once per sign-in.
          // Fire-and-forget — never block or fail the redirect on audit failure.
          logAudit({
            entity_type:   "profile",
            entity_id:     user.id,
            action:        "user_login",
            actor_id:      user.id,
            actor_email:   user.email ?? null,
            actor_name:    profile
              ? (profile.full_name ?? profile.company_name ?? user.email ?? user.id)
              : (user.email ?? user.id),
            actor_role:    profile?.role ?? null,
            system_source: "auth_callback",
            metadata: {
              provider:      "email_link",
              redirect_path: redirectPath,
            },
          }).catch(err => {
            console.warn("[auth-callback] Failed to log user_login audit event:", err)
          })
        }
      } catch {
        // If profile check fails, proceed to default redirect
      }

      return NextResponse.redirect(`${baseUrl}${redirectPath}`);
    }
  }

  // Code exchange failed — redirect to error page
  return NextResponse.redirect(
    `${origin}/auth/login?error=auth_callback_failed`
  );
}
