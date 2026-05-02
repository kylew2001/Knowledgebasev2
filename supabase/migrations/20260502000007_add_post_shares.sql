alter type public.audit_action add value if not exists 'post_share_created';
alter type public.audit_action add value if not exists 'post_share_revoked';

create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.kb_posts(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  constraint post_shares_expires_after_created check (expires_at > created_at)
);

create index if not exists post_shares_post_id_idx
on public.post_shares (post_id);

create index if not exists post_shares_expires_at_idx
on public.post_shares (expires_at);

create index if not exists post_shares_created_by_idx
on public.post_shares (created_by);

alter table public.post_shares enable row level security;

drop policy if exists "post_shares_admin_select" on public.post_shares;
create policy "post_shares_admin_select"
on public.post_shares for select
to authenticated
using (public.is_super_admin());

drop policy if exists "post_shares_editors_insert" on public.post_shares;
create policy "post_shares_editors_insert"
on public.post_shares for insert
to authenticated
with check (public.can_edit() and created_by = auth.uid());

drop policy if exists "post_shares_admin_update" on public.post_shares;
create policy "post_shares_admin_update"
on public.post_shares for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
