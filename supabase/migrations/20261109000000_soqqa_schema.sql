-- SOQQA — cloud schema, row level security and sync functions.
--
-- Design notes
--  * Every table is keyed by (user_id, id). Ids are client-generated UUIDs so
--    records can be created offline; built-in categories use fixed ids that
--    converge across a user's devices.
--  * Money is numeric(20,2); exchange rates numeric(24,10). Rows are returned
--    to clients with numeric values serialised as strings (no float rounding).
--  * Records are soft-deleted (deleted_at). `version` and `server_seq` are
--    owned by the server and drive conflict detection and incremental pulls.
--  * Clients never write tables directly: they call soqqa_sync_push, which
--    runs as SECURITY INVOKER so every statement is subject to RLS.


create sequence if not exists public.soqqa_seq;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text check (char_length(display_name) <= 80)
);

create or replace function public.soqqa_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists soqqa_on_auth_user_created on auth.users;
create trigger soqqa_on_auth_user_created after insert on auth.users
  for each row execute function public.soqqa_handle_new_user();

-- ---------------------------------------------------------------- shared columns
-- user_id, id, created_at, updated_at, deleted_at, version, server_seq, server_updated_at

create table if not exists public.wallets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  currency text not null check (currency in ('UZS','USD','EUR','RUB')),
  icon text not null check (char_length(icon) <= 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  opening_balance numeric(20,2) not null,
  spendable boolean not null default true,
  archived boolean not null default false,
  sort integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  kind text not null check (kind in ('income','expense')),
  system_key text check (char_length(system_key) <= 40),
  name text not null check (char_length(name) <= 40),
  icon text not null check (char_length(icon) <= 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  bucket text check (bucket in ('needs','wants')),
  archived boolean not null default false,
  sort integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  type text not null check (type in ('income','expense','transfer','refund','reversal')),
  direction text not null check (direction in ('in','out')),
  wallet_id uuid not null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency in ('UZS','USD','EUR','RUB')),
  category_id uuid,
  occurred_at timestamptz not null,
  local_date date not null,
  note text not null default '' check (char_length(note) <= 500),
  merchant text not null default '' check (char_length(merchant) <= 120),
  base_currency text not null check (base_currency in ('UZS','USD','EUR','RUB')),
  rate_to_base numeric(24,10) not null check (rate_to_base > 0),
  base_amount numeric(20,2) not null,
  rate_snapshot_id uuid,
  to_wallet_id uuid,
  to_amount numeric(20,2) check (to_amount is null or to_amount > 0),
  to_currency text check (to_currency in ('UZS','USD','EUR','RUB')),
  transfer_rate numeric(24,10),
  related_id uuid,
  source text not null default 'manual' check (source in ('manual','ai','recurring','demo')),
  primary key (user_id, id),
  -- A transfer carries both legs in one row, so it is atomic by construction.
  constraint transfer_legs check (
    (type = 'transfer' and to_wallet_id is not null and to_amount is not null and to_currency is not null and to_wallet_id <> wallet_id)
    or (type <> 'transfer' and to_wallet_id is null and to_amount is null)
  ),
  constraint reversal_link check (type <> 'reversal' or related_id is not null)
);
create index if not exists transactions_user_date on public.transactions (user_id, local_date);

create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  category_id uuid not null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency in ('UZS','USD','EUR','RUB')),
  alert_threshold numeric(4,3) not null default 0.8 check (alert_threshold between 0.1 and 1),
  primary key (user_id, id)
);

create table if not exists public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  target_amount numeric(20,2) not null check (target_amount > 0),
  currency text not null check (currency in ('UZS','USD','EUR','RUB')),
  target_date date,
  monthly_target numeric(20,2) check (monthly_target is null or monthly_target > 0),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null check (status in ('active','paused','completed','archived')),
  primary key (user_id, id)
);

create table if not exists public.goal_contributions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  goal_id uuid not null,
  kind text not null check (kind in ('contribution','withdrawal')),
  amount numeric(20,2) not null check (amount > 0),
  wallet_id uuid,
  wallet_amount numeric(20,2) check (wallet_amount is null or wallet_amount > 0),
  rate numeric(24,10),
  local_date date not null,
  note text not null default '' check (char_length(note) <= 200),
  primary key (user_id, id)
);

