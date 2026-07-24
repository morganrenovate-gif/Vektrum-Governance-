# 01 — Source Audit (Pre-Production)

**Assignment:** "Better Together: Vektrum + Procore" solution brief + seven-slide deck content.
**Date:** 2026-07-24.
**Mode:** Audit-first. No production release-gate, token, audit, billing, Stripe, Partner API, RLS, or admin code was modified.

---

## A. Source inventory

### Required governing documents (both located and read in full)

| Document | Location | Status |
|---|---|---|
| Vektrum Master System Prompt / Operating Constitution v1.0 (May 2026, 38 pp) | `public/vektrum-master-system-prompt.pdf` | **Read in full.** Governs all conflicts. |
| "AI Instructions for Procore Better Together Solution Brief \| Deck" | Google Drive doc `1rhCfF-lnJ1JQQnWOebORhQBF-UTg9_BulKXXn20hf2w` (linked from the template's "AI Prompt Here") | **Read in full.** Defines the 7-slide output contract, Core Partner Data block, and the "do not introduce unsupported facts" constraint. |
| Official Better Together deck template (9 pages: 7 content slides + Appendix + Demo Video) | Uploaded PDF `Template__Better_Together_Deck_for_Procore__Insert_Partner_Solution.pdf`; editable `.pptx` (30.6 MB) and Google Slides master found in Drive | PDF **read in full** (all 9 pages extracted). **Editable `.pptx` could not be retrieved into this environment** — it exceeds the 10 MB Drive-tool download/export limit. See §D. |

### Repository files inspected (read-only)

**Procore integration code (Phase 1A — sandbox OAuth):**
- `src/lib/integrations/procore/config.ts` — env-gated config; hard-fails unless `PROCORE_ENVIRONMENT=sandbox` **and** `PROCORE_WRITE_OPERATIONS_ENABLED=false`; pins Developer Sandbox URLs (`login-sandbox.procore.com`, `sandbox.procore.com`); allowlists the redirect URI to localhost or vektrum.io.
- `src/lib/integrations/procore/client.ts` — read-only client: `GET /rest/v1.0/me` (identity), `GET /rest/v1.1/projects` (project list). No POST/PUT/PATCH/DELETE.
- `src/lib/integrations/procore/oauth.ts`, `crypto.ts` — SHA-256 state hashing; AES-256-GCM token encryption at rest.
- `src/app/api/integrations/procore/{connect,callback,status,disconnect,projects,projects/select}/route.ts` — funder-role-gated OAuth start/callback, sanitized status, disconnect (tokens nulled), sandbox project listing, single-project selection. All audit-logged.
- `supabase/migrations/20260719000000_procore_sandbox_oauth.sql`, `20260720000000_procore_connection_metadata.sql` — `procore_oauth_transactions` + `procore_connections` (sandbox-only CHECK constraint; RLS enabled with deliberately **no** authenticated policies — server-only).
- `src/components/settings/procore-sandbox-tab.tsx`, `src/components/dashboard/procore-integration-card.tsx`, `src/app/(app)/dashboard/funder/integrations/procore/page.tsx` — funder-only UI; no secrets rendered.

**Simulated prototype (`/demo-live/procore`):**
- `src/app/(marketing)/demo-live/procore/page.tsx`, `ProcoreDemoWorkspace.tsx`, `_components/*` (5 chapter components + primitives), `_lib/fixtures.ts`, `_lib/machine.ts`, `_lib/types.ts` — pure fixture-driven state machine; no fetch, no env, no OAuth, no production imports (enforced by test). Fictional scenario: Harbor Point Medical Center (HPMC-2026-014), Draw Request #07, $2,180,000 gross, external rail, authorization record `DEMO-AUTH-HPMC-07`, external confirmation `DEMO-MWTE-88241`. Disclosure string: "Simulated integration concept — fictional demo data only. No external system is connected and no funds are moved."

**Tests:**
- `tests/procore-oauth-security.test.ts`, `tests/procore-phase1a-safety.test.ts`, `tests/procore-funder-access.test.ts` (npm script `test:procore`)
- `tests/demo-procore-prototype.test.ts` (70 behavioral + banned-language checks)
- Core-mechanism suites run for this audit: `release-gate.test.ts` (55), `partner-scope-isolation.test.ts` (6), `demo-dispute-resolution.test.ts` (24), `tier-b1-authorization-token.test.ts`, `audit-chain-health.test.ts` (28).

**Prior Procore deliverables (draft inputs, now partially outdated):**
- `procore-submission/00-integration-inventory.md` (Step 1 inventory — predates Phase 1A code; see contradiction register)
- `procore-submission/better-together-outline.md` (8-slide custom outline)
- `procore-submission/vektrum-procore-better-together.pptx` (8-slide custom "Technical Feasibility" deck — **not** the official 7-slide template)
- `procore-submission/brand-tokens.md`, `integration-diagram.md`, `.mmd`, `assets/integration-diagram.{png,svg}`

**Context and positioning docs:**
- `CLAUDE.md`, `docs/ai/MASTER_CONTEXT.md`, `docs/ai/BACKLOG.md`
- Marketing site source (the deployed vektrum.io is built from this repo): `src/app/(marketing)/**` — verified routes exist for `/`, `/demo-live`, `/demo-live/procore`, `/security`, `/resources`, `/resources/construction-dispute-isolation`, `/funders`, `/contractors`, `/pricing`, `/contact`, `/demo`; `operations@vektrum.io` confirmed on `/contact`.
- `.env.example` — contains **zero** `PROCORE_*` entries (gap; env names exist only in code/tests).

### Public URLs

Direct fetches of `vektrum.io/*`, `procore.com/*`, `developers.procore.com/*`, and `brand.procore.com/*` were **blocked by this environment's outbound network policy (HTTP 403 at the proxy)**. Handling:
- **Vektrum pages:** audited from the repository source that generates them (higher in the governing hierarchy than the rendered site).
- **Procore pages:** used only search-verified facts from official Procore domains, kept minimal and conservative; full page audit is recorded as **not run** in `08-source-register.md`.
- **Procore Marketplace:** a web search for a Vektrum listing returned **no listing**. The deck therefore uses only the general Marketplace URL and "pursue Marketplace readiness" language.

---

## B. Integration truth table

See `02-integration-truth-table.md` (kept as its own deliverable).

## C. Contradiction register

| # | Conflict | Sources | Controlling source | Handling |
|---|---|---|---|---|
| 1 | "There is no Procore integration in this codebase today… no Procore OAuth client" vs. present Phase 1A OAuth + read-only sandbox client | `procore-submission/00-integration-inventory.md` vs. current code (commits `4682dbf`, migrations dated 2026-07-19/20) | Current repository code (constitution rank 2) | Inventory treated as an outdated snapshot; truth table reflects current code. Phase 1A is classified **implemented but not fully verified** (no runtime E2E evidence in repo). |
| 2 | Prior deck lists "Procore OAuth app [PROPOSED]" | `better-together-outline.md`, existing `.pptx` slide 8 | Current repository code | New copy upgrades OAuth/read connectivity to "current implementation is designed to… (Developer Sandbox, read-only)". |
| 3 | Prior deck subtitle "Real-time draw verification" | Existing `.pptx` slide 1 vs. banned-language list ("real-time sync unless proved") | Master System Prompt + assignment §14 | Phrase dropped; nothing real-time is proved. |
| 4 | Prior deck slide 3 present-tense "It **reads** Levelset waiver status" | Existing `.pptx` vs. repo (no Levelset/Procore waiver read exists; prototype simulates it) | Repository | Rewritten as simulated/planned; Vektrum's own `lien_waivers` gating (Condition 10) is real and is what the deck claims. |
| 5 | Settings UI label "Live Procore Development Sandbox" could read as a live production integration | `procore-sandbox-tab.tsx` vs. external-copy standards | Master System Prompt (no overclaim) | External copy says "validated against the Procore Developer Sandbox (read-only)"; never "live integration." |
| 6 | User instruction search term `AUTH-HPMC-07-2026` vs. actual fixture `DEMO-AUTH-HPMC-07` | Assignment §6 vs. `_lib/fixtures.ts` | Repository | Deck/audit cite the identifier as it actually exists: `DEMO-AUTH-HPMC-07` (inert demo reference). |
| 7 | Master prompt bans inviting the comparison "Vektrum is like Procore for payments" while this deck is Procore-facing | Master System Prompt §4.4 | Master System Prompt | Deck positions Vektrum as a complementary governance layer; never as "Procore for payments," never as a Procore alternative, and never diminishes Procore. |

## D. Missing-information register

Proceeding conservatively; each gap is visibly labeled rather than blocking.

| Missing fact | Impact | Interim handling |
|---|---|---|
| Editable official Better Together `.pptx` in this environment (Drive file is 30.6 MB > 10 MB tool limit) | Cannot produce the template-native deck here | 8 core deliverables + a clearly labeled **working draft** deck produced; final step: open the Drive template and paste `05-better-together-slide-copy.md` blocks in |
| Production Procore integration status / launch date | Slide 4/6 tense | All Procore-facing capability written as sandbox-validated, simulated, or planned |
| Procore Marketplace listing for Vektrum | Slide 6/7 | None found; "pursue Marketplace readiness" used; general Marketplace URL only |
| Joint Vektrum + Procore customers, metrics, testimonials | Slide 5 | None exist; illustrative scenarios used and labeled; no fabricated proof |
| Procore certification / security review / endorsement | Slide 6 | Not claimed |
| Specific supported Procore objects beyond identity + project list | Slide 3/4 | Object mappings labeled "conceptual — API feasibility and permissions not yet validated" (matches prototype's own caveat) |
| Named Vektrum sales/alliances contact | Slide 7 | Labeled missing; `operations@vektrum.io` (verified in repo) used as the company contact |
| Runtime evidence of a successful sandbox OAuth handshake (screenshots/logs) | Truth-table tier | Phase 1A stays "implemented but not fully verified" |
| Procore official page audit (403-blocked) | Source register completeness | Recorded as limitation; only search-verified official facts used |
| `PROCORE_*` vars absent from `.env.example` | Operator setup friction (internal) | Flagged in open questions; no code change made (out of scope) |
