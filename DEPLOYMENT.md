# Veritas Wealth - Deployment Guide (Zero-Cost Production)

This guide provides instructions for deploying Veritas Wealth to a zero-cost production stack using Vercel, Render, and Supabase.

## 1. Supabase (Database)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database**.
3. Copy the **Connection String** (URI). It looks like: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
4. In your project here, run `npm run db:push` using this URL to initialize the tables.

## 2. Render (Backend)
1. Create a **Web Service** at [render.com](https://render.com).
2. Connect your GitHub repository.
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `node dist/index.cjs`
5. Add these **Environment Variables**:
   - `DATABASE_URL`: Your Supabase connection string.
   - `SESSION_SECRET`: A long random string (e.g., `a7k9mxq2w8j3h5f6g1b4c9d2e7k3n8p1`).
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `https://your-app-name.vercel.app` (Your Vercel URL).
   - `PORT`: `5000`

## 3. Vercel (Frontend)
1. Create a project at [vercel.com](https://vercel.com).
2. Connect your GitHub repository.
3. Add these **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend-name.onrender.com` (Your Render URL).
4. Vercel will automatically detect the Vite build and deploy.

## Troubleshooting
- **401 Errors**: Ensure `CLIENT_URL` on Render matches your Vercel URL exactly (no trailing slash).
- **CORS**: The backend is configured to allow cross-site cookies via `sameSite: "none"` and `secure: true`.
- **Render Sleep**: The free tier of Render sleeps after 15 mins. The first request might take 30-60s to wake up the server.
