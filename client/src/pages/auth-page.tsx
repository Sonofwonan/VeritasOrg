import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

const loginSchema = z.object({
  userId: z.string().min(1, "Client Reference is required"),
  password: z.string().min(1, "Password required"),
});

const appSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone required"),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, "Country required"),
  employmentStatus: z.string().min(1, "Required"),
  annualIncome: z.string().min(1, "Required"),
  investmentExperience: z.string().min(1, "Required"),
  riskTolerance: z.string().min(1, "Required"),
  investmentGoal: z.string().min(1, "Required"),
  initialDeposit: z.string().min(1, "Required"),
  sourceOfFunds: z.string().min(1, "Required"),
  password: z.string().min(8, "Min 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

type AppData = z.infer<typeof appSchema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label-caps text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function TextInput({ reg, type = "text", placeholder, autoComplete }: {
  reg: any; type?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <input
      {...reg}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="vw-input text-foreground"
    />
  );
}

function SelectInput({ reg, options }: { reg: any; options: { v: string; l: string }[] }) {
  return (
    <select
      {...reg}
      className="vw-input text-foreground appearance-none cursor-pointer"
    >
      <option value="">Select one</option>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

const STEPS = ["About you", "Where you live", "How you invest", "Your password"];

function ApplicationForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { toast } = useToast();

  const form = useForm<AppData>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      fullName: "", email: "", phone: "", dateOfBirth: "", nationality: "",
      address: "", city: "", country: "", employmentStatus: "", annualIncome: "",
      investmentExperience: "", riskTolerance: "", investmentGoal: "",
      initialDeposit: "", sourceOfFunds: "", password: "", confirmPassword: "",
    },
    mode: "onTouched",
  });
  const { register, handleSubmit, trigger, formState: { errors } } = form;

  const stepFields: (keyof AppData)[][] = [
    ["fullName", "email", "phone", "dateOfBirth", "nationality"],
    ["address", "city", "country", "employmentStatus", "annualIncome"],
    ["investmentExperience", "riskTolerance", "investmentGoal", "initialDeposit", "sourceOfFunds"],
    ["password", "confirmPassword"],
  ];

  const mutation = useMutation({
    mutationFn: async (data: AppData) => {
      const { confirmPassword, ...payload } = data;
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Submission failed");
      return res.json();
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" }),
  });

  const next = async () => {
    const ok = await trigger(stepFields[step]);
    if (ok) setStep(s => s + 1);
  };

  if (done) {
    return (
      <div className="text-center space-y-6 py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-primary/30 bg-primary/5">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-2 max-w-sm mx-auto">
          <h3 className="font-serif text-2xl">We have your application</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Someone from our team will review it and reach out within one to two business days with your Client ID and next steps.
          </p>
        </div>
        <button onClick={onBack} className="label-caps text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto">
          <ArrowLeft className="w-3 h-3" /> Return to login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i <= step ? "text-foreground" : "text-muted-foreground/40"}`}>
              <span className={`font-mono-nums text-xs ${i < step ? "text-primary" : i === step ? "text-foreground" : "text-muted-foreground/30"}`}>
                {i < step ? "✓" : `0${i + 1}`}
              </span>
              <span className="label-caps hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-6">

        {/* Step 0 */}
        {step === 0 && (
          <div className="space-y-6">
            <p className="font-serif text-xl">Tell us a bit about yourself</p>
            <Field label="Full legal name" error={errors.fullName?.message}>
              <TextInput reg={register("fullName")} placeholder="As it appears on your ID" autoComplete="name" />
            </Field>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <Field label="Email address" error={errors.email?.message}>
                <TextInput reg={register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Phone number" error={errors.phone?.message}>
                <TextInput reg={register("phone")} placeholder="+1 555 000 0000" />
              </Field>
              <Field label="Date of birth" error={errors.dateOfBirth?.message}>
                <TextInput reg={register("dateOfBirth")} type="date" />
              </Field>
              <Field label="Nationality" error={errors.nationality?.message}>
                <TextInput reg={register("nationality")} placeholder="e.g. American" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <p className="font-serif text-xl">Where are you based?</p>
            <Field label="Street address" error={errors.address?.message}>
              <TextInput reg={register("address")} placeholder="123 Main Street" autoComplete="street-address" />
            </Field>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <Field label="City" error={errors.city?.message}>
                <TextInput reg={register("city")} placeholder="New York" />
              </Field>
              <Field label="Country" error={errors.country?.message}>
                <TextInput reg={register("country")} placeholder="United States" />
              </Field>
            </div>
            <Field label="Employment status" error={errors.employmentStatus?.message}>
              <SelectInput reg={register("employmentStatus")} options={[
                { v: "employed", l: "Employed full time" },
                { v: "self-employed", l: "Self employed or business owner" },
                { v: "retired", l: "Retired" },
                { v: "unemployed", l: "Not currently employed" },
                { v: "student", l: "Student" },
              ]} />
            </Field>
            <Field label="Annual income (USD)" error={errors.annualIncome?.message}>
              <SelectInput reg={register("annualIncome")} options={[
                { v: "under-50m", l: "Under $50,000,000" },
                { v: "50m-100m", l: "$50,000,000 to $100,000,000" },
                { v: "100m-500m", l: "$100,000,000 to $500,000,000" },
                { v: "500m-1b", l: "$500,000,000 to $1,000,000,000" },
                { v: "over-1b", l: "Over $1,000,000,000" },
              ]} />
            </Field>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <p className="font-serif text-xl">How do you like to invest?</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <Field label="Investment experience" error={errors.investmentExperience?.message}>
                <SelectInput reg={register("investmentExperience")} options={[
                  { v: "none", l: "Brand new to investing" },
                  { v: "beginner", l: "Basic familiarity" },
                  { v: "intermediate", l: "Some portfolio experience" },
                  { v: "experienced", l: "Actively managed portfolios" },
                  { v: "professional", l: "Financial industry background" },
                ]} />
              </Field>
              <Field label="Risk tolerance" error={errors.riskTolerance?.message}>
                <SelectInput reg={register("riskTolerance")} options={[
                  { v: "conservative", l: "Conservative, preserve capital" },
                  { v: "moderate", l: "Moderate, balanced approach" },
                  { v: "aggressive", l: "Aggressive, maximum growth" },
                ]} />
              </Field>
              <Field label="Primary investment goal" error={errors.investmentGoal?.message}>
                <SelectInput reg={register("investmentGoal")} options={[
                  { v: "retirement", l: "Retirement planning" },
                  { v: "growth", l: "Long term capital growth" },
                  { v: "income", l: "Income and dividends" },
                  { v: "preservation", l: "Capital preservation" },
                  { v: "education", l: "Education funding" },
                  { v: "estate", l: "Estate and legacy planning" },
                ]} />
              </Field>
              <Field label="Anticipated initial deposit" error={errors.initialDeposit?.message}>
                <SelectInput reg={register("initialDeposit")} options={[
                  { v: "500m-1b", l: "$500M to $1B" },
                  { v: "1b-5b", l: "$1B to $5B" },
                  { v: "5b-10b", l: "$5B to $10B" },
                  { v: "over-10b", l: "Over $10B" },
                ]} />
              </Field>
            </div>
            <Field label="Primary source of funds" error={errors.sourceOfFunds?.message}>
              <SelectInput reg={register("sourceOfFunds")} options={[
                { v: "salary", l: "Employment or salary" },
                { v: "business", l: "Business income or exit" },
                { v: "inheritance", l: "Inheritance or gift" },
                { v: "savings", l: "Personal savings" },
                { v: "investment", l: "Investment returns" },
                { v: "other", l: "Other" },
              ]} />
            </Field>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <p className="font-serif text-xl">Choose a password for your account</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This will be activated once your application is approved. Your Client ID will be assigned and sent to you separately.
            </p>
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <TextInput reg={register("password")} type={showPw ? "text" : "password"} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-0 bottom-2.5 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <TextInput reg={register("confirmPassword")} type="password" autoComplete="new-password" />
            </Field>
            <div className="pt-2 text-xs text-muted-foreground border-t border-border space-y-1.5 leading-relaxed">
              <p>By submitting this form you confirm that everything you have provided is accurate and that you are the beneficial owner of the assets to be invested. You agree to our Terms of Service and Privacy Policy.</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={step === 0 ? onBack : () => setStep(s => s - 1)}
            className="label-caps text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            {step === 0 ? "Back to login" : "Previous"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="label-caps text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
            >
              Continue <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit application
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function AuthPage() {
  const { login, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<"login" | "apply">("login");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userId: "", password: "" },
  });

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const onLogin = handleSubmit(data => {
    setLoginError(null);
    login.mutate({ userId: data.userId, password: data.password } as any, {
      onError: (err: any) => {
        const raw = err?.message || "";
        const msg = raw.replace(/^\d+:\s*/, "");
        setLoginError(msg || "Please check your Client ID and password and try again.");
      },
    });
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-cream">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] shrink-0 flex-col justify-between p-12 xl:p-16 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-16">
            <img src="/assets/IMG_4531_1771684255921.jpeg" alt="" className="w-7 h-7 object-contain" />
            <span className="font-serif text-lg font-medium">Veritas Wealth</span>
          </div>

          <div className="space-y-6 max-w-xs">
            <p className="label-caps text-primary-foreground/40 tracking-widest">Private Wealth Management</p>
            <h1 className="font-serif leading-tight" style={{ fontSize: "clamp(2rem, 3.5vw, 2.8rem)" }}>
              Your wealth,<br />
              managed with<br />
              <em>precision</em> and care.
            </h1>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              We work with ultra high net worth Canadians who have $500M or more to invest. Real people, real relationships, no templates.
            </p>
          </div>
        </div>

        <div className="relative z-10 pt-10 border-t border-primary-foreground/10 grid grid-cols-2 gap-6">
          {[
            { v: "CAD $4.2B", l: "Assets managed" },
            { v: "12.4%", l: "10 yr avg return" },
            { v: "0.32%", l: "Avg all in fee" },
            { v: "50K+", l: "Canadian clients" },
          ].map(s => (
            <div key={s.l}>
              <p className="font-mono-nums text-xl font-medium text-accent">{s.v}</p>
              <p className="label-caps text-primary-foreground/40 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-16 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">

          {view === "login" ? (
            <div className="space-y-10">
              <div>
                <p className="label-caps text-muted-foreground mb-4">Secure client portal</p>
                <h2 className="font-serif text-display-md">Welcome back.</h2>
              </div>

              <form onSubmit={onLogin} className="space-y-7">
                <Field label="Client Reference" error={errors.userId?.message}>
                  <TextInput reg={register("userId")} placeholder="e.g. VW-440FR" autoComplete="username" />
                </Field>
                <Field label="Password" error={errors.password?.message}>
                  <div className="relative">
                    <TextInput
                      reg={register("password")}
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-0 bottom-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                {loginError && (
                  <div className="border border-destructive/40 bg-destructive/5 rounded px-4 py-3 text-sm text-destructive leading-relaxed">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={login.isPending}
                  data-testid="button-sign-in"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {login.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign in to Veritas
                </button>
              </form>

              <div className="pt-2 border-t border-border space-y-4">
                <p className="text-sm text-muted-foreground">Not yet a client?</p>
                <button
                  onClick={() => setView("apply")}
                  data-testid="button-open-application"
                  className="w-full flex items-center justify-between border border-border px-5 py-3.5 text-sm hover:border-primary hover:text-primary transition-colors group"
                >
                  <span>Open an investment account</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <button
                  onClick={() => setView("login")}
                  className="label-caps text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-6 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
                <p className="label-caps text-muted-foreground mb-3">Account application</p>
                <h2 className="font-serif text-display-md">Apply for<br />membership.</h2>
                <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
                  Fill in all four sections and your dedicated advisor will be in touch within one business day.
                </p>
              </div>
              <ApplicationForm onBack={() => setView("login")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
