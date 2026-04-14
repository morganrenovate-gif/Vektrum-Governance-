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
        "vektrum-navy": "#0f172a",
        "vektrum-blue": "#2563eb",
        "vektrum-green": "#16a34a",
        "vektrum-amber": "#d97706",
        "vektrum-red": "#dc2626",
        "vektrum-gray": "#64748b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
