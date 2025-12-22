import { useAccounts, useTransfer } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export default function TransfersPage() {
  const { data: accounts } = useAccounts();
  const transferMutation = useTransfer();
  const { toast } = useToast();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");

  const handleTransfer = () => {
    if (!fromId || !toId || !amount) {
      toast({ title: "Incomplete form", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    if (fromId === toId) {
      toast({ title: "Invalid selection", description: "Cannot transfer to the same account", variant: "destructive" });
      return;
    }

    transferMutation.mutate({
      fromAccountId: parseInt(fromId),
      toAccountId: parseInt(toId),
      amount: amount
    }, {
      onSuccess: () => {
        toast({ title: "Transfer Successful", description: `$${amount} has been transferred.` });
        setAmount("");
      },
      onError: (err) => {
        toast({ title: "Transfer Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold font-display">Transfers</h2>
          <p className="text-muted-foreground">Move money between your accounts instantly.</p>
        </div>

        <Card className="border-none shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              New Transfer
            </CardTitle>
            <CardDescription>Internal transfer between your accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
              <div className="space-y-2">
                <Label>From Account</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        <div className="text-left">
                          <p className="font-medium">Account #{a.id}</p>
                          <p className="text-xs text-muted-foreground">${Number(a.balance).toFixed(2)}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-center pt-6">
                <div className="bg-muted p-2 rounded-full">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>To Account</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        <div className="text-left">
                          <p className="font-medium">Account #{a.id}</p>
                          <p className="text-xs text-muted-foreground">${Number(a.balance).toFixed(2)}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                <Input 
                  type="number" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-8 h-14 text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 text-lg shadow-lg shadow-primary/25" 
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
