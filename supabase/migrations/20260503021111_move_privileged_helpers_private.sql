create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and disabled_at is null
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select private.current_user_role() = 'super_admin'
$$;

create or replace function private.can_edit()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select private.current_user_role() in ('super_admin', 'editor')
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security invoker
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and disabled_at is null
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security invoker
set search_path = public
stable
as $$
  select public.current_user_role() = 'super_admin'
$$;

create or replace function public.can_edit()
returns boolean
language sql
security invoker
set search_path = public
stable
as $$
  select public.current_user_role() in ('super_admin', 'editor')
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
    private.can_edit()
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

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or private.is_super_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists "security_settings_admin_all" on public.security_settings;
create policy "security_settings_admin_all"
on public.security_settings for all
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists "categories_editors_write" on public.categories;
create policy "categories_editors_write"
on public.categories for all
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "articles_view_published_or_editors" on public.articles;
create policy "articles_view_published_or_editors"
on public.articles for select
to authenticated
using (status = 'published' or private.can_edit());

drop policy if exists "articles_editors_write" on public.articles;
create policy "articles_editors_write"
on public.articles for all
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "article_files_editors_write" on public.article_files;
create policy "article_files_editors_write"
on public.article_files for all
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "tags_editors_write" on public.tags;
create policy "tags_editors_write"
on public.tags for all
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "article_tags_editors_write" on public.article_tags;
create policy "article_tags_editors_write"
on public.article_tags for all
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs for select
to authenticated
using (private.is_super_admin());

drop policy if exists "audit_logs_admin_insert" on public.audit_logs;
create policy "audit_logs_admin_insert"
on public.audit_logs for insert
to authenticated
with check (private.is_super_admin());

drop policy if exists "groups_admin_write" on public.groups;
create policy "groups_admin_write"
on public.groups for all
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists "user_groups_select_self_or_admin" on public.user_groups;
create policy "user_groups_select_self_or_admin"
on public.user_groups for select
to authenticated
using (user_id = (select auth.uid()) or private.is_super_admin());

drop policy if exists "user_groups_admin_write" on public.user_groups;
create policy "user_groups_admin_write"
on public.user_groups for all
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists "kb_posts_editors_insert" on public.kb_posts;
create policy "kb_posts_editors_insert"
on public.kb_posts for insert
to authenticated
with check (private.can_edit());

drop policy if exists "kb_posts_editors_update" on public.kb_posts;
create policy "kb_posts_editors_update"
on public.kb_posts for update
to authenticated
using (private.can_edit())
with check (private.can_edit());

drop policy if exists "kb_posts_editors_delete" on public.kb_posts;
create policy "kb_posts_editors_delete"
on public.kb_posts for delete
to authenticated
using (private.can_edit());

drop policy if exists "post_shares_admin_select" on public.post_shares;
create policy "post_shares_admin_select"
on public.post_shares for select
to authenticated
using (private.is_super_admin());

drop policy if exists "post_shares_editors_insert" on public.post_shares;
create policy "post_shares_editors_insert"
on public.post_shares for insert
to authenticated
with check (private.can_edit() and created_by = (select auth.uid()));

drop policy if exists "post_shares_admin_update" on public.post_shares;
create policy "post_shares_admin_update"
on public.post_shares for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists "pdfs_editors_read" on storage.objects;
create policy "pdfs_editors_read"
on storage.objects for select
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and private.can_edit());

drop policy if exists "pdfs_editors_insert" on storage.objects;
create policy "pdfs_editors_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'knowledgebase-pdfs' and private.can_edit());

drop policy if exists "pdfs_editors_update" on storage.objects;
create policy "pdfs_editors_update"
on storage.objects for update
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and private.can_edit())
with check (bucket_id = 'knowledgebase-pdfs' and private.can_edit());

drop policy if exists "pdfs_editors_delete" on storage.objects;
create policy "pdfs_editors_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'knowledgebase-pdfs' and private.can_edit());

drop policy if exists "images_editors_insert" on storage.objects;
create policy "images_editors_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'knowledgebase-images' and private.can_edit());

drop policy if exists "images_editors_update" on storage.objects;
create policy "images_editors_update"
on storage.objects for update
to authenticated
using (bucket_id = 'knowledgebase-images' and private.can_edit())
with check (bucket_id = 'knowledgebase-images' and private.can_edit());

drop policy if exists "images_editors_delete" on storage.objects;
create policy "images_editors_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'knowledgebase-images' and private.can_edit());

drop policy if exists "password_reset_tokens_no_client_access" on public.password_reset_tokens;
create policy "password_reset_tokens_no_client_access"
on public.password_reset_tokens for all
to authenticated
using (false)
with check (false);

create index if not exists password_reset_tokens_created_by_idx
on public.password_reset_tokens (created_by);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.can_edit() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.can_edit() to authenticated, service_role;
