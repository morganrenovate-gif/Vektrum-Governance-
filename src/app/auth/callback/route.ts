import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback handler for:
 * - Email confirmation links
 * - OAuth flows (if added later)
 * - Magic link sign-in
 *
 * Supabase redirects to /auth/callback?code=… after the user clicks the
 * confirmation/magic-link in their email.
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
      // Successful auth — redirect to dashboard (or requested destination)
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Code exchange failed — redirect to error page
  return NextResponse.redirect(
    `${origin}/auth/login?error=auth_callback_failed`
  );
}
