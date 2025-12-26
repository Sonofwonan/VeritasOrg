import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, CheckCircle2, Shield, TrendingUp, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { login, register, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<"login" | "register">("register");
  const [step, setStep] = useState(1);

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { name: "", email: "", password: "", userType: "personal" },
    mode: "onChange",
  });

  const onLogin = (data: z.infer<typeof loginSchema>) => {
    login.mutate(data, {
      onError: (error) => {
        const isBadGateway = error.message.includes("502");
        toast({
          title: isBadGateway ? "Service Unavailable" : "Login failed",
          description: error.message,
          variant: "destructive",
          duration: isBadGateway ? 10000 : 5000,
        });
      },
    });
  };

  const userType = registerForm.watch("userType");

  const nextStep = async () => {
    const isValid = await registerForm.trigger(['name', 'email', 'userType']);
    if (isValid) setStep(2);
  };

  const onRegister = (data: z.infer<typeof insertUserSchema>) => {
    register.mutate(data, {
      onError: (error) => {
        toast({
          title: "Registration failed",
          description: error.message,
          variant: "destructive",
        });
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
      {/* Visual Side - Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0a0a0a] text-white relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
          style={{ backgroundImage: 'url(/assets/invest-bg.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-black/80" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <img src="/logo.png" alt="Veritas Wealth Logo" className="w-10 h-10 object-contain shadow-lg shadow-primary/20" />
            <span className="text-2xl font-bold tracking-tight">Veritas Wealth</span>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-6xl font-bold font-display tracking-tight leading-[1.1]">
              The future of <span className="text-primary">{userType === 'business' ? 'enterprise' : 'personal'} wealth.</span>
            </h1>
            <p className="text-xl text-zinc-400 leading-relaxed">
              Experience professional-grade wealth management with a platform designed for the {userType === 'business' ? 'modern enterprise' : 'modern investor'}.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8 pt-12 border-t border-zinc-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Secure</span>
            </div>
            <p className="text-sm text-zinc-500">Bank-level encryption and multi-factor security as standard.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">Insightful</span>
            </div>
            <p className="text-sm text-zinc-500">Real-time market analytics and AI-powered portfolio insights.</p>
          </div>
        </div>
      </div>

      {/* Form Side - Right Panel */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-24 bg-zinc-50 dark:bg-[#111]">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {view === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-zinc-500">
              {view === "login" 
                ? "Enter your details to access your dashboard." 
                : "Join Veritas Wealth and start your journey today."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {view === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary" 
                              placeholder="name@company.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Password</FormLabel>
                            <Button variant="ghost" className="px-0 h-auto text-xs text-primary font-bold hover:bg-transparent">Forgot password?</Button>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary pr-10" 
                                autoComplete="off"
                                {...field} 
                                value={field.value || ""}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              >
                                {showPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" 
                      disabled={login.isPending}
                    >
                      {login.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sign in to Veritas"}
                    </Button>
                  </form>
                </Form>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex gap-2 mb-8">
                  {[1, 2].map((s) => (
                    <div 
                      key={s} 
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${s <= step ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-800'}`} 
                    />
                  ))}
                </div>

                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                    {step === 1 ? (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="space-y-4"
                      >
                        <FormField
                          control={registerForm.control}
                          name="userType"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Account Type</FormLabel>
                              <FormControl>
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    type="button"
                                    onClick={() => field.onChange("personal")}
                                    className={cn(
                                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                                      field.value === "personal"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                  >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                      <TrendingUp className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="font-bold text-sm text-foreground">Personal</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => field.onChange("business")}
                                    className={cn(
                                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                                      field.value === "business"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                  >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                      <Shield className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="font-bold text-sm text-foreground">Business</span>
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Full Name</FormLabel>
                              <FormControl>
                                <Input 
                                  className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary" 
                                  placeholder="Johnathan Doe" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Work Email</FormLabel>
                              <FormControl>
                                <Input 
                                  className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary" 
                                  placeholder="john@company.com" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="button" 
                          onClick={nextStep}
                          className="w-full h-12 text-base font-bold group"
                        >
                          Continue
                          <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="space-y-4"
                      >
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Secure Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type={showPassword ? "text" : "password"} 
                                    className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary pr-10" 
                                    autoComplete="off"
                                    {...field} 
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      field.onChange(e.target.value);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                  >
                                    {showPassword ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                            <span>At least 8 characters long</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                            <span>Includes symbols or numbers</span>
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => setStep(1)}
                            className="h-12 px-4"
                          >
                            Back
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1 h-12 text-base font-bold shadow-lg shadow-primary/20" 
                            disabled={register.isPending}
                          >
                            {register.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Complete setup"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </form>
                </Form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-8 text-center">
            <p className="text-sm text-zinc-500">
              {view === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button 
                onClick={() => {
                  setView(view === "login" ? "register" : "login");
                  setStep(1);
                }}
                className="text-primary font-bold hover:underline"
              >
                {view === "login" ? "Create one now" : "Sign in here"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
