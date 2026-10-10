# Signed-in balance regression checks

Run `npm run test:balances:browser`.

Prerequisites: Node/npm dependencies, PostgreSQL tools (`initdb`, `pg_ctl`,
`createdb`) on PATH and Chromium. On Replit the PostgreSQL module and packaged
Chromium are used. Elsewhere run `npx playwright install chromium` and install
its operating-system dependencies. Optional `BALANCE_E2E_PG_BIN` selects a
PostgreSQL **binary directory**, and `BALANCE_E2E_CHROMIUM` a browser executable.
Neither is a database URL.

## Isolation and authentication

The runner creates a new, loopback-only PostgreSQL cluster in an owned temporary
directory, allocates separate database/application ports and exports the current
Drizzle schema into it. It starts the actual app with a whitelisted environment:
no inherited Supabase, admin, session, email, SMS or WhatsApp credentials.
`VITE_API_URL` is explicitly `/api` so local env files cannot send browser API
requests to a shared backend. The production billing scheduler is not started.

Each test gets unique fictional users, a scrypt password hash, named accounts,
holdings, a pending deposit and an authorized fixture fee enrollment. Browser
contexts start anonymous, are redirected to `/auth`, submit the normal login
form, and verify the actual HTTP-only session cookie. No route, middleware or
session bypass is added.

The fee scenario enables billing and calls actual retry/refund APIs only in
this disposable cluster. Other scenarios use guarded local fixture queries to
represent administrative transfer status changes, deposits and market updates.
All API responses are real except deliberately delayed/failed/malformed requests
in the failure scenario. Cleanup never deletes individual client records or
issues DROP against an inherited connection. It stops and removes only the
cluster created by this runner. SIGINT/SIGTERM also trigger cleanup.

## Coverage and evidence

Journeys run on desktop (1440×1000) and narrow mobile (360×800):

- Funded cash plus holdings, separately linked named debt below, negative cash
  ledgers, all positive accounts (including the sixth, outside the dashboard's
  preview), account navigation, session persistence and full-digit CAD amounts.
- Actual authorized fee debit/refund, 30-second fee/account/holdings polling,
  changed cash and market values, and reload.
- Pending/failed/completed deposits, real internal cash transfer, all seven
  institutional transfer statuses, transfer locks and navigation.
- Delayed loading, initial and background request failures, unavailable totals,
  fee-summary failure, malformed balance and retry recovery.
- Existing accounts-page privacy control, including ledger and named fee debt.
  Dashboard masking is not currently implemented and is not asserted here.
- Profile requests cannot change a client's balance display currency.
- A preconfigured, isolated £ exception retains numeric ledger values and uses
  consistent headline, account-detail, fee-debt and statement labels. Ordinary
  fixtures remain CAD. Accepted fee-plan pricing/terms are not relabeled.
- Trusts remain in Business & Trust on Accounts while appearing alongside
  brokerage, IRA, workplace retirement and education accounts in the trading
  selector. Normal trading controls buy additional shares and sell trust
  holdings, with cash, holdings and completed transaction records checked.
  Debt restrictions disable trading and reject direct requests; all three active
  liquidation statuses reject buys and sells without changing financial records.
  Another client's trust is neither offered nor authorized for trading.

The browser clock advances client polling intervals; server dates remain real.
Assertions wait for rendered values rather than assuming clock advancement
means requests have completed. Account previews require stable server ordering;
otherwise updates can move a physical PostgreSQL row outside the five-row
preview despite unchanged account membership.

Screenshots for each meaningful state, JSON console/page/network error evidence,
the isolated server log and an isolation manifest are saved under
`test-results/balances/`. The HTML report is under `playwright-report/balances/`;
failed cases also retain Playwright traces. Both directories are gitignored.
Expected anonymous `/api/user` 401s, deliberately injected 503s, and explicitly
configured trade rejection responses are identified in the evidence;
unexpected HTTP failures, console errors or page errors fail
the test. Evidence contains only fictional identities, but failed-login traces
can contain ephemeral test passwords, so do not publish raw traces.
