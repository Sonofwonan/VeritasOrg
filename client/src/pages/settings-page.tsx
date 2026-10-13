import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, Check, ChevronRight, LockKeyhole, LogOut, Mail, MapPin, PencilLine, Phone, Shield, UserRound } from "lucide-react";
import { contactDetailsPath, contactDetailsSchema, type Address, type ContactDetails } from "@shared/client-settings";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { SecuritySettings } from "@/components/security-settings";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Preferences = { marketingEmails: boolean; securityAlerts: boolean };
type ContactPayload = ContactDetails & { currentPassword: string; code?: string };
const blankAddress = (): Address => ({ line1: "", line2: "", city: "", region: "", postalCode: "", country: "" });
const emptyContact = (): ContactDetails => ({ email: "", phoneNumber: "", residentialAddress: null, mailingAddress: null });
const advisorEmail = "veritaswealth@accountant.com";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

function formatAddress(address: Address | null) {
  if (!address) return "Not provided";
  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country]
    .filter(Boolean).join(", ");
}

function ContactInput({ id, label, value, onChange, type = "text", autoComplete, error }: {
  id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; error?: string;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} className="h-11 rounded-sm border-border bg-background" />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AddressFields({ title, address, onChange, errors }: { title: string; address: Address; onChange: (address: Address) => void; errors: Record<string, string> }) {
  const change = (key: keyof Address, value: string) => onChange({ ...address, [key]: value });
  const prefix = title === "Residential address" ? "residentialAddress" : "mailingAddress";
  return (
    <fieldset className="space-y-4 border-t border-border pt-5">
      <legend className="mb-1 pr-3 text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><ContactInput id={`${prefix}-line1`} label="Address line 1" autoComplete="address-line1" value={address.line1} onChange={value => change("line1", value)} error={errors[`${prefix}.line1`]} /></div>
        <div className="sm:col-span-2"><ContactInput id={`${prefix}-line2`} label="Address line 2 (optional)" autoComplete="address-line2" value={address.line2} onChange={value => change("line2", value)} error={errors[`${prefix}.line2`]} /></div>
        <ContactInput id={`${prefix}-city`} label="Town or city" autoComplete="address-level2" value={address.city} onChange={value => change("city", value)} error={errors[`${prefix}.city`]} />
        <ContactInput id={`${prefix}-region`} label="County / region (optional)" autoComplete="address-level1" value={address.region} onChange={value => change("region", value)} error={errors[`${prefix}.region`]} />
        <ContactInput id={`${prefix}-postal`} label="Postcode / postal code" autoComplete="postal-code" value={address.postalCode} onChange={value => change("postalCode", value)} error={errors[`${prefix}.postalCode`]} />
        <ContactInput id={`${prefix}-country`} label="Country" autoComplete="country-name" value={address.country} onChange={value => change("country", value)} error={errors[`${prefix}.country`]} />
      </div>
    </fieldset>
  );
}

export default function SettingsPage({ profile = false }: { profile?: boolean } = {}) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDetails>(emptyContact);
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [contactError, setContactError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [contactSaved, setContactSaved] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({ marketingEmails: false, securityAlerts: false });
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const preferencesInitialized = useRef(false);

  const contactQuery = useQuery<ContactDetails>({
    queryKey: [contactDetailsPath],
    queryFn: async () => (await apiRequest("GET", contactDetailsPath)).json(),
  });

  useEffect(() => {
    if (user && !preferencesInitialized.current) {
      preferencesInitialized.current = true;
      setPreferences({ marketingEmails: user.marketingEmails ?? false, securityAlerts: user.securityAlerts ?? false });
    }
  }, [user]);

  const saveContact = useMutation({
    gcTime: 0,
    mutationFn: async (payload: ContactPayload) => (await apiRequest("PATCH", contactDetailsPath, payload)).json() as Promise<ContactDetails>,
    onSuccess: async saved => {
      queryClient.setQueryData([contactDetailsPath], saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [contactDetailsPath] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
      setEditing(false);
      setCurrentPassword("");
      setCode("");
      setContactError("");
      setFieldErrors({});
      setContactSaved(true);
      saveContact.reset();
    },
    onError: error => {
      setContactError(errorMessage(error, "Your contact details could not be saved. Please try again."));
      saveContact.reset();
    },
  });

  const savePreferences = useMutation({
    mutationFn: async (payload: Preferences) => (await apiRequest("PATCH", "/api/user", payload)).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setPreferencesError("");
      setPreferencesSaved(true);
    },
    onError: error => setPreferencesError(errorMessage(error, "Your preferences could not be saved. Please try again.")),
  });

  const startEditing = () => {
    const contact = contactQuery.data ?? emptyContact();
    setDraft({
      ...contact,
      residentialAddress: contact.residentialAddress ? { ...contact.residentialAddress } : null,
      mailingAddress: contact.mailingAddress ? { ...contact.mailingAddress } : null,
    });
    setCurrentPassword("");
    setCode("");
    setContactError("");
    setFieldErrors({});
    setContactSaved(false);
    setEditing(true);
  };

  const submitContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveContact.isPending) return;
    setContactError("");
    setFieldErrors({});
    const parsed = contactDetailsSchema.safeParse(draft);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      setContactError("Please review the highlighted contact details.");
      return;
    }
    if (!currentPassword) {
      setContactError("Enter your current password to confirm these changes.");
      return;
    }
    if (user?.twoFactorEnabled && !code.trim()) {
      setContactError("Enter an authenticator or recovery code to confirm these changes.");
      return;
    }
    saveContact.mutate({
      ...parsed.data,
      currentPassword,
      ...(user?.twoFactorEnabled ? { code: code.trim() } : {}),
    });
  };

  const setAddress = (kind: "residentialAddress" | "mailingAddress", address: Address | null) =>
    setDraft(value => ({ ...value, [kind]: address }));

  const name = user?.name?.trim() || "Name not available";

  return (
    <LayoutShell>
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <header className="mb-7 border-b border-border pb-6 sm:mb-9 sm:pb-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Veritas Wealth · Client services</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{profile ? "Personal profile" : "Account settings"}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Keep your contact details current and manage how we communicate with you.</p>
            </div>
            <div className="flex items-center gap-2 border-l-2 border-primary/60 pl-3 text-sm text-muted-foreground">
              <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true" />
              Private client access
            </div>
          </div>
          {profile && (
            <section aria-label="Your profile" className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-foreground" data-testid="text-profile-name">{name}</p>
                  <p className="text-sm text-muted-foreground">Private client</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={logout.isPending} onClick={() => logout.mutate()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {logout.isPending ? "Signing out…" : "Sign out"}
              </Button>
              {logout.isError && <p role="alert" className="w-full text-sm text-destructive">Couldn’t sign out. Please try again.</p>}
            </section>
          )}
        </header>

        <Tabs defaultValue="contact" className="space-y-6 sm:space-y-8">
          <TabsList aria-label="Account settings sections" className="grid h-auto w-full grid-cols-2 gap-1 rounded-sm bg-primary/5 p-1 sm:w-fit sm:grid-cols-4">
            <TabsTrigger value="contact" className="min-h-11 gap-2 rounded-sm px-3 text-xs sm:px-5 sm:text-sm"><UserRound className="h-4 w-4" />Contact details</TabsTrigger>
            <TabsTrigger value="security" className="min-h-11 gap-2 rounded-sm px-3 text-xs sm:px-5 sm:text-sm"><Shield className="h-4 w-4" />Security</TabsTrigger>
            <TabsTrigger value="preferences" className="min-h-11 gap-2 rounded-sm px-3 text-xs sm:px-5 sm:text-sm"><Mail className="h-4 w-4" />Preferences</TabsTrigger>
            <TabsTrigger value="support" className="min-h-11 gap-2 rounded-sm px-3 text-xs sm:px-5 sm:text-sm"><Phone className="h-4 w-4" />Assistance</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="m-0 space-y-5">
            <section aria-labelledby="identity-heading" className="grid gap-5 border-y border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] sm:gap-10 sm:py-7">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Identity</p>
                <h2 id="identity-heading" className="text-xl font-bold tracking-tight">Legal name</h2>
                <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">Your legal name is held on your client record and can’t be changed here.</p>
              </div>
              <div className="flex min-w-0 flex-col justify-center border-l-2 border-primary/35 pl-4">
                <span className="text-xs font-medium text-muted-foreground">Name on your account</span>
                <span className="mt-1 break-words text-lg font-semibold text-foreground">{name}</span>
                <a className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${advisorEmail}?subject=${encodeURIComponent("Legal name change request")}`}>
                  Ask your advisor to change your legal name <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </section>

            <section aria-labelledby="contact-heading" className="border-b border-border pb-6">
              <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Personal information</p>
                  <h2 id="contact-heading" className="text-xl font-bold tracking-tight">Contact details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Your current email, phone and address for correspondence.</p>
                </div>
                {!editing && !contactQuery.isLoading && !contactQuery.isError && (
                  <Button variant="outline" className="min-h-11 w-full gap-2 rounded-sm border-primary/35 sm:w-auto" onClick={startEditing}>
                    <PencilLine className="h-4 w-4" /> Edit details
                  </Button>
                )}
              </div>

              {contactQuery.isLoading ? (
                <div aria-label="Loading contact details" className="space-y-4 py-5">
                  <div className="h-4 w-40 animate-pulse bg-muted" /><div className="h-4 w-64 max-w-full animate-pulse bg-muted" /><div className="h-4 w-52 max-w-full animate-pulse bg-muted" />
                </div>
              ) : contactQuery.isError ? (
                <div role="alert" className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground">Contact details couldn’t be loaded. Your saved information has not been changed.</p>
                  <Button variant="outline" onClick={() => contactQuery.refetch()}>Try again</Button>
                </div>
              ) : editing ? (
                <form onSubmit={submitContact} className="space-y-5 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <ContactInput id="contact-email" label="Contact email" type="email" autoComplete="email" value={draft.email} onChange={email => { setDraft(value => ({ ...value, email })); setContactSaved(false); }} />
                      {fieldErrors.email && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>}
                    </div>
                    <div>
                      <ContactInput id="contact-phone" label="Phone number" type="tel" autoComplete="tel" value={draft.phoneNumber} onChange={phoneNumber => { setDraft(value => ({ ...value, phoneNumber })); setContactSaved(false); }} />
                      {fieldErrors.phoneNumber && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.phoneNumber}</p>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {draft.residentialAddress ? (
                      <AddressFields title="Residential address" address={draft.residentialAddress} onChange={address => setAddress("residentialAddress", address)} errors={fieldErrors} />
                    ) : (
                      <button type="button" onClick={() => setAddress("residentialAddress", blankAddress())} className="flex min-h-12 w-full items-center justify-between border-y border-border py-3 text-left text-sm font-semibold text-primary hover:text-primary/80">
                        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Add residential address</span><ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    {draft.mailingAddress ? (
                      <>
                        <AddressFields title="Separate mailing address" address={draft.mailingAddress} onChange={address => setAddress("mailingAddress", address)} errors={fieldErrors} />
                        <Button type="button" variant="ghost" className="min-h-10 text-muted-foreground" onClick={() => setAddress("mailingAddress", null)}>Remove separate mailing address</Button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setAddress("mailingAddress", blankAddress())} className="flex min-h-12 w-full items-center justify-between border-y border-border py-3 text-left text-sm font-semibold text-primary hover:text-primary/80">
                        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Add a separate mailing address</span><ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    {fieldErrors.residentialAddress && <p className="text-xs text-destructive">{fieldErrors.residentialAddress}</p>}
                    {fieldErrors.mailingAddress && <p className="text-xs text-destructive">{fieldErrors.mailingAddress}</p>}
                  </div>

                  <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    <ContactInput id="contact-current-password" label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
                    {user?.twoFactorEnabled && <ContactInput id="contact-auth-code" label="Authenticator or recovery code" autoComplete="one-time-code" value={code} onChange={setCode} />}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">For your protection, confirm contact changes with your password{user?.twoFactorEnabled ? " and an authenticator or recovery code" : ""}.</p>

                  {contactError && <p role="alert" className="flex gap-2 border-l-2 border-destructive px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{contactError}</p>}
                  <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" className="min-h-11 rounded-sm" disabled={saveContact.isPending} onClick={() => { setEditing(false); setCurrentPassword(""); setCode(""); setContactError(""); setFieldErrors({}); }}>Cancel</Button>
                    <Button type="submit" className="min-h-11 rounded-sm" disabled={saveContact.isPending}>
                      {saveContact.isPending ? "Saving…" : "Save contact details"}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {contactSaved && <p role="status" className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><Check className="h-4 w-4" />Contact details saved.</p>}
                  <dl className="divide-y divide-border border-y border-border">
                    <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-5"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Contact email</dt><dd className="break-words text-sm font-medium">{contactQuery.data?.email || "Not provided"}</dd></div>
                    <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-5"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Phone number</dt><dd className="break-words text-sm font-medium">{contactQuery.data?.phoneNumber || "Not provided"}</dd></div>
                    <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-5"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Residential address</dt><dd className="break-words text-sm font-medium leading-6">{formatAddress(contactQuery.data?.residentialAddress ?? null)}</dd></div>
                    <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-5"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mailing address</dt><dd className="break-words text-sm font-medium leading-6">{formatAddress(contactQuery.data?.mailingAddress ?? null)}</dd></div>
                  </dl>
                </>
              )}
            </section>
          </TabsContent>

          <TabsContent value="security" className="m-0">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="preferences" className="m-0">
            <section className="max-w-3xl border-y border-border py-6 sm:py-8">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Communication</p>
              <h2 className="text-xl font-bold tracking-tight">Your preferences</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Choose your preferences for marketing emails and security alerts. These settings record your choices; they do not configure account activity or message delivery.</p>
              <div className="mt-6 divide-y divide-border border-y border-border">
                <div className="flex items-start justify-between gap-4 py-5">
                  <div className="pr-2"><Label htmlFor="security-alerts" className="text-sm font-semibold">Security alerts</Label><p className="mt-1 text-sm leading-5 text-muted-foreground">Your preference for security-related communications.</p></div>
                  <Switch id="security-alerts" checked={preferences.securityAlerts} onCheckedChange={checked => { setPreferences(value => ({ ...value, securityAlerts: checked })); setPreferencesSaved(false); setPreferencesError(""); }} aria-label="Security alerts preference" />
                </div>
                <div className="flex items-start justify-between gap-4 py-5">
                  <div className="pr-2"><Label htmlFor="marketing-emails" className="text-sm font-semibold">Marketing emails</Label><p className="mt-1 text-sm leading-5 text-muted-foreground">Your preference for product news and investment insights.</p></div>
                  <Switch id="marketing-emails" checked={preferences.marketingEmails} onCheckedChange={checked => { setPreferences(value => ({ ...value, marketingEmails: checked })); setPreferencesSaved(false); setPreferencesError(""); }} aria-label="Marketing emails preference" />
                </div>
              </div>
              {preferencesError && <p role="alert" className="mt-4 flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{preferencesError}</p>}
              {preferencesSaved && <p role="status" className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary"><Check className="h-4 w-4" />Preferences saved.</p>}
              <Button className="mt-5 min-h-11 w-full rounded-sm sm:w-auto" disabled={savePreferences.isPending} onClick={() => { setPreferencesError(""); setPreferencesSaved(false); savePreferences.mutate(preferences); }}>
                {savePreferences.isPending ? "Saving…" : "Save preferences"}
              </Button>
            </section>
          </TabsContent>

          <TabsContent value="support" className="m-0">
            <section className="max-w-3xl border-y border-border py-6 sm:py-8">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Client assistance</p>
              <h2 className="text-xl font-bold tracking-tight">Speak with your advisor</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">For help with your client record, contact your advisor. They can assist with updates that require additional confirmation, including legal-name changes.</p>
              <a href={`mailto:${advisorEmail}`} className="mt-5 flex min-h-14 items-center justify-between border-y border-border py-3 text-sm font-semibold text-primary hover:underline hover:underline-offset-4">
                <span className="flex min-w-0 items-center gap-3"><Mail className="h-5 w-5 shrink-0" /><span className="break-all">{advisorEmail}</span></span>
                <ArrowUpRight className="ml-3 h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </LayoutShell>
  );
}
