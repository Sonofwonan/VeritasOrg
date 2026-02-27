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
  CreditCard,
  Settings,
  ChevronRight,
  Search,
  Command,
  MessageSquare,
  Phone
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
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
import { motion } from "framer-motion";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: CreditCard, label: "Cards", href: "/cards" },
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
        <Sidebar className="border-r border-border/50 bg-zinc-950 text-zinc-100">
          <SidebarHeader className="h-20 flex items-center px-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <img src="/assets/IMG_4531_1771684255921.jpeg" alt="Logo" className="w-7 h-7 object-contain rounded-sm" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight leading-none">Veritas</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-black mt-1">Wealth Management</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 pt-6">
            <SidebarGroup>
              <SidebarGroupLabel className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Support
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-2 px-2">
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    className="flex-1 bg-white/5 hover:bg-green-600/20 text-white/70 hover:text-green-500 border border-white/5 transition-all rounded-xl h-12 flex flex-col items-center justify-center gap-1 group"
                    onClick={() => window.open("https://wa.me/14784165940", "_blank")}
                  >
                    <SiWhatsapp className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">WhatsApp</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="flex-1 bg-white/5 hover:bg-primary/20 text-white/70 hover:text-primary border border-white/5 transition-all rounded-xl h-12 flex flex-col items-center justify-center gap-1 group"
                    onClick={() => window.open("sms:+17409381335", "_blank")}
                  >
                    <MessageSquare className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Direct SMS</span>
                  </Button>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-2">
                <SidebarMenu className="gap-1">
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        isActive={location === item.href}
                        className={cn(
                          "px-4 py-6 rounded-xl transition-all duration-300 group relative overflow-hidden",
                          location === item.href 
                            ? "bg-primary text-white shadow-lg shadow-primary/20" 
                            : "text-white/50 hover:bg-white/5 hover:text-white"
                        )}
                        onClick={() => setLocation(item.href)}
                      >
                        <item.icon className={cn(
                          "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                          location === item.href ? "text-white" : "text-white/40 group-hover:text-primary"
                        )} />
                        <span className="ml-4 font-bold tracking-tight">{item.label}</span>
                        {location === item.href ? (
                          <motion.div 
                            layoutId="active-pill"
                            className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                          />
                        ) : (
                          <ChevronRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-40 transition-all transform group-hover:translate-x-1" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-white/5 bg-black/40">
            <div className="flex items-center gap-3 px-3 py-4 rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-md">
              <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-inner">
                <AvatarFallback className="bg-primary text-white font-black text-xs">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate" data-testid="text-username">{user?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Institutional</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-white/40 hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-20 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between px-8 z-10">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="hover:scale-110 transition-transform text-white/70 hover:text-white" />
              <div className="h-6 w-[1px] bg-white/10 hidden md:block" />
              <div className="hidden md:flex items-center gap-3 text-sm font-bold tracking-tight">
                <span className="text-white/40 uppercase tracking-widest text-[10px]">Portal</span>
                <ChevronRight className="w-4 h-4 text-white/20" />
                <span className="text-white capitalize">{location.substring(1) || 'Dashboard'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex gap-2 border-white/10 bg-white/5 text-white hover:bg-primary hover:border-primary transition-all rounded-xl font-bold"
                onClick={() => setLocation("/goals")}
              >
                <Target className="w-4 h-4 text-primary" />
                <span>Strategy</span>
              </Button>
              <div 
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-primary hover:border-primary transition-all group"
                onClick={() => setLocation("/settings")}
              >
                <Settings className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-3 bg-muted/5 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-2 md:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
