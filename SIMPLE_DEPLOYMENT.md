# Simple Vercel + Supabase Deployment

Your entire app runs on just 2 services:

```
Vercel (Frontend + Backend)  ←→  Supabase (Database)
```

## Step 1: Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your connection string from Settings → Database
4. Run locally:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   npx tsx server/seed.ts
   ```

## Step 2: Push Code to GitHub
```bash
git add .
git commit -m "Deploy to Vercel + Supabase"
git push
```

## Step 3: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **New Project**
3. Select your GitHub repo
4. Add environment variables:
   - `DATABASE_URL` = your Supabase connection string
   - `SESSION_SECRET` = random string (generate: `openssl rand -base64 32`)
5. Click **Deploy**

That's it! Both frontend and backend are live on Vercel, using Supabase for data.

## No More Setup Needed
- Frontend: Auto-deployed when you push to GitHub
- Backend: Same deployment on Vercel
- Database: Running on Supabase
- Total cost: $0/month