create table if not exists public.exchange_rates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  currency text not null check (currency in ('USD','EUR','RUB')),
  uzs_per_unit numeric(24,10) not null check (uzs_per_unit > 0),
  effective_date date not null,
  source text not null check (source in ('manual','cbu','seed')),
  primary key (user_id, id)
);

create table if not exists public.recurring (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('income','expense')),
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency in ('UZS','USD','EUR','RUB')),
  wallet_id uuid not null,
  category_id uuid,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  start_date date not null,
  next_date date not null,
  active boolean not null default true,
  primary key (user_id, id)
);

create table if not exists public.preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.soqqa_seq'),
  server_updated_at timestamptz not null default now(),
  base_currency text not null check (base_currency in ('UZS','USD','EUR','RUB')),
  locale text not null check (locale in ('uz','en','ru')),
  timezone text not null check (char_length(timezone) <= 64),
  theme text not null check (theme in ('dark','light','system')),
  ai_cloud_enabled boolean not null default false,
  onboarded boolean not null default false,
  primary key (user_id, id)
);

-- Idempotency ledger: one row per applied operation.
create table if not exists public.soqqa_sync_ops (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  op_id uuid not null,
  applied_at timestamptz not null default now(),
  result jsonb not null,
  primary key (user_id, op_id)
);

-- ---------------------------------------------------------------- immutability

-- Exchange-rate snapshots are immutable history: only soft deletion is allowed.
create or replace function public.soqqa_rates_immutable() returns trigger
language plpgsql as $$
begin
  if new.currency is distinct from old.currency
     or new.uzs_per_unit is distinct from old.uzs_per_unit
     or new.effective_date is distinct from old.effective_date then
    raise exception 'rates_immutable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists soqqa_rates_immutable on public.exchange_rates;
create trigger soqqa_rates_immutable before update on public.exchange_rates
  for each row execute function public.soqqa_rates_immutable();

-- ---------------------------------------------------------------- row level security

do $$
declare t text;
begin
  foreach t in array array['wallets','categories','transactions','budgets','goals','goal_contributions',
                           'exchange_rates','recurring','preferences','soqqa_sync_ops'] loop
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

alter table public.profiles enable row level security;
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

grant usage on sequence public.soqqa_seq to authenticated;

-- ---------------------------------------------------------------- sync helpers

create or replace function public.soqqa_entity_tables() returns text[]
language sql immutable as $$
  select array['wallets','categories','transactions','budgets','goals','goal_contributions',
               'exchange_rates','recurring','preferences']
$$;

-- Serialises a row with numeric columns as strings (exact decimal transport).
create or replace function public.soqqa_row_json(tbl text, r jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare col text; out jsonb := r;
begin
  for col in
    select a.attname from pg_attribute a
    where a.attrelid = ('public.' || tbl)::regclass and a.attnum > 0 and not a.attisdropped
      and a.atttypid = 'numeric'::regtype
  loop
    if out ? col and jsonb_typeof(out -> col) = 'number' then
      out := jsonb_set(out, array[col], to_jsonb(out ->> col));
    end if;
  end loop;
  return out - 'user_id';
end $$;

-- Inserts or overwrites one row for the current user with server-owned columns set.
create or replace function public.soqqa_write(tbl text, row_data jsonb, new_version integer) returns void
language plpgsql security invoker set search_path = public as $$
declare
  cols text;
  sets text;
  payload jsonb;
begin
  select string_agg(format('%I', a.attname), ', ' order by a.attnum),
         string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ' order by a.attnum)
           filter (where a.attname not in ('user_id', 'id', 'created_at'))
    into cols, sets
  from pg_attribute a
  where a.attrelid = ('public.' || tbl)::regclass and a.attnum > 0 and not a.attisdropped;

  payload := (row_data - 'user_id' - 'version' - 'server_seq' - 'server_updated_at')
    || jsonb_build_object(
         'user_id', auth.uid(),
         'version', new_version,
         'server_seq', nextval('public.soqqa_seq'),
         'server_updated_at', now());

  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) '
    'on conflict (user_id, id) do update set %3$s',
    tbl, cols, sets)
  using payload;
end $$;

-- ---------------------------------------------------------------- push

