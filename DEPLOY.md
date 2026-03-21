# 🚀 Blackboard AI Chat - Deployment Guide

## ✅ Already Done For You
- Supabase project created: `blackboard-ai-chat`
- Database schema applied (all tables, RLS, indexes, triggers)
- Project URL: `https://hpvcfizzwljhrioacykn.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdmNmaXp6d2xqaHJpb2FjeWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjkwMDQsImV4cCI6MjA4OTY0NTAwNH0.D72HJjjL6tXIkoKk6eNd9En9pjsrylRuEctSrKq1utY`
- Encryption Secret: `8Wunt2zibsjEixe/xgB6xcM9JZdhkVw3/V5A6S1bF/4=`

---

## Step 1 — Get Your Service Role Key (2 minutes)

1. Go to https://supabase.com/dashboard/project/hpvcfizzwljhrioacykn/settings/api
2. Scroll to **"Project API keys"**
3. Copy the **service_role** key (starts with `eyJ...`)

---

## Step 2 — Push to GitHub

```bash
cd blackboard-ai-chat
git init
git add .
git commit -m "Initial commit"
```

Create a new repo at https://github.com/new then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/blackboard-ai-chat.git
git push -u origin main
```

---

## Step 3 — Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hpvcfizzwljhrioacykn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdmNmaXp6d2xqaHJpb2FjeWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjkwMDQsImV4cCI6MjA4OTY0NTAwNH0.D72HJjjL6tXIkoKk6eNd9En9pjsrylRuEctSrKq1utY` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(paste from Step 1)* |
| `ENCRYPTION_SECRET` | `8Wunt2zibsjEixe/xgB6xcM9JZdhkVw3/V5A6S1bF/4=` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` *(set after deploy)* |

4. Click **Deploy**!

---

## Step 4 — After Deploy

1. Copy your Vercel URL (e.g. `https://blackboard-ai-chat.vercel.app`)
2. In Vercel → Settings → Environment Variables → update `NEXT_PUBLIC_APP_URL` to your URL
3. Redeploy once
4. Go to https://supabase.com/dashboard/project/hpvcfizzwljhrioacykn/auth/url-configuration
5. Add your Vercel URL to **"Redirect URLs"**: `https://your-app.vercel.app/**`

---

## Using the App

1. Sign up with your email
2. Go to **Settings** (bottom-left)
3. Paste your **OpenAI API key** (starts with `sk-`)
4. Start chatting! The app will auto-summarize every 5 messages to save tokens.
