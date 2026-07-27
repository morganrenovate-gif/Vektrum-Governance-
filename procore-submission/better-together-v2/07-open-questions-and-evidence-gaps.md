# 07 — Open Questions & Evidence Gaps

## Questions for the founder / Procore Technology Partner team

1. **Sandbox verification evidence.** Has the Phase 1A OAuth flow completed a successful end-to-end handshake against the registered Developer Sandbox app (connect → callback → identity → project list)? A screenshot or sanitized log would upgrade J-02 from "implemented but not fully verified" to "implemented and verified."
2. **Registered Procore app status.** Is a Procore developer app registered (client ID issued, redirect URI approved, scopes configured)? Code implies yes (`PROCORE_SANDBOX_COMPANY_ID` test fixture `4287207`), but registration state is outside the repo.
3. **Supported-object scope for Phase 1B.** Which Procore objects should the production read integration commit to first (prime contract SOV, change events/orders, documents/photos, invoices)? All current mappings are conceptual (`apiValidated: false`).
4. **Write-back target.** For returning authorization proof to the project record: document attachment, custom field/status, or correspondence item? Affects Slide 6 "planned" wording precision.
5. **Design partners.** Any nameable lender/GC design-partner conversations for the joint pilot, or keep "scope a joint design-partner pilot" generic?
6. **Named alliances contact.** Who is the named Vektrum sales/alliances contact for Slide 7? Currently labeled missing.
7. **Marketplace intent.** Confirm timeline for pursuing a Marketplace listing so Slide 6 language can stay accurate over time.

## Evidence gaps that would strengthen the deck

| Gap | What would close it | Slide impact |
|---|---|---|
| No joint customers or metrics | One design-partner pilot with measured draw-cycle and audit-prep outcomes | Slide 5 replaces illustrative scenarios with customer data |
| No runtime E2E sandbox proof | A recorded sandbox connect + project-list session | Slide 6 CTA firms up; truth table upgrades |
| No Marketplace listing | Complete Procore technical review + listing submission | Slides 6–7 |
| No independently verifiable market statistic | A citable industry source for draw-process pain (accessible network required) | Slide 3 could quantify the challenge |
| Official template not in-environment (30.6 MB > 10 MB tool limit) | Place a copy of the official `.pptx` in the repo (e.g. `procore-submission/template/`) or work in Google Slides directly | Deliverables 9–11 become template-native |
| Live-site fetches blocked (403 proxy) for vektrum.io / procore.com / brand.procore.com | Run link/copy verification from an unrestricted environment before sending externally | Slide 7 link QA |
| `PROCORE_*` env vars not in `.env.example` | Add documented placeholders (no real values) | Internal operator setup (not deck copy) |

## Standing constraints (do not relax)

- Never present the simulated prototype, the sandbox connection, or planned reads/writes as a live production integration.
- No Procore endorsement/certification implied without documentation.
- No fabricated customers, quotes, metrics, or Procore object mappings.
- The $15K/$9M and $2.18M scenarios must always carry their "illustrative" labels.
