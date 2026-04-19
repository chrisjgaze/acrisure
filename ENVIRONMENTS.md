## Environment Files

This repo now supports separate env files for each mode:

- `.env.development`
- `.env.test`
- `.env.production`

For machine-specific secrets, create the matching local override files:

- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

`.local` files override the base file and are ignored by git.

Example templates are included:

- `.env.development.local.example`
- `.env.test.local.example`
- `.env.production.local.example`

## Local Commands

Run the full app locally using the two-process stack:

```bash
npm run dev:local
npm run dev:local:test
npm run dev:local:prod
```

Those scripts do two things:

- start Vercel API routes on `localhost:3001` for `development` and `production`, or `localhost:3002` for `test`
- start the Vite frontend on `localhost:8080` for `development` and `production`, or `localhost:8081` for `test`

The browser should open the Vite URL, not the Vercel API port.

## Builds

```bash
npm run build:dev
npm run build:test
npm run build:prod
```

## Tests

To run tests with the test env loaded:

```bash
npm run test:env
```

## Recommended Setup

1. Put shared non-secret defaults in `.env.development`, `.env.test`, `.env.production`.
2. Put real secrets in the matching `.local` files.
3. Use `npm run dev:local`, `npm run dev:local:test`, or `npm run dev:local:prod` depending on the target environment.

## Minimum Required Local Variables

For the app to boot locally, `.env.development.local` must contain real values for:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Without those, the frontend Supabase client and API routes will fail during startup.
