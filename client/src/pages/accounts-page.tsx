import { useState, useEffect } from "react";
import { Plus, Wallet, CreditCard, ArrowRight, Briefcase, Eye, EyeOff, ArrowDownCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useAccounts, useCreateAccount, useDeleteAccount, useTransfer, useAccountTransactions } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

type AccountType = 'Checking Account' | 'Savings Account' | 'Money Market Account' | 'Certificate of Deposit (CCD)' | 'High-Yield Savings' | 'Brokerage Account' | 'Traditional IRA' | 'Roth IRA' | '401(k) / 403(b)' | '529 Savings Plan' | 'Trust Account' | 'Business Checking' | 'Business Savings';

const INVESTMENT_ACCOUNT_TYPES = ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan'];
const BUSINESS_ACCOUNT_TYPES = ['Trust Account', 'Business Checking', 'Business Savings'];
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AccountsPage() {
  const [feedback, setFeedback] = useState<{title: string, message: string, type: 'success' | 'error'} | null>(null);
  const { data: accounts, isLoading } = useAccounts();
  const checkingAccount = accounts?.find(a => a.accountType === "Checking Account");
  const { data: transactions } = useAccountTransactions(checkingAccount?.id || 0);

  const pendingBalance = transactions?.filter(t => t.status === 'pending')
    .reduce((sum, t) => {
      const amount = Number(t.amount);
      return t.toAccountId === checkingAccount?.id ? sum + amount : sum - amount;
    }, 0) || 0;

  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const depositMutation = useTransfer(); // We can use the same transfer logic but from "external"
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  const [newAccount, setNewAccount] = useState<{accountType: AccountType, balance: string}>({
    accountType: "Checking Account",
    balance: "5000",
  });

  const handleCreate = () => {
    if (!user) return;

    createAccount.mutate({
      userId: user.id,
      accountType: newAccount.accountType,
      balance: newAccount.balance,
      isDemo: false,
    }, {
      onSuccess: (data: any) => {
        setIsOpen(false);
        // Using a dialog for banking-style feedback
        const details = `Account: ${data.accountType}\nInitial Deposit: $${Number(data.balance).toLocaleString()}`;
        setFeedback({ title: "Account Successfully Established", message: details, type: 'success' });
      },
      onError: (error: any) => {
        const detail = error.response?.data?.message || error.message || "Failed to create account.";
        toast({
          title: "Error Creating Account",
          description: detail,
          variant: "destructive",
        });
      }
    });
  };

  const handleDeposit = () => {
    if (!selectedAccountId || !depositAmount) return;

    // In a real app, this would be an external deposit. 
    // For this demo/wealth management platform, we'll route it through a specialized deposit endpoint
    // that adds funds to the selected account.
    depositMutation.mutate({
      fromAccountId: -1, // Special ID for external deposit
      toAccountId: selectedAccountId,
      amount: depositAmount
    }, {
      onSuccess: () => {
        setIsDepositOpen(false);
        setDepositAmount("");
        setFeedback({ 
          title: "Deposit Initiated", 
          message: `Your deposit of $${Number(depositAmount).toLocaleString()} is being processed. Funds will be available after verification.`, 
          type: 'success' 
        });
      },
      onError: (error: any) => {
        setFeedback({ 
          title: "Deposit Failed", 
          message: error.message || "We were unable to process your deposit at this time.", 
          type: 'error' 
        });
      }
    });
  };

  return (
    <LayoutShell>
      <div className="flex items-center justify-between mb-3">
        {/* Banking Feedback Modal */}
        <Dialog open={!!feedback} onOpenChange={(open) => !open && setFeedback(null)}>
          <DialogContent className="sm:max-w-md border-primary/20 bg-zinc-950 text-white">
            <DialogHeader className="flex flex-col items-center gap-4 py-4">
              {feedback?.type === 'success' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center border border-destructive/50">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
              )}
              <DialogTitle className="text-xl font-bold text-center tracking-tight">
                {feedback?.title}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-center whitespace-pre-wrap leading-relaxed">
                {feedback?.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center border-t border-white/5 pt-6">
              <Button 
                onClick={() => setFeedback(null)} 
                className="w-full sm:w-32 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11 transition-all"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div>
          <h2 className="text-xl font-bold font-display">Accounts</h2>
          <p className="text-muted-foreground text-xs">Manage your banking and investment accounts.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open New Account</DialogTitle>
              <DialogDescription>
                Choose an account type and set your initial deposit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Account Type</Label>
                <Select 
                  value={newAccount.accountType} 
                  onValueChange={(v: any) => setNewAccount(prev => ({ ...prev, accountType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Deposit Accounts</p>
                      <SelectItem value="Checking Account">Checking Account</SelectItem>
                      <SelectItem value="Savings Account">Savings Account</SelectItem>
                      <SelectItem value="Money Market Account">Money Market Account</SelectItem>
                      <SelectItem value="Certificate of Deposit (CCD)">Certificate of Deposit (CCD)</SelectItem>
                      <SelectItem value="High-Yield Savings">High-Yield Savings</SelectItem>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Investment & Retirement</p>
                      <SelectItem value="Brokerage Account">Brokerage Account</SelectItem>
                      <SelectItem value="Traditional IRA">Traditional IRA</SelectItem>
                      <SelectItem value="Roth IRA">Roth IRA</SelectItem>
                      <SelectItem value="401(k) / 403(b)">401(k) / 403(b)</SelectItem>
                      <SelectItem value="529 Savings Plan">529 Savings Plan</SelectItem>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Other Accounts</p>
                      <SelectItem value="Trust Account">Trust Account</SelectItem>
                      <SelectItem value="Business Checking">Business Checking</SelectItem>
                      <SelectItem value="Business Savings">Business Savings</SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Initial Deposit</Label>
                <Input 
                  type="number" 
                  value={newAccount.balance}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
                  placeholder="5000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <p className="text-xs">Loading accounts...</p>
        ) : accounts?.map((account) => (
          <Card key={account.id} className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col h-full">
            {/* Background decoration - smaller */}
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              {INVESTMENT_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? (
                <CreditCard className="w-12 h-12" />
              ) : BUSINESS_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? (
                <Briefcase className="w-12 h-12" />
              ) : (
                <Wallet className="w-12 h-12" />
              )}
            </div>
            
            <CardHeader className="p-2 pb-1">
              <div className="flex justify-between items-start mb-0.5">
                <div className={`
                  p-1 rounded-lg text-xs
                  ${INVESTMENT_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? 'bg-purple-100 text-purple-600' : BUSINESS_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}
                `}>
                  {INVESTMENT_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? (
                    <CreditCard className="w-3 h-3" />
                  ) : BUSINESS_ACCOUNT_TYPES.includes(account.accountType as AccountType) ? (
                    <Briefcase className="w-3 h-3" />
                  ) : (
                    <Wallet className="w-3 h-3" />
                  )}
                </div>
              </div>
              <CardTitle className="text-xs leading-tight">
                {account.accountType}
              </CardTitle>
              <CardDescription className="text-[8px]">
                {account.accountType === "Checking Account" ? (
                  `Card: •••• ${((account.id * 1337) % 9000 + 1000)}`
                ) : (
                  "Cardless Account"
                )}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-2 pt-0 flex-1">
              <div className="mt-1">
                <p className="text-[8px] text-muted-foreground mb-0.5">Available Balance</p>
                <p className="text-sm font-bold font-display tracking-tight text-foreground">
                  ${Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                {account.accountType === "Checking Account" && pendingBalance !== 0 && (
                  <p className="text-[7px] text-amber-600 font-medium">
                    Pending: ${pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/30 border-t flex gap-1 p-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-7 text-xs gap-1 no-default-hover-elevate"
                onClick={() => setLocation(`/accounts/${account.id}`)}
              >
                Details
                <ArrowRight className="w-2 h-2" />
              </Button>
              <Dialog open={isDepositOpen && selectedAccountId === account.id} onOpenChange={(open) => {
                setIsDepositOpen(open);
                if (open) setSelectedAccountId(account.id);
                else setSelectedAccountId(null);
              }}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 h-7 text-xs gap-1 text-primary hover:bg-primary/10 no-default-hover-elevate"
                  >
                    <ArrowDownCircle className="w-2 h-2" />
                    Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                    <DialogDescription>
                      Add funds to your {account.accountType}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Deposit Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input 
                          type="number" 
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="pl-7"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleDeposit} disabled={depositMutation.isPending}>
                      {depositMutation.isPending ? "Processing..." : "Confirm Deposit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-4 border-t pt-3">
        <h3 className="text-sm font-bold mb-2">Debit Card Management</h3>
        <div className="grid md:grid-cols-2 gap-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Physical Debit Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg p-4 border border-primary/20 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Veritas Wealth</p>
                  <p className="font-mono text-sm">•••• •••• •••• 4829</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Cardholder:</span> {user?.name || 'Account Owner'}</p>
                <p><span className="text-muted-foreground">Expires:</span> 12/27</p>
                <p><span className="text-muted-foreground">Status:</span> <span className="text-green-600 font-medium">Active</span></p>
              </div>
              <Button variant="outline" className="w-full">Lock Card</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Virtual Debit Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Instant Virtual Card</p>
                  <p className="font-mono text-sm">Use immediately for online shopping</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Type:</span> Single-use or recurring</p>
                <p><span className="text-muted-foreground">Setup Time:</span> Instant</p>
                <p><span className="text-muted-foreground">Limit:</span> Customizable per transaction</p>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Create Virtual Card</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-3 rounded border hover-elevate transition-all">
                <div>
                  <p className="font-medium">Whole Foods Market</p>
                  <p className="text-xs text-muted-foreground">Dec 24, 2025</p>
                </div>
                <p className="font-medium text-rose-600">-$87.43</p>
              </div>
              <div className="flex justify-between items-center p-3 rounded border hover-elevate transition-all">
                <div>
                  <p className="font-medium">Starbucks Coffee</p>
                  <p className="text-xs text-muted-foreground">Dec 23, 2025</p>
                </div>
                <p className="font-medium text-rose-600">-$6.25</p>
              </div>
              <div className="flex justify-between items-center p-3 rounded border hover-elevate transition-all">
                <div>
                  <p className="font-medium">Salary Deposit</p>
                  <p className="text-xs text-muted-foreground">Dec 22, 2025</p>
                </div>
                <p className="font-medium text-emerald-600">+$3,500.00</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Card Controls & Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Spending Controls</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 rounded border">
                    <span className="text-muted-foreground">Daily Limit</span>
                    <span className="font-medium">$2,500</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded border">
                    <span className="text-muted-foreground">ATM Withdrawal Limit</span>
                    <span className="font-medium">$500</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs" data-testid="button-edit-limits">Edit Limits</Button>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Security Features</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Real-time fraud monitoring</li>
                  <li>✓ Transaction notifications</li>
                  <li>✓ Instant card lock/unlock</li>
                  <li>✓ Contactless payments</li>
                  <li>✓ EMV chip protection</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
