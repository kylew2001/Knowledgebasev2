alter type public.audit_action add value if not exists 'account_change_requested';
alter type public.audit_action add value if not exists 'account_change_approved';
alter type public.audit_action add value if not exists 'account_change_denied';

create table if not exists public.account_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  username text,
  request_type text not null check (request_type in ('email_change', 'two_fa_reset', 'password_reset')),
  proposed_value text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  admin_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or username is not null)
);

create index if not exists account_change_requests_status_idx
on public.account_change_requests (status, created_at desc);

create index if not exists account_change_requests_user_id_idx
on public.account_change_requests (user_id, created_at desc);

drop trigger if exists account_change_requests_set_updated_at on public.account_change_requests;
create trigger account_change_requests_set_updated_at
before update on public.account_change_requests
for each row execute function public.set_updated_at();

alter table public.account_change_requests enable row level security;

drop policy if exists "account_change_requests_select_self" on public.account_change_requests;
create policy "account_change_requests_select_self"
on public.account_change_requests for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "account_change_requests_insert_self" on public.account_change_requests;
create policy "account_change_requests_insert_self"
on public.account_change_requests for insert
to authenticated
with check (user_id = auth.uid());
