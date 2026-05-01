ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS totp_setup_required boolean NOT NULL DEFAULT false;
