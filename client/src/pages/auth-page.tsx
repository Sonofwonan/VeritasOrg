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
import { Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { login, register, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  const registerForm = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { name: "", email: "", password: "", userType: "personal" },
    mode: "onChange",
  });

  const onLogin = (data: z.infer<typeof loginSchema>) => {
    login.mutate(data, {
      onError: (error) => {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-[#0a0a0a] text-white relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: 'url(/assets/invest-bg.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-black" />
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-2 mb-8">
            <img src="/logo.png" alt="Veritas Wealth" className="w-10 h-10" />
            <span className="text-2xl font-bold">Veritas Wealth</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Professional wealth management <br />
            <span className="text-primary">simplified.</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-md">
            Secure, insightful, and designed for the modern investor.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 bg-zinc-50 dark:bg-[#111]">
        <Card className="w-full max-w-md mx-auto border-0 shadow-none bg-transparent">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-3xl font-bold">
              {view === "login" ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {view === "login" 
                ? "Enter your credentials to access your dashboard." 
                : "Join Veritas Wealth and start your journey today."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {view === "login" ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="name@company.com" 
                            {...field}
                            value={field.value || ""}
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              {...field}
                              value={field.value || ""}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              <Shield className={cn("w-4 h-4", !showPassword && "opacity-50")} />
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={login.isPending}>
                    {login.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Sign In
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Doe" 
                            {...field}
                            value={field.value || ""}
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="name@company.com" 
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={register.isPending}>
                    {register.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Account
                  </Button>
                </form>
              </Form>
            )}
            
            <div className="mt-6 text-center">
              <Button 
                variant="ghost" 
                onClick={() => setView(view === "login" ? "register" : "login")}
                className="text-primary font-bold hover:bg-transparent"
              >
                {view === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
