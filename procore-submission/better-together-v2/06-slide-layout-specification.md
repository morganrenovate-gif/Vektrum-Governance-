# 06 — Slide Layout Specification

The official editable Better Together template (Google Slides / 30.6 MB `.pptx` in Drive) could not be retrieved into this environment, so this specification maps the finalized copy onto the official template's structure for whoever pastes it in — and drives the clearly labeled **working draft** deck in `working-draft/`. The working draft is **not** the official Procore template and must not be represented as such.

## Global visual rules

- **Structure:** exactly the official template's 7 content slides (plus its Appendix/Demo Video pages if the official file is used). Keep text within existing placeholder boundaries; do not restyle the official master.
- **Logos:** Vektrum + Procore at equal visual weight on Slide 1 only; official, unaltered logo files only (Procore's from brand.procore.com). The working draft uses Vektrum's code-accurate V-mark and a neutral placeholder frame for the Procore logo rather than a recreated logo.
- **Vektrum brand tokens** (from `procore-submission/brand-tokens.md`, extracted from the app source): cobalt `#1A3A96` accent; dark hero `#0D1B2A`; light surface `#F4F6FA` with white cards and `#D0D8E8` hairlines; semantic green `#1A7A4A` / red `#B01C1C` for pass/blocked; mono uppercase eyebrow labels. In the working draft, Procore-side elements are rendered **neutral slate** — no guessed Procore brand color.
- **Fonts (working draft):** Arial for body/labels, bold Arial for titles (safe-render set). The official template's own fonts govern the final deck.
- **Status honesty on visuals:** anything Procore-connected is marked "Simulated" or "Planned"; solid outlines = live Vektrum capability, dashed = simulated/planned.
- No invented-data charts. No decorative accent bars.

## Slide-by-slide

### Slide 1 — Title & Logos (dark hero)
Background `#0D1B2A` with a soft cobalt radial glow (top-center). Centered lockup: Vektrum V-mark + wordmark, a "+" separator, Procore logo frame (equal box heights). Title 40pt bold; subtitle 16pt at 78% white, max 2 lines. Footer eyebrow (mono, 10pt): "CONDITIONAL AUTHORIZATION INFRASTRUCTURE FOR CONSTRUCTION DISBURSEMENTS".

### Slide 2 — Key Message (light)
Power statement as a two-line display headline (26–28pt) across the top. Below, two columns: left "Who This Is For" — three rows, each an icon-in-cobalt-circle + one sentence; right "Why It Matters" — three white cards with bold lead-in phrases ("Enforcement, not tracking." / "Proof by default." / "No rip-and-replace."). 14pt body.

### Slide 3 — Customer Challenge & Joint Solution (light)
Left column (~55%): "The Challenge" — three short cards, red-tinted icon chips. Right column: "The Joint Solution" — three ≤6-word outcome statements in cobalt, stacked, 18pt bold. Bottom band: the 30-second workflow strip — four nodes with arrows: `Procore project & cost records` → `Vektrum 10-condition release gate` → `Authorized funder decides` → `Customer's rail executes` — with a small caption "Proof recorded at every step." Procore node neutral slate; Vektrum nodes cobalt; the record-feed arrow dashed and tagged "simulated / planned."

### Slide 4 — Real-World Use Cases (light)
Three equal cards ("when X happens, Y happens"): title 16pt bold (Change-order-aware draw readiness / Lien-waiver completeness / Milestone isolation + execution proof), body 13–14pt, each with a small status chip: "Gate: live in Vektrum" (green) + "Procore feed: simulated" (neutral). Full-width 10.5pt footnote: "Release-gate enforcement is live in Vektrum today. The Procore-connected workflow is demonstrated as a simulated concept; production integration is planned."

### Slide 5 — Outcomes: ROI & Customer Proof (light)
Left: four benefit rows, bold lead metric/outcome + one-line explanation; the "10 required conditions" row carries an "Internal product metric" tag. Right: two proof cards, each with an eyebrow label "ILLUSTRATIVE SCENARIO — NOT CUSTOMER DATA" (the $2.18M simulated draw; the $15K/$9M isolation scenario). Bottom strip: the no-joint-customer disclosure line, 10.5pt.

### Slide 6 — Why We Win Together & What's Next (light)
Top: 2×2 differentiator grid (bold one-line claim + one supporting sentence each). Bottom: two CTA columns — "FOR PARTNERS" / "FOR CUSTOMERS", three checklist items each. The sandbox-connectivity bullet keeps its "read-only, Developer Sandbox" qualifier verbatim.

### Slide 7 — Resources & Contact (dark hero, mirrors Slide 1)
Left: "Key Links" — five links, each label + URL on one line, 13pt. The Marketplace line reads "Procore Marketplace (general)". Right: "Get in Touch" — Procore Partnerships (techpartners@procore.com), Vektrum (operations@vektrum.io), and a visibly labeled "[Named alliances contact — to be supplied]" slot in muted style.

## To produce the final template-compliant deck (missing prerequisite)

1. Obtain the editable official template: Drive file `Template | Better Together Deck for Procore + [Insert Partner Solution].pptx` (ID `1zc9xsl5dN0tQ9OfB1DLuCTj07t66nf_W`) or duplicate the Google Slides master (ID `1z0tY_UDZ9_QYiDm4vMEpnamn2OQQGNcC9yuqBzCDzR8`).
2. Duplicate it; paste each block from `05-better-together-slide-copy.md` into the matching placeholder, keeping the template's own styling and boundaries.
3. Insert both official logos on Slide 1 at equal weight; delete every instructional note (including the template's own "Remove this upon deck finalization" notes and all bracketed internal notes).
4. Re-run the QA checklist at the end of `05-better-together-slide-copy.md`, then export PDF and visually inspect every slide.
