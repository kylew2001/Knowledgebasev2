create table if not exists public.kb_posts (
  id text primary key,
  title text not null,
  published_by text not null,
  published_at date not null default current_date,
  post_type text check (post_type in ('pdf', 'written', 'both')),
  category text not null,
  subcategory text not null,
  widgets jsonb not null default '[]'::jsonb,
  visibility jsonb not null default '{"mode":"everyone","groupIds":[]}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kb_posts_category_subcategory_idx
on public.kb_posts (category, subcategory);

create index if not exists kb_posts_search_idx
on public.kb_posts using gin (
  to_tsvector(
    'english',
    title || ' ' || category || ' ' || subcategory || ' ' || coalesce(widgets::text, '')
  )
);

drop trigger if exists kb_posts_set_updated_at on public.kb_posts;
create trigger kb_posts_set_updated_at
before update on public.kb_posts
for each row execute function public.set_updated_at();

alter table public.kb_posts enable row level security;

drop policy if exists "kb_posts_view_all_authenticated" on public.kb_posts;
create policy "kb_posts_view_all_authenticated"
on public.kb_posts for select
to authenticated
using (true);

drop policy if exists "kb_posts_editors_write" on public.kb_posts;
create policy "kb_posts_editors_write"
on public.kb_posts for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledgebase-images',
  'knowledgebase-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images_authenticated_read" on storage.objects;
create policy "images_authenticated_read"
on storage.objects for select
to authenticated
using (bucket_id = 'knowledgebase-images');

drop policy if exists "images_editors_insert" on storage.objects;
create policy "images_editors_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'knowledgebase-images' and public.can_edit());

drop policy if exists "images_editors_update" on storage.objects;
create policy "images_editors_update"
on storage.objects for update
to authenticated
using (bucket_id = 'knowledgebase-images' and public.can_edit())
with check (bucket_id = 'knowledgebase-images' and public.can_edit());

drop policy if exists "images_editors_delete" on storage.objects;
create policy "images_editors_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'knowledgebase-images' and public.can_edit());
