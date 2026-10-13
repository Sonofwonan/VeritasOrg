const titles: Record<string, string> = {
  "/dashboard": "Account overview",
  "/accounts": "Your accounts",
  "/investments": "Investments",
  "/transfers": "Transfers",
  "/transactions": "Transaction history",
  "/education": "Education",
  "/settings": "Settings",
  "/signed-out": "Signed out",
};

// Visual context only: no auth, API requests, cookies or financial operations.
export function PreviewContent({ location = "/dashboard" }: { location?: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 font-sans">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
        <h1 className="text-3xl text-foreground">{titles[location] ?? "Account overview"}</h1>
        <span className="text-xs text-muted-foreground">Alex Morgan</span>
      </div>
      <section className="wealth-panel px-6 py-7 text-white">
        <p className="text-xs uppercase tracking-widest text-white/80">Total balance</p>
        <p className="mt-3 whitespace-nowrap font-sans text-[clamp(1.5rem,4vw,2.5rem)] font-bold tabular-nums">£248,500.25</p>
        <div className="mt-7 flex gap-6 border-t border-white/20 pt-5 text-sm">
          <span>Accounts</span><span>Transfers</span><span>Investments</span>
        </div>
      </section>
      <section className="border border-border bg-card">
        <h2 className="border-b border-border px-5 py-4 text-2xl">Recent transactions</h2>
        <div className="flex items-center justify-between gap-4 p-5 text-sm">
          <div><p className="font-medium">Account transfer</p><p className="mt-1 text-xs text-muted-foreground">Current Account · Completed</p></div>
          <p className="shrink-0 font-mono text-primary">+£500.00</p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border p-5 text-sm">
          <div><p className="font-medium">Monthly service fee</p><p className="mt-1 text-xs text-muted-foreground">Investment Account · Completed</p></div>
          <p className="shrink-0 font-mono text-destructive">-£15.00</p>
        </div>
      </section>
    </div>
  );
}
