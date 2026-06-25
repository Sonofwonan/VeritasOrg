import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, ArrowRight, Building2, CheckCircle2, X, Layers, CreditCard } from "lucide-react";
import type { Account } from "@shared/schema";

// ─── Canadian Institution Registry ──────────────────────────────────────────
const INSTITUTIONS = [
  { name: "RBC Dominion Securities", short: "RBC", color: "#003168" },
  { name: "TD Wealth Management", short: "TD", color: "#54B848" },
  { name: "BMO Nesbitt Burns", short: "BMO", color: "#0075BE" },
  { name: "Scotia Wealth Management", short: "BNS", color: "#EC111A" },
  { name: "CIBC Wood Gundy", short: "CIBC", color: "#8B0000" },
  { name: "National Bank Financial", short: "NBF", color: "#E31837" },
  { name: "Raymond James Canada", short: "RJ", color: "#003366" },
  { name: "Canaccord Genuity Wealth", short: "CF", color: "#003876" },
  { name: "Assante Wealth Management", short: "AW", color: "#1A5276" },
  { name: "Wealthsimple", short: "WS", color: "#00D37F" },
  { name: "Questrade", short: "QT", color: "#FF6B00" },
  { name: "Qtrade Direct Investing", short: "QTR", color: "#1B4F72" },
  { name: "HSBC InvestDirect", short: "HSBC", color: "#DB0011" },
  { name: "CI Direct Investing", short: "CI", color: "#E67E22" },
  { name: "Investia Financial Services", short: "INV", color: "#2E4057" },
  { name: "iA Financial Group", short: "iA", color: "#007A53" },
  { name: "Manulife Securities", short: "MFC", color: "#003B5C" },
  { name: "Sun Life Financial", short: "SLF", color: "#F5821F" },
  { name: "Desjardins Securities", short: "DES", color: "#009A44" },
  { name: "Fidelity Canada", short: "FID", color: "#289B48" },
  { name: "Credential Financial", short: "CRD", color: "#005B8E" },
];

const ACCOUNT_TYPES = ["RRSP", "TFSA", "RRIF", "Non-Registered", "Corporate", "RESP", "LIRA"];

type TransferMode = "single" | "full-portfolio";

