import type { Config } from "tailwindcss";

// ── Vektrum Brand Color Tokens ──────────────────────────────────────────────
//
// Source: Vektrum logo (2.jpg) — exact pixel extraction
//   Logo cobalt blue : #1A3A96  (dominant V mark color)
//   Logo near-black  : #141414  (wordmark and dark surfaces)
//   Tagline          : "TRUST. BUILT IN." — institutional, structural
//
// All Tailwind custom colors mirror the CSS variables in globals.css.
// Use the vektrum-* tokens in components instead of raw Tailwind color names
// so rebranding only requires changes in this one file + globals.css.
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Core brand ──────────────────────────────────────────────────────
        "vektrum-blue":         "#1A3A96",   // Logo cobalt — primary accent
        "vektrum-blue-hover":   "#132D78",   // Hover state (10% darker)
        "vektrum-blue-subtle":  "#E8EDF8",   // Tinted bg for badges / wells
        "vektrum-blue-border":  "#A8BAEA",   // Bordered info states
        "vektrum-canvas":       "#141414",   // Logo near-black — dark sections
        "vektrum-canvas-text":  "#F0F2F7",   // Text on dark canvas

        // ── Surfaces & borders ───────────────────────────────────────────────
        "vektrum-bg":           "#F4F6FA",   // Page background (blueprint grey)
        "vektrum-surface":      "#FFFFFF",   // Card / panel surface
        "vektrum-surface-alt":  "#EEF2F8",   // Slightly deeper surface
        "vektrum-border":       "#D0D8E8",   // Blue-tinted border
        "vektrum-border-subtle":"#E4E8F0",   // Hairline borders

        // ── Typography ───────────────────────────────────────────────────────
        "vektrum-text":         "#141414",   // Primary text
        "vektrum-muted":        "#5A6478",   // Secondary text
        "vektrum-faint":        "#9AA3B5",   // Tertiary / placeholder

        // ── Semantic status ──────────────────────────────────────────────────
        "vektrum-green":        "#1A7A4A",   // Success
        "vektrum-green-bg":     "#EAF7F0",
        "vektrum-green-border": "#B0DFC4",

        "vektrum-amber":        "#9A5A0A",   // Warning
        "vektrum-amber-bg":     "#FEF3E2",
        "vektrum-amber-border": "#F0CC80",

        "vektrum-red":          "#B01C1C",   // Error / danger
        "vektrum-red-bg":       "#FEF0F0",
        "vektrum-red-border":   "#F0AAAA",

        // ── New tokens (Phase 0) ─────────────────────────────────────────────
        "vektrum-blue-glow":    "rgba(26,58,150,0.15)",  // AI panel pulse ring
        "vektrum-score-low":    "#1A7A4A",  // Dispute risk — low (green)
        "vektrum-score-med":    "#9A5A0A",  // Dispute risk — medium (amber)
        "vektrum-score-high":   "#B01C1C",  // Dispute risk — high (red)
        "vektrum-surface-raised": "#F9FAFB", // Wizard overlay panels

        // ── Dark surface hierarchy ────────────────────────────────────────────
        // Use these instead of hardcoded hex to keep the dark theme coherent
        "surface-0":  "#0D1B2A",   // Page / app background
        "surface-1":  "#0F1F30",   // Sidebar, nav strips
        "surface-2":  "#111827",   // Cards, panels (standard)
        "surface-3":  "#1A2535",   // Nested content, subtle separators
        "surface-4":  "#232D3F",   // Hover states, selected rows

        // ── Nav ──────────────────────────────────────────────────────────────
        "nav-bg":     "#070D18",   // App navigation background
      },

      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },

      // ── Shadow Hierarchy ────────────────────────────────────────────────────
      // Light-context:  xs → sm → md → lg → xl  (standard elevation scale)
      // Dark-context:   card → card-hover → feature  (semantic dark shadows)
      //
      // Always use the named dark-context shadows on navy backgrounds —
      // never use inline style={{ boxShadow: '...' }} for dark cards.
      boxShadow: {
        xs:  "0 1px 2px 0 rgba(20,20,20,0.04)",
        sm:  "0 1px 3px 0 rgba(20,20,20,0.07), 0 1px 2px -1px rgba(20,20,20,0.04)",
        md:  "0 4px 6px -1px rgba(20,20,20,0.08), 0 2px 4px -2px rgba(20,20,20,0.05)",
        lg:  "0 10px 15px -3px rgba(20,20,20,0.10), 0 4px 6px -4px rgba(20,20,20,0.06)",
        xl:  "0 20px 25px -5px rgba(20,20,20,0.12), 0 8px 10px -6px rgba(20,20,20,0.07)",
        "2xl": "0 25px 50px -12px rgba(20,20,20,0.20)",
        // Dark-surface card shadows — use instead of inline style on bg-surface-2 cards
        "card":       "0 1px 3px rgba(0,0,0,0.20), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06)",
        "feature":    "0 8px 32px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.05)",
        // Brand-tinted shadow for primary CTAs
        blue: "0 4px 14px 0 rgba(26,58,150,0.30)",
        // Deep drama shadows — hero product card, scenario cards (dark context)
        "deep":  "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "scene": "0 24px 60px rgba(0,0,0,0.4)",
        // Lifted shadows — light-surface marketing cards (Proof, AI section)
        "lift":  "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
        // Float shadow — feature / role / step cards (light context)
        "float": "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        // Inner shadow for inset wells
        inner: "inset 0 2px 4px 0 rgba(20,20,20,0.06)",
        none: "none",
      },

      animation: {
        "fade-in":          "fadeIn 0.8s ease-out both",
        "fade-in-delay":    "fadeIn 0.8s ease-out 0.15s both",
        "fade-in-delay-2":  "fadeIn 0.8s ease-out 0.3s both",
        "fade-in-delay-3":  "fadeIn 0.8s ease-out 0.45s both",
        "slide-up":         "slideUp 0.6s ease-out both",
        "slide-up-delay":   "slideUp 0.6s ease-out 0.1s both",
        "slide-up-delay-2": "slideUp 0.6s ease-out 0.2s both",
        "pulse-slow":       "pulse 4s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
