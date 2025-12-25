import { useAccounts, useCreateAccount } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, CreditCard, ArrowRight, Briefcase, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

type AccountType = 'checking' | 'savings' | 'money_market' | 'cd' | 'high_yield_savings' | 'brokerage' | 'traditional_ira' | 'roth_ira' | '401k' | '529_plan' | 'trust_account' | 'business_checking' | 'business_savings';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking Account',
  savings: 'Savings Account',
  money_market: 'Money Market Account',
  cd: 'Certificate of Deposit',
  high_yield_savings: 'High-Yield Savings',
  brokerage: 'Brokerage Account',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  '401k': '401(k) / 403(b)',
  '529_plan': '529 Savings Plan',
  trust_account: 'Trust Account',
  business_checking: 'Business Checking',
  business_savings: 'Business Savings',
};
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const [newAccount, setNewAccount] = useState<{accountType: AccountType, balance: string}>({
    accountType: "checking",
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
      onSuccess: () => {
        setIsOpen(false);
        toast({
          title: "Account Created",
          description: "Your new account is ready to use.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create account.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <LayoutShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold font-display">Accounts</h2>
          <p className="text-muted-foreground">Manage your banking and investment accounts.</p>
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
                      <SelectItem value="checking">Checking Account</SelectItem>
                      <SelectItem value="savings">Savings Account</SelectItem>
                      <SelectItem value="money_market">Money Market Account</SelectItem>
                      <SelectItem value="cd">Certificate of Deposit (CD)</SelectItem>
                      <SelectItem value="high_yield_savings">High-Yield Savings</SelectItem>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Investment & Retirement</p>
                      <SelectItem value="brokerage">Brokerage Account</SelectItem>
                      <SelectItem value="traditional_ira">Traditional IRA</SelectItem>
                      <SelectItem value="roth_ira">Roth IRA</SelectItem>
                      <SelectItem value="401k">401(k) / 403(b)</SelectItem>
                      <SelectItem value="529_plan">529 Savings Plan</SelectItem>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Other Accounts</p>
                      <SelectItem value="trust_account">Trust Account</SelectItem>
                      <SelectItem value="business_checking">Business Checking</SelectItem>
                      <SelectItem value="business_savings">Business Savings</SelectItem>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p>Loading accounts...</p>
        ) : accounts?.map((account) => (
          <Card key={account.id} className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              {['brokerage', 'traditional_ira', 'roth_ira', '401k', '529_plan'].includes(account.accountType) ? (
                <CreditCard className="w-24 h-24" />
              ) : ['trust_account', 'business_checking', 'business_savings'].includes(account.accountType) ? (
                <Briefcase className="w-24 h-24" />
              ) : (
                <Wallet className="w-24 h-24" />
              )}
            </div>
            
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <div className={`
                  p-3 rounded-xl 
                  ${['brokerage', 'traditional_ira', 'roth_ira', '401k', '529_plan'].includes(account.accountType) ? 'bg-purple-100 text-purple-600' : ['trust_account', 'business_checking', 'business_savings'].includes(account.accountType) ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}
                `}>
                  {['brokerage', 'traditional_ira', 'roth_ira', '401k', '529_plan'].includes(account.accountType) ? (
                    <CreditCard className="w-6 h-6" />
                  ) : ['trust_account', 'business_checking', 'business_savings'].includes(account.accountType) ? (
                    <Briefcase className="w-6 h-6" />
                  ) : (
                    <Wallet className="w-6 h-6" />
                  )}
                </div>
              </div>
              <CardTitle className="text-xl">
                {ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}
              </CardTitle>
              <CardDescription>ID: ****{account.id}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-3xl font-bold font-display tracking-tight text-foreground">
                  ${Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/30 border-t flex gap-2 p-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => setLocation(`/accounts/${account.id}`)}
              >
                Details
                <ArrowRight className="w-4 h-4" />
              </Button>
              {['checking', 'savings', 'money_market'].includes(account.accountType) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  title="Order Debit Card"
                >
                  <CreditCard className="w-4 h-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 border-t pt-8">
        <h3 className="text-xl font-bold mb-6">Debit Card Management</h3>
        <div className="grid md:grid-cols-2 gap-6">
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
                <p><span className="text-muted-foreground">Cardholder:</span> {user?.username || 'Account Owner'}</p>
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
                  <Button variant="outline" size="sm" className="w-full text-xs">Edit Limits</Button>
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
