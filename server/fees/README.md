# CAD account fees

## Authorization and calculation

- Existing monthly cash-only schedule versions are immutable. Overdraft billing requires a new immutable schedule and independent client acceptance for that account. No account type enrolls itself.
- Discretionary management is a separate, explicitly accepted, account-owned contract. Pricing is additive to monthly service fees: `max(end-period holdings AUM × annual percentage, annual minimum)`, rounded half-up to cents using integers.
- The first annual fee falls one year after opening; each anniversary bills the completed period in arrears using Toronto calendar dates. Leap-day openings clamp in non-leap years without losing the original anchor.
- AUM excludes account cash and debt. Administrators record immutable valuations with dated supporting evidence. An empty holdings ledger may be snapshotted automatically **on the anniversary itself**, with account locks protecting against concurrent purchases/sales. Today's empty holdings are never used to infer a past anniversary's valuation. Nonempty holdings and missed historical valuations require supporting evidence; missing valuation blocks posting without advancing the annual period.
- Zero holdings do not end a contract. Pausing stops processing; resumption skips unbilled anniversaries before the resume date, without proration. Termination stops future assessments, retaining original debits and audit entries.
- Frozen or transfer-locked accounts receive skipped assessments once a valid valuation exists. Unpaid/skipped assessments may be retried while their authorization remains active or waived with a reason. A paid assessment can only be refunded once; the refund credits its owning ledger, leaving the original debit.
- Posted fees are represented by negative cash, not a separate unpaid estimate. Current overdraft is `max(-balance,0)` and falls when deposits/refunds arrive. Only genuinely unposted unpaid assessments are subtracted separately from net worth.

## Atomicity and safety

Monthly and annual assessments have separate period uniqueness keys and disjoint owners. Jobs, settings, consent, retries, waivers and refunds use a shared advisory transaction lock; actual account updates use row locks and exact PostgreSQL decimal arithmetic. Fees use whole cents, but ledger fractional cents remain untouched.

Startup only initializes the schema. Billing settings are disabled by default and require deliberate admin activation. Development has no scheduler. Production jobs respect persisted settings and account-specific consent.

## Fictional Mary history

The fixture-only adjustment lives outside startup and deployment. It requires the existing profile, internally marked accounts, original fixture audit provenance, paused original Trust plan, unchanged opening/depletion ledger, zero cash and no holdings. Any discrepancy aborts the entire transaction.

Preview on the intended **main** environment:

```sh
npx tsx script/apply-mary-fee-overdraft.ts
```

After the user has reviewed and authorized the amounts:

```sh
npx tsx script/apply-mary-fee-overdraft.ts \
  --apply-fictional-overdraft --include-historical-management --confirm-main-environment
```

Never run the application command in isolated task setup, service startup, or post-merge hooks. It preserves existing credentials and original transactions, converts original Trust unpaid assessments with traced adjustment provenance, appends Brokerage history, and adds the explicitly authorized January 1, 2025/2026 minimum-only annual history. No historical market values are fabricated. Repeating the command returns the original committed adjustment without charging again, including after deposits/refunds.

At the reviewed October 2026 cutoff, each account has 32 monthly CAD 363.64 charges and two annual CAD 381.00 charges: CAD 12,398.48 per account, CAD 24,796.96 combined. Monthly due-through is recalculated at execution; these totals are not a permanent fixed liability.

## Verification

`npm run test:fees` runs persistence tests in a randomly named isolated PostgreSQL schema and renders synthetic client/admin interfaces. `npm run check` and `npm run build` check types and bundling. Public preview screenshots show sign-in, not the protected screens; keep authentication intact and disclose that limitation.
