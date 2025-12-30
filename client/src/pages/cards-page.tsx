import { useAccounts } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { MetallicCard } from "@/components/metallic-card";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, Shield, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CardsPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const primaryAccount = accounts?.[0];

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Cards</h1>
          <p className="text-muted-foreground">Manage your physical and virtual wealth cards.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Active Cards Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Active Cards
            </h2>
            <div className="w-full max-w-md space-y-4">
              {accounts?.map((account) => (
                <MetallicCard 
                  key={account.id}
                  userName={user?.name || "Premium Member"}
                  balance={Number(account.balance)}
                  accountType={account.accountType}
                  lastFour={String((account.id * 1337) % 9000 + 1000)}
                />
              ))}
              {(!accounts || accounts.length === 0) && (
                <MetallicCard 
                  userName={user?.name || "Premium Member"}
                  balance={0}
                  accountType="Premium Member"
                  lastFour="8888"
                />
              )}
            </div>
            
            <Card className="max-w-md border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Card Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/5">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Fraud Protection</span>
                  </div>
                  <span className="text-xs font-bold text-green-600 uppercase">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/5">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Instant Lock</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">Manage</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Benefits & Discovery */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Discover More
            </h2>
            <div className="grid gap-4">
              <Card className="hover-elevate cursor-pointer border-border/50 bg-gradient-to-br from-card to-accent/5">
                <CardHeader>
                  <CardTitle className="text-lg">Virtual One-Time Card</CardTitle>
                  <CardDescription>Perfect for secure online shopping</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Generate Card</Button>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate cursor-pointer border-border/50 bg-gradient-to-br from-card to-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">Business Platinum</CardTitle>
                  <CardDescription>Exclusive benefits for corporate wealth</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">View Benefits</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
