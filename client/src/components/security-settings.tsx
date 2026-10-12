import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle, Check, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { securityPaths, type RecoveryResult, type SecurityStatus, type SetupResult } from "@shared/security";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DialogStep = "password" | "setup" | "disable" | "recovery" | null;
type PasswordFields = { currentPassword: string; newPassword: string; confirmPassword: string; code: string };
type ReauthFields = { currentPassword: string; code: string };

const emptyPassword: PasswordFields = { currentPassword: "", newPassword: "", confirmPassword: "", code: "" };
const emptyReauth: ReauthFields = { currentPassword: "", code: "" };

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

function SecurityField({ id, label, type = "text", value, onChange, autoComplete, maxLength }: {
  id: string; label: string; type?: string; value: string; onChange: (value: string) => void;
  autoComplete?: string; maxLength?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="min-h-11"
      />
    </div>
  );
}

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [dialog, setDialog] = useState<DialogStep>(null);
  const [passwordFields, setPasswordFields] = useState<PasswordFields>(emptyPassword);
  const [reauthFields, setReauthFields] = useState<ReauthFields>(emptyReauth);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const statusQuery = useQuery<SecurityStatus>({
    queryKey: [securityPaths.status],
    queryFn: async () => (await apiRequest("GET", securityPaths.status)).json(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const status = statusQuery.data;

  const passwordMutation = useMutation({
    gcTime: 0,
    mutationFn: async (payload: PasswordFields) => {
      const body = {
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
        confirmPassword: payload.confirmPassword,
        ...(payload.code.trim() ? { code: payload.code.trim() } : {}),
      };
      const response = await apiRequest("POST", securityPaths.password, body);
      return response.json().catch(() => ({}));
    },
    onSuccess: () => {
      setDialog(null);
      setPasswordFields(emptyPassword);
      passwordMutation.reset();
      queryClient.clear();
      setLocation("/auth?passwordChanged=1");
    },
    onError: (e: Error) => setError(messageFrom(e, "We could not change your password. Please try again.")),
  });

  const setupMutation = useMutation<SetupResult, Error, { currentPassword: string }>({
    gcTime: 0,
    mutationFn: async body => (await apiRequest("POST", securityPaths.setup, body)).json(),
    onError: e => setError(messageFrom(e, "We could not start two-factor setup. Please try again.")),
  });
  const confirmMutation = useMutation({
    gcTime: 0,
    mutationFn: async (code: string) => (await apiRequest("POST", securityPaths.confirm, { code })).json() as Promise<RecoveryResult>,
    onSuccess: async result => {
      setSetupResult(null);
      setDialog(null);
      setReauthFields(emptyReauth);
      disableMutation.reset();
      setRecoveryCodes(result.recoveryCodes);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [securityPaths.status] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
    },
    onError: e => setError(messageFrom(e, "That code could not be verified. Check it and try again.")),
  });
  const disableMutation = useMutation({
    gcTime: 0,
    mutationFn: async (body: ReauthFields) => (await apiRequest("POST", securityPaths.disable, body)).json(),
    onSuccess: async () => {
      setDialog(null);
      setReauthFields(emptyReauth);
      disableMutation.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [securityPaths.status] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
    },
    onError: e => setError(messageFrom(e, "Two-factor sign-in could not be turned off. Please try again.")),
  });
  const recoveryMutation = useMutation<RecoveryResult, Error, ReauthFields>({
    gcTime: 0,
    mutationFn: async body => (await apiRequest("POST", securityPaths.recovery, body)).json(),
    onSuccess: result => {
      setRecoveryCodes(result.recoveryCodes);
      setDialog(null);
      setReauthFields(emptyReauth);
      recoveryMutation.reset();
      queryClient.invalidateQueries({ queryKey: [securityPaths.status] });
    },
    onError: e => setError(messageFrom(e, "New recovery codes could not be created. Please try again.")),
  });

  const pending = passwordMutation.isPending || setupMutation.isPending || confirmMutation.isPending ||
    disableMutation.isPending || recoveryMutation.isPending;

  const resetDialog = () => {
    setDialog(null);
    setPasswordFields(emptyPassword);
    setReauthFields(emptyReauth);
    setSetupResult(null);
    setError("");
    setCopied(false);
    setupMutation.reset();
    confirmMutation.reset();
    passwordMutation.reset();
    disableMutation.reset();
    recoveryMutation.reset();
  };

  const beginSetup = async () => {
    if (setupMutation.isPending) return;
    setError("");
    const currentPassword = reauthFields.currentPassword;
    try {
      const result = await setupMutation.mutateAsync({ currentPassword });
      setSetupResult(result);
      setReauthFields(emptyReauth);
      setupMutation.reset();
    } catch {
      // Error is presented inline by the mutation.
    }
  };

  const closeRecoveryCodes = () => {
    setRecoveryCodes(null);
    setCopied(false);
    confirmMutation.reset();
    recoveryMutation.reset();
  };

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
    } catch {
      setError("Copy is not available here. Select and copy the codes instead.");
    }
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordMutation.isPending) return;
    setError("");
    if (passwordFields.newPassword.length < 12 || passwordFields.newPassword.length > 128) {
      setError("Choose a password between 12 and 128 characters.");
      return;
    }
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (status?.twoFactorEnabled && !passwordFields.code.trim()) {
      setError("Enter a code from your authenticator app or a recovery code.");
      return;
    }
    passwordMutation.mutate(passwordFields);
  };

  const submitDisable = (event: React.FormEvent) => {
    event.preventDefault();
    if (disableMutation.isPending) return;
    setError("");
    disableMutation.mutate(reauthFields);
  };

  const submitRecovery = (event: React.FormEvent) => {
    event.preventDefault();
    if (recoveryMutation.isPending) return;
    setError("");
    recoveryMutation.mutate(reauthFields);
  };

  return (
    <>
      <Card data-testid="security-status">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary/15 bg-primary/5 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Account security</CardTitle>
              <CardDescription className="mt-1">Manage how you sign in and protect your account.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {statusQuery.isLoading ? (
            <div aria-label="Loading security status" className="space-y-3">
              <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-64 max-w-full animate-pulse rounded-sm bg-muted" />
            </div>
          ) : statusQuery.isError ? (
            <div className="flex flex-col gap-3 rounded-sm border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">Your security settings could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()}>Try again</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-sm border border-border bg-background/70 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">Authenticator sign-in</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {status?.twoFactorEnabled
                      ? `On. You have ${status.recoveryCodesRemaining} recovery ${status.recoveryCodesRemaining === 1 ? "code" : "codes"} available.`
                      : status?.setupRequired
                        ? "A previous preference is on, but authenticator setup was not completed. Set it up here to protect sign-in."
                        : "Use a code from an authenticator app when signing in."}
                  </p>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 border px-2.5 py-1 text-xs font-medium ${status?.twoFactorEnabled ? "border-primary/25 bg-primary/5 text-primary" : "border-border bg-muted/40 text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status?.twoFactorEnabled ? "bg-primary" : "bg-muted-foreground/50"}`} />
                  {status?.twoFactorEnabled ? "Enabled" : "Not enabled"}
                </span>
              </div>

              {status?.twoFactorEnabled ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">Recovery codes</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create a new set if you no longer have your codes. This replaces the old set.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    data-testid="security-replace-recovery"
                    onClick={() => { setError(""); setReauthFields(emptyReauth); setDialog("recovery"); }}
                  >
                    <RefreshCw className="h-4 w-4" /> Replace codes
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{status?.twoFactorEnabled ? "Turn off authenticator sign-in" : "Set up authenticator sign-in"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status?.twoFactorEnabled
                      ? "Your password and a current code are required."
                      : "Use an authenticator app on your phone. Setup takes a moment."}
                  </p>
                </div>
                {status?.twoFactorEnabled ? (
                  <Button variant="outline" className="w-full sm:w-auto" data-testid="security-disable-two-factor"
                    onClick={() => { setError(""); setReauthFields(emptyReauth); setDialog("disable"); }}>
                    Turn off
                  </Button>
                ) : (
                  <Button className="w-full gap-2 sm:w-auto" data-testid="security-setup-two-factor"
                    onClick={() => { setError(""); setReauthFields(emptyReauth); setSetupResult(null); setDialog("setup"); }}>
                    <KeyRound className="h-4 w-4" /> Set up
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose a strong password you do not use elsewhere.</p>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" data-testid="security-change-password"
              onClick={() => { setError(""); setPasswordFields(emptyPassword); setDialog("password"); }}>
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !pending) resetDialog(); }}>
        <DialogContent data-testid="security-dialog" className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          {dialog === "password" && (
            <form onSubmit={submitPassword} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Change your password</DialogTitle>
                <DialogDescription>For your protection, all signed-in devices will need to sign in again after this change.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <SecurityField id="security-current-password" label="Current password" type="password" autoComplete="current-password"
                  value={passwordFields.currentPassword} onChange={value => setPasswordFields(fields => ({ ...fields, currentPassword: value }))} />
                <SecurityField id="security-new-password" label="New password" type="password" autoComplete="new-password" maxLength={128}
                  value={passwordFields.newPassword} onChange={value => setPasswordFields(fields => ({ ...fields, newPassword: value }))} />
                <p className="-mt-2 text-xs text-muted-foreground">Use 12 to 128 characters.</p>
                <SecurityField id="security-confirm-password" label="Confirm new password" type="password" autoComplete="new-password" maxLength={128}
                  value={passwordFields.confirmPassword} onChange={value => setPasswordFields(fields => ({ ...fields, confirmPassword: value }))} />
                {status?.twoFactorEnabled && (
                  <SecurityField id="security-password-code" label="Authenticator or recovery code" autoComplete="one-time-code" maxLength={64}
                    value={passwordFields.code} onChange={value => setPasswordFields(fields => ({ ...fields, code: value }))} />
                )}
              </div>
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={pending}>Cancel</Button>
                <Button type="submit" data-testid="security-change-password-submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Change password
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialog === "setup" && !setupResult && (
            <form onSubmit={event => { event.preventDefault(); void beginSetup(); }} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Set up authenticator sign-in</DialogTitle>
                <DialogDescription>Enter your current password to begin. You will confirm a code before this is turned on.</DialogDescription>
              </DialogHeader>
              <SecurityField id="security-setup-current-password" label="Current password" type="password" autoComplete="current-password"
                value={reauthFields.currentPassword} onChange={value => setReauthFields(fields => ({ ...fields, currentPassword: value }))} />
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={setupMutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={setupMutation.isPending}>
                  {setupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialog === "setup" && setupResult && (
            <form onSubmit={event => { event.preventDefault(); if (!confirmMutation.isPending) confirmMutation.mutate(reauthFields.code); }} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Connect your authenticator app</DialogTitle>
                <DialogDescription>Scan this QR code with your authenticator app, then enter the six-digit code it shows.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-sm border border-border bg-white p-3">
                <img src={setupResult.qrCodeDataUrl} alt="Authenticator setup QR code" className="h-48 w-48 max-w-full object-contain" />
              </div>
              <details className="rounded-sm border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">Enter key manually</summary>
                <p className="mt-2 break-all font-mono text-xs tracking-wide" aria-label="Authenticator setup key">{setupResult.secret}</p>
              </details>
              <SecurityField id="security-setup-code" label="Six-digit authenticator code" autoComplete="one-time-code" maxLength={6}
                value={reauthFields.code} onChange={value => setReauthFields(fields => ({ ...fields, code: value.replace(/\D/g, "").slice(0, 6) }))} />
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={confirmMutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={confirmMutation.isPending || reauthFields.code.length !== 6}>
                  {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify and turn on
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialog === "disable" && (
            <form onSubmit={submitDisable} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Turn off authenticator sign-in?</DialogTitle>
                <DialogDescription>You will no longer need an authenticator code when you sign in. Enter your password and a current code to continue.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <SecurityField id="security-disable-password" label="Current password" type="password" autoComplete="current-password"
                  value={reauthFields.currentPassword} onChange={value => setReauthFields(fields => ({ ...fields, currentPassword: value }))} />
                <SecurityField id="security-disable-code" label="Authenticator or recovery code" autoComplete="one-time-code" maxLength={64}
                  value={reauthFields.code} onChange={value => setReauthFields(fields => ({ ...fields, code: value }))} />
              </div>
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={disableMutation.isPending}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                  {disableMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Turn off
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialog === "recovery" && (
            <form onSubmit={submitRecovery} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Replace recovery codes</DialogTitle>
                <DialogDescription>This creates a new set and immediately makes your old recovery codes unusable. Other signed-in devices will be signed out.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <SecurityField id="security-recovery-password" label="Current password" type="password" autoComplete="current-password"
                  value={reauthFields.currentPassword} onChange={value => setReauthFields(fields => ({ ...fields, currentPassword: value }))} />
                <SecurityField id="security-recovery-code" label="Authenticator or recovery code" autoComplete="one-time-code" maxLength={64}
                  value={reauthFields.code} onChange={value => setReauthFields(fields => ({ ...fields, code: value }))} />
              </div>
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={recoveryMutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={recoveryMutation.isPending}>
                  {recoveryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Replace codes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryCodes !== null} onOpenChange={open => { if (!open) closeRecoveryCodes(); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{status?.twoFactorEnabled ? "Save your new recovery codes" : "Save your recovery codes"}</DialogTitle>
            <DialogDescription>Each code can be used once if you cannot access your authenticator app. Keep them private and store them somewhere safe. You will not be able to see them again.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-muted/30 p-3 sm:p-4" aria-label="One-time recovery codes">
            {recoveryCodes?.map((code, index) => (
              <code key={`${index}-${code}`} className="break-all rounded-sm bg-background px-2 py-2 text-center font-mono text-sm tracking-wide">{code}</code>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={copyRecoveryCodes} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy codes"}
            </Button>
            <Button onClick={closeRecoveryCodes}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
