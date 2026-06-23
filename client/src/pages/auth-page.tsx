import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useEffect, useState } from "react";
import { Loader2, Shield, TrendingUp, Eye, EyeOff, CheckCircle2, ChevronRight, ChevronLeft, User, Briefcase, BarChart3, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";

// ─── Schemas ────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  userId: z.string().min(1, "Client ID is required").refine(v => !isNaN(parseInt(v, 10)), "Client ID must be a number"),
  password: z.string().min(1, "Password is required"),
});

const applicationSchema = z.object({
  // Step 1 — Personal Info
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nationality: z.string().optional(),
  // Step 2 — Address & Employment
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  employmentStatus: z.string().min(1, "Employment status is required"),
  annualIncome: z.string().min(1, "Annual income range is required"),
  // Step 3 — Investment Profile
  investmentExperience: z.string().min(1, "Please select your experience level"),
  riskTolerance: z.string().min(1, "Please select risk tolerance"),
  investmentGoal: z.string().min(1, "Please select investment goal"),
  initialDeposit: z.string().min(1, "Please indicate initial deposit"),
  sourceOfFunds: z.string().min(1, "Source of funds is required"),
  // Step 4 — Account Credentials
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ApplicationData = z.infer<typeof applicationSchema>;

const STEPS = [
  { id: 1, label: "Personal Info", icon: User },
  { id: 2, label: "Background", icon: Briefcase },
  { id: 3, label: "Investment Profile", icon: BarChart3 },
  { id: 4, label: "Security", icon: Lock },
];

// ─── Select field helper ────────────────────────────────────────────────────
function SelectField({ label, name, options, form }: {
  label: string; name: keyof ApplicationData; options: { value: string; label: string }[]; form: any;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">{label}</FormLabel>
          <FormControl>
            <select
              {...field}
              className="w-full h-12 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select…</option>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextField({ label, name, form, placeholder, type = "text", inputMode }: {
  label: string; name: keyof ApplicationData; form: any; placeholder?: string; type?: string; inputMode?: any;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              inputMode={inputMode}
              className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ─── Application Form ─────────────────────────────────────────────────────
function ApplicationForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<ApplicationData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: "", email: "", phone: "", dateOfBirth: "", nationality: "",
      address: "", city: "", country: "", employmentStatus: "", annualIncome: "",
      investmentExperience: "", riskTolerance: "", investmentGoal: "",
      initialDeposit: "", sourceOfFunds: "", password: "", confirmPassword: "",
    },
    mode: "onTouched",
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationData) => {
      const { confirmPassword, ...payload } = data;
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stepFields: Record<number, (keyof ApplicationData)[]> = {
    1: ["fullName", "email", "phone", "dateOfBirth", "nationality"],
    2: ["address", "city", "country", "employmentStatus", "annualIncome"],
    3: ["investmentExperience", "riskTolerance", "investmentGoal", "initialDeposit", "sourceOfFunds"],
    4: ["password", "confirmPassword"],
  };

  const handleNext = async () => {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep(s => s + 1);
  };

  const handleSubmit = form.handleSubmit(data => submitMutation.mutate(data));

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 py-8"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Application Submitted!</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">
            Your account application has been sent to your advisor for review. You will be contacted within 1–2 business days with your Client ID once approved.
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="mt-4">Back to Sign In</Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = s.id === step;
          const done = s.id < step;
          return (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 ${i > 0 ? "ml-2" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-primary" : "text-zinc-400"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 sm:w-10 mx-1 mt-[-10px] ${s.id < step ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Personal Information</p>
                <TextField label="Full Legal Name" name="fullName" form={form} placeholder="As it appears on your ID" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Email Address" name="email" form={form} placeholder="you@example.com" type="email" />
                  <TextField label="Phone Number" name="phone" form={form} placeholder="+1 555 000 0000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Date of Birth" name="dateOfBirth" form={form} type="date" />
                  <TextField label="Nationality" name="nationality" form={form} placeholder="e.g. American" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Address & Employment</p>
                <TextField label="Street Address" name="address" form={form} placeholder="123 Main Street" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="City" name="city" form={form} placeholder="New York" />
                  <TextField label="Country" name="country" form={form} placeholder="United States" />
                </div>
                <SelectField label="Employment Status" name="employmentStatus" form={form} options={[
                  { value: "employed", label: "Employed (Full-time)" },
                  { value: "self-employed", label: "Self-Employed / Business Owner" },
                  { value: "retired", label: "Retired" },
                  { value: "unemployed", label: "Not Currently Employed" },
                  { value: "student", label: "Student" },
                ]} />
                <SelectField label="Annual Income (USD)" name="annualIncome" form={form} options={[
                  { value: "under-50k", label: "Under $50,000" },
                  { value: "50k-100k", label: "$50,000 – $100,000" },
                  { value: "100k-250k", label: "$100,000 – $250,000" },
                  { value: "250k-500k", label: "$250,000 – $500,000" },
                  { value: "500k-1m", label: "$500,000 – $1,000,000" },
                  { value: "over-1m", label: "Over $1,000,000" },
                ]} />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Investment Profile</p>
                <SelectField label="Investment Experience" name="investmentExperience" form={form} options={[
                  { value: "none", label: "No experience — new to investing" },
                  { value: "beginner", label: "Beginner — basic knowledge" },
                  { value: "intermediate", label: "Intermediate — some portfolio experience" },
                  { value: "experienced", label: "Experienced — active portfolio management" },
                  { value: "professional", label: "Professional — financial industry background" },
                ]} />
                <SelectField label="Risk Tolerance" name="riskTolerance" form={form} options={[
                  { value: "conservative", label: "Conservative — preserve capital, low risk" },
                  { value: "moderate", label: "Moderate — balanced growth and stability" },
                  { value: "aggressive", label: "Aggressive — maximum growth, high risk" },
                ]} />
                <SelectField label="Primary Investment Goal" name="investmentGoal" form={form} options={[
                  { value: "retirement", label: "Retirement Planning" },
                  { value: "growth", label: "Long-term Capital Growth" },
                  { value: "income", label: "Regular Income / Dividends" },
                  { value: "preservation", label: "Capital Preservation" },
                  { value: "education", label: "Education Funding" },
                  { value: "estate", label: "Estate / Legacy Planning" },
                ]} />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Initial Deposit (USD)" name="initialDeposit" form={form} options={[
                    { value: "under-10k", label: "Under $10,000" },
                    { value: "10k-50k", label: "$10,000 – $50,000" },
                    { value: "50k-250k", label: "$50,000 – $250,000" },
                    { value: "250k-1m", label: "$250,000 – $1,000,000" },
                    { value: "over-1m", label: "Over $1,000,000" },
                  ]} />
                  <SelectField label="Source of Funds" name="sourceOfFunds" form={form} options={[
                    { value: "salary", label: "Employment / Salary" },
                    { value: "business", label: "Business Income" },
                    { value: "inheritance", label: "Inheritance / Gift" },
                    { value: "savings", label: "Personal Savings" },
                    { value: "investment", label: "Investment Returns" },
                    { value: "other", label: "Other" },
                  ]} />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Create Your Account Password</p>
                <p className="text-xs text-zinc-400">This password will be used to access your account once your application is approved.</p>
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password"
                          className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 pr-10" {...field} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-12 w-12 hover:bg-transparent"
                          onClick={() => setShowPassword(v => !v)}>
                          {showPassword ? <EyeOff className="h-4 w-4 text-zinc-500" /> : <Eye className="h-4 w-4 text-zinc-500" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="new-password"
                        className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 text-xs text-zinc-500 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">By submitting this application you confirm:</p>
                  <p>• All information provided is accurate and complete</p>
                  <p>• You are the beneficial owner of the funds being invested</p>
                  <p>• You have read and agree to Veritas Wealth's Terms of Service</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
              className="text-zinc-500">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 1 ? "Back to Login" : "Previous"}
            </Button>

            {step < 4 ? (
              <Button type="button" onClick={handleNext} className="gap-1">
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={submitMutation.isPending} className="gap-2">
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Submit Application
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Main AuthPage ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<"login" | "apply">("login");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userId: "", password: "" },
  });

  const onLogin = (data: z.infer<typeof loginSchema>) => {
    login.mutate({ userId: data.userId, password: data.password } as any, {
      onError: (error) => {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      },
    });
  };

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0a0a0a] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-black/80" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <img src="/assets/IMG_4531_1771684255921.jpeg" alt="Veritas Wealth Logo" className="w-10 h-10 object-contain rounded-lg" />
            <span className="text-2xl font-bold tracking-tight">Veritas Wealth</span>
          </div>
          <div className="space-y-6 max-w-lg">
            <h1 className="text-6xl font-bold tracking-tight leading-[1.1]">
              The future of <span className="text-primary">personal wealth.</span>
            </h1>
            <p className="text-xl text-zinc-400 leading-relaxed">
              Professional-grade wealth management built for the modern investor. Apply today to get started.
            </p>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-8 pt-12 border-t border-zinc-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary"><Shield className="w-5 h-5" /><span className="font-semibold">Secure</span></div>
            <p className="text-sm text-zinc-500">Bank-level encryption and multi-factor security as standard.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary"><TrendingUp className="w-5 h-5" /><span className="font-semibold">Insightful</span></div>
            <p className="text-sm text-zinc-500">Real-time market analytics and AI-powered portfolio insights.</p>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-16 bg-zinc-50 dark:bg-[#111] overflow-y-auto">
        <div className="w-full max-w-lg mx-auto space-y-8">
          <AnimatePresence mode="wait">
            {view === "login" ? (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                  <p className="text-zinc-500">Enter your Client ID and password to access your dashboard.</p>
                </div>

                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField control={loginForm.control} name="userId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Client ID</FormLabel>
                        <FormControl>
                          <Input className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            placeholder="e.g. 10042" inputMode="numeric" data-testid="input-client-id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Password</FormLabel>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} autoComplete="current-password"
                              className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 pr-10" {...field} />
                            <Button type="button" variant="ghost" size="icon"
                              className="absolute right-0 top-0 h-12 w-12 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="h-4 w-4 text-zinc-500" /> : <Eye className="h-4 w-4 text-zinc-500" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" disabled={login.isPending}>
                      {login.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sign in to Veritas"}
                    </Button>
                  </form>
                </Form>

                <div className="pt-4 text-center space-y-3">
                  <p className="text-sm text-zinc-500">Don't have an account?</p>
                  <Button variant="outline" className="w-full h-12 font-bold" onClick={() => setView("apply")}
                    data-testid="button-open-application">
                    Open an Account Application
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="apply" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-1 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Account Application</h2>
                  <p className="text-zinc-500 text-sm">Complete all sections. Your advisor will review and contact you within 1–2 business days.</p>
                </div>
                <ApplicationForm onBack={() => setView("login")} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
