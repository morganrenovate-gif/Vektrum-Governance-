# 08 — Source Register

Date accessed for all entries: **2026-07-24** (America/Denver assumed for the workspace).

## 1. Governing documents

| Source | Title | Access | Supports |
|---|---|---|---|
| `public/vektrum-master-system-prompt.pdf` | Vektrum Master System Prompt — Operating Constitution v1.0 (May 2026) | Read in full (38 pp, text-extracted) | V-01…V-11, C-01, C-02, all banned/approved language rules |
| Google Drive doc `1rhCfF-lnJ1JQQnWOebORhQBF-UTg9_BulKXXn20hf2w` | "AI Instructions for Procore Better Together Solution Brief \| Deck" (Procore Tech Partner Team) | Read in full | 7-slide contract, Core Partner Data block, "no unsupported facts" constraint, P-03 |
| Uploaded PDF `Template__Better_Together_Deck_for_Procore__Insert_Partner_Solution.pdf` | Official Better Together deck template (9 pages) | Read in full (all pages text-extracted) | Slide structure, placeholder intent, P-03 |
| Drive `.pptx` `1zc9xsl5dN0tQ9OfB1DLuCTj07t66nf_W` (30.6 MB) and Google Slides `1z0tY_UDZ9_QYiDm4vMEpnamn2OQQGNcC9yuqBzCDzR8` | Editable official template | **Located; not retrievable here** (exceeds 10 MB Drive-tool download/export limit) | Missing-prerequisite note in 06 |

## 2. Repository evidence (rank 2 in the governing hierarchy)

| Source | Supports |
|---|---|
| `src/lib/engine/release-gate.ts` + `tests/release-gate.test.ts` (55/55 passed 2026-07-24) | V-02, M-01 |
| `supabase/migrations/*audit*`, `tests/audit-chain-health.test.ts` (28/28) | V-05 |
| `supabase/migrations/20260504000001_authorization_tokens.sql`, `tests/tier-b1-authorization-token.test.ts` (pass) | V-10 |
| `src/app/api/partner/*`, `tests/partner-scope-isolation.test.ts` (6/6) | V-04, V-07, V-11 |
| `tests/demo-dispute-resolution.test.ts` (24/24), `disputes` schema | V-08 |
| `src/lib/integrations/procore/*`, `src/app/api/integrations/procore/*`, migrations `20260719000000` + `20260720000000`, `npm run test:procore` (3/3 suites passed) | J-02 |
| `src/app/(marketing)/demo-live/procore/**`, `tests/demo-procore-prototype.test.ts` (70/70) | J-01, J-03, M-02 |
| `src/app/(marketing)/resources/construction-dispute-isolation/page.tsx`, homepage, help page | V-12, M-03 |
| `src/app/(marketing)/contact/page.tsx` | operations@vektrum.io (Slide 7) |
| Marketing route tree `src/app/(marketing)/` | Existence of /, /demo-live, /security, /resources, /funders, /contractors, /pricing, /contact (Slide 7 links) |
| `procore-submission/{00-integration-inventory.md, better-together-outline.md, vektrum-procore-better-together.pptx, brand-tokens.md, integration-diagram.*}` | Prior-draft input; contradiction register items 1–4; visual tokens |
| `CLAUDE.md`, `docs/ai/MASTER_CONTEXT.md`, `docs/ai/BACKLOG.md` | Workflow + positioning constraints |

## 3. Official public web sources

Direct fetches of vektrum.io, procore.com, developers.procore.com, brand.procore.com, and marketplace.procore.com returned **HTTP 403 from this environment's egress proxy** (network policy). They were **not** reviewed as rendered pages; that limitation is recorded rather than claimed otherwise. Vektrum page content was audited from this repository's source (which generates the site). Procore facts were limited to what official-domain results returned through web search:

| Page (official domain) | URL | Access method | Supports |
|---|---|---|---|
| Procore — Construction cost management software | https://www.procore.com/cost-management | Search result (direct fetch blocked) | P-01 |
| Procore — Project Financial Software | https://www.procore.com/project-financials | Search result | P-01 |
| Procore Support — Payment Applications / Change Orders / Budget changes on owner invoices | support.procore.com (multiple) | Search result | P-01 |
| Procore — Technology Partner Overview | https://developers.procore.com/documentation/partner-overview | Search result | P-02 |
| Procore Marketplace | https://marketplace.procore.com/ | Search result; **no Vektrum listing found** | P-02; Tier D exclusion of any listing claim |
| Procore brand portal | https://brand.procore.com/document/10 | **Not accessible** (403) | Logo/brand handling deferred to whoever finalizes the official file |
| Vektrum public pages (/, /demo, /funders, /contractors, /pricing, /demo-live, /security, /resources, /resources/construction-dispute-isolation, /terms, /contact) | https://www.vektrum.io/… | **Rendered pages not accessible (403); audited from repo source** | V-01, V-12, Slide 7 links |

## 4. Claim-support cross-check

Every deck claim ID (V-01…V-12, J-01…J-05, P-01…P-03, M-01…M-03, C-01…C-02) appears in at least one register row above. Tier D items are excluded from the deck entirely (see `03-claim-ledger.md`).
