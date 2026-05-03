create table if not exists public.post_user_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id text not null references public.kb_posts(id) on delete cascade,
  pinned_at timestamptz,
  favourited_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists post_user_state_pinned_idx
on public.post_user_state (user_id, pinned_at desc)
where pinned_at is not null;

create index if not exists post_user_state_favourited_idx
on public.post_user_state (user_id, favourited_at desc)
where favourited_at is not null;

create index if not exists post_user_state_recent_idx
on public.post_user_state (user_id, last_viewed_at desc)
where last_viewed_at is not null;

drop trigger if exists post_user_state_set_updated_at on public.post_user_state;
create trigger post_user_state_set_updated_at
before update on public.post_user_state
for each row execute function public.set_updated_at();

alter table public.post_user_state enable row level security;

drop policy if exists "post_user_state_select_self" on public.post_user_state;
create policy "post_user_state_select_self"
on public.post_user_state for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "post_user_state_insert_self" on public.post_user_state;
create policy "post_user_state_insert_self"
on public.post_user_state for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "post_user_state_update_self" on public.post_user_state;
create policy "post_user_state_update_self"
on public.post_user_state for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
