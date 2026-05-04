create table if not exists public.kb_settings (
  id boolean primary key default true,
  categories jsonb,
  deleted_post_ids jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint kb_settings_single_row check (id)
);

drop trigger if exists kb_settings_set_updated_at on public.kb_settings;
create trigger kb_settings_set_updated_at
before update on public.kb_settings
for each row execute function public.set_updated_at();

alter table public.kb_settings enable row level security;

drop policy if exists "kb_settings_authenticated_read" on public.kb_settings;
create policy "kb_settings_authenticated_read"
on public.kb_settings for select
to authenticated
using (true);

drop policy if exists "kb_settings_editors_write" on public.kb_settings;
create policy "kb_settings_editors_write"
on public.kb_settings for all
to authenticated
using (private.can_edit())
with check (private.can_edit());
