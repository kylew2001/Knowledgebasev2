create or replace function public.lookup_user_by_username(p_username text)
returns table (user_id uuid, email text, force_password_change boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, u.email, p.force_password_change
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;
