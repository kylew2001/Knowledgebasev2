alter table public.profiles
  add column if not exists email_2fa_enabled boolean not null default false,
  add column if not exists otp_code text,
  add column if not exists otp_expires_at timestamptz;
