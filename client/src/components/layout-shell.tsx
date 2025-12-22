import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  ArrowRightLeft, 
  LogOut, 
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Accounts", href: "/accounts", icon: Wallet },
  { label: "Investments", href: "/investments", icon: TrendingUp },
  { label: "Transfers", href: "/transfers", icon: ArrowRightLeft },
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 font-display">
          FinTech<span className="text-primary">Demo</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Premium Banking</p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 mt-auto">
        <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          onClick={() => logout.mutate()}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 border-r bg-card/50 backdrop-blur-sm fixed h-full z-30">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-40 flex items-center justify-between px-4">
        <h1 className="font-bold text-lg font-display">FinTechDemo</h1>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 pt-16 lg:pt-0 min-h-screen transition-all duration-300">
        <div className="container max-w-7xl mx-auto p-4 md:p-8 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
