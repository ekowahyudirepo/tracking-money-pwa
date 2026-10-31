-- Skema database KeuanganKu (jalankan di Supabase > SQL Editor)
create table public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('INCOME','EXPENSE')),
  amount bigint not null check (amount > 0),
  category text not null,
  note text not null default '',
  tx_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.transactions (user_id, tx_date desc);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  budget bigint not null default 0,
  theme text not null default 'system',
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own settings" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
