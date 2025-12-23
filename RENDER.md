# Deploying the backend on Render

This project uses an Express backend (bundled to `dist` by `npm run build`) and expects a Postgres DB. Use Render to host the API (frontend remains on Vercel / static host). Below are concise, prescriptive steps for a smooth Render setup.

## Quick summary ✅
- Create a **Web Service** (Node) for the backend.
- Provide a Postgres DB (Render Postgres or a remote DB like Supabase).
- Add environment variables: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `CLIENT_URL` (frontend URL), `COOKIE_DOMAIN` (optional).
- Run migrations using `npm run db:push` (locally or via a one-off Render job).

---

## 1) Repo & service setup (Render dashboard)
1. Go to https://dashboard.render.com and click **New** → **Web Service**.
2. Connect your GitHub repo and pick this repository (`Sonofwonan/VeritasOrg`).
3. Branch: `main` (or whichever branch you deploy from).
4. Root Directory: leave blank (repo root) — the build script builds both client and server.
5. Environment: `Node`.
6. Build Command:

```bash
npm ci && npm run build
```

7. Start Command:

```bash
npm run start
```

8. Instance: choose the smallest instance to start (Free/Starter if available).
9. Health Checks: Render will check that the service binds to `$PORT` and responds. (The server reads `process.env.PORT`.)

---

## 2) Database options
- Option A (recommended for simplicity): Use Supabase (as in the docs) and set `DATABASE_URL` to Supabase's connection string.
- Option B: Provision a Render-managed Postgres instance (Dashboard → New → Postgres). Use the provided connection string as `DATABASE_URL`.

Notes:
- Run migrations after provisioning the DB (step 3 below).
- If using Render Postgres, add a `db` dependency or attach the DB to the service as needed.

---

## 3) Environment variables (Render Dashboard → Service → Environment)
Add the following Production environment variables:
- DATABASE_URL → postgres connection string
- SESSION_SECRET → (random long secret)
- NODE_ENV → production
- CLIENT_URL → https://your-frontend.example
- COOKIE_DOMAIN → (optional; set only if you need cross-domain cookies)

Important: do not commit real secrets to the repo. Use Render's dashboard secrets.

---

## 4) Run database migrations
Choice A (recommended locally):

```bash
# Locally
export DATABASE_URL="<your-prod-db-connection-string>"
npm run db:push
```

Choice B (on Render): create a one-off Shell command in the Render dashboard (or create a Background Job) that runs:

```bash
npm ci && npx drizzle-kit push --connection "${DATABASE_URL}"
```

---

## 5) Additional tips
- CORS & cookies: set `CLIENT_URL` in env vars and ensure `SESSION_SECRET` is set. The app uses `sameSite` depending on NODE_ENV.
- Health route: If you want a dedicated health-check endpoint, add a simple route (GET /health → 200) so Render can check status.
- Logs: Use the Render service logs to troubleshoot build/start issues and runtime errors.

---

## Optional: `render.yaml` (infra-as-code)
You can add a `render.yaml` to the repo to declare resources in a reproducible way. Example snippet (edit names / plans before applying):

```yaml
services:
  - type: web
    name: veritas-backend
    env: node
    branch: main
    buildCommand: "npm ci && npm run build"
    startCommand: "npm run start"
    envVars:
      - key: NODE_ENV
        value: production
      - key: VITE_API_URL
        value: https://your-api.example

databases:
  - type: postgres
    name: veritas-db
    plan: starter  # choose appropriate plan
```

Note: `render.yaml` must be created with correct values and then Render's `render` CLI or the dashboard can apply it.

---

## Want me to do this for you? 🔧
I can:
- Add `RENDER.md` to the repo (done).
- Add a sample `render.yaml` (I can add it as a separate file if you want).
- Add a health-check route and a deployment checklist or a one-off `db:migrate` job config.

Tell me which of the optional items you'd like me to implement next. 👇