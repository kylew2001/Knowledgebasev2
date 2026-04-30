alter table public.profiles add column username text unique;

create index profiles_username_lower_idx on public.profiles (lower(username));

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, force_password_change)
  values (new.id, split_part(new.email, '@', 1), 'viewer', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