function InstitutionAvatar({ inst, size = "md" }: { inst: typeof INSTITUTIONS[0]; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : "w-11 h-11 text-xs";
  return (
    <div className={`${sz} rounded-lg flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: inst.color }}>
      {inst.short.slice(0, 3)}
    </div>
  );
}

// ─── Step 1: Mode Selection ───────────────────────────────────────────────────
function ModePicker({ onSelect }: { onSelect: (mode: TransferMode) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose how you'd like to transfer your assets.</p>
      <button
        onClick={() => onSelect("full-portfolio")}
        className="w-full text-left p-4 rounded-xl border-2 border-primary/20 hover:border-primary bg-primary/3 hover:bg-primary/5 transition-all group"
        data-testid="mode-full-portfolio"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Full Portfolio Transfer</p>
            <p className="text-xs text-muted-foreground mt-0.5">Move <strong>all accounts and investments</strong> to a new institution in one request. Recommended for full consolidation.</p>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors mt-3 shrink-0" />
        </div>
      </button>

      <button
        onClick={() => onSelect("single")}
        className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/5 transition-all group"
        data-testid="mode-single-account"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors">
            <CreditCard className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <p className="font-semibold text-sm">Single Account Transfer</p>
            <p className="text-xs text-muted-foreground mt-0.5">Transfer one specific account to another institution.</p>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors mt-3 shrink-0" />
        </div>
      </button>
    </div>
  );
}

// ─── Step 2: Institution Picker ───────────────────────────────────────────────
function InstitutionPicker({ onSelect }: { onSelect: (inst: typeof INSTITUTIONS[0]) => void }) {
  const [search, setSearch] = useState("");
  const filtered = INSTITUTIONS.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.short.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search institution…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          autoFocus
          data-testid="input-institution-search"
        />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {filtered.map(inst => (
          <button
            key={inst.name}
            onClick={() => onSelect(inst)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/10 transition-colors text-left group"
            data-testid={`institution-option-${inst.short}`}
          >
            <InstitutionAvatar inst={inst} size="sm" />
            <span className="text-sm font-medium group-hover:text-primary transition-colors">{inst.name}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No institutions found</p>
        )}
      </div>
    </div>
  );
}

// ─── Full Portfolio Transfer Form ─────────────────────────────────────────────
function FullPortfolioForm({
  institution,
  accounts,
  onBack,
  onSubmit,
  isPending,
}: {
  institution: typeof INSTITUTIONS[0];
  accounts: Account[];
  onBack: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [transferType, setTransferType] = useState<"cash" | "in-kind">("in-kind");

  const totalValue = useMemo(() =>
    accounts.reduce((sum, a) => sum + Number(a.balance), 0),
    [accounts]
  );

  const portfolioSnapshot = accounts.map(a => ({
    id: a.id,
    accountType: a.accountType,
    balance: Number(a.balance),
  }));

  const canSubmit = accountNumber.trim().length > 0;

  const weeks = transferType === "cash" ? "12–18 weeks" : "10–14 weeks";

  return (
    <div className="space-y-5">
      {/* Institution header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
        <InstitutionAvatar inst={institution} />
        <div>
          <p className="font-semibold text-sm">{institution.name}</p>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
            <X className="w-3 h-3" /> Change institution
          </button>
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="rounded-xl border border-primary/20 overflow-hidden">
        <div className="bg-primary/5 px-4 py-2.5 flex items-center justify-between border-b border-primary/10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Accounts to Transfer</span>
          <span className="text-xs font-bold text-primary">
            CAD ${totalValue.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
          </span>
        </div>
        <div className="divide-y divide-border/40">
          {accounts.map(a => (
            <div key={a.id} className="px-4 py-2.5 flex items-center justify-between" data-testid={`portfolio-account-row-${a.id}`}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                <span className="text-sm">{a.accountType}</span>
              </div>
              <span className="text-sm font-medium tabular-nums">
                CAD ${Number(a.balance).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Receiving account number */}
      <div className="space-y-1.5">
        <Label className="text-xs">Your Portfolio ID at {institution.short}</Label>
        <Input
          placeholder="e.g. 123-456789"
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value)}
          data-testid="input-institution-account-number"
        />
        <p className="text-xs text-muted-foreground">Your Portfolio ID at {institution.name} that will receive the assets.</p>
      </div>

      {/* Transfer method */}
      <div className="space-y-2">
        <Label className="text-xs">Transfer Method</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["in-kind", "cash"] as const).map(type => (
            <button
              key={type}
              onClick={() => setTransferType(type)}
              className={`p-3 rounded-xl border text-left transition-all ${transferType === type
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/40"}`}
              data-testid={`transfer-type-${type}`}
            >
              <p className="font-semibold text-sm">{type === "in-kind" ? "In-Kind" : "Cash"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {type === "in-kind" ? "Securities re-registered as-is" : "Liquidate all, then wire cash"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        disabled={!canSubmit || isPending}
        onClick={() => onSubmit({
          institutionName: institution.name,
          institutionAccountNumber: accountNumber,
          accountType: "Full Portfolio",
          transferType,
          transferScope: "full-portfolio",
          partialAmount: totalValue.toFixed(2),
          portfolioSnapshot,
        })}
        data-testid="button-submit-institutional-transfer"
      >
        {isPending ? "Submitting…" : `Submit Full Portfolio Transfer — CAD $${totalValue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`}
      </Button>
    </div>
  );
}

// ─── Single Account Transfer Form ─────────────────────────────────────────────
function SingleAccountForm({
  institution,
  accounts,
  onBack,
  onSubmit,
  isPending,
}: {
  institution: typeof INSTITUTIONS[0];
  accounts: Account[];
  onBack: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("");
  const [transferType, setTransferType] = useState<"cash" | "in-kind">("in-kind");
  const [transferScope, setTransferScope] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [sourceAccount, setSourceAccount] = useState("");

  const weeks = transferType === "cash" ? "12–18 weeks" : "12 weeks minimum";
  const canSubmit = accountNumber && accountType && sourceAccount &&
    (transferScope === "full" || (transferScope === "partial" && partialAmount));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
        <InstitutionAvatar inst={institution} />
        <div>
          <p className="font-semibold text-sm">{institution.name}</p>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
            <X className="w-3 h-3" /> Change institution
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Your Portfolio ID at {institution.short}</Label>
          <Input
            placeholder="e.g. 123-456789"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            data-testid="input-institution-account-number"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Account Type</Label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger data-testid="select-account-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Veritas Account to Transfer</Label>
        <Select value={sourceAccount} onValueChange={setSourceAccount}>
          <SelectTrigger data-testid="select-source-account">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id.toString()}>
                {a.accountType} — CAD ${Number(a.balance).toLocaleString("en-CA", { maximumFractionDigits: 0 })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Transfer Method</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["in-kind", "cash"] as const).map(type => (
            <button
              key={type}
              onClick={() => setTransferType(type)}
              className={`p-3 rounded-xl border text-left transition-all ${transferType === type
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/40"}`}
              data-testid={`transfer-type-${type}`}
            >
              <p className="font-semibold text-sm">{type === "in-kind" ? "In-Kind" : "Cash"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {type === "in-kind" ? "Securities transferred as-is" : "Liquidate, then wire cash"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Transfer Scope</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["full", "partial"] as const).map(scope => (
            <button
              key={scope}
              onClick={() => setTransferScope(scope)}
              className={`p-3 rounded-xl border text-left transition-all ${transferScope === scope
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/40"}`}
              data-testid={`transfer-scope-${scope}`}
            >
              <p className="font-semibold text-sm capitalize">{scope}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {scope === "full" ? "Entire account balance" : "Specify an amount"}
              </p>
            </button>
          ))}
        </div>
        {transferScope === "partial" && (
          <div className="relative mt-2">
            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">CAD $</span>
            <Input
              type="number"
              placeholder="0.00"
              className="pl-14"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              data-testid="input-partial-amount"
            />
          </div>
        )}
      </div>

      <Button
        className="w-full"
        disabled={!canSubmit || isPending}
        onClick={() => onSubmit({
          institutionName: institution.name,
          institutionAccountNumber: accountNumber,
          accountType,
          transferType,
          transferScope,
          partialAmount: transferScope === "partial" ? partialAmount : undefined,
          accountId: parseInt(sourceAccount),
        })}
        data-testid="button-submit-institutional-transfer"
      >
        {isPending ? "Submitting…" : "Submit Transfer Request"}
      </Button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
type Step = "mode" | "pick-institution" | "form" | "done";

export function InstitutionalTransferModal({
  open,
  onClose,
  accounts,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  userId: number;
}) {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<TransferMode>("single");
  const [selectedInst, setSelectedInst] = useState<typeof INSTITUTIONS[0] | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/institutional-transfers", { ...data, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutional-transfers"] });
      setStep("done");
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep("mode");
    setMode("single");
    setSelectedInst(null);
    onClose();
  };

  const stepTitle = () => {
    if (step === "mode") return "Institutional Transfer";
    if (step === "pick-institution") return mode === "full-portfolio" ? "Select Receiving Institution" : "Select Receiving Institution";
    if (step === "form") return mode === "full-portfolio" ? "Full Portfolio Transfer" : "Transfer Details";
    return "Request Submitted";
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Building2 className="w-5 h-5 text-primary" />
            {stepTitle()}
          </DialogTitle>
        </DialogHeader>

        {/* Back button for sub-steps */}
        {(step === "pick-institution" || (step === "form" && !selectedInst)) && (
          <button
            onClick={() => { setStep("mode"); setSelectedInst(null); }}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 -mt-1"
          >
            ← Back
          </button>
        )}

        {step === "mode" && (
          <ModePicker
            onSelect={m => {
              setMode(m);
              setStep("pick-institution");
            }}
          />
        )}

        {step === "pick-institution" && (
          <InstitutionPicker
            onSelect={inst => {
              setSelectedInst(inst);
              setStep("form");
            }}
          />
        )}

        {step === "form" && selectedInst && mode === "full-portfolio" && (
          <FullPortfolioForm
            institution={selectedInst}
            accounts={accounts}
            onBack={() => setStep("pick-institution")}
            onSubmit={data => mutation.mutate(data)}
            isPending={mutation.isPending}
          />
        )}

        {step === "form" && selectedInst && mode === "single" && (
          <SingleAccountForm
            institution={selectedInst}
            accounts={accounts}
            onBack={() => setStep("pick-institution")}
            onSubmit={data => mutation.mutate(data)}
            isPending={mutation.isPending}
          />
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {mode === "full-portfolio" ? "Full Portfolio Transfer Submitted" : "Transfer Request Received"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "full-portfolio"
                  ? <>Your complete portfolio transfer to <strong>{selectedInst?.name}</strong> is now pending admin review. All {accounts.length} accounts are included in this request.</>
                  : <>Your institutional transfer to <strong>{selectedInst?.name}</strong> is under review. You'll see the status and estimated completion date once approved.</>
                }
              </p>
            </div>
            <Button className="w-full" onClick={handleClose} data-testid="button-done-institutional-transfer">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
