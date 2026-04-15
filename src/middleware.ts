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

  // ── Public paths — always allowed ─────────────────────────────────────────
  // Static assets, Next.js internals, and Stripe webhook (must be public for
  // Stripe's servers which have no session cookie)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/auth/") ||
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/favicon")
  ) {
    // Still update session cookies so they stay fresh
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // ── Protected paths — require session ─────────────────────────────────────
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

  // ── All other routes — update session and pass through ───────────────────
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
