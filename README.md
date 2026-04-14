# Vektrum — Construction Payment Governance

## What is Vektrum?

The construction industry loses billions annually to payment disputes and frozen funds. In a typical scenario, a funder wires $9M to a contractor at deal start — and when a dispute arises over one milestone, the entire project capital gets frozen, halting work across the whole site. Vektrum solves this by replacing upfront bulk transfers with milestone-conditional escrow: funds are deposited into Stripe-held accounts at deal creation, and each milestone's tranche releases only after the funder explicitly approves verified completion. Disputes are scoped to individual milestones, leaving the rest of the project cash-flow intact. Every action — from status changes to payment transfers — is recorded in an immutable audit log.

## Tech Stack

- **Next.js 15** (App Router, React Server Components, Server Actions)
- **Supabase** (Postgres + Auth + Row-Level Security)
- **Stripe Connect** (contractor payouts via direct charges)
- **Tailwind CSS** (utility-first, mobile-first)
- **TypeScript** (strict mode throughout)

## Setup Instructions

### 1. Clone and install

```bash
git clone [your-repo-url]
cd vektrum
npm install
```

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   ```
   supabase/migrations/001_schema.sql
   ```
3. Copy your credentials from **Settings > API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon (public) key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Stripe Setup

1. Create an account at [stripe.com](https://stripe.com)
2. Enable **Connect** in the Stripe Dashboard under Settings > Connect
3. Copy your secret key from **Developers > API keys** → `STRIPE_SECRET_KEY`
4. Create a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
5. Subscribe to these events:
   - `account.updated` — contractor onboarding complete
   - `payment_intent.succeeded` — deal funded
6. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. Never commit this file — it is already in `.gitignore`.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Create Test Users

1. **Contractor**: Sign up at `/auth/signup`, select "Contractor"
2. **Funder**: Sign up at `/auth/signup`, select "Funder"
3. **Admin**: Sign up normally, then go to **Supabase Dashboard > Table Editor > profiles** and manually update the `role` column to `admin`

---

## System Architecture

### Role Separation

| Role | Can do |
|------|--------|
| **Contractor** | Create deals, add milestones, start/submit milestone work |
| **Funder** | Fund deals, approve/reject milestones, release payments |
| **Admin** | View all deals, access audit log |

Roles are self-selected at signup (contractor or funder). Admin is never self-selectable — it is assigned manually via the Supabase dashboard.

### Deal State Machine

```
draft → active (when funder funds the deal)
active → completed (when all milestones are released)
active → disputed (when a milestone dispute is raised)
disputed → active (when dispute is resolved)
any → cancelled
```

### Milestone State Machine

```
not_started → in_progress (contractor starts work)
in_progress → ready_for_review (contractor submits)
ready_for_review → approved (funder approves)
ready_for_review → in_progress (funder requests changes)
approved → released (funder releases payment)
any → disputed
```

### Release Gate

A milestone payment releases only when ALL of the following are true:
- Milestone status is `approved`
- Milestone protection status is `ready_for_release`
- Deal is fully funded
- Deal is not disputed or cancelled

The `ReleaseButton` component surfaces every unmet condition so the funder knows exactly what's blocking release.

### Audit Log

Every state transition, payment event, and administrative action is written to the `audit_logs` table with: entity type, entity ID, action name, actor ID, timestamp, and a JSON detail blob. The admin audit page displays this log with expandable detail rows.

---

## Deployment

### Vercel (recommended)

1. Push your repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Deploy

After deployment, update your Stripe webhook endpoint URL to your production domain:
```
https://your-app.vercel.app/api/stripe/webhook
```

### Database migrations

Run the migration against your production Supabase project:
```bash
# Using Supabase CLI
supabase db push --db-url postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

Or paste `supabase/migrations/001_schema.sql` into the Supabase SQL Editor in your production project.
