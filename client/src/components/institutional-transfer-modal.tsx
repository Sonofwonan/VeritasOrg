import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, ArrowRight, Building2, CheckCircle2, X } from "lucide-react";
import type { Account } from "@shared/schema";

// ─── Canadian Institution Registry ──────────────────────────────────────────
const INSTITUTIONS = [
  // Big Five Banks
  { name: "RBC Dominion Securities", short: "RBC", color: "#003168", bg: "#003168" },
  { name: "TD Wealth Management", short: "TD", color: "#54B848", bg: "#54B848" },
  { name: "BMO Nesbitt Burns", short: "BMO", color: "#0075BE", bg: "#0075BE" },
  { name: "Scotia Wealth Management", short: "BNS", color: "#EC111A", bg: "#EC111A" },
  { name: "CIBC Wood Gundy", short: "CIBC", color: "#8B0000", bg: "#8B0000" },
  // Independent Wealth
  { name: "National Bank Financial", short: "NBF", color: "#E31837", bg: "#E31837" },
  { name: "Raymond James Canada", short: "RJ", color: "#003366", bg: "#003366" },
  { name: "Canaccord Genuity Wealth", short: "CF", color: "#003876", bg: "#003876" },
  { name: "Assante Wealth Management", short: "AW", color: "#1A5276", bg: "#1A5276" },
  // Online / Self-Directed
  { name: "Wealthsimple", short: "WS", color: "#00D37F", bg: "#00D37F" },
  { name: "Questrade", short: "QT", color: "#FF6B00", bg: "#FF6B00" },
  { name: "Qtrade Direct Investing", short: "QTR", color: "#1B4F72", bg: "#1B4F72" },
  { name: "HSBC InvestDirect", short: "HSBC", color: "#DB0011", bg: "#DB0011" },
  { name: "CI Direct Investing", short: "CI", color: "#E67E22", bg: "#E67E22" },
  // Insurance / Mutual Fund
  { name: "Investia Financial Services", short: "INV", color: "#2E4057", bg: "#2E4057" },
  { name: "iA Financial Group", short: "iA", color: "#007A53", bg: "#007A53" },
  { name: "Manulife Securities", short: "MFC", color: "#003B5C", bg: "#003B5C" },
  { name: "Sun Life Financial", short: "SLF", color: "#F5821F", bg: "#F5821F" },
  { name: "Desjardins Securities", short: "DES", color: "#009A44", bg: "#009A44" },
  // Other
  { name: "Fidelity Canada", short: "FID", color: "#289B48", bg: "#289B48" },
  { name: "Credential Financial", short: "CRD", color: "#005B8E", bg: "#005B8E" },
];

const ACCOUNT_TYPES = ["RRSP", "TFSA", "RRIF", "Non-Registered", "Corporate", "RESP", "LIRA"];

// ─── Institution Logo Avatar ─────────────────────────────────────────────────
function InstitutionAvatar({ inst, size = "md" }: { inst: typeof INSTITUTIONS[0]; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : "w-11 h-11 text-xs";
  return (
    <div
      className={`${sz} rounded-lg flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: inst.color }}
    >
      {inst.short.slice(0, 3)}
    </div>
  );
}

// ─── Step 1: Institution Picker ───────────────────────────────────────────────
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
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
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

// ─── Step 2: Transfer Details Form ───────────────────────────────────────────
function TransferForm({
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

  const weeks = transferType === "cash"
    ? `12–18 weeks (liquidation + wire)`
    : `12 weeks minimum (re-registration)`;

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
          <Label className="text-xs">Your Account Number at {institution.short}</Label>
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
        <Label className="text-xs">Veritas Account to Transfer From</Label>
        <Select value={sourceAccount} onValueChange={setSourceAccount}>
          <SelectTrigger data-testid="select-source-account">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id.toString()}>
                {a.accountType} — ${Number(a.balance).toLocaleString("en-CA", { maximumFractionDigits: 0 })}
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
              <p className="font-semibold text-sm capitalize">{type === "in-kind" ? "In-Kind" : "Cash"}</p>
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

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
        <span className="mt-0.5">⏱</span>
        <span>Estimated timeline: <strong>{weeks}</strong>. This request is subject to admin review before processing begins.</span>
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
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
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
    setStep("pick");
    setSelectedInst(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Building2 className="w-5 h-5 text-primary" />
            {step === "pick" ? "Select Receiving Institution" :
             step === "form" ? "Transfer Details" :
             "Request Submitted"}
          </DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <InstitutionPicker onSelect={inst => { setSelectedInst(inst); setStep("form"); }} />
        )}

        {step === "form" && selectedInst && (
          <TransferForm
            institution={selectedInst}
            accounts={accounts}
            onBack={() => setStep("pick")}
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
              <h3 className="font-semibold text-lg">Transfer Request Received</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your institutional transfer to <strong>{selectedInst?.name}</strong> is under review.
                You'll see the status and estimated completion date once approved.
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
