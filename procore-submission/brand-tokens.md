# Vektrum Brand Tokens — extracted from code (source of truth for the deck rebuild)

All values pulled **exactly** from the repo. Citations point to the file each value lives in.

## Colors — core palette
Source: `src/app/globals.css` `:root` (lines 18–53) and `tailwind.config.ts` `theme.extend.colors`.

| Token | Hex | Where found | Use |
|---|---|---|---|
| Background (page) | `#F4F6FA` | globals.css `--background`; tw `vektrum-bg` | Light content-slide background ("blueprint grey") |
| Surface (card) | `#FFFFFF` | globals.css `--surface`; tw `vektrum-surface` | Cards |
| Surface alt | `#EEF2F8` | globals.css `--surface-alt` | Deeper surface / wells |
| Border | `#D0D8E8` | globals.css `--border` | Card/hairline borders |
| Border subtle | `#E4E8F0` | globals.css `--border-subtle` | Fine hairlines |
| Foreground (text) | `#141414` | globals.css `--foreground`; tw `vektrum-text` | Primary text |
| Muted | `#5A6478` | globals.css `--muted` | Secondary text |
| Faint | `#9AA3B5` | globals.css `--faint` | Tertiary/labels |
| **Accent (primary)** | **`#1A3A96`** | globals.css `--accent`; tw `vektrum-blue` | **Vektrum cobalt — primary brand accent** |
| Accent hover | `#132D78` | globals.css `--accent-hover`; tw `vektrum-blue-hover` | Hover/darker cobalt |
| Accent subtle | `#E8EDF8` | globals.css `--accent-subtle`; tw `vektrum-blue-subtle` | Tinted cobalt well (badges) |
| Canvas (near-black) | `#141414` | globals.css `--canvas`; tw `vektrum-canvas` | Dark surface / logo wordmark |
| Canvas text | `#F0F2F7` | globals.css `--canvas-text` | Text on near-black |

## Colors — dark surface hierarchy (the "app"/hero navy family)
Source: `tailwind.config.ts` + `globals.css` (lines 56–60).

| Token | Hex | Use |
|---|---|---|
| surface-0 | `#0D1B2A` | **Hero / title-slide background base** |
| surface-1 | `#0F1F30` | Nav strips |
| surface-2 | `#111827` | Cards on dark |
| surface-3 | `#1A2535` | Nested content |
| surface-4 | `#232D3F` | Hover rows |
| nav-bg | `#070D18` | App nav background (deepest) |

## Colors — semantic status
Source: `globals.css` lines 42–53; mirrored in `tailwind.config.ts`.

| State | Fg | Bg | Border |
|---|---|---|---|
| Success | `#1A7A4A` | `#EAF7F0` | `#B0DFC4` |
| Warning | `#9A5A0A` | `#FEF3E2` | `#F0CC80` |
| Error/Danger | `#B01C1C` | `#FEF0F0` | `#F0AAAA` |
| Info | `#1A3A96` | `#E8EDF8` | `#A8BAEA` |

## Foreground-on-dark opacities (for text over the navy hero)
Source: `globals.css` lines 76–81 (AA-tested against `#111827`).
`--fg-primary` white · `--fg-secondary` white@78% · `--fg-tertiary` white@62% · `--fg-label` white@65%.
→ For pptx (no alpha in hex), approximate as: secondary `#C7D0E0`, tertiary/label `#9FB0CC`.

## Hero treatment (title-slide background)
Source: `src/app/(marketing)/page.tsx` lines 80–83.
- Base: `bg-[#0D1B2A]` (= surface-0).
- Glow 1: radial, **top-center**, 900×500, `from-vektrum-blue/15 to-transparent`, `blur-3xl`, `rounded-full`.
  → cobalt `#1A3A96` at ~15% opacity fading to transparent.
- Glow 2: radial, **mid-right**, 500×500, `from-vektrum-blue/8 to-transparent`, `blur-3xl`.
  → cobalt `#1A3A96` at ~8% opacity.
- Recreate in pptx as: solid `#0D1B2A` + one large soft cobalt ellipse (top-center, high transparency) + a fainter one mid-right. **No new "navy" — use `#0D1B2A` exactly.**

## Typography
Source: `src/app/layout.tsx` (21–46), `tailwind.config.ts` `fontFamily` (76–80).

| Role | Font | Weights used | Var |
|---|---|---|---|
| **Display / headings** | **Instrument Sans** | 400, 500, 600, **700** | `--font-display` |
| **Body** | **Inter** | (default) | `--font-sans` |
| Mono / eyebrows / data | **JetBrains Mono** | (default) | `--font-mono` |

Display stack falls back to body → `system-ui`. **The deck's current Cambria/Calibri is wrong** — should be Instrument Sans (titles) + Inter (body). *Note for pptx: Instrument Sans and Inter are not PowerPoint-bundled; the deck should embed them, or fall back to a close safe pairing. Flag for confirmation (see below).*

## Logo
Source: `src/components/ui/vektrum-logo.tsx`.
- **The mark is a code-drawn SVG**, not a static asset — a geometric **double-line "V"**, viewBox `0 0 100 90`, stroke `#1A3A96` (light bg) or `#FFFFFF` (dark bg, via `dark` prop). Outer stroke width 10, inner 7; signature rectangular **notch** at top-right.
- Wordmark: "Vektrum", `font-display` bold, tracking `-0.02em`. Tagline: **"TRUST. BUILT IN."** mono, uppercase, `0.12em` tracking.
- Only static SVG in `public/` is `og-image.svg` (social card, contains branding) — **not** a clean logo lockup.
- **Recommendation:** redraw the V-mark natively in pptx from the exact geometry (white on the dark title slide, cobalt on light) rather than embed a raster — matches how the product renders it.

## Accent motifs to echo (from the landing page)
- Dark hero + soft **cobalt radial glow** (title slide).
- **Blueprint-grey** `#F4F6FA` content surface with white cards, hairline borders `#D0D8E8`.
- **Mono uppercase eyebrow labels** with wide letter-spacing (`--font-mono`, ~0.12–0.2em).
- Rounded cards (`rounded-xl` ≈ 12px, `rounded-2xl` ≈ 16px); pill chips (`rounded-full`).
- Status = **icon + tinted bg + border + colored text** (never color alone).
- Single accent discipline: cobalt is the only brand accent; semantic green/amber/red only for status.

## Flags / things to confirm before I rebuild
1. **Fonts in PowerPoint:** Instrument Sans + Inter aren't Office-bundled. Options: (a) **embed the fonts** in the .pptx (truest to brand, larger file), or (b) fall back to a safe near-match (e.g., Inter→Calibri/Arial). Which do you want?
2. **Procore's color on the boundary slide:** there is **no Procore token in our repo** (correctly). The current deck uses an orange `#D9621C` to represent "Procore's zone." Keep a neutral/orange to denote Procore, or render Procore's zone in grey and reserve cobalt for Vektrum? (Recommend: Vektrum zone = cobalt `#1A3A96`; Procore zone = neutral slate, not a guessed Procore orange.)
3. **Semantic greens/reds** in the deck (gate pass/blocked) — keep the exact brand `#1A7A4A` / `#B01C1C`? (Recommend yes.)

**STOP — awaiting your confirmation on the palette (and the two font/Procore-color questions) before rebuilding the deck.**
