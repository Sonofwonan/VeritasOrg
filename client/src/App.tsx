import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard";
import AccountsPage from "@/pages/accounts-page";
import AccountDetailPage from "@/pages/account-detail";
import InvestmentsPage from "@/pages/investments-page";
import TransfersPage from "@/pages/transfers-page";
import GoalsPage from "@/pages/goals-page";
import EducationPage from "@/pages/education-page";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/accounts">
        {() => <ProtectedRoute component={AccountsPage} />}
      </Route>
      <Route path="/accounts/:id">
        {() => <ProtectedRoute component={AccountDetailPage} />}
      </Route>
      <Route path="/investments">
        {() => <ProtectedRoute component={InvestmentsPage} />}
      </Route>
      <Route path="/transfers">
        {() => <ProtectedRoute component={TransfersPage} />}
      </Route>
      <Route path="/goals">
        {() => <ProtectedRoute component={GoalsPage} />}
      </Route>
      <Route path="/education">
        {() => <ProtectedRoute component={EducationPage} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
