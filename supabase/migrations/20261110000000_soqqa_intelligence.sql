-- SOQQA v2: financial strategies, forgotten-expense day reviews, achievements
-- and notification settings. All rows are private to their owner (RLS), and
-- flow through the same idempotent sync RPCs as the v1 entities.

alter table public.preferences
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

-- A user's adoption of a financial strategy. Strategy content itself is static
-- and public (bundled with the app); only the personal configuration lives here.
create table if not exists public.strategy_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  strategy text not null check (strategy in ('pay-yourself-first','rule-50-30-20','zero-based','envelopes','kakeibo',
                                             'profit-first','sinking-funds','emergency-fund','debt-payoff','lifestyle-inflation')),
  status text not null check (status in ('active','paused','archived')),
  selected_at timestamptz not null,
  configuration jsonb not null default '{}'::jsonb check (pg_column_size(configuration) <= 32768),
  primary key (user_id, id)
);

-- Answers to "did you forget to record something?" — one row per date.
create table if not exists public.day_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  local_date date not null,
  status text not null check (status in ('no_spending','complete','needs_review')),
  primary key (user_id, id)
);
create unique index if not exists day_reviews_user_date on public.day_reviews (user_id, local_date) where deleted_at is null;

-- Unlocked badges. The client derives the id from the badge key, so each badge
-- exists at most once per user even when two devices unlock it offline.
create table if not exists public.achievements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  key text not null check (char_length(key) between 1 and 40),
  unlocked_at timestamptz not null,
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['strategy_plans','day_reviews','achievements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

create or replace function public.soqqa_entity_tables() returns text[]
language sql immutable as $$
  select array['wallets','categories','transactions','budgets','goals','goal_contributions',
               'exchange_rates','recurring','preferences','strategy_plans','day_reviews','achievements']
$$;
