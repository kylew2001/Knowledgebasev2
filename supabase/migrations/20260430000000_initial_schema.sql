create type public.user_role as enum ('super_admin', 'editor', 'viewer');
create type public.audit_action as enum (
  'login_failed',
  'user_created',
  'user_disabled',
  'user_enabled',
  'role_changed',
  'password_reset',
  'category_created',
  'category_updated',
  'category_deleted',
  'article_created',
  'article_updated',
  'article_deleted',
  'pdf_uploaded',
  'pdf_downloaded',
  'pdf_deleted',
  'bulk_upload'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.user_role not null default 'viewer',
  disabled_at timestamptz,
  force_password_change boolean not null default false,
  last_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.security_settings (
  id boolean primary key default true,
  failed_login_threshold integer not null default 5,
  lockout_minutes integer not null default 15,
  inactivity_timeout_minutes integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint security_settings_single_row check (id)
);

insert into public.security_settings (id)
values (true)
on conflict (id) do nothing;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  description text,
  icon_name text not null default 'BookOpenText',
  icon_color text not null default '#0f766e',
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, name)
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null,
  body_md text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  review_due_at date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_files (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action public.audit_action not null,
  target_table text,
  target_id uuid,
  target_label text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index categories_parent_id_idx on public.categories(parent_id);
create index articles_category_id_idx on public.articles(category_id);
create index articles_title_idx on public.articles using gin (to_tsvector('english', title || ' ' || coalesce(body_md, '')));
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

create trigger security_settings_set_updated_at
before update on public.security_settings
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and disabled_at is null
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() = 'super_admin'
$$;

create or replace function public.can_edit()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() in ('super_admin', 'editor')
$$;

alter table public.profiles enable row level security;
alter table public.security_settings enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_files enable row level security;
alter table public.tags enable row level security;
alter table public.article_tags enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "security_settings_admin_all"
on public.security_settings for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "categories_view_all_authenticated"
on public.categories for select
to authenticated
using (true);

create policy "categories_editors_write"
on public.categories for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "articles_view_published_or_editors"
on public.articles for select
to authenticated
using (status = 'published' or public.can_edit());

create policy "articles_editors_write"
on public.articles for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "article_files_view_all_authenticated"
on public.article_files for select
to authenticated
using (true);

create policy "article_files_editors_write"
on public.article_files for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "tags_view_all_authenticated"
on public.tags for select
to authenticated
using (true);

create policy "tags_editors_write"
on public.tags for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "article_tags_view_all_authenticated"
on public.article_tags for select
to authenticated
using (true);

create policy "article_tags_editors_write"
on public.article_tags for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "audit_logs_admin_select"
on public.audit_logs for select
to authenticated
using (public.is_super_admin());

create policy "audit_logs_admin_insert"
on public.audit_logs for insert
to authenticated
with check (public.is_super_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledgebase-pdfs', 'knowledgebase-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "pdfs_authenticated_read"
on storage.objects for select
to authenticated
using (bucket_id = 'knowledgebase-pdfs');

create policy "pdfs_editors_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'knowledgebase-pdfs' and public.can_edit());

create policy "pdfs_editors_update"
on storage.objects for update
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and public.can_edit())
with check (bucket_id = 'knowledgebase-pdfs' and public.can_edit());

create policy "pdfs_editors_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and public.can_edit());
