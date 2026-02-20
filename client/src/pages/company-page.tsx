import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Users, 
  BarChart3, 
  Globe, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Landmark
} from "lucide-react";
import { useLocation } from "wouter";

export default function CompanyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">V</div>
            <span className="font-display font-bold text-xl tracking-tight">Veritas<span className="text-primary">LLC</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#about" className="hover:text-primary transition-colors">About</a>
            <a href="#services" className="hover:text-primary transition-colors">Services</a>
            <a href="#portfolio" className="hover:text-primary transition-colors">Portfolio</a>
            <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <Button 
            onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            Wealth Platform
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 -z-10" />
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 py-1 px-4 text-primary border-primary/20 bg-primary/5">Global Enterprise Solutions</Badge>
            <h1 className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-6 leading-[1.1]">
              Architecting the <span className="text-primary">Future</span> of Global Business.
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl">
              Veritas LLC is a premier multi-disciplinary holding company specializing in venture capital, wealth management, and strategic infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-12 px-8 text-base">Corporate Profile</Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 text-base gap-2"
                onClick={() => setLocation("/dashboard")}
              >
                Access Wealth Portal
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Key Divisions */}
      <section id="services" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-display mb-4">Our Core Divisions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Strategic excellence across diverse financial and industrial sectors.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <DivisionCard 
              icon={TrendingUp}
              title="Veritas Wealth"
              description="Premier investment and cash management platform for high-net-worth individuals and institutional partners."
              link="/dashboard"
              isInternal={true}
            />
            <DivisionCard 
              icon={Landmark}
              title="Capital Partners"
              description="Strategic venture capital and private equity firm focusing on disruptive technologies and infrastructure."
              link="#"
            />
            <DivisionCard 
              icon={ShieldCheck}
              title="Risk Solutions"
              description="Comprehensive global risk assessment and mitigation strategies for international enterprise."
              link="#"
            />
          </div>
        </div>
      </section>

      {/* Global Impact Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-card border rounded-2xl p-8 shadow-2xl overflow-hidden aspect-video flex items-center justify-center">
                <Globe className="w-32 h-32 text-primary animate-pulse-slow" />
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl font-bold font-display">Global Presence, <br /><span className="text-primary">Local Expertise.</span></h2>
              <p className="text-lg text-muted-foreground">
                Operating in over 45 markets worldwide, Veritas LLC combines global perspective with deep local market insights to deliver unmatched value.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-primary">$12.8B+</p>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Assets Under Stewardship</p>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-primary">450+</p>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Corporate Partnerships</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wealth Integration Banner */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Card className="bg-primary text-primary-foreground border-none shadow-2xl shadow-primary/30 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <BarChart3 className="w-64 h-64" />
            </div>
            <CardContent className="p-8 md:p-12 relative z-10">
              <div className="max-w-2xl">
                <h3 className="text-3xl font-bold mb-4">Integrated Wealth Management</h3>
                <p className="text-primary-foreground/80 mb-8 text-lg">
                  Veritas Wealth is our flagship digital experience, providing seamless access to institutional-grade investment tools and cash management.
                </p>
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="gap-2 font-bold"
                  onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}
                >
                  Visit Veritas Wealth Platform
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 mt-12 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">V</div>
                <span className="font-display font-bold text-xl tracking-tight">Veritas<span className="text-primary">LLC</span></span>
              </div>
              <p className="text-muted-foreground max-w-sm mb-6">
                Redefining the standard of strategic holding management and global enterprise.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Divisions</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-primary transition-colors cursor-pointer" onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}>Veritas Wealth</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Capital Partners</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Risk Management</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Corporate</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-primary transition-colors cursor-pointer">About Us</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Investor Relations</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Contact</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2026 Veritas LLC. All rights reserved.</p>
            <div className="flex gap-6">
              <span className="hover:text-primary cursor-pointer">Privacy Policy</span>
              <span className="hover:text-primary cursor-pointer">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DivisionCard({ icon: Icon, title, description, link, isInternal = false }: any) {
  const [, setLocation] = useLocation();
  
  const handleClick = () => {
    if (isInternal) {
      setLocation(link);
    } else {
      window.open(link, '_blank');
    }
  };

  return (
    <Card className="group hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer" onClick={handleClick}>
      <CardHeader>
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 mb-2">
          <Icon className="w-6 h-6" />
        </div>
        <CardTitle className="flex items-center justify-between">
          {title}
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function Badge({ children, className, variant }: any) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
}
