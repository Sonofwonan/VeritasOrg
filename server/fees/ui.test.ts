import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientFees as ClientFeesComponent } from "../../client/src/components/fees/client-fees";
import { AdminFees } from "../../client/src/components/fees/admin-fees";
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
    React.createElement(Component, props)));
  client.clear();
  return html;
}
describe("Fee interfaces rendered with synthetic cached data", () => {
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
