import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Lock, Zap, BarChart3, Users, Trophy, Loader2 } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Smart Investments",
    description: "AI-powered portfolio recommendations tailored to your goals"
  },
  {
    icon: Lock,
    title: "Bank-Level Security",
    description: "256-bit encryption and multi-factor authentication for peace of mind"
  },
  {
    icon: Zap,
    title: "Real-Time Analytics",
    description: "Monitor your wealth with live market data and instant notifications"
  },
  {
    icon: BarChart3,
    title: "Advanced Tools",
    description: "Professional-grade charting and portfolio analysis tools"
  },
  {
    icon: Users,
    title: "Expert Support",
    description: "24/7 customer success team dedicated to your financial goals"
  },
  {
    icon: Trophy,
    title: "Proven Results",
    description: "Average portfolio growth of 12% YoY for our active investors"
  }
];

const successStories = [
    {
      name: "Sarah Mitchell",
      role: "Global Portfolio Manager",
      achievement: "Managed $4.5B in institutional assets",
      quote: "Veritas Wealth provides the institutional-grade infrastructure required for serious capital management. Their analytics are unparalleled.",
      initial: "$10M+",
      current: "$142M+"
    },
    {
      name: "James Chen",
      role: "Venture Capitalist",
      achievement: "Early-stage investor in 3 Decacorns",
      quote: "The efficiency of capital deployment through Veritas is what sets them apart. It's the only platform that keeps pace with high-velocity investing.",
      initial: "$2.5M",
      current: "$18.4M"
    },
    {
      name: "Emma Rodriguez",
      role: "Family Office Principal",
      achievement: "Preserving multi-generational wealth",
      quote: "We trust Veritas with our most sensitive family assets. Their security protocols and reporting standards are the gold standard.",
      initial: "$50M",
      current: "$120M"
    }
];

