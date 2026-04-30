# Supabase Database And Auto Deploy Guide

This guide explains how to set up Supabase for the knowledge base and automatically deploy database changes from GitHub.

Official Supabase migration docs use the Supabase CLI with:

```bash
supabase db push
```

Reference: https://supabase.com/docs/guides/deployment/database-migrations

## 1. Create A Supabase Project

1. Sign in to Supabase.
2. Create a new project.
3. Save the database password somewhere secure.
4. Open **Project Settings > API** and copy:
   - Project URL
   - Anon public key
   - Service role key

Add these to `.env.local` for local development:

```text
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 2. Apply The Initial Schema

This repository includes the initial migration here:

```text
supabase/migrations/20260430000000_initial_schema.sql
```

Install the Supabase CLI, then run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Your `PROJECT_REF` is in the Supabase project URL. It looks like:

```text
https://supabase.com/dashboard/project/YOUR_PROJECT_REF
```

## 3. What The Migration Creates

The initial migration creates:

- User roles: `super_admin`, `editor`, `viewer`
- Profiles table for app permissions
- Security settings for lockout and timeout rules
- Nested categories and subcategories
- Articles with manual Markdown content
- PDF attachment records
- Tags
- Audit logs
- Private `knowledgebase-pdfs` storage bucket
- Row Level Security policies

## 4. Create The First Super Admin

Because public signups are disabled, create the first user from Supabase:

1. Open **Authentication > Users**.
2. Select **Add user**.
3. Enter the email and temporary password.
4. Copy the new user ID.
5. Open **SQL Editor** and run:

```sql
insert into public.profiles (id, display_name, role)
values ('PASTE_AUTH_USER_ID_HERE', 'Your Name', 'super_admin');
```

After that, the super admin can create and manage other users through the app once the admin routes are fully wired to Supabase Admin APIs.

## 5. Add GitHub Secrets For Supabase Deploys

Open the GitHub repository:

**Settings > Secrets and variables > Actions > New repository secret**

Add:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
```

Where:

- `SUPABASE_ACCESS_TOKEN` is created from your Supabase account access tokens.
- `SUPABASE_PROJECT_ID` is the Supabase project ref.
- `SUPABASE_DB_PASSWORD` is the database password for the project.

## 6. Auto Deploy Migrations From GitHub

This repository includes:

```text
.github/workflows/supabase-migrations.yml
```

When changes are pushed to `main` under `supabase/migrations/**`, GitHub Actions will:

1. Check out the repository.
2. Install the Supabase CLI using `supabase/setup-cli@v1`.
3. Link to your Supabase project.
4. Run `supabase db push`.

Supabase also documents `supabase/setup-cli@v1` for GitHub Actions.

Reference: https://github.com/supabase/setup-cli

## 7. How To Make Future DB Changes

Create a new migration:

```bash
supabase migration new describe_the_change
```

Edit the new SQL file in:

```text
supabase/migrations/
```

Test locally if you are running the local Supabase stack:

```bash
supabase db reset
```

Commit and push:

```bash
git add supabase/migrations
git commit -m "Add database change"
git push
```

When merged into `main`, GitHub Actions deploys the migration to Supabase.

## 8. Free Plan Notes

Supabase Free is enough for an MVP, but plan around these limits:

- 500 MB database size
- 1 GB storage
- 50 MB max file size for uploads on Free projects
- 5 GB egress

For PDFs, keep files compressed and avoid storing unnecessary duplicates.

References:

- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/storage/uploads/file-limits
