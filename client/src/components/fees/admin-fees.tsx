import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CircleDollarSign, Clock3, FilePlus2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useAdminFees, useAdminFeeAction, useFeePreview } from "@/hooks/use-fees";
import { BILLING_TIME_ZONE, DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS, billingToday, formatCAD, type FeeAssessment, type FeeEnrollment } from "@shared/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const inputClass = "vw-input min-h-10 w-full border-0 border-b border-white/25 bg-transparent px-0 text-sm text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

type ConfirmAction = { path: string; body: unknown; title: string; consequence: string } | null;

export function AdminFees({ adminKey }: { adminKey: string }) {
  const fees = useAdminFees(adminKey);
  const preview = useFeePreview(adminKey);
  const action = useAdminFeeAction(adminKey);
  const [schedule, setSchedule] = useState({
    name: "Monthly service fee schedule",
    components: DEFAULT_FEE_COMPONENTS.map(item => ({ ...item })),
    terms: DEFAULT_FEE_TERMS,
  });
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [accountId, setAccountId] = useState("");
  const [firstChargeDate, setFirstChargeDate] = useState("");
  const [servicesConfirmed, setServicesConfirmed] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [reason, setReason] = useState("");
  const [openTerms, setOpenTerms] = useState<number | null>(null);
  const [operationError, setOperationError] = useState("");
  const [runResults, setRunResults] = useState<FeeAssessment[] | null>(null);

  const total = useMemo(() => schedule.components.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [schedule.components]);
  const overview = fees.data;
  const mutationBusy = action.isPending;
  const minDate = (() => {
    const date = new Date(`${billingToday()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  })();

  const submitAction = async (path: string, body: unknown) => {
    setOperationError("");
    try {
      const result = await action.mutateAsync({ path, body });
      return result;
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "The fee request could not be completed.");
      return null;
    }
  };
  const askConfirm = (next: NonNullable<ConfirmAction>) => {
    setReason("");
    setConfirmAction(next);
    setOperationError("");
  };
  const runConfirmedAction = async (bodyOverride?: unknown) => {
    if (!confirmAction) return;
    if (["retry", "waive", "refund"].some(actionName => confirmAction.path.endsWith(`/${actionName}`)) && reason.trim().length < 3) {
      setOperationError("Enter a clear reason before continuing.");
      return;
    }
    const result = await submitAction(confirmAction.path, bodyOverride ?? confirmAction.body);
    if (result !== null) {
      if (confirmAction.path === "/run") {
        const maybeResults = (result as { results?: FeeAssessment[] })?.results;
        setRunResults(Array.isArray(maybeResults) ? maybeResults : []);
      }
      setConfirmAction(null);
      setReason("");
    }
  };

  if (fees.isLoading || preview.isLoading) {
    return <section className="mt-5 space-y-4" aria-label="Loading service fees">
      {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse border border-slate-700 bg-slate-800/40" />)}
    </section>;
  }
  if (fees.isError || !overview) {
    return <div className="mt-5 border border-rose-400/25 bg-rose-400/5 p-6 text-slate-200">
      <p className="font-semibold">Fee records could not be loaded.</p>
      <p className="mt-1 text-sm text-slate-400">No changes have been made. Try again to retrieve the current service-fee ledger.</p>
      <Button variant="outline" className="mt-4 border-slate-600 text-white" onClick={() => { void fees.refetch(); void preview.refetch(); }}>
        <RefreshCw className="mr-2 h-4 w-4" /> Retry
      </Button>
    </div>;
  }

  return (
    <div className="mt-4 space-y-6 text-slate-200">
      {(operationError || action.isError || preview.isError) && (
        <div role="alert" className="flex items-start gap-2 border border-rose-400/25 bg-rose-400/5 p-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{operationError || (action.error instanceof Error ? action.error.message : "The preview could not be refreshed.")}</span>
        </div>
      )}

      <section className="border border-slate-700 bg-slate-800/30">
        <div className="flex flex-col gap-4 border-b border-slate-700 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label-caps text-slate-400">Monthly service-fee processing</p>
            <h2 className="mt-1 font-serif text-2xl text-white">Fee controls</h2>
            <p className="mt-1 text-sm text-slate-400">New schedules are immutable versions. Existing clients are never enrolled automatically.</p>
          </div>
          <div className="flex items-center gap-3 border border-slate-700 px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${overview.settings.enabled ? "bg-emerald-400" : "bg-slate-500"}`} />
            <div>
              <p className="label-caps text-slate-400">Processing</p>
              <p className="text-sm font-semibold text-white">{overview.settings.enabled ? "Enabled" : "Disabled"}</p>
            </div>
            <Button size="sm" variant="outline" disabled={mutationBusy} className="ml-2 border-slate-600 text-white"
              onClick={() => askConfirm({
                path: "/settings",
                body: { enabled: !overview.settings.enabled, confirmed: true },
                title: overview.settings.enabled ? "Disable fee processing?" : "Enable fee processing?",
                consequence: overview.settings.enabled ? "No scheduled fee runs will process while disabled. Existing assessments remain recorded." : "Scheduled fee processing will be enabled for eligible active enrollments. No client is enrolled by this action.",
              })}>
              {overview.settings.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-4 flex items-center gap-2 text-white"><FilePlus2 className="h-4 w-4 text-amber-400" /><h3 className="font-semibold">Create schedule version</h3></div>
            <label className="label-caps text-slate-400" htmlFor="fee-schedule-name">Schedule name</label>
            <Input id="fee-schedule-name" className={inputClass} value={schedule.name} onChange={e => setSchedule({ ...schedule, name: e.target.value })} />
            <div className="mt-4 space-y-3">
              {schedule.components.map((component, index) => (
                <div key={index} className="grid gap-2 border-t border-slate-700 pt-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label className="label-caps text-slate-500" htmlFor={`fee-component-${index}`}>Service {index + 1} of 3</label>
                    <Input id={`fee-component-${index}`} className={inputClass} value={component.name} onChange={e => setSchedule({ ...schedule, components: schedule.components.map((c, i) => i === index ? { ...c, name: e.target.value } : c) })} />
                  </div>
                  <div>
                    <label className="label-caps text-slate-500" htmlFor={`fee-amount-${index}`}>CAD amount</label>
                    <Input id={`fee-amount-${index}`} inputMode="decimal" className={`${inputClass} font-mono tabular-nums`} value={component.amount} onChange={e => setSchedule({ ...schedule, components: schedule.components.map((c, i) => i === index ? { ...c, amount: e.target.value } : c) })} />
                  </div>
                  <Textarea aria-label={`${component.name || `Service ${index + 1}`} description`} className="min-h-16 border-slate-700 bg-slate-900/40 text-sm text-slate-200 sm:col-span-2" value={component.serviceDescription} onChange={e => setSchedule({ ...schedule, components: schedule.components.map((c, i) => i === index ? { ...c, serviceDescription: e.target.value } : c) })} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
              <span className="text-sm text-slate-400">Monthly total · CAD</span>
              <span className="font-mono text-lg tabular-nums text-amber-300">{formatCAD(total)}</span>
            </div>
            <label className="label-caps mt-5 block text-slate-400" htmlFor="fee-terms">Client terms</label>
            <Textarea id="fee-terms" className="mt-2 min-h-36 border-slate-700 bg-slate-900/40 text-sm leading-relaxed text-slate-200" value={schedule.terms} onChange={e => setSchedule({ ...schedule, terms: e.target.value })} />
            <Button className="mt-4 bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={mutationBusy || schedule.name.trim().length < 3 || schedule.components.some(c => !c.name.trim() || c.serviceDescription.trim().length < 10 || !/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(c.amount)) || schedule.terms.trim().length < 50}
              onClick={() => void submitAction("/schedules", { name: schedule.name.trim(), components: schedule.components, terms: schedule.terms.trim() })}>
              {mutationBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />} Save immutable version
            </Button>
          </div>

          <div className="border-t border-slate-700 pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div className="mb-4 flex items-center gap-2 text-white"><ShieldCheck className="h-4 w-4 text-amber-400" /><h3 className="font-semibold">Offer a version</h3></div>
            <p className="mb-4 text-sm leading-relaxed text-slate-400">The client must review and accept this exact version. An offer alone does not authorize a charge.</p>
            <label className="label-caps text-slate-400" htmlFor="fee-offer-version">Fee schedule</label>
             <select id="fee-offer-version" value={selectedSchedule} onChange={e => { setSelectedSchedule(e.target.value); setServicesConfirmed(false); }} className="mt-1 w-full border-b border-slate-600 bg-slate-900 py-2 text-sm text-white">
              <option value="">Choose a saved version</option>
              {overview.schedules.map(s => <option key={s.id} value={s.id}>{s.name} · v{s.version} · {formatCAD(s.total)}</option>)}
            </select>
            <label className="label-caps mt-4 block text-slate-400" htmlFor="fee-offer-account">Existing account</label>
             <select id="fee-offer-account" value={accountId} onChange={e => { setAccountId(e.target.value); setServicesConfirmed(false); }} className="mt-1 w-full border-b border-slate-600 bg-slate-900 py-2 text-sm text-white">
              <option value="">Select an account</option>
              {overview.accounts.map(account => <option key={account.id} value={account.id}>{account.userName} · {account.accountType} · {formatCAD(account.balance)}</option>)}
            </select>
            <label className="label-caps mt-4 block text-slate-400" htmlFor="fee-first-date">Prospective first charge date · Toronto</label>
            <Input id="fee-first-date" type="date" min={minDate} value={firstChargeDate} onChange={e => setFirstChargeDate(e.target.value)} className={inputClass} />
            <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-300">
              <input type="checkbox" checked={servicesConfirmed} onChange={e => setServicesConfirmed(e.target.checked)} className="mt-0.5 accent-amber-500" />
              I confirm the listed services and eligibility have been reviewed for this selected account; the client must independently review and explicitly consent before enrollment.
            </label>
            <Button className="mt-4 w-full bg-white text-slate-900 hover:bg-slate-200" disabled={mutationBusy || !selectedSchedule || !accountId || !firstChargeDate || firstChargeDate < minDate || !servicesConfirmed}
              onClick={() => void submitAction("/offers", { accountId: Number(accountId), scheduleId: Number(selectedSchedule), firstChargeDate, servicesConfirmed: true })}>
              Offer to client
            </Button>
            <p className="mt-3 text-[11px] text-slate-500">Currency: CAD · Billing timezone: {BILLING_TIME_ZONE}. The next date is calculated by the service.</p>
          </div>
        </div>
      </section>

      <section className="border border-slate-700 bg-slate-800/30">
        <div className="flex flex-col gap-3 border-b border-slate-700 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="label-caps text-slate-400">Scheduled assessment</p><h2 className="mt-1 font-serif text-2xl text-white">Run preview</h2><p className="mt-1 text-sm text-slate-400">Review every due enrollment before confirming the run.</p></div>
          <Button variant="outline" disabled={preview.isFetching} onClick={() => void preview.refetch()} className="border-slate-600 text-white"><RefreshCw className={`mr-2 h-4 w-4 ${preview.isFetching ? "animate-spin" : ""}`} /> Refresh preview</Button>
        </div>
        {preview.data ? <>
          <div className="grid grid-cols-1 divide-y divide-slate-700 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {(["payable", "unpaid", "skipped"] as const).map(kind => {
              const items = preview.data.charges.filter(charge => charge.outcome === kind);
              return <div key={kind} className="p-4"><p className="label-caps text-slate-500">{kind} · {items.length}</p><p className="mt-1 font-mono text-lg tabular-nums text-white">{formatCAD(items.reduce((sum, row) => sum + Number(row.total), 0))}</p></div>;
            })}
          </div>
          <div className="divide-y divide-slate-700">
            {preview.data.charges.length === 0 ? <p className="p-5 text-sm text-slate-400">No enrollments are due on {dateLabel(preview.data.today)}.</p> : preview.data.charges.map((charge, i) => (
              <div key={`${charge.enrollmentId}-${charge.dueDate}-${i}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div><p className="text-sm font-semibold text-white">{charge.userName} <span className="text-slate-500">· account {charge.accountId}</span></p><p className="mt-0.5 text-xs text-slate-400">Enrollment {charge.enrollmentId} · period {charge.period + 1} · due {dateLabel(charge.dueDate)}{charge.reason ? ` · ${charge.reason}` : ""}</p></div>
                <div className="flex items-center justify-between gap-4 sm:justify-end"><span className={`label-caps ${charge.outcome === "payable" ? "text-emerald-300" : charge.outcome === "unpaid" ? "text-amber-300" : "text-slate-400"}`}>{charge.outcome}</span><span className="font-mono text-sm tabular-nums text-white">{formatCAD(charge.total)}</span></div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-700 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">Preview status: {preview.data.enabled ? "processing enabled" : "processing disabled"} · {preview.data.timeZone}</p>
            <Button disabled={mutationBusy || !preview.data.enabled || preview.data.charges.length === 0} className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              onClick={() => askConfirm({ path: "/run", body: { confirmed: true, previewToken: preview.data.previewToken }, title: "Run the displayed fee assessment?", consequence: "This will attempt the reviewed due assessments using the recorded cash ledger. A changed preview must be refreshed and reviewed again. Cash eligibility is checked again during settlement; unavailable funds remain unpaid or skipped. No partial charge, overdraft, external-bank debit, investment sale, or forced liquidation will occur." })}>
              <CircleDollarSign className="mr-2 h-4 w-4" /> Confirm and run
            </Button>
          </div>
        </> : <p className="p-5 text-sm text-slate-400">Preview is unavailable. Retry before running charges.</p>}
      </section>

      {runResults && <section className="border border-emerald-700/50 bg-emerald-950/20 p-5" aria-live="polite">
        <h3 className="font-serif text-xl text-white">Run results</h3>
         {runResults.length ? <div className="mt-3 divide-y divide-emerald-900/60">{runResults.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>Account {row.accountId} · period {row.period + 1} · {dateLabel(row.dueDate)}</span><span className="font-mono tabular-nums">{formatCAD(row.total)} · {row.status}</span></div>)}</div> : <p className="mt-2 text-sm text-emerald-100/70">The service returned no assessment rows. Refresh the ledger to confirm the recorded outcome.</p>}
      </section>}

      <section className="border border-slate-700 bg-slate-800/30">
        <div className="border-b border-slate-700 p-5"><p className="label-caps text-slate-400">Consent and lifecycle</p><h2 className="mt-1 font-serif text-2xl text-white">Enrollments</h2></div>
        {overview.enrollments.length === 0 ? <div className="p-7 text-center"><Clock3 className="mx-auto h-6 w-6 text-slate-500" /><p className="mt-2 text-sm text-slate-400">No fee plans have been offered.</p><p className="mt-1 text-xs text-slate-500">Offering a plan never enrolls the client; acceptance is recorded by the client only.</p></div> : (
          <div className="divide-y divide-slate-700">{overview.enrollments.map((enrollment: FeeEnrollment) => (
            <div key={enrollment.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{enrollment.accountName}</h3><span className="label-caps border border-slate-600 px-2 py-1 text-slate-300">{enrollment.state}</span></div>
                  <p className="mt-1 text-xs text-slate-400">{enrollment.userName || `Client ${enrollment.userId}`} · {enrollment.schedule.name} v{enrollment.schedule.version} · {formatCAD(enrollment.schedule.total)} / month</p>
                  <p className="mt-1 text-xs text-slate-500">First date {dateLabel(enrollment.firstChargeDate)} · next date {dateLabel(enrollment.nextChargeDate)} · {enrollment.acceptedAt ? `client accepted ${dateLabel(enrollment.acceptedAt)}` : "awaiting client consent"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {enrollment.state === "active" && <Button size="sm" variant="outline" disabled={mutationBusy} className="border-slate-600 text-white" onClick={() => askConfirm({ path: `/enrollments/${enrollment.id}/state`, body: { state: "paused" }, title: "Pause enrollment?", consequence: "Future fee processing will stop for this enrollment until it is resumed. Existing assessments are unchanged." })}>Pause</Button>}
                  {enrollment.state === "paused" && <Button size="sm" variant="outline" disabled={mutationBusy} className="border-slate-600 text-white" onClick={() => askConfirm({ path: `/enrollments/${enrollment.id}/state`, body: { state: "active" }, title: "Resume enrollment?", consequence: "This enrollment will again be eligible for future scheduled assessments under its accepted schedule." })}>Resume</Button>}
                  {enrollment.state !== "ended" && <Button size="sm" variant="outline" disabled={mutationBusy} className="border-rose-900 text-rose-200" onClick={() => askConfirm({ path: `/enrollments/${enrollment.id}/state`, body: { state: "ended" }, title: "End this enrollment?", consequence: "This stops future fees for this enrollment. Existing assessed charges remain in the ledger and are not automatically waived." })}>End</Button>}
                </div>
              </div>
              <button type="button" className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-white" onClick={() => setOpenTerms(openTerms === enrollment.id ? null : enrollment.id)}>
                {openTerms === enrollment.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {openTerms === enrollment.id ? "Hide" : "View"} accepted schedule terms
              </button>
              {openTerms === enrollment.id && <div className="mt-3 border-l border-amber-500/50 pl-4">
                <div className="divide-y divide-slate-700">{enrollment.schedule.components.map(component => <div key={component.name} className="py-2"><div className="flex justify-between gap-3 text-sm"><span className="font-medium">{component.name}</span><span className="font-mono tabular-nums">{formatCAD(component.amount)}</span></div><p className="mt-1 text-xs text-slate-400">{component.serviceDescription}</p></div>)}</div>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{enrollment.schedule.terms}</p>
              </div>}
            </div>
          ))}</div>
        )}
      </section>

      <section className="border border-slate-700 bg-slate-800/30">
         <div className="border-b border-slate-700 p-5"><p className="label-caps text-slate-400">Recorded fee history</p><h2 className="mt-1 font-serif text-2xl text-white">Assessments & audit</h2><p className="mt-1 text-xs text-slate-400">Latest 500 assessments and 100 append-only audit entries. Original transactions remain unchanged after a refund.</p></div>
        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          <div className="divide-y divide-slate-700 lg:border-r lg:border-slate-700">
            <h3 className="label-caps px-5 py-3 text-slate-500">Assessment history</h3>
            {overview.assessments.length === 0 ? <p className="p-5 text-sm text-slate-400">No assessments recorded.</p> : overview.assessments.map((assessment: FeeAssessment) => (
              <AssessmentRow key={assessment.id} assessment={assessment} pending={mutationBusy} onAction={(name) => askConfirm({
                path: `/assessments/${assessment.id}/${name}`,
                body: { confirmed: true, reason: "" },
                title: `${name[0].toUpperCase()}${name.slice(1)} assessment ${assessment.id}?`,
                consequence: name === "retry" ? "A new attempt will be made for this assessment against available recorded cash; no partial payment or overdraft." : name === "waive" ? "This marks the unpaid or skipped assessment as waived. It will remain in history and will not be collected." : "This records a one-time refund against the paid assessment. The original payment remains visible in history.",
              })} />
            ))}
          </div>
          <div className="divide-y divide-slate-700">
            <h3 className="label-caps px-5 py-3 text-slate-500">Audit trail</h3>
            {overview.audit.length === 0 ? <p className="p-5 text-sm text-slate-400">No audit events recorded.</p> : [...overview.audit].reverse().map(entry => <div key={entry.id} className="p-4">
              <div className="flex justify-between gap-3"><span className="text-sm font-medium text-white">{entry.action}</span><span className="text-[10px] text-slate-500">{dateLabel(entry.createdAt)}</span></div>
              <p className="mt-1 text-xs text-slate-400">By {entry.actor}{entry.enrollmentId ? ` · enrollment ${entry.enrollmentId}` : ""}{entry.assessmentId ? ` · assessment ${entry.assessmentId}` : ""}</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-500">{JSON.stringify(entry.detail)}</pre>
            </div>)}
          </div>
        </div>
      </section>

      {confirmAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="fee-confirm-title" className="w-full max-w-lg border border-slate-600 bg-[#10221b] p-5 shadow-2xl">
          <p className="label-caps text-amber-300">Confirm fee action</p><h2 id="fee-confirm-title" className="mt-2 font-serif text-2xl text-white">{confirmAction.title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-300">{confirmAction.consequence}</p>
          {["retry", "waive", "refund"].some(name => confirmAction.path.endsWith(`/${name}`)) && <div className="mt-4"><label className="label-caps text-slate-400" htmlFor="fee-action-reason">Required reason</label><Textarea id="fee-action-reason" value={reason} onChange={e => setReason(e.target.value)} className="mt-1 border-slate-600 bg-slate-900 text-white" placeholder="Record the reason for this action" /></div>}
          {operationError && <p role="alert" className="mt-3 text-sm text-rose-300">{operationError}</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" className="border-slate-600 text-slate-200" disabled={mutationBusy} onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={mutationBusy || (["retry", "waive", "refund"].some(name => confirmAction.path.endsWith(`/${name}`)) && reason.trim().length < 3)} onClick={() => {
              const body = ["retry", "waive", "refund"].some(name => confirmAction.path.endsWith(`/${name}`)) ? { confirmed: true, reason: reason.trim() } : undefined;
              void runConfirmedAction(body);
            }}>{mutationBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm action</Button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function AssessmentRow({ assessment, pending, onAction }: { assessment: FeeAssessment; pending: boolean; onAction: (action: "retry" | "waive" | "refund") => void }) {
  return <div className="p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white">Assessment {assessment.id}</span><span className="label-caps border border-slate-600 px-2 py-0.5 text-slate-300">{assessment.status}</span></div><p className="mt-1 text-xs text-slate-400">Account {assessment.accountId} · period {assessment.period + 1} · {dateLabel(assessment.dueDate)}</p>{assessment.reason && <p className="mt-1 text-xs text-slate-500">Reason: {assessment.reason}</p>}</div>
      <span className="font-mono text-sm tabular-nums text-amber-300">{formatCAD(assessment.total)}</span>
    </div>
    {["unpaid", "skipped"].includes(assessment.status) && <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={pending} className="border-slate-600 text-white" onClick={() => onAction("retry")}>Retry</Button>
      <Button size="sm" variant="outline" disabled={pending} className="border-slate-600 text-white" onClick={() => onAction("waive")}>Waive</Button>
    </div>}
    {assessment.status === "paid" && <div className="mt-3"><Button size="sm" variant="outline" disabled={pending || assessment.refundTransactionId !== null} className="border-slate-600 text-white" onClick={() => onAction("refund")}>{assessment.refundTransactionId !== null ? "Refund recorded" : "Refund once"}</Button></div>}
  </div>;
}
