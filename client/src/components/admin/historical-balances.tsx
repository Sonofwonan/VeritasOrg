import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileUp, History, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { accountLabel } from "@shared/account-display";
import type { HistoryImportInput, HistoryPreview } from "@shared/history-import";

type Account = { id: number; accountType: string; displayName?: string | null; accountNumber?: string };
type User = { id: number; name: string; email?: string };
const TEMPLATE = {
  userId: 0, accountId: 0, start: "", end: "", openingBalance: "", closingBalance: "",
  source: {
    kind: "statement", reference: "", sha256: "", reviewedBy: "", notes: "",
    complete: false, attested: false, ownerAuthorized: false,
  },
  movements: [],
  nonPostingTransactions: [],
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(body?.issues)
      ? body.issues.map((issue: { path?: string; message: string }) => `${issue.path || "Input"}: ${issue.message}`).join("; ")
      : "";
    const error = new Error(`${body?.message || `Request failed (${response.status})`}${details ? ` ${details}` : ""}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function HistoricalBalances({ adminKey, users }: { adminKey: string; users: User[] }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [jsonText, setJsonText] = useState(JSON.stringify(TEMPLATE, null, 2));
  const [attestations, setAttestations] = useState({ complete: false, attested: false, ownerAuthorized: false });
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [previewNeedsRefresh, setPreviewNeedsRefresh] = useState(false);
  const [previewExpiresAt, setPreviewExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [confirmApply, setConfirmApply] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [sourceDigest, setSourceDigest] = useState<{ fileName: string; sha256: string } | null>(null);
  const [applied, setApplied] = useState<{ applied: boolean; importId: string; postingCount: number } | null>(null);

  const accountQuery = useQuery<Account[]>({
    queryKey: ["/api/admin/users", userId, "history-accounts"],
    enabled: !!userId,
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/accounts`, { headers: { "x-admin-key": adminKey } });
      const result = await responseJson<Account[] | { accounts: Account[] }>(response);
      return Array.isArray(result) ? result : result.accounts;
    },
  });
  const account = useMemo(() => accountQuery.data?.find(item => item.id === Number(accountId)), [accountQuery.data, accountId]);
  const auditQuery = useQuery<any[]>({
    queryKey: ["/api/admin/history/imports", accountId],
    enabled: !!accountId,
    queryFn: async () => responseJson<any[]>(await fetch(`/api/admin/history/imports?accountId=${encodeURIComponent(accountId)}`, {
      headers: { "x-admin-key": adminKey },
    })),
  });

  useEffect(() => {
    if (!previewExpiresAt || !preview) return;
    const timer = window.setTimeout(() => {
      setPreviewNeedsRefresh(true);
      setConfirmApply(false);
    }, Math.max(0, previewExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [previewExpiresAt, preview]);

  const chooseAccount = (id: string) => {
    setAccountId(id);
    setPreview(null);
    setPreviewNeedsRefresh(false);
    setPreviewExpiresAt(null);
    setApplied(null);
    setConfirmApply(false);
    setAttestations({ complete: false,attested: false,ownerAuthorized: false });
    setSourceDigest(null);
    try {
      const input = JSON.parse(jsonText) as HistoryImportInput;
      input.userId = Number(userId) || 0;
      input.accountId = Number(id) || 0;
      setJsonText(JSON.stringify(input, null, 2));
    } catch { /* Keep invalid text intact for correction. */ }
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const content = await file.text();
      const input = JSON.parse(content);
      setJsonText(JSON.stringify(input, null, 2));
      setUserId(input.userId ? String(input.userId) : "");
      setAccountId(input.accountId ? String(input.accountId) : "");
      // An uploaded file cannot attest on behalf of the staff reviewer.
      setAttestations({ complete: false, attested: false, ownerAuthorized: false });
      setConfirmApply(false);
      setPreview(null);
      setPreviewNeedsRefresh(false);
      setPreviewExpiresAt(null);
      setSourceDigest(null);
    } catch {
      setError("The selected file is not valid JSON. Nothing was submitted.");
    }
  };

  const hashSourceDocument = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const input = JSON.parse(jsonText) as HistoryImportInput;
      input.source = { ...input.source, sha256 };
      setJsonText(JSON.stringify(input, null, 2));
      setSourceDigest({ fileName: file.name, sha256 });
      setAttestations({ complete: false,attested: false,ownerAuthorized: false });
      setConfirmApply(false);
      setPreview(null);
      setPreviewNeedsRefresh(false);
      setPreviewExpiresAt(null);
    } catch {
      setError("Could not calculate a digest. Select a valid JSON import and source document, then try again.");
    }
  };

  const previewHistory = async () => {
    if (previewing) return;
    setPreviewing(true);
    setError("");
    setApplied(null);
    try {
      const input = JSON.parse(jsonText);
      input.userId = Number(userId) || input.userId;
      input.accountId = Number(accountId) || input.accountId;
      input.source = {
        ...input.source,
        complete: attestations.complete,
        attested: attestations.attested,
        ownerAuthorized: attestations.ownerAuthorized,
      };
      setJsonText(JSON.stringify(input, null, 2));
      const result = await responseJson<HistoryPreview>(await fetch("/api/admin/history/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(input),
      }));
      setPreview(result);
      setPreviewNeedsRefresh(false);
      setPreviewExpiresAt(Date.now() + 5 * 60 * 1000);
      setConfirmApply(false);
    } catch (cause) {
      setPreview(null);
      setPreviewNeedsRefresh(false);
      setPreviewExpiresAt(null);
      setError(cause instanceof Error ? cause.message : "Could not create a history preview.");
    } finally {
      setPreviewing(false);
    }
  };

  const refreshPreview = () => {
    setPreview(null);
    setPreviewNeedsRefresh(false);
    setPreviewExpiresAt(null);
    setConfirmApply(false);
    void previewHistory();
  };

  const applyHistory = async () => {
    if (!preview?.canApply || previewNeedsRefresh || !confirmApply || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setError("");
    try {
      const result = await responseJson<{ applied: boolean; importId: string; postingCount: number }>(
        await fetch("/api/admin/history/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({ previewId: preview.previewId, confirm: true }),
        }),
      );
       // Repeating an already accepted import is a successful no-op.
      setApplied(result);
      setPreview(null);
      setPreviewNeedsRefresh(false);
      setPreviewExpiresAt(null);
      setConfirmApply(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/history/imports", accountId] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply this history import.");
      const failure = cause as Error & { status?: number };
      if (failure.status === 409 || failure.status === 410 || /expired|stale|preview/i.test(failure.message)) {
        setPreviewNeedsRefresh(true);
        setConfirmApply(false);
      }
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/40 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Historical balances</CardTitle>
          <p className="text-sm leading-relaxed text-slate-400">
            Restore source-backed transaction balance history. This workflow records historical movements only; it must never be used to create new financial actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="note" className="flex gap-3 border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Staff must actually review the source statement and verify that the movement records are complete. Existing client transaction rows without a supported cash posting remain visible with no invented balance. A preview is a gap report, not proof that source records are verified.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">Client
              <select aria-label="Client" value={userId} disabled={previewing || applying} onChange={event => {
                setUserId(event.target.value); setAccountId(""); setPreview(null); setPreviewNeedsRefresh(false);
                setPreviewExpiresAt(null); setApplied(null); setConfirmApply(false);
                setAttestations({ complete: false,attested: false,ownerAuthorized: false }); setSourceDigest(null);
              }}
                className="h-10 w-full border border-slate-600 bg-slate-900 px-3 text-sm text-white">
                <option value="">Select a client</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name} · #{user.id}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">Account
              <select aria-label="Account" value={accountId} onChange={event => chooseAccount(event.target.value)} disabled={!userId || accountQuery.isLoading || previewing || applying}
                className="h-10 w-full border border-slate-600 bg-slate-900 px-3 text-sm text-white disabled:opacity-50">
                <option value="">{accountQuery.isLoading ? "Loading accounts…" : "Select an account"}</option>
                {(accountQuery.data || []).map(item => <option key={item.id} value={item.id}>{accountLabel(item)} · {item.accountNumber || "Number unavailable"}</option>)}
              </select>
            </label>
          </div>
          {accountQuery.isError && <p role="alert" className="text-sm text-red-300">Client accounts could not be loaded. <button className="underline" onClick={() => void accountQuery.refetch()}>Retry</button></p>}
          {account && <div className="border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <span className="text-slate-400">Selected account</span>
            <p className="mt-1 font-medium">{accountLabel(account)} <span className="font-mono text-xs text-slate-400">· {account.accountNumber || "Number unavailable"}</span></p>
          </div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="border-slate-600 text-slate-200" onClick={() => downloadJson("veritas-history-import-template.json", TEMPLATE)}>
              <Download className="mr-2 h-4 w-4" /> Download safe JSON template
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/50">
              <FileUp className="mr-2 h-4 w-4" /> Upload JSON
              <Input type="file" accept=".json,application/json" disabled={previewing || applying} className="sr-only" onChange={event => { void onUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
            <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/50">
              <ShieldCheck className="mr-2 h-4 w-4" /> Select source document for SHA-256
              <Input type="file" disabled={previewing || applying} className="sr-only" onChange={event => { void hashSourceDocument(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            The source file is read locally in this browser only to calculate its SHA-256 digest; source contents are not uploaded. You may instead supply an already verified 64-character source-document digest in the JSON.
          </p>
          {sourceDigest && <p className="break-all border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-300">
            Local source digest · {sourceDigest.fileName} · <span className="font-mono">{sourceDigest.sha256}</span>
          </p>}
          <div className="space-y-2">
            <label htmlFor="history-input-json" className="text-sm font-medium text-slate-200">Reviewed movement input</label>
            <Textarea id="history-input-json" value={jsonText} disabled={previewing || applying} onChange={event => {
              setJsonText(event.target.value); setPreview(null); setPreviewNeedsRefresh(false); setPreviewExpiresAt(null);
              setApplied(null); setSourceDigest(null);
            }}
              spellCheck={false} className="min-h-72 resize-y border-slate-700 bg-slate-950 font-mono text-xs leading-relaxed text-slate-200" />
            <p className="text-xs leading-relaxed text-slate-500">JSON uses exact decimal strings. Movement sequence must include every actual source movement in the exclusive start/end period. Corrections, reservations, and releases must not be mapped to new transaction IDs.</p>
            <details className="border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-300">Input field guide</summary>
              <div className="mt-2 space-y-1.5 leading-relaxed">
                <p><span className="font-mono text-slate-200">start</span> is inclusive and <span className="font-mono text-slate-200">end</span> is exclusive; both are ISO timestamps. Balances and signed deltas are exact decimal strings.</p>
                <p>Source fields: kind (statement or ledger_export), reference, SHA-256 (64 hex characters), reviewedBy, notes, and the three review attestations above.</p>
                <p>Each movement needs a positive sequence, ISO occurredAt, signed delta, transactionId or null, sourceReference, and kind (transaction, adjustment, reservation, release). Adjustment, reservation, and release rows require transactionId null.</p>
                <p>Reservation and release movements may include relatedTransactionId. nonPostingTransactions entries must name a recorded transaction, include a sourceReference, and explain in at least 10 characters why that row did not move cash.</p>
              </div>
            </details>
          </div>
          <fieldset className="space-y-2 border-t border-slate-700 pt-4">
            <legend className="mb-2 text-sm font-semibold text-slate-200">Source review &amp; attestation</legend>
            {([
              ["complete", "I reviewed the source and confirm the records include every movement in the selected period."],
              ["attested", "I attest that the source details and movement data are accurate."],
               ["ownerAuthorized", "I have the account owner's authorization to import this history evidence."],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
                <Checkbox checked={attestations[key]} disabled={previewing || applying} onCheckedChange={value => {
                  setAttestations(current => ({ ...current, [key]: value === true }));
                  setPreview(null); setPreviewNeedsRefresh(false); setPreviewExpiresAt(null); setConfirmApply(false);
                }} className="mt-0.5 border-slate-500" />
                <span>{label}</span>
              </label>
            ))}
            <p className="text-xs text-slate-500">False values are permitted for previewing missing-attestation issues. They do not satisfy a safe apply.</p>
          </fieldset>
          {error && <p role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <Button type="button" disabled={!userId || !accountId || previewing || applying} onClick={() => void previewHistory()}>
            <ShieldCheck className="mr-2 h-4 w-4" /> {previewing ? "Building preview…" : "Preview history"}
          </Button>
          {applied && <div role="status" className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {applied.applied ? "Applied" : "Previously recorded"} import {applied.importId}: {applied.postingCount} posting records{applied.applied ? " created." : ". No new records were created."}
          </div>}
          {preview && <section className="space-y-4 border-t border-slate-700 pt-5" aria-labelledby="history-preview-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h3 id="history-preview-heading" className="font-semibold">Preview · {preview.account.accountName}</h3>
                <p className="mt-1 text-xs text-slate-400">Account {preview.account.accountNumber} · {preview.rows.length} movement rows</p>
                <p className={cn("mt-1 text-xs", previewNeedsRefresh ? "text-amber-300" : "text-slate-500")}>
                  {previewNeedsRefresh ? "This preview is no longer current. Refresh it before applying." :
                    previewExpiresAt ? `Local preview freshness window ends ${new Date(previewExpiresAt).toLocaleTimeString()}.` : ""}
                </p></div>
              <Button type="button" size="sm" variant="outline" className="shrink-0 border-slate-600 text-slate-200"
                disabled={previewing || applying} onClick={refreshPreview}>
                {previewNeedsRefresh ? "Refresh expired preview" : "Refresh preview"}
              </Button>
              <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-200"
                onClick={() => downloadJson(`history-gap-report-${preview.account.accountId}.json`, {
                  account: preview.account, openingBalance: preview.openingBalance, closingBalance: preview.closingBalance,
                  calculatedClosing: preview.calculatedClosing, issues: preview.issues, requiredRecords: preview.requiredRecords,
                })}><Download className="mr-2 h-4 w-4" /> Export gap report</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Opening", preview.openingBalance],
                ["Provided closing", preview.closingBalance],
                ["Calculated closing", preview.calculatedClosing],
              ].map(([label, value]) => <div key={label} className="border border-slate-700 bg-slate-900/50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-all font-mono text-sm">{value}</p>
              </div>)}
            </div>
            <div className="border border-slate-700">
              <h4 className="border-b border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Issues and missing records</h4>
              {!preview.issues.length && !preview.requiredRecords.length ? <p className="p-3 text-sm text-slate-400">No issues reported by the preview.</p> :
                <ul className="divide-y divide-slate-700/70">{preview.issues.map((issue, index) =>
                  <li key={`${issue.code}-${index}`} className="p-3 text-sm text-amber-100"><span className="mr-2 font-mono text-xs text-amber-400">{issue.code}</span>{issue.message}{issue.transactionId != null && <span className="ml-2 text-xs text-slate-400">Transaction {issue.transactionId}</span>}</li>)}
                  {preview.requiredRecords.map((record, index) => <li key={`required-${index}`} className="p-3 text-sm text-amber-100">Required: {record}</li>)}
                </ul>}
            </div>
            <div className="max-h-72 overflow-auto border border-slate-700">
              <table className="w-full min-w-[42rem] text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{["#", "Date", "Source reference", "Movement", "Balance after"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-700/60">{preview.rows.map(row => <tr key={`${row.sequence}-${row.sourceReference}`} className="text-slate-300">
                  <td className="px-3 py-2 font-mono">{row.sequence}</td><td className="px-3 py-2 whitespace-nowrap">{new Date(row.occurredAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.sourceReference || "—"}</td><td className="px-3 py-2 font-mono">{row.delta}</td><td className="px-3 py-2 font-mono">{row.balanceAfter}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
              <Checkbox checked={confirmApply} disabled={previewing || applying} onCheckedChange={value => setConfirmApply(value === true)} className="mt-0.5 border-amber-200" />
              <span>I reviewed the preview and authorize applying this source-backed historical balance import.</span>
            </label>
            <Button type="button" disabled={!preview.canApply || !confirmApply || previewNeedsRefresh || previewing || applying} onClick={() => void applyHistory()}>
              {applying ? "Applying…" : "Apply historical balances"}
            </Button>
            {!preview.canApply && <p className="text-xs text-amber-200">Apply is disabled because this preview cannot be safely applied.</p>}
          </section>}
        </CardContent>
      </Card>

      <Card className="bg-slate-800/40 border-slate-700 text-white">
        <CardHeader><CardTitle className="text-base">Import audit history</CardTitle></CardHeader>
        <CardContent>
          {!accountId ? <p className="text-sm text-slate-400">Select an account to review imports.</p>
            : auditQuery.isLoading ? <div className="h-12 animate-pulse bg-slate-700/40" role="status" aria-label="Loading import audit" />
              : auditQuery.isError ? <p role="alert" className="text-sm text-red-200">Audit history could not be loaded. <button className="underline" onClick={() => void auditQuery.refetch()}>Retry</button></p>
                : !auditQuery.data?.length ? <p className="text-sm text-slate-400">No historical imports recorded for this account.</p>
                  : <ul className="space-y-2">{auditQuery.data.map((entry, index) => <li key={entry.importId || entry.id || index} className="border border-slate-700 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-slate-200">{entry.importId || `Import ${entry.id || index + 1}`}</span>
                      <span className="text-xs text-slate-400">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span></div>
                    <p className="mt-1 text-xs text-slate-400">{entry.postingCount ?? entry.count ?? "—"} postings · {entry.sourceReference || entry.source?.reference || "Source reference unavailable"}</p>
                  </li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}
