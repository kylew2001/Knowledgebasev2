create table if not exists public.user_groups (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table public.user_groups enable row level security;

drop policy if exists "user_groups_select_self_or_admin" on public.user_groups;
create policy "user_groups_select_self_or_admin"
on public.user_groups for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "user_groups_admin_write" on public.user_groups;
create policy "user_groups_admin_write"
on public.user_groups for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

insert into public.groups (name, description)
values ('Admin', 'Administrative users who can see all knowledge base content')
on conflict do nothing;
