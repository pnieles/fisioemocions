# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fisioemocions is a clinical/billing management app for a physiotherapy clinic in Andorra (patients, agenda, invoicing with IGI tax and CASS coverage, tariffs, inventory, expenses, P&L reporting). It was originally scaffolded and iterated on inside Lovable; it now builds and deploys independently (Vercel + a standalone Supabase project).

## Commands

Package manager is **bun** — do not use npm/yarn/pnpm.

```bash
bun install          # install deps
bun run dev           # vite dev server
bun run build         # production build (nitro, see "Deployment" below)
bun run lint          # eslint (includes prettier as a lint rule)
bun run lint --fix    # auto-fix lint + formatting issues
bun run format        # prettier --write . (formatting only)
bunx tsc --noEmit     # typecheck (no dedicated script exists)
```

There is no test suite/script in this repo currently.

**Lockfile gotcha:** `bun.lock` must resolve against the public npm registry. If installs start failing with 403s against `*.pkg.dev` URLs, the lockfile has picked up references to Lovable's private sandbox-only npm proxy again — regenerate it (`rm bun.lock && bun install`) rather than trying to reach that registry.

## Architecture

**Stack:** TanStack Start (React 19, file-based routing) on Vite + Nitro, Tailwind v4 + shadcn/ui (`new-york` style, see `components.json`), TanStack Query, Supabase (Postgres + Auth).

### Routing

File-based routing per `src/routes/README.md`: every `.tsx` in `src/routes/` is a route (`index.tsx` → `/`, `$id.tsx` → dynamic segment, etc.), `__root.tsx` is the only app shell, and `routeTree.gen.ts` is auto-generated — never hand-edit it (it regenerates on `bun run dev`/`build`).

`__root.tsx` renders an `AuthGate` that checks the Supabase session (`src/lib/session.ts`) before anything else: no session → redirect to `/login`; session + still on `/login` → redirect to `/`. `/login` is the only route that renders outside `AppShell` (the sidebar chrome). `AppShell` (`src/components/AppShell.tsx`) filters its nav items by the signed-in user's role permissions.

### Auth & roles

- Two Supabase clients: `src/integrations/supabase/client.ts` (browser, publishable key, subject to RLS) and `client.server.ts` (service role key, bypasses RLS — **server-only**, never import it from client code). Server functions get the caller's own JWT via `auth-attacher.ts` (client middleware) / `auth-middleware.ts` (server middleware), not the service role, unless they specifically need admin/service-level access.
- `auth-middleware.ts` exports `requireSupabaseAuth` (any signed-in user) and `requireAdminAuth` (also requires `app_users.role_id = 'admin'`). Apply these via `.middleware([...])` on any `createServerFn` that touches sensitive data — the ones in `src/lib/users.functions.ts` are the reference example.
- Role/permission definitions (`MENU_KEYS`, per-role `view`/`edit`/`hidden` per section) live in `app_settings` (key `roles`) in the DB — **not** localStorage — so every device/user sees the same menu. The *active* role is derived from the signed-in account's `app_users.role_id`, not a manual switcher. All of this is in `src/lib/roles.ts`; `MENU_KEYS` is the single source of truth mapping sidebar sections to permission keys, so a new nav section needs an entry there to be nav-filterable.
- First-run bootstrap: if `app_users` is empty, `/login` shows a "create the admin account" form instead of a sign-in form (`src/lib/auth-bootstrap.functions.ts`).

### Data layer

`src/lib/data-hooks.ts` centralizes all TanStack Query read hooks, querying Supabase tables directly from the browser client (so RLS is the enforcement boundary, not the hook). Mutations are *not* centralized — each route file calls `supabase.from(...).insert/update/delete(...)` inline in its own `useMutation`.

Server-only logic (anything needing the service-role key, `nodemailer`, etc.) lives in `src/lib/*.functions.ts` files using `createServerFn` — this naming convention (`*.functions.ts`) marks server-only modules in this codebase.

### Database & RLS

Migrations are in `supabase/migrations/*.sql`, timestamp-prefixed, applied in order. **There is no linked Supabase CLI project here** — adding a migration file does not apply it. Migrations must be run by hand against the actual live Supabase project (SQL editor or Supabase MCP tooling); check `SUPABASE_PROJECT_ID` in `.env` for which project is current before assuming a schema state.

Access model (see `20260910090518_auth_and_rls.sql` for the full rationale): `patients`, `appointments`, `patient_visits`, `invoices`, `treatments`, `client_profiles`, `igi_rates` are usable by any authenticated staff member; `materials`, `expenses`, `inventory_counts`, `app_users` are **admin-only** (purchase costs / margins / account management), gated by a `is_admin()` SQL function; `app_settings` is readable by any authenticated user except the `email_account` row (holds an SMTP password) and writable by admins only. `anon` has no access to any table — everything requires a real Supabase Auth session.

Invoice numbers (`F-YYYY-NNNN`, global correlative across all invoices) are assigned by a DB trigger (`assign_invoice_number`), not client-side — never set `invoice_number` from the app.

### Deployment

`vite.config.ts` forces the Nitro build preset to `"vercel"`, overriding `@lovable.dev/vite-tanstack-config`'s default (which auto-targets Cloudflare inside Lovable's own sandbox but honors an explicit `nitro.preset` override outside it). The app deploys via Vercel's GitHub integration (preview deployment per push, production from `main`).

`.env` (committed) holds non-secret values: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` and their `VITE_`-prefixed equivalents (Vite bakes `VITE_*` into the client bundle at build time). `SUPABASE_SERVICE_ROLE_KEY` is a real secret and must only ever be set as a platform environment variable (Vercel project settings) — never in `.env`. Both `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` also need to be set as actual Vercel env vars for server-side code (`client.server.ts`, `auth-middleware.ts` read them via `process.env`, which is *not* populated from the committed `.env` at runtime on Vercel). Changing any Vercel env var requires a redeploy to take effect — env var changes don't apply retroactively to an existing deployment.
