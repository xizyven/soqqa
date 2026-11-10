# Soqqa — personal finance tracker (offline-first PWA)

Soqqa is a manual + AI-assisted personal finance tracker: virtual multi-currency
wallets, fast transaction entry (calculator keypad and natural-language input in
Uzbek / Russian / English), budgets, savings goals, analytics, a safe-to-spend
engine and a financial advisor. Uzbek is the default language, UZS the default
currency, Asia/Tashkent the default timezone.

> Soqqa never connects to banks, cards or payment systems. Wallets and transfers
> are virtual records for monitoring only.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4 design tokens, Motion, Recharts, Lucide, Plus Jakarta Sans + JetBrains Mono (self-hosted) |
| Local data | IndexedDB via Dexie (source of truth for the UI) |
| Cloud | Supabase Postgres + Auth (email/password), RLS on every table |
| Sync | Persistent outbox, idempotency keys, version-based conflict detection, exponential backoff |
| Validation | Zod (client + server), Postgres CHECK constraints |
| Money | `bigint` minor units + decimal strings, banker's rounding — no floats |
| AI | Offline: deterministic parser + advisor. Online (optional): Claude via server routes |
| Tests | Vitest, fake-indexeddb, PGlite (real Postgres in WASM for schema/RLS/sync tests) |

## Project layout

```
src/
  app/                 routes: (app)/* screens, welcome (onboarding), api/* route handlers
  components/          shell (nav, palette, sync indicator, PWA), ui primitives, charts, features
  lib/
    money/             decimal-safe arithmetic, calculator expressions
    domain/            types, dates/timezones, rates, ledger, analytics, planning, insights, report
    data/              Dexie DB, repository (entity + outbox writes are atomic), demo data, export
    sync/              protocol, client engine, in-memory reference server, RPC transport
    ai/                offline parser, offline advisor, cloud client
    i18n/              uz (source), en, ru dictionaries + locale formatting
    validation/        Zod schemas
    server/            route-handler guard (auth, rate limit), Claude client
supabase/migrations/   schema, RLS policies, sync functions
public/                sw.js, offline.html, icons, generated precache manifest
tests/                 unit + integration tests (incl. PGlite SQL tests)
```

## Run locally

```bash
npm install
npm run dev                  # http://localhost:3000 (service worker disabled in dev)
npm run build && npm start   # production build + service worker / offline mode
npm test                     # domain, sync, SQL/RLS (PGlite), i18n tests
npm run typecheck
npm run lint
```

First launch shows onboarding: **Try the demo** (3 months of Uzbekistan-context
data in a separate database, never synced) or **Start my own** (local-only until
you sign in).

Keyboard: `Ctrl/Cmd+K` command palette, `N` new expense, `A` AI entry, `G` then
`O/T/W/B/A/G/I/S` to jump between pages, `Enter` saves, `Shift+Enter` saves and
starts another.

## Database setup (Supabase)

1. Create a Supabase project and enable Email auth (Authentication → Providers).
2. Apply `supabase/migrations/20261109000000_soqqa_schema.sql`
   (SQL editor, or `supabase db push` with the Supabase CLI).
3. Copy `.env.example` to `.env.local`; set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Sign in from **Settings → Account & sync**. Data recorded before signing in is
   attached to that account and uploaded through the outbox. A device whose data
   belongs to another account refuses to sync until it is exported and erased.

The migration creates:
- Tables keyed by `(user_id, id)`: wallets, categories, transactions, budgets,
  goals, goal_contributions, exchange_rates, recurring, preferences, profiles,
  soqqa_sync_ops (idempotency ledger).
- `FORCE ROW LEVEL SECURITY` with owner-only policies on every table; `anon` has no access.
- `soqqa_sync_push(ops)` / `soqqa_sync_pull(since, max_rows)` — `SECURITY INVOKER`
  RPCs, so RLS applies to every statement. Push is idempotent per `op_id`; each op
  runs in its own savepoint, so one invalid op never aborts the batch.
- A trigger that makes exchange-rate snapshots immutable, CHECK constraints for
  amounts/currencies, and a transfer constraint (both legs in one row).
- Numerics are returned to clients as strings (no float rounding).

## Environment variables

See `.env.example`. All optional:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Cloud sync and auth |
| `ANTHROPIC_API_KEY` | server only | Cloud AI parser and advisor |
| `SOQQA_AI_MODEL` | server only | Model override (default `claude-opus-5-5`) |
| `AI_ALLOW_ANONYMOUS` | server only | Allow AI routes without a signed-in user (local demos) |

## Key design decisions

- **Financial correctness** — amounts are `bigint` cents; rates are decimal strings
  applied with round-half-even. Each transaction stores an immutable snapshot
  (`base_currency`, `rate_to_base`, `base_amount`); editing a note never rewrites
  history, and new rates never change past reports.
- **Transfers** are one record holding both legs, so they are atomic locally and on
  the server, and excluded from income/expense. **Refunds** reduce spending in the
  original category; **reversals** cancel the outstanding amount. Goal
  contributions move wallet money without counting as income or expense.
- **Safe-to-spend** = spendable wallet balances − recurring bills due before the
  period end − goal commitments still due this month. Expected income is shown,
  not counted. Net worth is never presented as spendable money.
- **Projections** add what you typically spent in the rest of the month (last 3
  months) to month-to-date spending, so early-month rent is not extrapolated.
- **Timezones** — every transaction stores `local_date` in the user's timezone, so
  monthly reports do not shift with the device timezone.
- **Offline-first** — the UI reads only IndexedDB. Every write updates the entity
  and appends an outbox op in one IndexedDB transaction. Sync status is honest:
  local only / offline / pending / syncing / synced / error.
- **Conflicts** — same base version → apply; stale → last writer wins by client
  time and the losing version is kept in a local conflict log you can restore from
  (Settings). Rejected ops are kept and can be retried, never silently dropped.
- **AI** never writes records. Parsed drafts always open in the editable form; the
  cloud advisor receives only aggregates (month and category totals) — no notes,
  merchants, wallet or goal names.
- **Charts** — series colors were validated for colorblind separation and contrast
  on both themes; every multi-series chart has a legend, tooltips and a table view.

## Deployment

Any Node host that runs Next.js works (Vercel, Fly, Render, a VPS):

1. Set the environment variables in the host.
2. `npm run build` (the `postbuild` step writes `public/precache-manifest.json`
   for the service worker).
3. Serve over HTTPS (required for service workers and installability).
4. Rate limiting in `src/lib/server/guard.ts` is per instance; for multi-instance
   deployments back it with a shared store (e.g. Redis/Upstash).

## Integrations that need credentials

- **Supabase** — sync and auth are implemented, and the schema, RLS and sync
  functions are tested against real Postgres (PGlite), but they have not been run
  against a hosted Supabase project here. Add the keys and apply the migration.
- **Claude** — `/api/ai/parse` and `/api/ai/advisor` use the official SDK with
  Zod-validated input/output, auth, rate limiting and refusal handling, but were
  not called live here (no API key). Without a key the app uses the offline engines
  and says so in the UI.
- **CBU exchange rates** — `/api/rates/cbu` proxies the Central Bank of Uzbekistan
  daily JSON; each fetch adds new immutable snapshots. Manual entry always works.
