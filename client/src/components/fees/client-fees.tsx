import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useClientFees, useClientFeeAction, useClientManagementAction } from "@/hooks/use-fees";
import { BILLING_TIME_ZONE, annualDate, centsToMoney, moneyToCents, formatCAD, type FeeAssessment, type FeeEnrollment, type ManagementContract } from "@shared/fees";
import { Button } from "@/components/ui/button";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export function ClientFees({ accountId, cashBalance }: { accountId: number; cashBalance?: string }) {
  const fees = useClientFees(accountId);
  const action = useClientFeeAction(accountId);
  const managementAction = useClientManagementAction(accountId);
  const [consents, setConsents] = useState<Record<number, boolean>>({});
  const [managementConsents, setManagementConsents] = useState<Record<number, boolean>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const act = async (enrollmentId: number, kind: "accept" | "end", scheduleId?: number) => {
    setErrorMessage("");
    setNotice("");
    try {
      await action.mutateAsync({ enrollmentId, action: kind, scheduleId });
      setNotice(kind === "accept" ? "Your acceptance has been recorded." : "Your enrollment has ended. Future fees under this plan will stop.");
      setConsents(current => ({ ...current, [enrollmentId]: false }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Your request could not be completed. No change has been confirmed.");
    }
  };

  if (fees.isLoading) return <section className="mt-8 space-y-3" aria-label="Loading service-fee information"><div className="h-32 animate-pulse bg-muted/50" /><div className="h-24 animate-pulse bg-muted/50" /></section>;
  if (fees.isError || !fees.data) return <section className="mt-8 border border-border p-6">
    <p className="font-serif text-xl">Service-fee information unavailable</p><p className="mt-1 text-sm text-muted-foreground">No fee action has been taken. Retry to check for current offers and history.</p>
    <Button variant="outline" className="mt-4" onClick={() => void fees.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
  </section>;

  const { settings, enrollments, assessments } = fees.data;
  const accountEnrollments = enrollments.filter(item => item.accountId === accountId);
  const accountAssessments = assessments.filter(item => item.accountId === accountId);
  const unpaidTotal = centsToMoney(accountAssessments.filter(item => item.status === "unpaid")
    .reduce((total, item) => total + moneyToCents(item.total), 0n));
  const offers = accountEnrollments.filter(item => item.state === "offered");
  const accepted = accountEnrollments.filter(item => item.state !== "offered");
  const accountContracts = (fees.data.contracts || []).filter(item => item.accountId === accountId);
  const contractOffers = accountContracts.filter(item => item.state === "offered");
  const existingContracts = accountContracts.filter(item => item.state !== "offered");
  const accountOverdraft = Math.max(0, -Number(cashBalance ?? fees.data.balance ?? 0));

  return <section className="mt-8 space-y-6" aria-labelledby="client-fees-heading">
    <div className="border-t-2 border-primary pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="label-caps text-muted-foreground">Account services</p><h2 id="client-fees-heading" className="mt-1 font-serif text-3xl">Monthly service fees</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review every service, amount, and term before deciding. Nothing is charged from an offer alone.</p></div>
        <p className="label-caps text-muted-foreground">{settings.enabled ? "Processing enabled" : "Processing currently disabled"} · CAD</p>
      </div>
    </div>
    {errorMessage && <div role="alert" className="flex items-start gap-2 border border-rose-700/30 bg-rose-50 p-3 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{errorMessage}</div>}
    {notice && <div role="status" className="flex items-start gap-2 border border-emerald-700/30 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

    {offers.length === 0 && <div className="border border-border bg-muted/20 p-5 text-sm text-muted-foreground">There are no pending fee-plan offers for this account.</div>}
    {offers.map((enrollment: FeeEnrollment) => (
      <article key={enrollment.id} className="border border-primary/25 bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><span className="label-caps text-primary">Plan offered for your review</span><span className="border border-border px-2 py-0.5 text-xs">Version {enrollment.schedule.version}</span></div><h3 className="mt-2 font-serif text-2xl">{enrollment.schedule.name}</h3><p className="mt-1 text-sm text-muted-foreground">First prospective date: {dateLabel(enrollment.firstChargeDate)} · billing timezone: {BILLING_TIME_ZONE}</p></div>
          <div className="sm:text-right"><p className="label-caps text-muted-foreground">Monthly total</p><p className="mt-1 font-mono text-2xl tabular-nums text-primary">{formatCAD(enrollment.schedule.total)}</p></div>
        </div>
        <div className="px-5">
          <h4 className="label-caps pt-4 text-muted-foreground">Exact itemized schedule · CAD</h4>
          <div className="divide-y divide-border">
            {enrollment.schedule.components.map(component => <div key={component.name} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-6">
              <div><p className="text-sm font-semibold">{component.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{component.serviceDescription}</p></div>
              <p className="font-mono text-sm tabular-nums sm:text-right">{formatCAD(component.amount)} / month</p>
            </div>)}
          </div>
        </div>
        <div className="m-5 border-l-2 border-accent bg-muted/20 p-4">
          <h4 className="label-caps text-muted-foreground">Terms for this version</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{enrollment.schedule.terms}</p>
        </div>
        <div className="mx-5 mb-5 border-t border-border pt-4">
          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <input type="checkbox" checked={!!consents[enrollment.id]} onChange={e => setConsents(current => ({ ...current, [enrollment.id]: e.target.checked }))} className="mt-1 accent-primary" />
            I have reviewed the exact monthly schedule and terms above. I explicitly consent to this plan and {enrollment.schedule.funding === "fee_overdraft" ? "authorize fee debits to this account even when cash is zero or negative, creating or increasing its fee overdraft." : "authorize deductions only from available cash recorded in this application as described in these terms."}
          </label>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Acceptance is optional. {enrollment.schedule.funding === "fee_overdraft" ? "You authorize the full fee debit to this account’s cash ledger even at zero or negative cash; posted fees can deepen the negative balance. No interest, penalty, external debit, or investment sale." : "Fees are not partially charged; unavailable cash does not cause an overdraft, interest, investment sale, or external-bank debit."} You may end enrollment later; already assessed fees remain visible.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button disabled={!consents[enrollment.id] || action.isPending} className="bg-primary text-primary-foreground" onClick={() => void act(enrollment.id, "accept", enrollment.schedule.id)}>
              {action.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accept this exact plan
            </Button>
            <p className="flex items-center text-xs text-muted-foreground">Declining requires no action; an offer does not enroll you.</p>
          </div>
        </div>
      </article>
    ))}

    <div className="border-t border-border pt-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="font-serif text-2xl">Enrollment status</h3></div>
      {accepted.length === 0 ? <p className="mt-3 border border-border p-5 text-sm text-muted-foreground">No accepted or ended fee plans for this account.</p> : <div className="mt-3 divide-y divide-border border-y border-border">
        {accepted.map(enrollment => <div key={enrollment.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{enrollment.schedule.name} · v{enrollment.schedule.version}</p><span className="label-caps border border-border px-2 py-1">{enrollment.state}</span></div><p className="mt-1 text-sm text-muted-foreground">{formatCAD(enrollment.schedule.total)} / month · next prospective date {dateLabel(enrollment.nextChargeDate)}</p><p className="mt-1 text-xs text-muted-foreground">Accepted {dateLabel(enrollment.acceptedAt)} · first date {dateLabel(enrollment.firstChargeDate)}</p></div>
          {enrollment.state !== "ended" && <Button variant="outline" disabled={action.isPending} onClick={() => {
            const confirmed = window.confirm("End this fee enrollment? Future fees under this plan will stop. Assessments already recorded remain in your history and are not automatically cancelled.");
            if (confirmed) void act(enrollment.id, "end");
          }}>End enrollment</Button>}
        </div>)}
      </div>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Ending stops future fees. Any fee already assessed stays in your account history; contact your advisor if you have a question about a recorded assessment.</p>
    </div>

    <div className="border-t border-border pt-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="font-serif text-2xl">Discretionary management</h3></div>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">A separate, additive annual contract. This is independent of monthly services; review and accept each offer explicitly.</p>
      {accountOverdraft > 0 && <div className="mt-3 border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950"><span className="label-caps">Posted negative cash ledger · CAD</span><p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatCAD(-accountOverdraft)}</p><p className="mt-1 text-xs">This is actual account debt, not an unpaid estimate. Deposits and refunds reduce it.</p></div>}
      {contractOffers.length === 0 && existingContracts.length === 0 && <p className="mt-3 border border-border bg-muted/20 p-5 text-sm text-muted-foreground">No management contracts or offers for this account.</p>}
      {contractOffers.map((contract: ManagementContract) => <article key={contract.id} className="mt-3 border border-primary/25 bg-card">
        <div className="border-b border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label-caps text-primary">Independent offer · account-specific</p><h4 className="mt-1 font-serif text-xl">Annual discretionary management</h4></div><span className="label-caps border border-border px-2 py-1">Additive · CAD</span></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Opening date</dt><dd className="font-medium">{dateLabel(contract.openingDate)}</dd></div>
            <div><dt className="text-muted-foreground">First annual charge date</dt><dd className="font-medium">{dateLabel(annualDate(contract.openingDate,0))}</dd></div>
            <div><dt className="text-muted-foreground">Annual minimum</dt><dd className="font-mono">{formatCAD(contract.annualMinimum)}</dd></div>
            <div><dt className="text-muted-foreground">Annual rate</dt><dd className="font-mono">{contract.annualRatePercent}% of holdings AUM</dd></div>
          </dl>
          <p className="mt-3 border-l-2 border-accent bg-muted/20 p-3 text-xs leading-relaxed">Each completed annual period is charged in arrears at the greater of {contract.annualRatePercent}% of documented end-period holdings or the {formatCAD(contract.annualMinimum)} minimum. The confirmed valuation excludes cash and fee debt. Missing valuation blocks charge. Zero holdings still incur the minimum. Annual fee overdraft is authorized only for this account.</p>
        </div>
        <details className="border-b border-border px-5 py-3"><summary className="cursor-pointer text-xs font-semibold">Read full contract terms</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{contract.terms}</p></details>
        <div className="p-5">
          <label className="flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" checked={!!managementConsents[contract.id]} onChange={e => setManagementConsents(current => ({ ...current, [contract.id]: e.target.checked }))} className="mt-1 accent-primary" />I have reviewed and explicitly accept this separate annual management contract, its account-specific fee calculation, and fee-overdraft authorization.</label>
          <Button className="mt-4" disabled={!managementConsents[contract.id] || managementAction.isPending} onClick={async () => {
            setErrorMessage(""); setNotice("");
            try { await managementAction.mutateAsync({ contractId: contract.id, action: "accept" }); setManagementConsents(current => ({ ...current, [contract.id]: false })); setNotice("Your management-contract acceptance has been recorded."); }
            catch (error) { setErrorMessage(error instanceof Error ? error.message : "Acceptance could not be recorded."); }
          }}>Accept this management contract</Button>
          <p className="mt-2 text-xs text-muted-foreground">No management fee is charged by this offer alone. Monthly service fees are separate and unchanged.</p>
        </div>
      </article>)}
      {existingContracts.length > 0 && <div className="mt-3 divide-y divide-border border-y border-border">
        {existingContracts.map(contract => <div key={contract.id} className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Annual management · {contract.annualRatePercent}% or {formatCAD(contract.annualMinimum)} minimum</p><span className="label-caps border border-border px-2 py-1">{contract.state}</span></div><p className="mt-1 text-sm text-muted-foreground">Opened {dateLabel(contract.openingDate)} · next prospective date {dateLabel(contract.nextChargeDate)} · additive to monthly fees</p><p className="mt-1 text-xs text-muted-foreground">Accepted {dateLabel(contract.acceptedAt)} · account-specific fee overdraft authorization</p></div>
            {contract.state !== "ended" && <Button variant="outline" disabled={managementAction.isPending} onClick={() => {
              if (window.confirm("End this management contract? Future annual fees stop; historical charges remain in the account ledger.")) {
                void managementAction.mutateAsync({ contractId: contract.id, action: "end" }).then(() => setNotice("Management contract ended. Historical charges remain.")).catch(error => setErrorMessage(error instanceof Error ? error.message : "Could not end contract."));
              }
            }}>End management contract</Button>}
          </div>
          {(fees.data.valuations || []).filter(value => value.contractId === contract.id).length > 0 && <div className="mt-3 border-l border-primary/40 pl-3">
            <p className="label-caps text-muted-foreground">Confirmed period-end holdings valuations · cash and fee debt excluded</p>
            {(fees.data.valuations || []).filter(value => value.contractId === contract.id).map(value => <p key={value.id} className="mt-2 text-xs text-muted-foreground">Period {value.period + 1} · {dateLabel(value.valuationDate)} · AUM {formatCAD(value.aum)} · documented valuation #{value.id}</p>)}
          </div>}
        </div>)}
      </div>}
    </div>

    <div className="border-t border-border pt-5">
      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-accent" /><h3 className="font-serif text-2xl">Fee history</h3></div>
      <div className="mt-3 border border-border bg-muted/20 p-4">
        <p className="label-caps text-muted-foreground">Outstanding unpaid assessments · separate from posted debt</p>
        <p className="mt-1 font-mono text-xl tabular-nums">{formatCAD(unpaidTotal)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Only unposted assessments appear here. Posted overdraft is reflected in the negative cash ledger above.</p>
      </div>
      {accountAssessments.length === 0 ? <div className="mt-3 border border-border bg-muted/20 p-5 text-sm text-muted-foreground">No fee assessments are recorded for this account.</div> : <div className="mt-3 divide-y divide-border border-y border-border">
        {accountAssessments.map((assessment: FeeAssessment) => <div key={assessment.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
             <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{assessment.kind === "management" ? "Annual management fee" : "Monthly service fee"} · period {assessment.period + 1}</p><span className="label-caps border border-border px-2 py-0.5">{assessment.status}</span></div><p className="mt-1 text-xs text-muted-foreground">Due {dateLabel(assessment.dueDate)} · recorded {dateLabel(assessment.createdAt)}{assessment.contractId ? ` · contract ${assessment.contractId}` : ""}{assessment.transactionId ? ` · ledger transaction ${assessment.transactionId}` : ""}{assessment.funding === "fee_overdraft" ? " · authorized fee overdraft" : ""}</p>
              {assessment.kind === "management" && assessment.calculation && <p className="mt-1 break-words text-xs text-muted-foreground">Calculation: {String(assessment.calculation.coverageStart || "")} to {String(assessment.calculation.coverageEnd || "")} · AUM {formatCAD(String(assessment.calculation.aum || "0"))} × {String(assessment.calculation.annualRatePercent || "0")}% or {formatCAD(String(assessment.calculation.annualMinimum || "0"))} minimum, whichever is greater · additional to monthly fees · rounded half-up to cents.</p>}
            <div className="mt-2 space-y-1">{assessment.components.map(component => <p key={component.name} className="flex justify-between gap-4 text-xs text-muted-foreground"><span>{component.name}</span><span className="font-mono tabular-nums">{formatCAD(component.amount)}</span></p>)}</div>
            {assessment.reason && <p className="mt-2 text-xs text-muted-foreground">Record note: {assessment.reason}</p>}
          </div>
          <p className="font-mono text-base font-semibold tabular-nums sm:text-right">{formatCAD(assessment.total)}</p>
        </div>)}
      </div>}
    </div>
  </section>;
}
