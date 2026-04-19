# Acrisure

Insurance proposal platform for broker-managed client submissions, renewals, and quote comparison.

This project is a Vite + React frontend with Vercel serverless API routes and Supabase as the backing database/auth layer.

## What It Does

The app supports two main flows:

- Client-facing proposal forms accessed through magic links
- Broker-facing dashboards for managing clients, submissions, renewals, and quote comparisons

Core capabilities include:

- multi-step trade credit and class-specific proposal forms
- broker admin area with client and team management
- renewal initiation and invite flows
- AI-assisted quote comparison
- PDF generation and confirmation email flows

## Stack

- React 18
- TypeScript
- Vite
- Vercel serverless functions in `api/`
- Supabase for Postgres, auth, and RLS
- Tailwind + shadcn/ui
- Vitest for unit tests

## Project Structure

```txt
src/
  pages/          route-level React pages
  components/     reusable UI and form components
  contexts/       auth/session context
  lib/            frontend utilities and API helpers
  test/           unit tests

api/              Vercel serverless functions
server/           shared backend application layer
supabase/
  migrations/     SQL schema migrations
scripts/          local dev and utility scripts
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local env file

Use:

- `.env.development.local`

Minimum required values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_KEY
APP_URL=http://127.0.0.1:8080
```

Example templates are included:

- `.env.development.local.example`
- `.env.test.local.example`
- `.env.production.local.example`

### 3. Start the app

```bash
npm run dev:local
```

This runs:

- Vite frontend on `http://127.0.0.1:8080`
- Vercel API routes on `http://localhost:3001`

Open the frontend URL in the browser:

```txt
http://127.0.0.1:8080
```

Do not open the Vercel API port directly in the browser.

### Other local modes

```bash
npm run dev:local:test
npm run dev:local:prod
```

## Environment Files

Tracked base env files:

- `.env.development`
- `.env.test`
- `.env.production`

Local overrides:

- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

The `.local` files override the base files and are ignored by git.

## Database and Schema

Supabase provides the database instance. The schema for this app is defined by:

- [supabase/migrations/20260415000000_initial_schema.sql](supabase/migrations/20260415000000_initial_schema.sql)

That migration creates:

- tenants
- users
- clients
- submissions
- submission data tables
- magic links
- audit and quote-related tables
- RLS policies

### Apply the migration

Log in and link the repo to your Supabase project:

```bash
npx supabase login
npx supabase link --project-ref zkpvfefxcxsuhepoducd
```

Push the schema:

```bash
npx supabase db push
```

### Bootstrap admin user

The migration bootstraps a first platform admin user for fresh environments.

Email:

```txt
chrisjgaze@gmail.com
```

Temporary password:

```txt
TempAdmin#2026!Bloom
```

Change that password immediately after first login.

## Demo / Seed Data

There is a demo data script:

- `scripts/seed-demo-data.mjs`

Run it manually if you want example data after the schema is applied:

```bash
node scripts/seed-demo-data.mjs
```

Review the script before running it against any non-disposable environment.

## Tests and Quality Checks

Run tests:

```bash
npm run test
```

Run tests with test env loaded:

```bash
npm run test:env
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Deployment

The app is deployed on Vercel.

Production URL:

```txt
https://acrisure.vercel.app
```

### Required Vercel environment variables

```env
VITE_SUPABASE_URL=https://zkpvfefxcxsuhepoducd.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_KEY
APP_URL=https://acrisure.vercel.app
```

Optional, depending on enabled features:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
ANTHROPIC_API_KEY=
COMPANIES_HOUSE_API_KEY=
CRON_SECRET=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
VITE_SENTRY_DSN=
```

After changing Vercel env vars, redeploy the project. `VITE_*` variables are injected at build time.

## Git

Initial push:

```bash
git push -u origin main
```

Remote:

```txt
git@github.com:chrisjgaze/acrisure.git
```

## Security Notes

- `VITE_*` variables are public in the frontend bundle by design
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only
- do not commit `.env.*.local` files
- if a secret key is exposed, rotate it in Supabase/Vercel and update local env files
