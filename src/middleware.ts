import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Vektrum route protection middleware.
 *
 * Public routes: /, /auth/*, /api/stripe/webhook, /api/invites/[token] (GET),
 *                /invite/*, /pricing
 * Protected routes: /dashboard/* — requires authenticated Supabase session.
 *
 * All other routes are left to Next.js to handle.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public paths — pass through without touching Supabase ─────────────────
  // Avoids an unnecessary getUser() round-trip on every public page load.
  // The auth/callback route handles its own session exchange.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/auth/") ||
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/demo"
  ) {
    return NextResponse.next();
  }

  // ── Protected paths — require session ─────────────────────────────────────
  // Only call getUser() (which hits Supabase) when we actually need to gate.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/")) {
    const { supabaseResponse, user } = await updateSession(request);

    if (!user) {
      // Redirect to login, preserving the destination for post-auth redirect
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  // ── All other routes — pass through ───────────────────────────────────────
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Only run middleware on routes that need it:
     * - Page routes (not _next internals, not static files)
     * - API routes
     * Excludes: _next/static, _next/image, favicon, sitemap, robots
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
