import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { BrandedLoader } from "@/components/branded-loader";
import { SessionLoadError } from "@/components/session-load-error";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard";
import AccountsPage from "@/pages/accounts-page";
import AccountDetailPage from "@/pages/account-detail";
import InvestmentsPage from "@/pages/investments-page";
import TransfersPage from "@/pages/transfers-page";
import TransactionsPage from "@/pages/transactions-page";
import CardsPage from "@/pages/cards-page";
import SettingsPage from "@/pages/settings-page";
import CompanyPage from "@/pages/company-page";
import AdminPage from "@/pages/admin-page";
import AccountActivationPage from "@/pages/account-activation";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading, hasSessionError, retrySession } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !hasSessionError && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, hasSessionError, setLocation]);

  if (isLoading) {
    return <BrandedLoader />;
  }

  if (hasSessionError) return <SessionLoadError onRetry={retrySession} />;

  if (!user) return null;

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/company" component={CompanyPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/activate" component={AccountActivationPage} />

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
      <Route path="/transactions">
        {() => <ProtectedRoute component={TransactionsPage} />}
      </Route>
      <Route path="/cards">
        {() => <ProtectedRoute component={CardsPage} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={SettingsPage} profile />}
      </Route>

      <Route path="/admin" component={AdminPage} />
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
