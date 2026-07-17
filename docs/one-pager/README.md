# Vektrum One-Pager

The definitive one-page introduction to Vektrum — **Construction Payment Governance Infrastructure**.
Portrait, US Letter, single page. Every claim is grounded in the actual implementation (see the spec's *Accuracy provenance* table).

## Files

| File | Purpose |
|---|---|
| `vektrum-one-pager.pdf` | **Print-ready.** One Letter page. Send straight to a printer. |
| `vektrum-one-pager.html` | Self-contained page (brand fonts + QR inlined, no external requests). Open in a browser, or Print → Save as PDF (Chrome). |
| `vektrum-one-pager-preview.png` | Screen render for quick reference. |
| `vektrum-one-pager-spec.md` | Master specification: copy, layout blueprint, type/spacing/color specs, diagram spec, print recommendations, expert + contrarian panel reviews, confidence score. |

## Core message

> **Unauthorized draws don't get released.**
> Vektrum verifies every release condition before a construction draw is authorized.

The current files are the **v2 redesign** (leads with prevention + a live "RELEASE BLOCKED" gate card). The earlier version is archived as `vektrum-one-pager-v1.*`; see the spec's v2 note for the rationale.

## Regenerating the PDF

Open `vektrum-one-pager.html` in Chrome → Print → destination "Save as PDF" → paper "Letter", margins "None", **Background graphics ON**. The page's print CSS scales it to fit exactly one page.
