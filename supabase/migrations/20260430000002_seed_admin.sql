do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'kylew@internal.local',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    now(), now(),
    '', '', '', ''
  );

  -- trigger auto-creates the profile row; update username + role
  update public.profiles
  set username = 'kylew',
      role = 'super_admin',
      force_password_change = true
  where id = v_user_id;
end $$;
