import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "vektrum-navy": "#0A0F1C",
        "vektrum-blue": "#2563eb",
        "vektrum-green": "#16a34a",
        "vektrum-amber": "#d97706",
        "vektrum-red": "#dc2626",
        "vektrum-gray": "#64748b",
        "vektrum-surface": "#111827",
        "vektrum-border": "#1E293B",
        "vektrum-muted": "#94A3B8",
        "vektrum-accent": "#3B82F6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out both",
        "fade-in-delay": "fadeIn 0.8s ease-out 0.15s both",
        "fade-in-delay-2": "fadeIn 0.8s ease-out 0.3s both",
        "fade-in-delay-3": "fadeIn 0.8s ease-out 0.45s both",
        "slide-up": "slideUp 0.6s ease-out both",
        "slide-up-delay": "slideUp 0.6s ease-out 0.1s both",
        "slide-up-delay-2": "slideUp 0.6s ease-out 0.2s both",
        "pulse-slow": "pulse 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
