import { cn } from "@/lib/utils";

/**
 * VektrumLogo — the official geometric double-line V mark.
 *
 * Faithfully recreates the brand logo:
 *   Left side:  two parallel diagonal lines descending to the apex
 *   Right side: outer line ascends full height; inner line has a
 *               rectangular notch near the top (the signature brand detail —
 *               the inner right stroke starts lower than the outer, creating
 *               a small enclosed rectangle at the top-right)
 *
 * ViewBox: 100 × 90  (roughly square, slightly taller than wide)
 * Stroke color: #1A3A96 (vektrum-blue)
 * Stroke width: outer 10, inner 7 — matches the relative weight in the logo
 */

interface VektrumMarkProps {
  size?: number;
  className?: string;
  /** Render strokes in white — for use on dark/canvas backgrounds */
  dark?: boolean;
}

export function VektrumMark({ size = 32, className, dark = false }: VektrumMarkProps) {
  const h = Math.round(size * 0.9);
  const stroke = dark ? "#FFFFFF" : "#1A3A96";
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/*
        Logo geometry (100×90 viewBox):

        Apex:       (50, 82)    ← bottom center point of V
        Left outer: (4,  4)  → apex
        Left inner: (20, 4)  → apex  (inset ~16px on the left)

        Right outer: apex → (96, 4)   ← full height, same as left outer
        Right inner: apex → (80, 4)   ← inset ~16px

        The notch on the right:
          The inner right arm does NOT go all the way to the top.
          Instead it terminates at roughly (80, 22), and a horizontal
          segment connects (80, 22) → (96, 22), forming the bottom of
          the rectangular notch. The outer right arm continues to (96, 4).
          This creates the closed rectangular shape at the top-right.
      */}

      {/* ── Left outer arm ──────────────────────────────────────────────── */}
      <line
        x1="4" y1="4"
        x2="50" y2="82"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* ── Left inner arm ──────────────────────────────────────────────── */}
      <line
        x1="21" y1="4"
        x2="50" y2="68"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* ── Right outer arm ─────────────────────────────────────────────── */}
      <line
        x1="50" y1="82"
        x2="96" y2="4"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/*
        ── Right inner arm + notch ──────────────────────────────────────────
        The inner right line runs from the apex up to ~y=25, then there is
        a horizontal connector to the outer right arm, forming the notch box.
        Rendered as a polyline: apex → elbow-inner → elbow-outer
        The outer arm above that point is already drawn above.
      */}
      {/* Inner right arm: apex region up to elbow */}
      <line
        x1="50" y1="68"
        x2="79" y2="25"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Horizontal notch connector (bottom of the rectangular notch) */}
      <line
        x1="79" y1="25"
        x2="91" y2="4"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Full horizontal lockup: mark + "Vektrum" wordmark.
 * Optionally shows the "TRUST. BUILT IN." tagline.
 */
interface VektrumWordmarkProps {
  markSize?: number;
  showTagline?: boolean;
  className?: string;
  /** Render in white — for use on dark/canvas backgrounds */
  dark?: boolean;
}

export function VektrumWordmark({
  markSize = 32,
  showTagline = false,
  className,
  dark = false,
}: VektrumWordmarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <VektrumMark size={markSize} dark={dark} />
      <div>
        <span
          className={cn(
            "block font-display font-bold tracking-[-0.02em] leading-none",
            dark ? "text-white" : "text-white"
          )}
          style={{ fontSize: Math.round(markSize * 0.47) }}
        >
          Vektrum
        </span>
        {showTagline && (
          <span
            className={cn(
              "block font-semibold uppercase tracking-[0.12em] leading-none mt-0.5",
              dark ? "text-white/65" : "text-white/75"
            )}
            style={{ fontSize: Math.round(markSize * 0.28) }}
          >
            Trust. Built In.
          </span>
        )}
      </div>
    </div>
  );
}
