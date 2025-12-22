# Deployment Guide: Vercel + Supabase

## Step 1: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to initialize
4. Go to **Settings → Database** and copy your `Connection String` (JDBC or URI format)
   - Select "URI" format
   - Copy the full connection string: `postgresql://postgres:password@host:port/postgres`
5. Keep this safe—you'll need it for Vercel environment variables

## Step 2: Migrate Database Schema to Supabase

1. Update your local `.env` file:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/database"
   ```

2. Run migrations:
   ```bash
   npm run db:push
   ```

3. Seed with demo data (optional):
   ```bash
   npx tsx server/seed.ts
   ```

## Step 3: Deploy to Vercel

### Push your code to GitHub
```bash
git init
git add .
git commit -m "Init investment platform"
git remote add origin https://github.com/YOUR_USERNAME/investment-platform.git
git push -u origin main
```

### Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **New Project**
3. Select your repository
4. In **Environment Variables**, add:
   - `DATABASE_URL`: (from Supabase connection string)
   - `SESSION_SECRET`: (generate a random string: `openssl rand -base64 32`)
5. Click **Deploy**

## Step 4: Frontend Configuration

The frontend automatically configures API calls to your backend:
- In development: `http://localhost:5000`
- In production: `https://your-vercel-app.vercel.app`

No changes needed—the build process handles this.

## Troubleshooting

- **Database connection fails**: Verify `DATABASE_URL` format and whitelist Vercel IPs in Supabase firewall
- **Session not persisting**: Ensure `SESSION_SECRET` is set in Vercel environment
- **CORS errors**: Backend runs on same Vercel domain as frontend
- **Cold starts**: Supabase and Vercel both have brief cold starts on first request

## Monitoring

- **Vercel**: Logs available at vercel.com/dashboard
- **Supabase**: Logs available at supabase.com dashboard under "Logs"

## Scaling

- **Database**: Upgrade Supabase plan for higher connections
- **API**: Vercel Functions auto-scale; monitor usage at vercel.com
- **Costs**: Both services have generous free tiers; paid plans start at ~$5/month each