const stats = [
  { value: "850,000+", label: "Active Investors" },
  { value: "$142.8B", label: "Assets Under Management" },
  { value: "99.99%", label: "System Uptime" },
  { value: "15.4%", label: "Avg Annual Return" }
];

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Veritas Wealth Logo" className="w-10 h-10 object-contain drop-shadow-md" />
            <span className="text-2xl font-bold tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Veritas Wealth
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex items-center gap-6">
              <button 
                onClick={() => scrollTo('features')} 
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollTo('investment-options')} 
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Investments
              </button>
              <button 
                onClick={() => scrollTo('support')} 
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Support
              </button>
            </nav>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/auth')}
                className="font-bold"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => setLocation('/auth')}
                className="font-bold shadow-lg shadow-primary/20"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative pt-20 overflow-hidden min-h-[90vh] flex items-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay transition-opacity duration-1000"
          style={{ backgroundImage: 'url(/attached_assets/IMG_3468_1766686477600.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/5" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold">
                <Shield className="w-4 h-4" />
                <span>Institutional Grade Wealth Management</span>
              </div>
              <div className="space-y-4">
                <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
                  Secure Your Future with
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                    Veritas Wealth
                  </span>
                </h1>
                <p className="text-xl text-zinc-300 max-w-xl leading-relaxed">
                  We bridge the gap between institutional sophistication and personal wealth management. 
                  Experience a platform built on transparency, security, and proven results.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Button 
                  onClick={() => setLocation('/auth')} 
                  size="lg"
                  className="w-full sm:w-auto px-8 h-14 text-lg font-bold shadow-2xl shadow-primary/40"
                  data-testid="button-get-started"
                >
                  Open an Account
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setLocation('/auth')} 
                  size="lg"
                  className="w-full sm:w-auto px-8 h-14 text-lg font-bold border-zinc-700 hover:bg-zinc-800"
                  data-testid="button-sign-in"
                >
                  Sign In
                </Button>
              </div>

              <div className="pt-8 flex items-center gap-6 border-t border-zinc-800/50">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center overflow-hidden">
                      <img src={`https://i.pravatar.cc/150?u=${i}`} alt="user" />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-400 font-medium">
                  Joined by <span className="text-white font-bold">850,000+</span> global investors
                </p>
              </div>
            </div>

            <div className="hidden lg:block relative animate-in zoom-in fade-in duration-1000 delay-200">
              <div className="relative z-10 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl shadow-primary/20">
                <img 
                  src="/attached_assets/IMG_3469_1766686477600.jpeg" 
                  alt="Veritas Wealth Dashboard" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              {/* Floating decorative elements */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-pulse delay-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - High Contrast */}
      <div className="bg-[#0a0a0a] border-y border-zinc-800 py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-2 animate-in fade-in zoom-in duration-700">
                <p className="text-4xl md:text-5xl font-bold text-primary tabular-nums tracking-tighter">{stat.value}</p>
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Powerful Features for Smart Investors</h2>
          <p className="text-lg text-muted-foreground">Everything you need to manage your wealth in one place</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border hover-elevate">
                <CardHeader>
                  <div className="mb-4">
                    <Icon className="w-10 h-10 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Investment Options Section (from Image) */}
      <div id="investment-options" className="max-w-7xl mx-auto px-6 py-24 border-t">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold tracking-tight">Investing isn't just about money — it's about your future</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Let us help you create the future you want for yourself and your loved ones. Whether you're new to investing or an experienced trader, we're here to help you on your way.
          </p>
        </div>

        <div className="grid gap-12 max-w-4xl mx-auto">
          {/* Retirement & IRAs */}
          <Card className="border-0 shadow-none text-center p-8 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl group overflow-hidden relative">
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-cover bg-center"
              style={{ backgroundImage: 'url(/attached_assets/IMG_3484_1766686477600.jpeg)' }}
            />
            <CardHeader className="flex flex-col items-center relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Retirement & IRAs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <p className="text-lg text-muted-foreground">
                Save for retirement with access to a broad range of investments, exceptional service, planning tools, and free investment guidance.
              </p>
              <Button 
                onClick={() => setLocation('/auth')} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 h-12 rounded-md hover-elevate"
              >
                Open an account
              </Button>
            </CardContent>
          </Card>

          {/* Planning & Advice */}
          <Card className="border-0 shadow-none text-center p-8 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl group overflow-hidden relative">
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-cover bg-center"
              style={{ backgroundImage: 'url(/attached_assets/IMG_3483_1766686477600.jpeg)' }}
            />
            <CardHeader className="flex flex-col items-center relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Planning & advice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <p className="text-lg text-muted-foreground">
                Start making real progress on your financial goals with help from our investment management services.
              </p>
              <Button 
                onClick={() => setLocation('/auth')} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 h-12 rounded-md hover-elevate"
              >
                Find an advisor
              </Button>
            </CardContent>
          </Card>

          {/* Brokerage Account */}
          <Card className="border-0 shadow-none text-center p-8 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl group overflow-hidden relative">
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-cover bg-center"
              style={{ backgroundImage: 'url(/attached_assets/IMG_3475_1766686477600.jpeg)' }}
            />
            <CardHeader className="flex flex-col items-center relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Brokerage account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <p className="text-lg text-muted-foreground">
                Trade smarter with $0 commissions¹ for online US stock, ETF, and option trades; fractional share trading for a slice of your favorite companies; and powerful research tools.
              </p>
              <Button 
                onClick={() => setLocation('/auth')} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 h-12 rounded-md hover-elevate"
              >
                Open an account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Support Section */}
      <div id="support" className="bg-zinc-50 dark:bg-zinc-950 py-24 border-y">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold tracking-tight">Need help with your account?</h2>
              <p className="text-lg text-muted-foreground">
                Our dedicated support team and financial advisors are available 24/7 to assist you with any questions about our platform or your investment strategy.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="font-bold">Help Center</p>
                  <p className="text-sm text-muted-foreground">Browse our extensive library of guides and FAQs.</p>
                  <Button variant="ghost" className="px-0 text-primary hover:bg-transparent">Visit Help Center</Button>
                </div>
                <div className="space-y-2">
                  <p className="font-bold">Contact Support</p>
                  <p className="text-sm text-muted-foreground">Get in touch with our representative instantly.</p>
                  <Button variant="ghost" className="px-0 text-primary hover:bg-transparent">Chat with us</Button>
                </div>
              </div>
            </div>
            <Card className="bg-primary text-primary-foreground p-8">
              <CardHeader>
                <CardTitle className="text-2xl">Expert Financial Guidance</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Schedule a complimentary consultation with a certified wealth advisor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Personalized investment roadmap
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Portfolio health assessment
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Retirement planning strategy
                  </li>
                </ul>
                <Button variant="secondary" className="w-full font-bold">
                  Schedule Consultation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Stories */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-5"
          style={{ backgroundImage: 'url(/assets/team-bg.jpeg)' }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Success Stories from Real Investors</h2>
            <p className="text-lg text-muted-foreground">See how our clients have grown their wealth</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {successStories.map((story) => (
              <Card key={story.name} className="border hover-elevate">
                <CardHeader>
                  <div className="space-y-2 mb-4">
                    <CardTitle className="text-lg">{story.name}</CardTitle>
                    <CardDescription>{story.role}</CardDescription>
                  </div>
                  <div className="flex gap-8 py-4 border-t">
                    <div>
                      <p className="text-2xl font-bold text-primary">{story.initial}</p>
                      <p className="text-xs text-muted-foreground">Starting Balance</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">{story.current}</p>
                      <p className="text-xs text-muted-foreground">Current Value</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground italic">"{story.quote}"</p>
                  <p className="text-xs font-semibold text-primary">{story.achievement}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Market Insights */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: 'url(/assets/market-bg.jpeg)' }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Market Insights & Education</h2>
            <p className="text-lg text-muted-foreground">Stay informed with real-time market data and expert analysis</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border">
              <CardHeader>
                <CardTitle>Market Volatility Report</CardTitle>
                <CardDescription>Current market conditions and trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tech Stocks (NASDAQ)</span>
                    <span className="text-sm font-bold text-accent">+4.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Broad Market (S&P 500)</span>
                    <span className="text-sm font-bold text-primary">+2.1%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Bonds & Treasuries</span>
                    <span className="text-sm font-bold">-0.8%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border">
              <CardHeader>
                <CardTitle>Investment Strategies</CardTitle>
                <CardDescription>Proven approaches for different goals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-1">Growth Portfolio</p>
                    <p className="text-xs text-muted-foreground">70% stocks, 30% bonds - for long-term growth</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-1">Balanced Portfolio</p>
                    <p className="text-xs text-muted-foreground">50% stocks, 50% bonds - for stability</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-1">Income Portfolio</p>
                    <p className="text-xs text-muted-foreground">Dividend stocks & fixed income - for cash flow</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 py-16 border-t">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Grow Your Wealth?</h2>
          <p className="text-lg text-muted-foreground">Join thousands of investors using Veritas Wealth to achieve their financial goals.</p>
          <Button 
            onClick={() => setLocation('/auth')} 
            size="lg"
            className="px-8 h-12 text-base"
            data-testid="button-cta-start"
          >
            Start Your Free Account
          </Button>
        </div>
      </div>
    </div>
  );
}
