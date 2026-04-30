# Vercel And GitHub Auto Deploy Guide

This guide explains how to connect the project to GitHub and Vercel so edits pushed to GitHub automatically deploy.

Official Vercel docs say Git-connected projects create Preview Deployments for branch pushes and Production Deployments from the production branch, usually `main`.

Reference: https://vercel.com/docs/deployments/git

## 1. Push The Project To GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Initial IT support knowledge base"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Skip `git init` if the repository is already initialized.

## 2. Create The Vercel Project

1. Sign in to Vercel.
2. Select **Add New Project**.
3. Import the GitHub repository.
4. Use these settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | Leave default |
| Install Command | `npm install` |
| Production Branch | `main` |

## 3. Add Environment Variables

In Vercel, open:

**Project > Settings > Environment Variables**

Add:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Use the values from your Supabase project settings.

Important: `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side. Never expose it in client components or browser code.

## 4. Deploy

After the variables are saved, select **Deploy**.

Vercel will build the app and create the first production deployment.

## 5. Daily Edit Workflow

Use this workflow for normal changes:

```bash
git checkout -b feature/my-change
git add .
git commit -m "Describe the change"
git push -u origin feature/my-change
```

Then open a pull request into `main`.

Vercel will create a Preview Deployment for the pull request. Test that URL first. When the pull request is merged into `main`, Vercel automatically creates a Production Deployment.

## 6. Rollbacks

If a deployment breaks something:

1. Open the Vercel project.
2. Go to **Deployments**.
3. Choose the last known-good deployment.
4. Select **Promote to Production** or revert the Git commit and push to `main`.

## 7. Free Plan Notes

Vercel Hobby is free, but Vercel documents it as intended for personal projects. If this becomes a production workplace tool, confirm that the plan is appropriate for your use.

Reference: https://vercel.com/docs/accounts/plans/hobby
