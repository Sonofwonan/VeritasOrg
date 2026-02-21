import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Lock, Zap, BarChart3, Users, Trophy, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";

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
    role: "Portfolio Manager",
    achievement: "Grew net worth from $500K to $2.3M in 5 years",
    quote: "Veritas Wealth gave me the tools and insights to optimize my investment strategy. The real-time analytics are game-changing.",
    initial: "$500K",
    current: "$2.3M"
  },
  {
    name: "James Chen",
    role: "Entrepreneur",
    achievement: "Diversified portfolio across 15+ asset classes",
    quote: "The platform made it easy to manage my diverse portfolio without the complexity. Highly recommended for serious investors.",
    initial: "$250K",
    current: "$890K"
  },
  {
    name: "Emma Rodriguez",
    role: "Financial Advisor",
    achievement: "Manages $15M+ in client assets",
    quote: "I recommend Veritas to all my clients. The security, UX, and features are unmatched in the industry.",
    initial: "$100K",
    current: "$1.2M"
  }
];

const stats = [
  { value: "50,000+", label: "Active Users" },
  { value: "$4.2B", label: "Assets Managed" },
  { value: "99.9%", label: "Uptime" },
  { value: "12%", label: "Avg Annual Return" }
];

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Veritas Wealth | Professional Wealth Management Platform</title>
        <meta name="description" content="Professional-grade tools for managing investments, tracking assets, and building lasting wealth. Join thousands of investors who trust Veritas." />
      </Helmet>
      {/* ... rest of the file ... */}
      {/* Enhanced Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/IMG_4531_1771684255921.jpeg" alt="Veritas Wealth Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
            <span className="text-2xl font-bold tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Veritas Wealth
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex items-center gap-6">
              <button className="text-sm font-medium hover:text-primary transition-colors">Platform</button>
              <button className="text-sm font-medium hover:text-primary transition-colors">Solutions</button>
              <button className="text-sm font-medium hover:text-primary transition-colors">Resources</button>
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
      <div className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-cover opacity-40 scale-105"
          >
            <source src="/assets/aHR0cHM6Ly9hc3NldHMuZ3Jvay5jb20vdXNlcnMvZjg1MzVhY2QtY2ExZS00Mz_1771684255921.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-transparent to-[#0a0a0a] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-background/40 to-background/60" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-32 sm:py-44">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
                Wealth Management
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Made Simple
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Professional-grade tools for managing investments, tracking assets, and building lasting wealth. 
                Join thousands of investors who trust Veritas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                onClick={() => setLocation('/auth')} 
                size="lg"
                className="px-8 h-12 text-base"
                data-testid="button-get-started"
              >
                Get Started Free
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/auth')} 
                size="lg"
                className="px-8 h-12 text-base"
                data-testid="button-sign-in"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="bg-zinc-950 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-2">
                <p className="text-4xl font-bold text-primary tracking-tight">{stat.value}</p>
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
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

      {/* Success Stories */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: 'url(/assets/IMG_4530_1771684255921.jpeg)' }}
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
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: 'url(/assets/IMG_4529_1771684255921.jpeg)' }}
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
