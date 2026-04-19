# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

## What This App Does

**form-bloom-pro** is a multi-class insurance proposal form platform which will be sold as a SaaS product to multiple insurance brokerage firms, the first client will be Acrisur. It has two distinct user flows:

- **Client-facing** (`/form/*`, `/invite/:token`): Public multi-step forms for collecting company, financial, and class-specific insurance data. Accessed via single-use magic links (no login).
- **Broker-facing** (`/dashboard`, `/clients/*`): Authenticated admin UI for managing clients, submissions, renewals, and AI-powered quote comparisons.

Live at: `https://form-bloom-pro.vercel.app` until we purchase a domain or get our first client to allow us to use a site on their domain

## Architecture

### Key Directories

- `src/pages/` — One component per route. Form pages use manual useState + debounced auto-save. Broker pages are larger (ClientViewPage ~26KB, ComparatorPage ~33KB).
- `src/components/` — Reusable form primitives (`FormShell`, `FormCard`, `FormInput`, `DateInput`, `ToggleGroup`, `SlideReveal`) and shadcn/ui components in `ui/`.
- `src/lib/` — Core utilities: `supabase.ts` (Supabase client), `formProgress.ts` (step completion hook), `generatePDF.ts` (@react-pdf/renderer), `parseSpreadsheet.ts` (Excel/paste import).
- `src/contexts/AuthContext.tsx` — Provides `user`, `session`, `role`, `tenantId`, `isAdmin`, `licensedClasses`. Uses Supabase Auth with a REST-based user profile fetch to avoid GoTrueClient lock issues.
- `src/data/` — Static option arrays (countries, trade sectors, capacities, etc.).
- `api/` — Vercel serverless functions (13 files). Most use edge runtime; `compare-quotes.ts` uses Node.js runtime with `maxDuration: 300`.

### Routing (React Router v6, `src/App.tsx`)

Public:
- `/invite/:token` — Magic link entry; validates token, sets `sessionStorage`, redirects to first form step
- `/form/company`, `/form/financial`, `/form/trading-arrangements`, `/form/customers`, `/form/buyers`, `/form/loss-history`, `/form/review` — Trade credit form steps
- `/form/cyber`, `/form/dno`, `/form/terrorism`, `/form/class-review/:classKey` — Class-specific steps

Broker (requires `<RequireAuth>`):
- `/dashboard`, `/analytics`, `/clients/new`, `/clients/:id`, `/clients/:id/comparator`

### Session State Pattern

Client forms pass context via `sessionStorage` keys (set by the magic link handler):
- `ff_submission_id` — UUID of the active submission
- `ff_client_id` — UUID of the client
- `ff_policy_year` — Year (int); `> currentYear` means renewal
- `ff_tenant_logo` — Logo URL for the tenant

Every form page redirects to `/` if `ff_submission_id` is missing.

### Data Persistence Pattern

Form pages use:
1. `useState` for all fields
2. A `useEffect` with `useRef(setTimeout)` for 1-second debounced auto-save
3. Supabase upsert on the relevant `submission_*` table, keyed by `submission_id`
4. A `refreshSteps()` call after save (updates step completion progress bar)

### API Routes (`api/`)

Most functions follow this pattern:
1. Validate HTTP method
2. Extract Bearer token from `Authorization` header
3. Verify token via `anonClient.auth.getUser(token)` → resolve `tenant_id` via `users` table
4. Do the work using a service-role Supabase client
5. Return `json(body, status)` helper

Key files:
- `save-form-data.ts` — Generic form data save; validates submission belongs to tenant
- `validate-token.ts` — Magic link validation; returns submission context
- `add-class.ts` — Creates new submission + `submission_company` row + magic link + sends invite email
- `initiate-renewal.ts` — Creates renewal submission, copies prior submission data, shifts loss history years, generates magic link, sends renewal email
- `compare-quotes.ts` — **Node.js runtime** (not edge). Calls Anthropic API with extracted PDF/DOCX text, returns structured comparison JSON + narrative. Model: `claude-sonnet-4-5-20250929`.
- `lapse-submissions.ts` — Cron job (02:00 UTC daily) to mark overdue submissions as lapsed.

