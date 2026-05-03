create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.can_view_kb_post(post_visibility jsonb)
returns boolean
language sql
set search_path = public
stable
as $$
  with recursive user_group_tree(group_id, parent_id) as (
    select g.id, g.parent_id
    from public.user_groups ug
    join public.groups g on g.id = ug.group_id
    where ug.user_id = auth.uid()

    union

    select parent.id, parent.parent_id
    from public.groups parent
    join user_group_tree child on child.parent_id = parent.id
  )
  select
    public.can_edit()
    or coalesce(post_visibility->>'mode', 'everyone') = 'everyone'
    or (
      coalesce(post_visibility->>'mode', 'everyone') = 'groups'
      and exists (
        select 1
        from jsonb_array_elements_text(coalesce(post_visibility->'groupIds', '[]'::jsonb)) allowed(group_id)
        join user_group_tree user_groups on user_groups.group_id::text = allowed.group_id
      )
    );
$$;

drop policy if exists "kb_posts_view_all_authenticated" on public.kb_posts;
drop policy if exists "kb_posts_editors_write" on public.kb_posts;
drop policy if exists "kb_posts_visible_to_user" on public.kb_posts;
create policy "kb_posts_visible_to_user"
on public.kb_posts for select
to authenticated
using (public.can_view_kb_post(visibility));

drop policy if exists "kb_posts_editors_insert" on public.kb_posts;
create policy "kb_posts_editors_insert"
on public.kb_posts for insert
to authenticated
with check (public.can_edit());

drop policy if exists "kb_posts_editors_update" on public.kb_posts;
create policy "kb_posts_editors_update"
on public.kb_posts for update
to authenticated
using (public.can_edit())
with check (public.can_edit());

drop policy if exists "kb_posts_editors_delete" on public.kb_posts;
create policy "kb_posts_editors_delete"
on public.kb_posts for delete
to authenticated
using (public.can_edit());

drop policy if exists "images_authenticated_read" on storage.objects;
drop policy if exists "images_visible_post_read" on storage.objects;
create policy "images_visible_post_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'knowledgebase-images'
  and exists (
    select 1
    from public.kb_posts post
    where post.id = (storage.foldername(name))[1]
      and public.can_view_kb_post(post.visibility)
  )
);

drop policy if exists "pdfs_authenticated_read" on storage.objects;
drop policy if exists "pdfs_editors_read" on storage.objects;
create policy "pdfs_editors_read"
on storage.objects for select
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and public.can_edit());

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  reason text not null default 'password_reset',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint password_reset_tokens_expires_after_created check (expires_at > created_at)
);

create index if not exists password_reset_tokens_user_id_idx
on public.password_reset_tokens (user_id);

create index if not exists password_reset_tokens_expires_at_idx
on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;

create index if not exists account_change_requests_reviewed_by_idx
on public.account_change_requests (reviewed_by);

create index if not exists article_files_article_id_idx
on public.article_files (article_id);

create index if not exists article_files_uploaded_by_idx
on public.article_files (uploaded_by);

create index if not exists article_tags_tag_id_idx
on public.article_tags (tag_id);

create index if not exists articles_created_by_idx
on public.articles (created_by);

create index if not exists articles_updated_by_idx
on public.articles (updated_by);

create index if not exists categories_created_by_idx
on public.categories (created_by);

create index if not exists groups_created_by_idx
on public.groups (created_by);

create index if not exists kb_posts_created_by_idx
on public.kb_posts (created_by);

create index if not exists kb_posts_updated_by_idx
on public.kb_posts (updated_by);

create index if not exists post_shares_revoked_by_idx
on public.post_shares (revoked_by);

create index if not exists post_user_state_post_id_idx
on public.post_user_state (post_id);

create index if not exists user_groups_group_id_idx
on public.user_groups (group_id);

revoke execute on function public.lookup_user_by_username(text) from public, anon, authenticated;
grant execute on function public.lookup_user_by_username(text) to service_role;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.can_edit() from public, anon;
revoke execute on function public.can_view_kb_post(jsonb) from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.can_edit() to authenticated, service_role;
grant execute on function public.can_view_kb_post(jsonb) to authenticated, service_role;
