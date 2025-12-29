import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowRightLeft, 
  Target, 
  GraduationCap, 
  LogOut,
  TrendingUp,
  Settings,
  ChevronRight,
  Search,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
  SidebarInset
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: TrendingUp, label: "Investments", href: "/investments" },
  { icon: ArrowRightLeft, label: "Transfers", href: "/transfers" },
  { icon: Target, label: "Goals", href: "/goals" },
  { icon: GraduationCap, label: "Education", href: "/education" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = navItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border/50">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">Veritas Wealth</span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <div className="px-4 py-4">
              <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-muted-foreground font-normal bg-muted/50 border-border/50 h-9 px-3 hover:bg-muted transition-colors"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    <span>Search...</span>
                    <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden">
                  <DialogHeader className="p-4 border-b border-border/50">
                    <div className="flex items-center bg-muted/50 rounded-lg px-3 h-10 border border-border/50">
                      <Search className="h-4 w-4 text-muted-foreground mr-2" />
                      <Input 
                        placeholder="Search features..." 
                        className="border-0 bg-transparent focus-visible:ring-0 px-0 h-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </DialogHeader>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    {filteredItems.length > 0 ? (
                      <div className="space-y-1">
                        {filteredItems.map((item) => (
                          <Button
                            key={item.href}
                            variant="ghost"
                            className="w-full justify-start gap-3 h-10 px-3 hover:bg-primary/5 hover:text-primary transition-all group"
                            onClick={() => {
                              setLocation(item.href);
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-sm font-medium">{item.label}</span>
                            <ChevronRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Menu
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-3">
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        isActive={location === item.href}
                        className={cn(
                          "px-3 py-2 rounded-lg transition-all duration-200",
                          location === item.href 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={() => setLocation(item.href)}
                      >
                        <item.icon className={cn("w-5 h-5", location === item.href ? "text-primary" : "text-muted-foreground")} />
                        <span className="ml-3">{item.label}</span>
                        {location === item.href && (
                          <ChevronRight className="ml-auto w-4 h-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/50 bg-accent/5">
            <div className="flex items-center gap-3 px-2 py-3 rounded-xl border border-border/50 bg-card shadow-sm">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" data-testid="text-username">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate opacity-70">Premium Plan</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover-elevate" />
              <div className="h-4 w-[1px] bg-border/50 hidden md:block" />
              <div className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>Wealth Management</span>
                <ChevronRight className="w-4 h-4 opacity-30" />
                <span className="text-foreground capitalize">{location.substring(1) || 'Dashboard'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-primary/20 hover:bg-primary/5 transition-colors">
                <Target className="w-4 h-4 text-primary" />
                <span>Set Goal</span>
              </Button>
              <div 
                className="h-8 w-8 rounded-full bg-accent flex items-center justify-center cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => setLocation("/settings")}
              >
                <Settings className="w-4 h-4 text-accent-foreground" />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-muted/5 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
