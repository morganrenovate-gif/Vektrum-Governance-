import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

// ─── IP Allowlist Helpers ─────────────────────────────────────────────────────
// Pure Edge-safe IPv4 CIDR matching — no Node.js net module required.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  // Exact IP match (no slash)
  if (!cidr.includes("/")) return ip === cidr;

  const [network, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt  = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

function isAdminIpAllowed(ip: string, allowedCidrs: string[]): boolean {
  // Empty allowlist ⟹ no restriction (all allowed)
  if (allowedCidrs.length === 0) return true;
  return allowedCidrs.some((cidr) => isIpInCidr(ip, cidr.trim()));
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ?? // Cloudflare
    "unknown"
  );
}

/**
 * Fire-and-forget: log a blocked admin IP attempt to admin_audit_log via the
 * Supabase REST API directly (service-role key). We bypass the JS client here
 * because this runs in Edge middleware before any route handler is entered.
 * Failures are silently discarded — the 403 response is the primary control.
 */
function logBlockedAdminIp(
  ip: string,
  pathname: string,
  supabaseUrl: string,
  serviceKey: string,
): void {
  const justification =
    `Automated IP block: ${ip} attempted admin access to ${pathname} but is not in the IP allowlist.`;

  fetch(`${supabaseUrl}/rest/v1/admin_audit_log`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey":        serviceKey,
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify({
      entity_type:         "admin_access",
      // Zero UUID — used for system events with no specific entity
      entity_id:           "00000000-0000-0000-0000-000000000000",
      action:              "admin_access_blocked_ip",
      actor_id:            null,
      actor_role:          null,
      actor_name:          "system",
      system_source:       "middleware/ip_allowlist",
      ip_address:          ip,
      admin_justification: justification,
      metadata:            JSON.stringify({ blocked_ip: ip, pathname }),
    }),
  }).catch(() => { /* best-effort — never block the 403 response */ });
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Vektrum route protection middleware.
 *
 * Public routes: /, /auth/*, /api/stripe/webhook, /api/invites/[token] (GET),
 *                /invite/*, /pricing
 * Protected routes: /dashboard/* — requires authenticated Supabase session.
 * Admin routes:   /dashboard/admin/*, /api/admin/* — additionally require
 *                 AAL2 MFA (dashboard pages) and IP allowlisting (both).
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
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/demo" ||
    pathname === "/demo-live" ||
    pathname.startsWith("/demo-live/") ||
    pathname === "/funders" ||
    pathname === "/lenders" ||
    pathname === "/contractors" ||
    pathname === "/about" ||
    pathname === "/help" ||
    pathname === "/careers" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/security" ||
    pathname === "/contact" ||
    pathname === "/forgot-password"
  ) {
    return NextResponse.next();
  }

  // ── Admin IP allowlisting ─────────────────────────────────────────────────
  // Applied to /dashboard/admin/* and /api/admin/* before session checks.
  //
  // ADMIN_ALLOWED_IPS: comma-separated CIDR blocks or exact IPs.
  //   Example: "10.0.0.0/8,203.0.113.5"
  //
  // Enforcement rules:
  //   - Production + ADMIN_ALLOWED_IPS set  → enforce; block IPs not in list
  //   - Production + ADMIN_ALLOWED_IPS unset → allow all (no restriction)
  //   - Development                          → always allow (unless ADMIN_ALLOWED_IPS
  //                                            is explicitly set, in which case enforce)
  const isAdminPath =
    pathname.startsWith("/dashboard/admin") ||
    pathname.startsWith("/api/admin/");

  if (isAdminPath) {
    const allowedIpsRaw = process.env.ADMIN_ALLOWED_IPS;
    const isProduction  = process.env.NODE_ENV === "production";

    // Only enforce when an allowlist is configured AND we're in production
    // (or when ADMIN_ALLOWED_IPS is set in any environment for explicit control)
    if (allowedIpsRaw && (isProduction || allowedIpsRaw.trim() !== "")) {
      const allowedCidrs = allowedIpsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (allowedCidrs.length > 0) {
        const clientIp = getClientIp(request);

        if (!isAdminIpAllowed(clientIp, allowedCidrs)) {
          // Log the blocked attempt (best-effort, fire-and-forget)
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && serviceKey) {
            logBlockedAdminIp(clientIp, pathname, supabaseUrl, serviceKey);
          }

          return NextResponse.json(
            { error: "Admin access restricted by IP policy" },
            { status: 403 },
          );
        }
      }
    }
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

    // ── AAL2 enforcement for /dashboard/admin ───────────────────────────────
    // Admin pages require MFA (AAL2). Check the JWT's aal claim — this is a
    // local read of the token, not a network call, so it is safe in Edge Runtime.
    //
    // If the admin has MFA enrolled but hasn't verified this session → /auth/mfa/verify
    // If the admin has no MFA enrolled at all                        → /auth/mfa/enroll
    if (pathname.startsWith("/dashboard/admin")) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll() { /* read-only in middleware context */ },
          },
        },
      );

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalData && aalData.currentLevel !== "aal2") {
        // Determine whether to redirect to verify (enrolled) or enroll (not enrolled)
        const mfaPath =
          aalData.nextLevel === "aal2"
            ? "/auth/mfa/verify"    // enrolled but not yet verified this session
            : "/auth/mfa/enroll";  // not enrolled — must set up TOTP first

        const mfaUrl = new URL(mfaPath, request.url);
        mfaUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(mfaUrl);
      }
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
