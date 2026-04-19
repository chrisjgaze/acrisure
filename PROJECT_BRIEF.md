# Project Brief

## What This Project Does

This project is a broker-facing insurance submission platform with a client self-service intake flow.

The product appears to support this workflow:

- Brokers create clients and send secure 72-hour magic links.
- Clients complete multi-step insurance proposal forms online.
- Brokers manage submissions in an internal dashboard.
- Admin users manage team members and product access.
- Brokers can review analytics across their client portfolio.
- Brokers can generate proposal PDFs and confirmation emails.
- Brokers can upload insurer quote documents and run AI-assisted quote comparisons.

The main insurance classes currently represented in the code are:

- Trade Credit Insurance
- Cyber Insurance
- Directors & Officers
- Terrorism Insurance

## Core Functional Areas

### Client Intake Flow

The public-facing side of the app lets invited clients complete proposal forms without standard login, using tokenised magic links. The flow includes:

- Company details
- Company contact details
- Financial details
- Trading arrangements
- Customers / buyers
- Class-specific forms
- Review and submission

### Broker Workspace

The authenticated broker side includes:

- Dashboard for clients and submissions
- Submission progress and status tracking
- Renewal visibility
- Client creation and invitation sending
- Per-client views
- Quote comparison tools
- PDF generation

### Admin and Operations

There is also support for:

- Team management
- Admin permissions
- Licensed product assignment by user
- Audit logging
- GDPR anonymisation endpoint(s)
- Lapse processing via scheduled job(s)

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router

### UI and UX

- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Sonner

### Data and Form Handling

- TanStack React Query
- React Hook Form
- Zod

### Backend and Hosting

- Vercel serverless functions in `api/`
- Vercel deployment configuration

### Database and Authentication

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security (RLS)

### Observability and Messaging

- Sentry
- Resend

### Documents and File Processing

- `@react-pdf/renderer`
- `pdfjs-dist`
- `mammoth`
- `xlsx`

### AI Integration

- Anthropic API for insurer quote comparison and narrative analysis

## Architecture Summary

At a high level, this is a single-page React application backed by:

- Supabase for auth, data storage, and access control
- Vercel serverless APIs for privileged operations and external integrations
- A multi-step form workflow for insurance proposal capture
- A broker/admin workspace for operational management

The frontend is under `src/`, while backend endpoints live under `api/`. The data model and security rules are defined in the Supabase migration files under `supabase/migrations/`.

## Important Integrations

- Supabase for auth and persistence
- Resend for invitation and confirmation emails
- Companies House for UK company lookup
- Sentry for error/performance monitoring
- Anthropic for AI-based quote comparison

## Key Files

- `src/App.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/ComparatorPage.tsx`
- `api/clients.ts`
- `api/compare-quotes.ts`
- `supabase/migrations/20260415000000_initial_schema.sql`
- `vercel.json`

## Notes

- The repository README is currently minimal, so the codebase is the main source of truth.
- The project appears to have originated from a Lovable scaffold and has since been developed into a more specific insurance workflow platform.
