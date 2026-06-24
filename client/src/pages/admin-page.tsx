import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Users, ArrowLeftRight, Clock, TrendingUp, CheckCircle2,
  XCircle, ShieldCheck, LogOut, Wallet, Eye, EyeOff,
  RefreshCw, DollarSign, Activity, FileText, ChevronDown, ChevronUp, Building2,
  Lock, Unlock
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog as ShadDialog, DialogContent as ShadDialogContent, DialogHeader as ShadDialogHeader, DialogTitle as ShadDialogTitle, DialogFooter as ShadDialogFooter } from "@/components/ui/dialog";

const SESSION_KEY = "vw_admin_key";

function fmt(amount: string | number) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function adminFetch(path: string, adminKey: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
      ...(options.headers || {}),
    },
  });
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, password);
        onLogin(password);
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-slate-400 mt-1 text-sm">Veritas Wealth Management</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Admin Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                    data-testid="input-admin-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!password || loading}
                data-testid="button-admin-login"
              >
                {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Sign In to Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = "text-primary" }: {
  icon: any; label: string; value: string | number; color?: string;
}) {
  return (
    <Card className="bg-slate-800/40 border-slate-700">
      <CardContent className="flex items-center gap-4 pt-5 pb-5">
        <div className={`p-3 rounded-xl bg-slate-700/50`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-white mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    completed: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    failed: "bg-red-400/10 text-red-400 border-red-400/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[status] || "bg-slate-400/10 text-slate-400 border-slate-400/20"}`}>
      {status}
    </span>
  );
}

// ─── Application Card ──────────────────────────────────────────────────────────
function ApplicationCard({ app, onApprove, onReject, isPending }: {
  app: any; onApprove: (id: number) => void; onReject: (id: number) => void; isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColors: Record<string, string> = {
    pending: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    approved: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    rejected: "bg-red-400/10 text-red-400 border-red-400/20",
  };

  return (
    <div className="rounded-xl bg-slate-700/30 border border-slate-600/50 overflow-hidden" data-testid={`app-card-${app.id}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">{app.fullName}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[app.status] || "bg-slate-400/10 text-slate-400 border-slate-400/20"}`}>
              {app.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
            <span>{app.email}</span>
            <span className="text-slate-600">•</span>
            <span>{app.phone}</span>
            <span className="text-slate-600">•</span>
            <span>{new Date(app.createdAt).toLocaleDateString()}</span>
          </div>
          {app.notes && (
            <p className="mt-1 text-xs text-slate-400 italic">Note: {app.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-white gap-1">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Details
          </Button>
          {app.status === "pending" && (
            <>
              <Button size="sm" disabled={isPending} onClick={() => onApprove(app.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" data-testid={`button-approve-app-${app.id}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => onReject(app.id)}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1" data-testid={`button-reject-app-${app.id}`}>
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-600/50 p-4 bg-slate-800/30">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-xs">
            {[
              ["Date of Birth", app.dateOfBirth],
              ["Nationality", app.nationality],
              ["Address", app.address],
              ["City", app.city],
              ["Country", app.country],
              ["Employment", app.employmentStatus],
              ["Annual Income", app.annualIncome],
              ["Inv. Experience", app.investmentExperience],
              ["Risk Tolerance", app.riskTolerance],
              ["Investment Goal", app.investmentGoal],
              ["Initial Deposit", app.initialDeposit],
              ["Source of Funds", app.sourceOfFunds],
            ].map(([label, value]) => value && (
              <div key={label}>
                <span className="text-slate-500 uppercase tracking-wide">{label}</span>
                <p className="text-slate-200 font-medium capitalize mt-0.5">{String(value).replace(/-/g, " ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const adminGet = useCallback((path: string) =>
    adminFetch(path, adminKey).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || "Request failed");
      return data;
    }), [adminKey]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminGet("/api/admin/stats"),
    refetchInterval: 30000,
  });

  const { data: pendingTxns = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/transactions", "pending"],
    queryFn: () => adminGet("/api/admin/transactions?status=pending"),
    refetchInterval: 15000,
  });

  const { data: allTxns = [], isLoading: allTxnsLoading } = useQuery({
    queryKey: ["/api/admin/transactions"],
    queryFn: () => adminGet("/api/admin/transactions"),
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => adminGet("/api/admin/users"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/transactions/${id}/approve`, adminKey, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Transaction Approved", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve transaction", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/transactions/${id}/reject`, adminKey, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Transaction Rejected", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject transaction", variant: "destructive" }),
  });

  const { data: instTransfers = [], isLoading: instLoading } = useQuery({
    queryKey: ["/api/admin/institutional-transfers"],
    queryFn: () => adminGet("/api/admin/institutional-transfers"),
    refetchInterval: 30000,
  });

  const approveInstMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/institutional-transfers/${id}/approve`, adminKey, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Transfer Approved", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutional-transfers"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve transfer", variant: "destructive" }),
  });

  const rejectInstMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/institutional-transfers/${id}/reject`, adminKey, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Transfer Rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutional-transfers"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject transfer", variant: "destructive" }),
  });

  const { data: allApplications = [], isLoading: appsLoading, refetch: refetchApps } = useQuery({
    queryKey: ["/api/admin/applications"],
    queryFn: () => adminGet("/api/admin/applications"),
    refetchInterval: 30000,
  });

  const approveAppMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      adminFetch(`/api/admin/applications/${id}/approve`, adminKey, {
        method: "POST", body: JSON.stringify({ notes }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Application Approved ✓", description: `Client ID: ${data.userId} — ${data.userName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to approve", variant: "destructive" }),
  });

  const rejectAppMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      adminFetch(`/api/admin/applications/${id}/reject`, adminKey, {
        method: "POST", body: JSON.stringify({ notes }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Application Rejected", description: "Applicant notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject application", variant: "destructive" }),
  });

  const restrictUserMutation = useMutation({
    mutationFn: ({ id, restricted, message }: { id: number; restricted: boolean; message?: string }) =>
      adminFetch(`/api/admin/users/${id}/restrict`, adminKey, {
        method: "POST", body: JSON.stringify({ restricted, message }),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      toast({ title: vars.restricted ? "Access Restricted" : "Access Restored", description: vars.restricted ? "User can no longer sign in." : "User can now sign in again." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update restriction.", variant: "destructive" }),
  });

  const [restrictDialog, setRestrictDialog] = useState<{ user: any } | null>(null);
  const [restrictMsg, setRestrictMsg] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-none">Veritas Wealth</h1>
              <p className="text-slate-400 text-xs mt-0.5">Admin Portal</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div>
          <h2 className="text-white font-semibold mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Total Users" value={statsLoading ? "—" : stats?.userCount ?? 0} />
            <StatCard icon={ArrowLeftRight} label="Transactions" value={statsLoading ? "—" : stats?.txCount ?? 0} />
            <StatCard icon={Clock} label="Pending" value={statsLoading ? "—" : stats?.pendingCount ?? 0} color="text-amber-400" />
            <StatCard icon={DollarSign} label="Total Volume" value={statsLoading ? "—" : fmt(stats?.totalVolume ?? 0)} color="text-emerald-400" />
            <StatCard icon={Wallet} label="Assets Under Mgmt" value={statsLoading ? "—" : fmt(stats?.totalAssets ?? 0)} color="text-sky-400" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="applications">
          <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="applications" className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Applications
              {Array.isArray(allApplications) && allApplications.filter((a: any) => a.status === "pending").length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {allApplications.filter((a: any) => a.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400">
              Pending Txns
              {Array.isArray(pendingTxns) && pendingTxns.length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingTxns.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-txns" className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400">
              All Transactions
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400">
              Users
            </TabsTrigger>
            <TabsTrigger value="inst-transfers" className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Inst. Transfers
              {Array.isArray(instTransfers) && instTransfers.filter((t: any) => t.status === "pending").length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {instTransfers.filter((t: any) => t.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Client Applications ── */}
          <TabsContent value="applications" className="mt-4">
            <Card className="bg-slate-800/40 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Account Applications
                  <Button size="sm" variant="ghost" onClick={() => refetchApps()} className="ml-auto text-slate-400 hover:text-white">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : !Array.isArray(allApplications) || allApplications.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No applications yet</p>
                    <p className="text-slate-500 text-sm mt-1">New applications will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(allApplications) ? allApplications : []).map((app: any) => (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        onApprove={(id) => approveAppMutation.mutate({ id })}
                        onReject={(id) => rejectAppMutation.mutate({ id })}
                        isPending={approveAppMutation.isPending || rejectAppMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pending Approvals ── */}
          <TabsContent value="pending" className="mt-4">
            <Card className="bg-slate-800/40 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Pending Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : !Array.isArray(pendingTxns) || pendingTxns.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
                    <p className="text-slate-400">No pending transactions</p>
                    <p className="text-slate-500 text-sm mt-1">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(pendingTxns) ? pendingTxns : []).map((txn: any) => (
                      <div
                        key={txn.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50"
                        data-testid={`txn-pending-${txn.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold">TXN-{txn.id}</span>
                            <StatusBadge status={txn.status} />
                            <span className="text-xs text-slate-500 capitalize bg-slate-600/40 px-2 py-0.5 rounded-full">{txn.transactionType}</span>
                          </div>
                          <p className="text-slate-300 text-sm mt-1 truncate">{txn.description || "No description"}</p>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                            <span>User: <span className="text-slate-300 font-medium">{txn.userName}</span></span>
                            <span className="text-slate-600">•</span>
                            <span>{txn.userEmail}</span>
                            <span className="text-slate-600">•</span>
                            <span>{new Date(txn.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-white font-bold text-lg whitespace-nowrap">{fmt(txn.amount)}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(txn.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              data-testid={`button-approve-${txn.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMutation.mutate(txn.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1"
                              data-testid={`button-reject-${txn.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── All Transactions ── */}
          <TabsContent value="all-txns" className="mt-4">
            <Card className="bg-slate-800/40 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  All Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allTxnsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                          <th className="text-left py-3 pr-4 font-medium">ID</th>
                          <th className="text-left py-3 pr-4 font-medium">User</th>
                          <th className="text-left py-3 pr-4 font-medium">Type</th>
                          <th className="text-left py-3 pr-4 font-medium">Description</th>
                          <th className="text-right py-3 pr-4 font-medium">Amount</th>
                          <th className="text-left py-3 pr-4 font-medium">Status</th>
                          <th className="text-left py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {(allTxns as any[]).map((txn: any) => (
                          <tr key={txn.id} className="hover:bg-slate-700/20" data-testid={`txn-row-${txn.id}`}>
                            <td className="py-3 pr-4 text-slate-300 font-mono text-xs">TXN-{txn.id}</td>
                            <td className="py-3 pr-4">
                              <div className="text-slate-200 font-medium">{txn.userName}</div>
                              <div className="text-slate-500 text-xs">{txn.userEmail}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="capitalize text-slate-300">{txn.transactionType}</span>
                            </td>
                            <td className="py-3 pr-4 text-slate-400 max-w-[200px] truncate">{txn.description || "—"}</td>
                            <td className="py-3 pr-4 text-right font-semibold text-white whitespace-nowrap">{fmt(txn.amount)}</td>
                            <td className="py-3 pr-4"><StatusBadge status={txn.status} /></td>
                            <td className="py-3 text-slate-500 text-xs whitespace-nowrap">
                              {new Date(txn.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(allTxns as any[]).length === 0 && (
                      <p className="text-center text-slate-400 py-8">No transactions yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Users ── */}
          <TabsContent value="users" className="mt-4">
            {/* Restrict dialog */}
            <ShadDialog open={!!restrictDialog} onOpenChange={(o) => { if (!o) { setRestrictDialog(null); setRestrictMsg(""); } }}>
              <ShadDialogContent className="bg-slate-800 border-slate-700 text-white">
                <ShadDialogHeader>
                  <ShadDialogTitle className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-400" />
                    Restrict Login — {restrictDialog?.user?.name}
                  </ShadDialogTitle>
                </ShadDialogHeader>
                <div className="space-y-3 py-2">
                  <p className="text-slate-400 text-sm">This user will be blocked from signing in. Optionally add a message they will see when they attempt to log in.</p>
                  <Textarea
                    value={restrictMsg}
                    onChange={e => setRestrictMsg(e.target.value)}
                    placeholder="e.g. Your account has been suspended pending KYC review. Please contact your advisor at advisor@veritaswealth.ca."
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 min-h-[100px] resize-none"
                  />
                </div>
                <ShadDialogFooter>
                  <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => { setRestrictDialog(null); setRestrictMsg(""); }}>Cancel</Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={restrictUserMutation.isPending}
                    onClick={() => {
                      restrictUserMutation.mutate({ id: restrictDialog!.user.id, restricted: true, message: restrictMsg || undefined }, {
                        onSuccess: () => { setRestrictDialog(null); setRestrictMsg(""); }
                      });
                    }}
                  >
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Restrict Access
                  </Button>
                </ShadDialogFooter>
              </ShadDialogContent>
            </ShadDialog>

            <Card className="bg-slate-800/40 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  All Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(allUsers as any[]).map((u: any) => (
                      <div key={u.id} className={`rounded-lg border p-4 ${u.loginRestricted ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-700/20"}`} data-testid={`user-row-${u.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${u.loginRestricted ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"}`}>
                              {u.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-medium text-sm">{u.name}</span>
                                <span className="text-slate-500 font-mono text-xs">#{u.id}</span>
                                {u.loginRestricted && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/20">
                                    <Lock className="w-2.5 h-2.5" /> RESTRICTED
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-400 text-xs mt-0.5">{u.email}</p>
                              {u.loginRestricted && u.loginRestrictionMessage && (
                                <p className="text-red-400/70 text-xs mt-1 italic">"{u.loginRestrictionMessage}"</p>
                              )}
                              <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                                <span>{u.accountCount} account{u.accountCount !== 1 ? "s" : ""}</span>
                                <span className="text-emerald-400 font-medium">{fmt(u.totalBalance)}</span>
                                <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {u.loginRestricted ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs h-8"
                                disabled={restrictUserMutation.isPending}
                                onClick={() => restrictUserMutation.mutate({ id: u.id, restricted: false })}
                              >
                                <Unlock className="w-3 h-3 mr-1" /> Restore Access
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs h-8"
                                onClick={() => { setRestrictDialog({ user: u }); setRestrictMsg(""); }}
                              >
                                <Lock className="w-3 h-3 mr-1" /> Restrict
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(allUsers as any[]).length === 0 && (
                      <p className="text-center text-slate-400 py-8">No users yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── Institutional Transfers ── */}
          <TabsContent value="inst-transfers" className="mt-4">
            <Card className="bg-slate-800/40 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Institutional Transfer Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {instLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : !Array.isArray(instTransfers) || instTransfers.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No institutional transfer requests</p>
                    <p className="text-slate-500 text-sm mt-1">Requests from clients will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(instTransfers) ? instTransfers : []).map((t: any) => (
                      <div
                        key={t.id}
                        className="rounded-xl bg-slate-700/30 border border-slate-600/50 p-4"
                        data-testid={`inst-transfer-admin-${t.id}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-semibold">IT-{t.id}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize
                                ${t.status === "approved" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                                : t.status === "rejected" ? "bg-red-400/10 text-red-400 border-red-400/20"
                                : "bg-amber-400/10 text-amber-400 border-amber-400/20"}`}>
                                {t.status}
                              </span>
                              <span className="text-xs text-slate-400 bg-slate-600/40 px-2 py-0.5 rounded-full capitalize">
                                {t.transferType === "in-kind" ? "In-Kind" : "Cash"} · {t.transferScope}
                              </span>
                            </div>
                            <p className="text-slate-200 font-medium text-sm mt-1">{t.institutionName}</p>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                              <span>Client: <span className="text-slate-300 font-medium">{t.userName}</span></span>
                              <span className="text-slate-600">·</span>
                              <span>{t.userEmail}</span>
                              <span className="text-slate-600">·</span>
                              <span>Acct #{t.accountId} ({t.accountType})</span>
                              <span className="text-slate-600">·</span>
                              <span>{new Date(t.createdAt).toLocaleDateString("en-CA")}</span>
                            </div>
                            {t.partialAmount && (
                              <p className="text-xs text-slate-400 mt-1">Partial amount: <span className="text-slate-200 font-medium">CAD ${Number(t.partialAmount).toLocaleString()}</span></p>
                            )}
                            {t.status === "approved" && t.estimatedCompletionDate && (
                              <p className="text-xs text-emerald-400 mt-1">Est. completion: {new Date(t.estimatedCompletionDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</p>
                            )}
                          </div>
                          {t.status === "pending" && (
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => approveInstMutation.mutate(t.id)}
                                disabled={approveInstMutation.isPending || rejectInstMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                data-testid={`button-approve-inst-${t.id}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectInstMutation.mutate(t.id)}
                                disabled={approveInstMutation.isPending || rejectInstMutation.isPending}
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1"
                                data-testid={`button-reject-inst-${t.id}`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Admin Page (entry point) ─────────────────────────────────────────────────
export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));

  const handleLogin = (key: string) => setAdminKey(key);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminKey(null);
  };

  if (!adminKey) return <AdminLogin onLogin={handleLogin} />;
  return <AdminDashboard adminKey={adminKey} onLogout={handleLogout} />;
}
