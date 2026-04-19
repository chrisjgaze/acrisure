# Tenanting And Security Overview

## Executive Summary

This project uses a shared-database multi-tenant model on Supabase/Postgres.

Each tenant is represented by a row in the `tenants` table, and most business records carry a `tenant_id` foreign key. Broker users are linked to a tenant through the `users.tenant_id` column, and most broker operations scope data access by tenant.

The model is broadly reasonable for a SaaS-style multi-tenant app, but based on the current code and schema it is not fully secure enough yet for a high-assurance production environment. The largest concern is the client/magic-link access model in Row Level Security, which appears too broad.

## How Tenanting Is Created

### Current State

There does not appear to be a self-serve tenant creation flow in the application code.

I did not find:

- an API route that creates new tenant records
- a UI flow for onboarding a new tenant
- a migration or script that automatically provisions tenant admins from within the app

What I did find:

- the `tenants` table definition in `supabase/migrations/20260415000000_initial_schema.sql`
- seed/demo scripts that assume an existing `TENANT_ID`
- admin/team flows that only invite users into an already-existing tenant

This strongly suggests tenant creation is currently done manually or through an external admin/setup process, for example:

- directly in Supabase
- via SQL
- via an internal script not present in this repo

### How Users Join A Tenant

Once a tenant already exists:

1. A broker/admin user already linked to that tenant invites another user.
2. The invite flow creates a Supabase Auth user.
3. A corresponding row is upserted into the app-level `users` table with the caller's `tenant_id`.

Relevant code:

- `api/invite-user.ts`
- `api/list-team.ts`
- `api/update-team-member.ts`

## How Tenant Isolation Works

### Data Model

Tenant isolation is implemented mainly through:

- `tenants`
- `users.tenant_id`
- `clients.tenant_id`
- `submissions.tenant_id`
- other tenant-scoped records such as `quote_comparisons`, `documents`, `audit_log`, `tenant_form_config`

This is a standard shared-schema tenancy model.

### Broker Isolation

Broker/admin users authenticate with Supabase Auth, and the app resolves their profile from the `users` table.

RLS policies then scope access by comparing row `tenant_id` values to:

- `select tenant_id from users where id = auth.uid()`

Examples:

- `clients`: brokers can view clients in their own tenant
- `submissions`: brokers can access submissions in their own tenant
- `quote_comparisons`: reads/inserts are scoped to the caller's tenant

This part of the design is directionally sound.

## Security Assessment

## What Looks Good

- Tenant-aware schema design using explicit `tenant_id` foreign keys
- Supabase Auth for broker authentication
- RLS enabled on core tables
- Server-side admin operations use the service role key
- Team-management APIs verify the caller and resolve the caller's tenant before acting
- Audit logging is present for important operations
- Magic links are stored as SHA-256 hashes, not raw tokens

## Main Risks

### 1. Client-facing RLS around magic links appears too broad

This is the main issue.

Several client-facing policies allow access if there exists any unexpired magic link for the target submission. For example, the `submissions` and form tables use patterns like:

- allow access when a row's `submission_id` has a matching unexpired record in `magic_links`

The problem is that this policy is not tied to a client-authenticated identity or a scoped session derived from the presented token. It only checks whether some valid link exists for that submission.

That means, in principle, if an attacker can guess or obtain a `submission_id`, they may be able to read or modify data for any submission that currently has an active magic link, because the database policy is based on row state rather than the caller's possession of a validated token.

This is materially weaker than it should be.

### 2. `magic_links` has an anonymous `select` policy of `using (true)`

The schema includes:

- `Allow anon to read magic links for policy evaluation`

with `using (true)`.

Even if the intended usage is only indirect policy evaluation, this is dangerous as written because it can expose the table too broadly depending on grants and API exposure. A table containing token hashes, emails, client IDs, submission IDs, and expiry times should not be broadly selectable by anonymous callers.

At minimum this deserves tightening and re-validation.

### 3. Service-role APIs are doing the real enforcement

Many privileged routes correctly use the Supabase service role and then implement tenant checks in application code. That is acceptable, but it means security depends heavily on every API route doing the check correctly every time.

This is normal for backend code, but it increases the importance of:

- consistent authorization helpers
- explicit tenant checks on all privileged routes
- avoiding direct client access to sensitive tables where possible

### 4. Tenant creation is operationally unclear

Because tenant creation is not codified in the app, the provisioning process is probably manual. That creates operational risk:

- inconsistent setup
- missing admin user linkage
- missing tenant config rows
- no formal onboarding controls or audit trail for tenant provisioning

This is not necessarily a direct exploit, but it is a governance and reliability gap.

### 5. Hard-coded Supabase credentials exist in the demo seed script

`scripts/seed-demo-data.mjs` contains a hard-coded service key and tenant ID.

That is a serious secret-management problem if the key is real. Service-role keys bypass normal RLS and effectively have full database power.

This is the most urgent operational issue in the repository itself.

## Is It Secure Enough?

Short answer: not yet.

For internal demo use or a controlled pilot, the tenant model is workable. For production handling real customer insurance submission data, I would not consider the current setup strong enough without changes.

The broker-side tenant isolation is reasonably structured.

The weak point is the client/magic-link access pattern, where the RLS rules appear to grant access based on the existence of an active link rather than a securely bound caller identity or server-side access mediation.

## Recommended Improvements

### High Priority

1. Remove or redesign the anonymous `magic_links` select policy.
2. Stop relying on direct anonymous client access to submission tables for magic-link users.
3. Move client-facing reads/writes behind server-side endpoints that validate the presented token on every request, then perform narrowly scoped operations with the service role.
4. Rotate any exposed service-role keys immediately.

### Medium Priority

1. Add a formal tenant provisioning workflow.
2. Add unique constraints and validation around tenant `slug` and `custom_domain` if these are meant to identify tenants publicly.
3. Centralise authorization helpers for service-role API routes.
4. Add tests specifically for cross-tenant and cross-submission access attempts.

### Ideal End State

The safest model would be:

- brokers use Supabase Auth + RLS
- clients do not query tenant data directly with anonymous access
- client magic-link flows go through backend endpoints that validate token possession server-side
- backend endpoints only expose the exact submission and fields permitted for that token

## Relevant Files

- `supabase/migrations/20260415000000_initial_schema.sql`
- `src/lib/supabase.ts`
- `src/contexts/AuthContext.tsx`
- `api/invite-user.ts`
- `api/list-team.ts`
- `api/update-team-member.ts`
- `api/validate-token.ts`
- `scripts/seed-demo-data.mjs`

## Conclusion

Tenanting is implemented as shared-schema multi-tenancy with `tenant_id`-based isolation, and tenant membership is attached to broker users through the `users` table. Tenant creation itself does not appear to be productised in this repo and is likely manual.

The overall structure is sensible, but the current client magic-link security model appears too permissive. Before treating this as production-grade for sensitive customer data, I would tighten the anonymous/magic-link access model and remove any exposed service credentials.
