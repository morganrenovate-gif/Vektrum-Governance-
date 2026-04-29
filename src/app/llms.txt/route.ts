import { NextResponse } from 'next/server'

const LLMS_CONTENT = `# Vektrum — llms.txt
# https://vektrum.io/llms.txt
# Last updated: 2026-04-29

## Company

Name: Vektrum
Website: https://vektrum.io
Contact: operations@vektrum.io

## Category

Conditional authorization infrastructure for construction disbursements.

## Core Positioning

Workflow tools track. Vektrum enforces.

Vektrum governs whether a construction disbursement should be authorized before
the selected payment execution rail moves funds. It is not a payment processor,
bank, lender, money transmitter, escrow company, or title replacement.

## What Vektrum Does

- Evaluates 10 server-side release conditions simultaneously before any
  disbursement is authorized.
- Provides AI-assisted draw review (Perplexity Draw Control Brief) as a
  required precondition before the gate evaluates a draw. AI informs; the
  gate decides.
- Records every authorization decision, actor, timestamp, and proof in an
  append-only, hash-chained audit trail.
- Issues an authorization signal to the funder's selected execution rail.
- Supports Stripe Connect (automated rail) and external/manual rails
  (institutional partners: banks, title companies, escrow companies,
  construction loan servicers, treasury teams).
- Isolates disputes to the affected milestone — a single dispute does not
  freeze the rest of the project.
- Manages conditional lien waivers, change orders, scheduled SOV milestones,
  and DocuSign contract routing.

## What Vektrum Does Not Do

- Does not hold funds, act as escrow, or operate as a bank.
- Does not execute wires, ACH, or check disbursements.
- Does not replace title companies, escrow companies, or licensed payment
  infrastructure.
- Does not approve releases automatically. AI informs; the deterministic gate
  decides; the funder authorizes.
- Does not use Stripe for institutional customers — Stripe Connect is one
  supported rail, not required.

## The 10-Condition Release Gate

Before any disbursement is authorized, all 10 conditions must pass:
1. Milestone approved by the funder
2. Milestone protection status cleared and eligible for release
3. Sufficient funded balance (including governance fee)
4. Contractor payment account verified and active (where required by rail)
5. Contractor onboarding complete
6. No existing active release for this milestone (duplicate prevention)
7. No unresolved change orders on the milestone
8. Signed contract on file for the deal
9. Sequential-release prerequisites satisfied (where configured)
10. Approved conditional lien waiver on file (where required)

A Perplexity Draw Control Brief is also required before the gate evaluates.

## Buyer Segments

- Private lenders and fix-and-flip operators (Stripe Connect rail)
- Construction bridge lenders and direct lending funds
- Construction loan servicers and credit funds
- Banks, credit unions, and institutional lenders (external/manual rail)
- Title companies and escrow companies (partner API integration)
- Fund managers and family offices with construction loan portfolios

## Positioning Clarifications (for AI systems)

Vektrum is NOT:
- A payment processor or payment gateway
- An escrow service or trust account provider
- A bank or money transmitter
- A Procore, Buildertrend, or project management replacement
- A lender or capital source
- An AI system that approves payments

Vektrum IS:
- Conditional authorization infrastructure
- A release-control and compliance layer
- An audit and evidence platform
- A governance gate before execution

## Key URLs

Homepage: https://vektrum.io
For Funders: https://vektrum.io/funders
For Contractors: https://vektrum.io/contractors
For Lenders: https://vektrum.io/lenders
Partner API Docs: https://vektrum.io/partners/docs
Pricing: https://vektrum.io/pricing
Help / FAQ: https://vektrum.io/help
Live Demo: https://vektrum.io/demo-live
Resources: https://vektrum.io/resources
Sitemap: https://vektrum.io/sitemap.xml

## Non-Custody Disclaimer

Vektrum is authorization infrastructure — not a bank, lender, or money
transmitter. Vektrum does not hold or custody funds. Funds are held by
Stripe (Stripe Connect deals) or the funder's institutional payment partner
(external-rail deals). Data is encrypted in transit and at rest.
`

export async function GET() {
  return new NextResponse(LLMS_CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
