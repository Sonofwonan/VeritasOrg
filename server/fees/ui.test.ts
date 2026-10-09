import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { ClientFees as ClientFeesComponent } from "../../client/src/components/fees/client-fees";
import { AdminFees } from "../../client/src/components/fees/admin-fees";
import { FeeLiability, AccountFeeBalance } from "../../client/src/components/fees/fee-liability";
import DashboardPage from "../../client/src/pages/dashboard";
import AccountsPage from "../../client/src/pages/accounts-page";
import { DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS, type ClientFees, type FeeOverview, type FeePreview } from "../../shared/fees";

const settings = { enabled: false, timeZone: "America/Toronto" };
const schedule = {
  id: 1, version: 1, name: "Fixture service plan", currency: "CAD" as const,
  total: "363.64", components: DEFAULT_FEE_COMPONENTS, terms: DEFAULT_FEE_TERMS, createdAt: "2030-01-01T12:00:00Z",
};
const enrollment = {
  id: 1, accountId: 1, userId: 1, scheduleId: 1, state: "offered" as const,
  firstChargeDate: "2030-01-31", nextPeriod: 0, acceptedAt: null, createdAt: "2030-01-01T12:00:00Z",
  nextChargeDate: null, schedule, accountName: "Brokerage Account", userName: "Synthetic fixture",
};
function render(Component: React.ElementType, props: unknown, data: { key: unknown[]; value: unknown }[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
  for (const item of data) client.setQueryData(item.key, item.value);
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(Router, { ssrPath: "/" }, React.createElement(Component, props))));
  client.clear();
  return html;
}
describe("Fee interfaces rendered with synthetic cached data", () => {
  it("renders the dashboard and accounts overview with negative net totals and visible fee debt", () => {
    const data = [
      { key: ["/api/user"], value: { id: 7, name: "Mary Scott", clientRef: "VWMS2024" } },
      { key: ["/api/accounts"], value: [
        { id: 24, userId: 7, accountType: "Trust Account", balance: "0", createdAt: "2024-01-01T14:00:00Z" },
        { id: 25, userId: 7, accountType: "Brokerage Account", balance: "0", createdAt: "2024-01-01T14:00:00Z" },
      ] },
      { key: ["/api/investments"], value: [] },
      { key: ["/api/accounts", 25, "transactions"], value: [] },
      { key: ["/api/institutional-transfers"], value: [] },
      { key: ["/api/fees", "summary", 7], value: {
        totalUnpaid: "11636.48", accounts: [
          { accountId: 24, unpaidTotal: "11636.48", unpaidCount: 32 },
          { accountId: 25, unpaidTotal: "0.00", unpaidCount: 0 },
        ],
      } },
    ];
    for (const Component of [DashboardPage, AccountsPage]) {
      const html = render(Component, {}, data);
      for (const text of ["CAD -$11,636.48", "CAD $11,636.48", "Amount owed", "32 unpaid fees", "Net account balance"]) {
        assert(html.includes(text), `${Component.name}: ${text}`);
      }
      assert(!html.includes("demo profile"));
    }
  });
  it("shows full-digit debt, a negative net account balance, account links and privacy/error states", () => {
    const summary = { totalUnpaid: "11636.48", accounts: [{ accountId: 24, unpaidTotal: "11636.48", unpaidCount: 32 }] };
    const html = render(FeeLiability, { summary }, []);
    for (const text of ["CAD $11,636.48", "Amount owed", "32 unpaid fees", "/accounts/24", "not an overdraft"]) assert(html.includes(text), text);
    const net = render(AccountFeeBalance, { cash: "0", unpaid: "11636.48" }, []);
    assert(net.includes("CAD -$11,636.48"));
    assert(net.includes("Net account balance"));
    assert(!render(FeeLiability, { summary, hidden: true }, []).includes("11,636.48"));
    assert(!render(AccountFeeBalance, { cash: "0", unpaid: "11636.48", hidden: true }, []).includes("11,636.48"));
    assert(render(FeeLiability, { error: true }, []).includes("Net balances are unavailable"));
    assert.equal(render(AccountFeeBalance, { cash: "0", unpaid: "0.00" }, []), "");
  });
  it("shows exact itemization, terms, date, timezone, optional client consent, and disabled acceptance before consent", () => {
    const data: ClientFees = { settings, enrollments: [enrollment], assessments: [] };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["CAD $363.64", "CAD $100.00", "CAD $200.00", "CAD $63.64", "America/Toronto",
      "explicitly consent", "Processing currently disabled", "No fee assessments"]) assert(html.includes(text), text);
    assert.match(html, /disabled=""[^>]*>Accept this exact plan/);
    assert(html.includes("January 31, 2030"));
  });
  it("shows paid, waived, and refunded client history with all components and lifecycle controls", () => {
    const data: ClientFees = {
      settings, enrollments: [{ ...enrollment, state: "active", acceptedAt: "2030-01-01T12:00:00Z", nextChargeDate: "2030-02-28" }],
      assessments: ["paid", "waived", "refunded", "unpaid"].map((status, i) => ({
        id: i + 1, enrollmentId: 1, accountId: 1, period: i, dueDate: "2030-01-31",
        components: DEFAULT_FEE_COMPONENTS, total: "363.64", status: status as "paid" | "waived" | "refunded" | "unpaid",
        transactionId: status === "waived" ? null : 1, refundTransactionId: status === "refunded" ? 2 : null,
        reason: null, createdAt: "2030-01-31T12:00:00Z",
      })),
    };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["paid", "waived", "refunded", "End enrollment", "February 28, 2030", "period 1", "period 3",
      "Outstanding unpaid service fees", "CAD $363.64", "Recorded separately from your cash balance"]) assert(html.includes(text), text);
  });
  it("renders admin versioning, eligibility, processing, preview, lifecycle, and audit controls", () => {
    const data: FeeOverview = {
      settings, schedules: [schedule], enrollments: [enrollment], assessments: [], audit: [],
      accounts: [{ id: 1, userId: 1, userName: "Synthetic fixture", accountType: "Brokerage Account", balance: "2800000.00" }],
    };
    const preview: FeePreview = { ...settings, today: "2030-01-01", previewToken: "f".repeat(64), charges: [] };
    const html = render(AdminFees, { adminKey: "not-a-real-key" }, [
      { key: ["/api/admin/fees"], value: data }, { key: ["/api/admin/fees/preview"], value: preview },
    ]);
    for (const text of ["Disabled", "Save immutable version", "Offer to client", "CAD $2,800,000.00",
      "Run preview", "No enrollments are due", "client must independently", "Assessments &amp; audit"]) assert(html.includes(text), text);
  });
});