create or replace function public.soqqa_sync_push(ops jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  op jsonb;
  op_uuid uuid;
  tbl text;
  rid uuid;
  cur jsonb;
  res jsonb;
  prior jsonb;
  results jsonb := '[]'::jsonb;
  cur_version integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 500 then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;

  for op in select value from jsonb_array_elements(ops) loop
    begin
      op_uuid := (op ->> 'op_id')::uuid;

      select s.result into prior from public.soqqa_sync_ops s where s.user_id = uid and s.op_id = op_uuid;
      if prior is not null then
        results := results || jsonb_build_array(prior || '{"duplicate": true}'::jsonb);
        continue;
      end if;

      tbl := op ->> 'table';
      if tbl is null or not (tbl = any (public.soqqa_entity_tables())) then
        raise exception 'unknown_table';
      end if;
      rid := (op -> 'row' ->> 'id')::uuid;
      if rid is null then
        raise exception 'missing_id';
      end if;

      execute format('select to_jsonb(t) from public.%I t where t.user_id = $1 and t.id = $2 for update', tbl)
        into cur using uid, rid;

      if cur is null then
        perform public.soqqa_write(tbl, op -> 'row', 1);
        res := jsonb_build_object('op_id', op_uuid, 'status', 'applied', 'version', 1);
      else
        cur_version := (cur ->> 'version')::integer;
        if cur_version = coalesce((op ->> 'base_version')::integer, -1) then
          perform public.soqqa_write(tbl, op -> 'row', cur_version + 1);
          res := jsonb_build_object('op_id', op_uuid, 'status', 'applied', 'version', cur_version + 1);
        elsif (op ->> 'client_updated_at')::timestamptz > (cur ->> 'updated_at')::timestamptz then
          perform public.soqqa_write(tbl, op -> 'row', cur_version + 1);
          res := jsonb_build_object('op_id', op_uuid, 'status', 'applied_lww', 'version', cur_version + 1,
                                    'row', public.soqqa_row_json(tbl, cur) - 'server_seq' - 'server_updated_at');
        else
          res := jsonb_build_object('op_id', op_uuid, 'status', 'conflict', 'version', cur_version,
                                    'row', public.soqqa_row_json(tbl, cur) - 'server_seq' - 'server_updated_at');
        end if;
      end if;

      insert into public.soqqa_sync_ops (user_id, op_id, result) values (uid, op_uuid, res);
      results := results || jsonb_build_array(res);
    exception when others then
      -- The failed op's partial work is rolled back to this block's savepoint.
      results := results || jsonb_build_array(jsonb_build_object(
        'op_id', op ->> 'op_id', 'status', 'rejected', 'error', sqlerrm));
    end;
  end loop;

  return results;
end $$;

-- ---------------------------------------------------------------- pull

create or replace function public.soqqa_sync_pull(since bigint, max_rows integer default 500) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(max_rows, 500), 1), 1000);
  tbl text;
  q text := '';
  changes jsonb;
  total integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  foreach tbl in array public.soqqa_entity_tables() loop
    if q <> '' then q := q || ' union all '; end if;
    q := q || format(
      'select %L::text as tbl, t.server_seq as seq, public.soqqa_row_json(%L, to_jsonb(t)) as r '
      'from public.%I t where t.user_id = $1 and t.server_seq > $2', tbl, tbl, tbl);
  end loop;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''table'', tbl, ''seq'', seq, ''row'', r) order by seq), ''[]''::jsonb), count(*)::int '
    'from (select * from (%s) u order by seq limit $3) x', q)
    into changes, total using uid, since, lim + 1;

  if total > lim then
    changes := changes - lim; -- drop the look-ahead row
  end if;

  return jsonb_build_object(
    'changes', changes,
    'cursor', coalesce((changes -> -1 ->> 'seq')::bigint, since),
    'hasMore', total > lim);
end $$;

revoke all on function public.soqqa_sync_push(jsonb) from public, anon;
revoke all on function public.soqqa_sync_pull(bigint, integer) from public, anon;
revoke all on function public.soqqa_write(text, jsonb, integer) from public, anon;
grant execute on function public.soqqa_sync_push(jsonb) to authenticated;
grant execute on function public.soqqa_sync_pull(bigint, integer) to authenticated;
grant execute on function public.soqqa_write(text, jsonb, integer) to authenticated;
grant execute on function public.soqqa_row_json(text, jsonb) to authenticated;
grant execute on function public.soqqa_entity_tables() to authenticated;
