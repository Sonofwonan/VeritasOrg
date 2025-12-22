# Final Deployment Guide

Your app is ready! Here's the simplest way to deploy:

## Architecture
```
Frontend → Vercel (React)
Backend → Replit or Railway (Express)
Database → Supabase (PostgreSQL)
```

---

## Step 1: Deploy Database to Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database → Connection String
4. Copy the "URI" format string
5. Run migration:
   ```bash
   DATABASE_URL="your_supabase_uri" npm run db:push
   npx tsx server/seed.ts
   ```

---

## Step 2: Keep Backend Running

Choose ONE option:

### Option A: Keep on Replit (Free, Easiest)
- Just keep this Replit running
- When deployed, you'll get a public URL like: `https://your-project.replit.dev`
- Copy this URL

### Option B: Deploy to Railway.app (Free tier)
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Connect GitHub repo
4. Add environment variables:
   - `DATABASE_URL`: Your Supabase connection string
   - `SESSION_SECRET`: Random string
5. Deploy
6. Copy your Railway URL

---

## Step 3: Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **New Project** → Select your GitHub repo
4. Click **Add Environment Variables**:
   - **Name:** `VITE_API_URL`
   - **Value:** Your backend URL (e.g., `https://your-project.replit.dev` or Railway URL)
5. Click **Deploy**

Done! Your frontend is live and connected to your backend.

---

## Verification

1. Visit your Vercel URL
2. Sign up with email: `test@example.com`, password: `test123`
3. Create an account
4. Try a transfer or investment

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Cannot connect to API" | Check VITE_API_URL is set in Vercel |
| "Database connection failed" | Verify DATABASE_URL on backend is correct |
| "401 Unauthorized" | SESSION_SECRET may be different between deployments |
| "Page not found" | Make sure backend is running |

---

## Cost
- **Replit**: Free ($0 - includes 50 hours/month)
- **Vercel**: Free for frontend ($0)
- **Supabase**: Free ($0 - includes 5GB storage, 2M reads/month)
- **Total**: $0/month!

Your app is production-ready. Good luck!
