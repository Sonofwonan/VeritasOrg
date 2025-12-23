# Deploying to Vercel + Supabase (Recommended)

This project uses an Express backend, a Vite React frontend, Drizzle ORM and expects a Postgres DB. The recommended deployment pattern is to host the *frontend on Vercel* and *database on Supabase*. The backend can be hosted on a small Node host (Render/Railway) or converted into Vercel API routes (more work).

## 1) Provision Supabase DB

1. Go to https://app.supabase.com and create a new project.
2. In the Project Settings → Database → Connection string, copy the `DATABASE_URL` connection string.
3. In this repo, create a local `.env` with (or for quick testing you can use the committed `/.env` in this repo — it contains **placeholder test values only** and should be removed or replaced before production):

```
DATABASE_URL="<your-supabase-connection-string>"
SESSION_SECRET="<your-session-secret>"
NODE_ENV="development"
PORT=5000
CLIENT_URL="http://localhost:5173"
```

4. Push the schema/migrations to the DB from your machine:

```bash
# ensure env var is set locally
export DATABASE_URL="<your-supabase-connection-string>"
npm run db:push
```

(Or use `npx drizzle-kit` manually to generate and run migrations.)

## 2) Host the Backend (two options)

Option A (recommended, easiest): Host backend on Render/Railway/Heroku
- Create a service (GitHub-connected)
- Add env vars: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `COOKIE_DOMAIN` (optional)
- Deploy
- Take the public URL (e.g., `https://api.myapp.example`)

Option B: Convert to Vercel API routes (advanced)
- Requires refactor: Express -> serverless route files under `/api`
- Reasonable for small APIs, but requires additional testing and changes

## 3) Host Frontend on Vercel

1. Push your repo to GitHub.
2. Go to https://vercel.com and import the project.
3. In the Vercel dashboard for the project, set Environment Variables (Production):
   - `VITE_API_URL` → your backend URL (e.g., `https://api.myapp.example`)
   - If you host backend on Vercel and it needs DB: `DATABASE_URL` and `SESSION_SECRET` as secrets
   - `CLIENT_URL` → https://your-frontend-url (optional; used for CORS)
4. Deploy.

Note: The repo already contains `vercel.json` placeholders for these environment variables.

## 4) Session / Cookies / CORS considerations

- We added CORS and configured cookie `sameSite` and `secure` options.
- If the frontend is on Vercel and backend on another host, set `CLIENT_URL` to your Vercel site URL and ensure `SESSION_SECRET` is set in backend envs.
- Ensure HTTPS (production) so cookies with `secure: true` are accepted.

## 5) Verification

- Load the frontend and try registering/logging in. In the browser devtools → Application → Cookies, ensure the session cookie is present.
- Use the Vercel logs and backend logs to trace issues.

## 6) Optional automation

- Add a GitHub Action to run `npm run check` and `npm run build` on PRs.
- Add a workflow step to run `drizzle-kit push` using a `DATABASE_URL` secret on merges to `main` (be careful; migration runs modify production DB).

---

If you want, I can:
- Add a GitHub Action CI workflow (TS + lint + build)
- Add a small Render/Railway deployment README and sample service definition
- Help you refactor backend to Vercel Serverless routes (takes more effort)

Which of these do you want me to implement next?