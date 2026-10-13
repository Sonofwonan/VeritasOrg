import "./_group.css";
import { PreviewContent } from "./_shared/PreviewContent";
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowRightLeft, 
  History,
  GraduationCap, 
  LogOut,
  TrendingUp,
  CreditCard,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Command,
  MessageSquare,
  Phone,
  ShieldAlert,
  Snowflake,
  AlertTriangle
} from "lucide-react";
import { cn } from "./_shared/utils";
import { Button } from "./_shared/button";
import { Input } from "./_shared/input";
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
  SidebarInset,
  useSidebar
} from "./_shared/sidebar";
import { Avatar, AvatarFallback } from "./_shared/avatar";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: TrendingUp, label: "Investments", href: "/investments" },
  { icon: ArrowRightLeft, label: "Transfers", href: "/transfers" },
  { icon: History, label: "Transaction history", href: "/transactions" },
  { icon: GraduationCap, label: "Education", href: "/education" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

function ResetSidebarOnRouteChange({ location }: { location: string }) {
  const { setOpen, setOpenMobile } = useSidebar();
  const previousLocation = useRef(location);

  useEffect(() => {
    if (previousLocation.current === location) return;
    previousLocation.current = location;
    setOpen(false);
    setOpenMobile(false);
  }, [location, setOpen, setOpenMobile]);

  return null;
}

function SidebarPanel({ children }: { children: React.ReactNode }) {
  const { isMobile, open, openMobile } = useSidebar();
  // React 18 needs a string for this native HTML boolean attribute.
  const inactive = { inert: !(isMobile ? openMobile : open) };
  return <div {...inactive} id="veritas-side-navigation" className="flex h-full flex-col">{children}</div>;
}

function ShellSidebarToggle({ testId = "sidebar-toggle" }: { testId?: string }) {
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <SidebarTrigger
      data-testid={testId}
      aria-label={expanded ? "Close side navigation" : "Open side navigation"}
      aria-expanded={expanded}
      aria-controls="veritas-side-navigation"
      className="h-11 w-11 shrink-0 rounded-none text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
    />
  );
}


export function Current() {
 const [location,setLocation] = useState("/dashboard");
 const user = { name: "Alex Morgan" };
 const logout = { mutate: () => setLocation("/signed-out"), isPending: false };
 const [sidebarOpen,setSidebarOpen] = useState(false);
 const [topNavigationOpen,setTopNavigationOpen] = useState(false);
 useEffect(() => setTopNavigationOpen(false),[location]);
 const style = { "--sidebar-width": "18rem", "--sidebar-width-icon": "4rem" };
 return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      defaultOpen={false}
      style={style as React.CSSProperties}
    >
      <ResetSidebarOnRouteChange location={location} />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar collapsible="offcanvas" className="wealth-panel border-r border-border/50 bg-zinc-950 text-zinc-100">
          <SidebarPanel>
          <SidebarHeader className="h-20 flex-row items-center justify-between gap-2 px-4 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <img src="/__mockup/images/veritas-logo.jpeg" alt="Logo" className="w-7 h-7 object-contain rounded-sm" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight leading-none">Veritas</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-black mt-1">Wealth Management</span>
              </div>
            </div>
            <ShellSidebarToggle testId="sidebar-close" />
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
                    className="flex-1 bg-white/5 hover:bg-primary/20 text-white/70 hover:text-primary border border-white/5 transition-all rounded-xl h-12 flex flex-col items-center justify-center gap-1 group"
                    onClick={() => window.open("mailto:veritaswealth@accountant.com", "_blank")}
                  >
                    <MessageSquare className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Email Us</span>
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
                         data-funds-action={["/transfers", "/investments"].includes(item.href) ? "" : undefined}
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
          </SidebarPanel>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className={cn(
            "wealth-panel shrink-0 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between z-10 transition-[height,padding] duration-200",
            topNavigationOpen ? "h-16 px-4 md:px-8" : "h-12 px-3 md:px-5"
          )}>
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
              <ShellSidebarToggle />
              <button
                type="button"
                data-testid="top-navigation-toggle"
                aria-label={topNavigationOpen ? "Hide navigation details" : "Show navigation details"}
                aria-expanded={topNavigationOpen}
                aria-controls="veritas-top-navigation-details veritas-top-navigation-actions"
                onClick={() => setTopNavigationOpen((open) => !open)}
                className="flex h-11 min-w-11 items-center justify-center gap-2 border border-white/10 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="hidden sm:inline">{topNavigationOpen ? "Hide details" : "Navigation"}</span>
                {topNavigationOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <div
                id="veritas-top-navigation-details"
                className={cn(
                  topNavigationOpen ? "flex" : "hidden",
                  "min-w-0 flex-1 items-center gap-2 md:gap-3 text-sm font-bold tracking-tight"
                )}
              >
                <span className="hidden md:inline text-white/40 uppercase tracking-widest text-[10px]">Portal</span>
                <ChevronRight className="hidden md:block w-4 h-4 shrink-0 text-white/20" />
                <span className="min-w-0 truncate text-white capitalize">{location.substring(1) || 'Dashboard'}</span>
              </div>
            </div>
            <div id="veritas-top-navigation-actions" className="flex items-center gap-3">
              {topNavigationOpen && (
                <Button
                  type="button"
                  data-testid="header-settings-button"
                  variant="ghost"
                  aria-label="Settings"
                  onClick={() => setLocation("/settings")}
                  className="h-11 w-11 rounded-none border border-white/10 bg-white/5 p-0 text-white/55 hover:border-primary hover:bg-primary hover:text-white"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              )}
            </div>
          </header>

 <main className="flex-1 overflow-auto p-4"><PreviewContent location={location} /></main>
 </SidebarInset></div></SidebarProvider>
 );
}
