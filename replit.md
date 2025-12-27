# Veritas Wealth - Investment & Cash Management Platform

## Project Overview
A professional wealth management platform with authentication, portfolio management, and investment tracking. The platform includes a public homepage with success stories and market insights, plus protected dashboard for authenticated users.

**Status**: Authentication system fixed, homepage redesigned with professional content, live deployment needs environment variable configuration.

## Recent Changes (Dec 24, 2025)

### 1. Authentication System Fix
- **Status**: FIXED ✓
- **Issue**: Frontend sends `email` field, Passport was configured correctly with `usernameField: 'email'`
- **Solution**: Verified Passport LocalStrategy in `server/auth.ts` is correctly configured
- **Files**: `server/auth.ts` (line 52 uses correct usernameField)

### 2. Homepage Redesign
- **Completed**: Professional wealth management homepage
- **Features added**:
  - Hero section with gradient branding and CTAs
  - 6 feature cards (Smart Investments, Security, Analytics, Tools, Expert Support, Proven Results)
  - Success stories with before/after wealth comparisons (3 user testimonials)
  - Market insights section (market volatility, investment strategies)
  - Statistics dashboard (50K+ users, $4.2B assets managed, 99.9% uptime, 12% avg return)
  - CTA sections encouraging sign-up
- **Styling**: Professional cards with hover-elevate effects, gradient accents, semantic colors
- **File**: `client/src/pages/home.tsx`

### 3. Test IDs Added
- All interactive elements have descriptive data-testid attributes
- Examples: `button-get-started`, `button-sign-in`, `button-cta-start`

## Database Configuration - CRITICAL

### Session Pooler Connection Required
Your Supabase database MUST use the **Session Pooler** connection string, not Transaction Pooler.

**Why?** The Transaction Pooler does not support PREPARE statements that Drizzle ORM requires. Only Session Pooler works.

### Get the Session Pooler Connection String

1. Go to **Supabase Dashboard > Your Project > Settings > Database**
2. In the "Method" dropdown, select **Session pooler** (not Transaction pooler)
3. Copy the connection string shown
4. Should contain: `pooler.supabase.com:5432` and `pool_mode=session`

### Set Environment Variables on Render

Go to your **Render Dashboard > Your Backend Service > Environment**

Add or update these variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Session Pooler connection string from Supabase |
| `SESSION_SECRET` | Strong random string (min 32 chars) - generate new |
| `CLIENT_URL` | `https://veritaswealth.vercel.app` |

**Example SESSION_SECRET**:
```
a7k9mxq2w8j3h5f6g1b4c9d2e7k3n8p1
```

**CRITICAL**: Do NOT set `NODE_ENV` as an environment variable on Render. The build script automatically sets `NODE_ENV=production`.

### Why Session Pooler Works

- **Transaction Pooler**: No PREPARE statement support (breaks Drizzle)
- **Session Pooler**: Full PostgreSQL support (works with Drizzle)
- **IPv4 Compatible**: Yes, works perfectly on Render and Vercel

### After Setting Variables

1. Save changes in Render - service auto-restarts
2. Clear browser cookies
3. Test signup - users will now appear in Supabase database
4. Verify: Run `SELECT * FROM users ORDER BY id DESC LIMIT 1;` in Supabase

## Architecture

### Backend (Render)
- **Framework**: Express.js
- **Authentication**: Passport.js with LocalStrategy
- **Session Storage**: PostgreSQL (via connect-pg-simple)
- **Database**: Supabase PostgreSQL
- **Port**: 5000 (production)

### Frontend (Vercel)
- **Framework**: React + Vite
- **Routing**: Wouter
- **State Management**: React Query (TanStack)
- **UI Components**: Shadcn
- **Styling**: Tailwind CSS

### Database Schema
- **users**: User credentials and profile
- **accounts**: Cash and investment accounts per user
- **transactions**: Transfers and trades
- **investments**: Held securities with purchase price and current value
- **session**: Passport session storage (auto-created by connect-pg-simple)

## API Endpoints

### Authentication
- `POST /api/register` - Create account
- `POST /api/login` - Login (email + password)
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user (requires auth)

### Accounts
- `GET /api/accounts` - List user accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id` - Get account details

### Transactions
- `POST /api/transactions/transfer` - Transfer between accounts

### Investments
- `GET /api/investments` - List user investments
- `POST /api/investments/buy` - Buy assets
- `POST /api/investments/sell` - Sell assets

### Market Data
- `GET /api/market/quote/:symbol` - Get live quote

## Development Notes

### Key Files
- `server/auth.ts` - Passport setup and session config
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database interface
- `client/src/hooks/use-auth.ts` - Frontend auth logic
- `client/src/pages/home.tsx` - Homepage with success stories
- `shared/schema.ts` - Zod schemas and database models
- `shared/routes.ts` - Type-safe API contract

### Session Configuration Details
Located in `server/auth.ts`:
```typescript
const sessionSettings: session.SessionOptions = {
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "default_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === "production", // HTTPS only
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
};
```

The `sameSite: "none"` in production allows cookies to be sent cross-site (Vercel to Render).

## Frontend Auth Flow
- `useAuth()` hook maintains auth state via React Query
- Initial request to `/api/user` checks if user is logged in
- Login mutation calls `/api/login` and updates query cache
- Protected routes check for user via `ProtectedRoute` component
- All requests include `credentials: "include"` for cookie handling

## Next Steps for User

1. **Set environment variables on Render** (see section above)
2. Restart Render backend
3. Test login flow on live site
4. Verify `/api/user` returns 200 (not 401)
5. Check dashboard loads with user data

## Troubleshooting

### 401 on /api/user after login
- Check SESSION_SECRET is set on Render
- Verify NODE_ENV=production
- Check Supabase connection working (test in Render logs)
- Restart Render backend after env changes

### Session not persisting
- Check browser cookies are being set (dev tools > Application > Cookies)
- Verify `secure` and `sameSite` cookie settings
- Check PostgreSQL session table exists: `SELECT * FROM "session";`

### Login fails
- Check email/password are correct
- Verify user was registered in auth signup flow
- Check backend logs for authentication errors

## User Preferences
- Professional design for wealth management/investment platform
- Live deployment: Render (backend) + Vercel (frontend) + Supabase (database)
- Emphasis on security, professional UI, real investor testimonials
