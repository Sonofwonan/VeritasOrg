# Vercel Deployment - Easy Setup

## Option 1: Frontend Only on Vercel (Recommended)

This is simpler and works best with your current setup.

### Step 1: Prepare Frontend for Vercel
Your frontend is already ready. Just push to GitHub.

### Step 2: Run Backend Separately
Choose ONE of these options:

**Option A: Keep Backend on Replit** (Free & Simple)
- Keep this Replit running as your backend
- Copy your Replit URL when deployed
- Update frontend API endpoint to point to your Replit backend

**Option B: Run Backend on Railway/Render** (Free tier available)
- Railway.app or Render.com
- Push your code there
- Database: Supabase
- Set `DATABASE_URL` environment variable

### Step 3: Update Frontend API Endpoint

In `client/src/lib/queryClient.ts`, update the API base URL:

```typescript
// For Replit backend (while in development)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// For production on Replit
// Set VITE_API_URL in Vercel environment variables
```

### Step 4: Deploy Frontend to Vercel

1. Push your repo to GitHub
2. Go to vercel.com → Import Project
3. Select your GitHub repo
4. In **Environment Variables**, add:
   - `VITE_API_URL`: Your backend URL (e.g., https://your-backend.replit.dev)
5. Click **Deploy**

---

## Option 2: Full Backend on Vercel (Advanced)

If you want the backend on Vercel too:

1. Refactor Express app into Vercel API routes
2. More complex setup, not recommended for this project size
3. Cold start issues with database connections

---

## Quick Troubleshooting

**"Build failed"** → Check build logs in Vercel dashboard
**"API not connecting"** → Verify VITE_API_URL is set in Vercel env vars
**"Database connection failed"** → Verify DATABASE_URL in Supabase/Vercel

---

## Current Architecture (Recommended)
```
┌─────────────────┐
│    Vercel       │ (Frontend Only)
│ React + Vite    │
└────────┬────────┘
         │
    VITE_API_URL
         │
    ┌────▼─────────┐
    │   Backend     │ (Replit, Railway, or Render)
    │ Express API   │
    └────┬─────────┘
         │
    DATABASE_URL
         │
    ┌────▼──────────┐
    │   Supabase    │ (Database)
    │   PostgreSQL  │
    └───────────────┘
```
