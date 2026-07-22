# Vektrum ROI Estimator

Interactive, self-contained ROI calculator for a **contractor/builder** or a
**lender/fund-control** audience. Estimates the annual value of governed draw
release across three levers: **team time saved**, **cash-flow timing**, and
**dispute/lien exposure avoided**. Every figure is driven by editable assumptions.

## Live (shareable) URL
Published as a Claude artifact (default-private; share from the page's share menu):
**https://claude.ai/code/artifact/245defc5-f378-42ba-8b03-7b39efb8b1b7**

## Files
- `vektrum-roi-estimator.html` — self-contained microsite (brand fonts inlined, no
  network calls). Open directly in a browser, or host anywhere as a static file.

## What it computes
- **Time & labor** = draws/yr × hours per draw × % removed × loaded hourly cost
- **Cash-flow value** = draw volume × (days saved ÷ 365) × cost of capital  *(a timing benefit, not new revenue)*
- **Dispute exposure avoided** = draws/yr × dispute probability × avg event cost × % reduced
- **Total annual value** = sum of the three

## Notes
- Deterministic; recomputes live as assumptions change.
- Persona toggle (Contractor / Lender) sets sensible defaults; every field is editable.
- "Copy shareable link" encodes the current scenario in the URL so a configured
  estimate can be shared in a meeting.
- Copy is truth-locked: figures are labelled illustrative planning inputs, and
  Vektrum is described as non-custodial authorization infrastructure (it does not
  move or hold funds).