### Email Templates

All five email-sending API files (`add-class.ts`, `initiate-renewal.ts`, `resend-invite.ts`, `send-confirmation.ts`, `request-magic-link.ts`) use the same HTML layout: navy header (`#041240`) with hosted SVG logo, white body, CTA button. Logo URL: `https://form-bloom-pro.vercel.app/acrisure-logo-white.svg`.

### Database Schema (Supabase)

Core tables:
- `tenants` — One row per brokerage
- `users` — Broker user profiles; has `tenant_id`, `role`, `licensed_classes[]`
- `clients` — One row per client company; has `tenant_id`, `display_name`, `contact_name`, `contact_email`
- `submissions` — One per client+class+year. Fields: `status`, `completion_pct`, `reference`, `policy_year`, `renewal_date`, `class_of_business`
- `submission_company`, `submission_financial`, `submission_buyers`, `submission_loss_history`, `submission_cyber`, `submission_dno`, `submission_terrorism` — Data tables per submission
- `magic_links` — Token hash, expiry, `used_at`; one per submission
- `quote_comparisons` — AI comparison results; `tenant_id`, `client_id`, `class_of_business`, `insurer_labels[]`, `result` (JSONB)

RLS policies on `quote_comparisons` and most tables use:
```sql
(select tenant_id from users where id = auth.uid())
```
(Not `profiles` — that table does not exist in this schema.)

### AI Quote Comparator

- Client-side PDF text extraction: `pdfjs-dist` (dynamic import). Worker: `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()`
- DOCX extraction: `mammoth` (dynamic import)
- Text sent as plain `text` content blocks to Anthropic API — **no** `document` blocks or `anthropic-beta` header (these caused 504 timeouts)
- Results saved to `quote_comparisons` table. `tenantId` fallback: query `users` table directly if `AuthContext.tenantId` is null at save time.

### Renewal Logic

- `initiate-renewal.ts` creates the new submission and pre-computes `renewal_date` (previous `renewal_date` + 1 year) before inserting
- Company data copy: keeps `contact_position`, `contact_telephone` from previous submission, but overwrites `contact_name`/`contact_email` from the `clients` record
- Loss history: shifts `sort_order` +1 (slot 0 left empty for current-year estimate), takes only 4 most-recent rows
- Renewal countdown in `ClientViewPage.tsx`: 5 seconds (`const SECONDS = 5`), capped on localStorage restore with `Math.min(5, ...)`

## Environment Variables

| Variable | Where used |
|---|---|
| `VITE_SUPABASE_URL` | Client + API routes |
| `VITE_SUPABASE_ANON_KEY` | Client + API routes (auth verification) |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes only |
| `RESEND_API_KEY` | Email-sending API routes |
| `RESEND_FROM_EMAIL` | Sender address (defaults to `onboarding@resend.dev`) |
| `ANTHROPIC_API_KEY` | `api/compare-quotes.ts` |
| `COMPANIES_HOUSE_API_KEY` | Dev Vite middleware proxy |

## Deployment

Vercel. `vercel.json` rewrites all non-API paths to `/index.html`. `api/compare-quotes.ts` has `maxDuration: 300` due to Anthropic API latency. Cron: `api/lapse-submissions` at `0 2 * * *`.

## Setting up the data capture from clients

Every tenant (insurance broker) might have different questions they want their clients to answer even for the same type of insurance product. They may also have different 'required fields' which must be completed before submission is possible. Every time a new tenant is onboarded, the question set will be created with relevant updates to the tsx pages and supabase data.

The main selling points of this platform are that it 
1. makes it easy for their clients to fill out the form 
2. reduces the number of times the client has to enter the same data, ideally only once ever
3. makes it easy for the broker to identify cross-sell opportunities