import { useAccounts, useCreateAccount } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
  const [isOpen, setIsOpen] = useState(false);
  
  const [newAccount, setNewAccount] = useState({
    accountType: "cash" as "cash" | "investment",
    balance: "1000", // Default starting balance for demo
  });

  const handleCreate = () => {
    if (!user) return;
    
    createAccount.mutate({
      userId: user.id,
      accountType: newAccount.accountType,
      balance: newAccount.balance,
      isDemo: true,
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
                Choose an account type to get started. Initial deposit is simulated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Account Type</Label>
                <Select 
                  value={newAccount.accountType} 
                  onValueChange={(v: "cash" | "investment") => setNewAccount(prev => ({ ...prev, accountType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash / Checking</SelectItem>
                    <SelectItem value="investment">Investment / Brokerage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Initial Deposit (Demo)</Label>
                <Input 
                  type="number" 
                  value={newAccount.balance}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
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
              {account.accountType === 'investment' ? (
                <CreditCard className="w-24 h-24" />
              ) : (
                <Wallet className="w-24 h-24" />
              )}
            </div>
            
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <div className={`
                  p-3 rounded-xl 
                  ${account.accountType === 'investment' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}
                `}>
                  {account.accountType === 'investment' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                </div>
                {account.isDemo && (
                  <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground">DEMO</span>
                )}
              </div>
              <CardTitle className="text-xl">
                {account.accountType === 'investment' ? 'Brokerage Account' : 'Checking Account'}
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
            
            <CardFooter className="bg-muted/30 border-t p-4 flex gap-2">
              <Button variant="outline" size="sm" className="w-full">Details</Button>
              <Button variant="ghost" size="sm" className="w-full">History</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </LayoutShell>
  );
}
