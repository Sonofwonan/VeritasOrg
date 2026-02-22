import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Globe, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Landmark,
  ArrowRight,
  CheckCircle2,
  PieChart,
  Zap,
  PhoneCall,
  Mail,
  MapPin,
  Menu,
  X
} from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function CompanyPage() {
  const [, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Divisions", href: "#divisions" },
    { name: "Portfolio", href: "#portfolio" },
    { name: "Impact", href: "#impact" },
    { name: "Contact", href: "#contact" }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary selection:text-primary-foreground font-sans overflow-x-hidden">
      {/* Modern Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? "bg-black/80 backdrop-blur-xl py-4 border-b border-white/10" : "bg-transparent py-6"}`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setLocation("/")}
          >
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-black text-xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] group-hover:scale-110 transition-transform">V</div>
            <span className="font-display font-bold text-2xl tracking-tighter">Veritas<span className="text-primary">LLC</span></span>
          </motion.div>

          <div className="hidden md:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.3em] text-white/60">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="hover:text-primary transition-colors relative group">
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}
              className="hidden sm:flex gap-2 bg-white text-black hover:bg-primary hover:text-white transition-all font-bold px-6 rounded-full"
            >
              Wealth Portal
              <ExternalLink className="w-4 h-4" />
            </Button>
            <button className="md:hidden p-2 text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-8 text-2xl font-bold">
              {navLinks.map((link) => (
                <a key={link.name} href={link.href} onClick={() => setIsMenuOpen(false)} className="text-white/80 hover:text-primary transition-colors">
                  {link.name}
                </a>
              ))}
              <Button 
                onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}
                className="w-full bg-primary text-white py-8 text-xl"
              >
                Wealth Portal
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/assets/trading-floor.png" 
            alt="Trading Floor"
            className="w-full h-full object-cover opacity-20 scale-105"
          />
        </div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(var(--primary-rgb),0.15),transparent_50%)]" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Global Strategic Holdings
              </div>
              <h1 className="text-6xl md:text-9xl font-black font-display tracking-tight mb-8 leading-[0.9] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                Architecting <br />Global <span className="text-primary italic">Wealth.</span>
              </h1>
              <p className="text-xl md:text-2xl text-white/50 mb-12 leading-relaxed max-w-2xl font-light">
                Veritas LLC orchestrates capital, infrastructure, and innovation across 45+ global markets. We don't just invest; we define the future.
              </p>
              <div className="flex flex-wrap gap-6">
                <Button 
                  size="lg" 
                  className="h-16 px-10 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] transition-all hover:-translate-y-1"
                  onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Global Inquiries
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-16 px-10 text-lg font-bold rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl transition-all hover:-translate-y-1 gap-3"
                  onClick={() => setLocation("/dashboard")}
                >
                  Wealth Portal
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Discover</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-primary to-transparent" />
        </motion.div>
      </section>

      {/* Dynamic Statistics */}
      <section id="impact" className="py-24 border-y border-white/5 bg-white/[0.02]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center md:text-left">
            <StatBox value="$12.8B" label="Assets Managed" />
            <StatBox value="45+" label="Global Markets" />
            <StatBox value="99.9%" label="Security Rating" />
            <StatBox value="12%" label="Avg. Yearly Growth" />
          </div>
        </div>
      </section>

      {/* Advanced Divisions Grid */}
      <section id="divisions" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="max-w-2xl text-center md:text-left">
              <h2 className="text-4xl md:text-6xl font-bold font-display mb-6 tracking-tighter text-center md:text-left">Strategic <span className="text-primary">Ecosystem.</span></h2>
              <p className="text-xl text-white/40 font-light">Four specialized divisions, one singular vision of excellence.</p>
            </div>
            <Button variant="ghost" className="text-primary font-black text-xs p-0 gap-2 hover:gap-4 transition-all uppercase tracking-[0.3em] mx-auto md:mx-0">
              View All Ventures <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DivisionCard 
              icon={TrendingUp}
              title="Wealth Management"
              tag="Flagship"
              description="Digital-first institutional grade investment portal for elite capital management."
              onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}
            />
            <DivisionCard 
              icon={Landmark}
              title="Venture Capital"
              tag="Alpha"
              description="Seeding disruptive technologies in FinTech, AI, and Sustainable Energy."
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            />
            <DivisionCard 
              icon={ShieldCheck}
              title="Risk & Security"
              tag="Core"
              description="Military-grade encryption and global risk assessment for cross-border enterprise."
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            />
            <DivisionCard 
              icon={Globe}
              title="Infrastructure"
              tag="Global"
              description="Strategic real estate and logistics development in emerging economic corridors."
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            />
          </div>
        </div>
      </section>

      {/* Interactive Feature: Asset Distribution */}
      <section id="portfolio" className="relative py-32 bg-white/[0.02] border-y border-white/5 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10">
          <img src="/assets/executive-boardroom.png" alt="Boardroom" className="w-full h-full object-cover" />
        </div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl w-fit">
                <PieChart className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-4xl md:text-6xl font-bold font-display tracking-tighter leading-[1.1]">Precision <br />Asset <span className="text-primary italic">Distribution.</span></h2>
              <p className="text-xl text-white/50 leading-relaxed font-light max-w-xl">
                Our portfolio is engineered for resilience. We maintain a diverse spread across asset classes, ensuring stability in volatile global markets.
              </p>
              <ul className="space-y-4 pt-4 text-left">
                <FeatureItem text="Algorithmic risk balancing across all sectors" />
                <FeatureItem text="Real-time transparency for institutional partners" />
                <FeatureItem text="Adaptive liquidity events for maximized returns" />
              </ul>
              <Button 
                size="lg" 
                className="h-14 px-8 rounded-xl font-bold bg-white text-black hover:bg-primary hover:text-white transition-all mt-6"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Request Portfolio Review
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full" />
              <div className="relative aspect-square rounded-[40px] border border-white/10 bg-black/40 backdrop-blur-3xl p-12 flex items-center justify-center overflow-hidden group">
                <div className="grid grid-cols-2 gap-4 w-full h-full">
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-primary/20 rounded-3xl border border-primary/30 flex items-end p-6 transition-colors">
                    <span className="text-4xl md:text-5xl font-black text-primary">45%</span>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-white/5 rounded-3xl border border-white/10 flex items-end p-6 transition-colors">
                    <span className="text-4xl md:text-5xl font-black text-white/40">25%</span>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-white/5 rounded-3xl border border-white/10 flex items-end p-6 transition-colors">
                    <span className="text-4xl md:text-5xl font-black text-white/40">20%</span>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-primary/5 rounded-3xl border border-primary/10 flex items-end p-6 transition-colors">
                    <span className="text-4xl md:text-5xl font-black text-primary/40">10%</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Inquiries / Contact */}
      <section id="contact" className="py-32">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-16">
            <h2 className="text-5xl md:text-8xl font-black font-display tracking-tighter">Connect with <br /><span className="text-primary italic">Veritas Corp.</span></h2>
            <div className="grid sm:grid-cols-3 gap-8">
              <ContactMethod icon={PhoneCall} label="WhatsApp Support" value="+1 (478) 416-5940" onClick={() => window.open('https://wa.me/14784165940', '_blank')} />
              <ContactMethod icon={PhoneCall} label="Global HQ" value="+1 702-718-8852" />
              <ContactMethod icon={MapPin} label="Location" value="Manhattan, NY" />
            </div>
            <div className="pt-12">
              <Card className="bg-zinc-900 border-white/10 p-12 rounded-[50px] text-left relative overflow-hidden group shadow-2xl">
                <div className="relative z-10 max-w-2xl space-y-8">
                  <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight text-white">Send a Message</h3>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Message sent to support.'); }}>
                    <input 
                      type="email" 
                      placeholder="Your Email" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-colors"
                      required
                    />
                    <textarea 
                      placeholder="Your Message" 
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-colors"
                      required
                    />
                    <Button 
                      type="submit"
                      size="lg" 
                      className="bg-primary text-white hover:bg-primary/90 transition-all h-16 px-12 rounded-2xl text-xl font-black gap-3 w-full shadow-2xl"
                    >
                      Send Message
                      <ArrowRight className="w-6 h-6" />
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Minimalistic Modern Footer */}
      <footer className="border-t border-white/5 py-24 bg-black">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-20">
            <div className="space-y-8 max-w-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-black text-xl">V</div>
                <span className="font-display font-bold text-3xl tracking-tighter">Veritas<span className="text-primary">LLC</span></span>
              </div>
              <p className="text-white/30 text-base leading-relaxed font-light">
                Architecting the future of global enterprise through strategic stewardship and technological innovation.
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-20 md:gap-40 font-black uppercase tracking-[0.3em] text-[10px] text-white/30">
              <div className="space-y-8">
                <p className="text-white/60">Ecosystem</p>
                <ul className="space-y-5">
                  <li className="hover:text-primary transition-colors cursor-pointer" onClick={() => window.open('https://veritaswealth.vercel.app', '_blank')}>Wealth</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Ventures</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Security</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Infra</li>
                </ul>
              </div>
              <div className="space-y-8">
                <p className="text-white/60">Corporate</p>
                <ul className="space-y-5">
                  <li className="hover:text-primary transition-colors cursor-pointer">About</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Investors</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">ESG</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Press</li>
                </ul>
              </div>
              <div className="space-y-8 hidden sm:block">
                <p className="text-white/60">Offices</p>
                <ul className="space-y-5">
                  <li className="hover:text-primary transition-colors cursor-pointer">New York</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">London</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Singapore</li>
                  <li className="hover:text-primary transition-colors cursor-pointer">Zurich</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-24 mt-24 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8 text-[11px] uppercase tracking-[0.4em] font-black text-white/10">
            <p>© 2026 Veritas Global Holdings LLC. All rights reserved.</p>
            <div className="flex gap-12">
              <span className="hover:text-white transition-colors cursor-pointer">Privacy Protocol</span>
              <span className="hover:text-white transition-colors cursor-pointer">Service Terms</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBox({ value, label }: { value: string, label: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      className="space-y-4 group"
    >
      <h3 className="text-5xl md:text-7xl font-black text-white group-hover:text-primary transition-colors duration-500 tracking-tighter">{value}</h3>
      <p className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">{label}</p>
    </motion.div>
  );
}

function DivisionCard({ icon: Icon, title, description, tag, onClick }: any) {
  return (
    <motion.div 
      whileHover={{ y: -15, scale: 1.02 }}
      className="group relative h-full"
      onClick={onClick}
    >
      <div className="absolute -inset-[1px] bg-gradient-to-b from-white/20 to-transparent rounded-[40px] -z-10 group-hover:from-primary/50 transition-colors duration-500" />
      <div className="relative h-full bg-[#0a0a0a] rounded-[39px] p-10 space-y-8 flex flex-col justify-between cursor-pointer border border-white/5 hover:border-primary/20 transition-all shadow-2xl">
        <div className="space-y-8">
          <div className="flex justify-between items-start">
            <div className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center text-white group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
              <Icon className="w-8 h-8" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/40 group-hover:text-primary group-hover:border-primary/30 transition-all">{tag}</span>
          </div>
          <div className="space-y-4">
            <h3 className="text-3xl font-black tracking-tighter">{title}</h3>
            <p className="text-white/40 text-sm leading-relaxed font-light">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-primary font-black text-[10px] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          Enter Division <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <motion.li 
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 text-white/60 text-base font-light"
    >
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-primary" />
      </div>
      {text}
    </motion.li>
  );
}

function ContactMethod({ icon: Icon, label, value, onClick }: { icon: any, label: string, value: string, onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="p-10 rounded-[35px] bg-white/[0.02] border border-white/5 space-y-6 hover:border-primary/20 transition-all cursor-pointer group shadow-2xl"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30 mb-2">{label}</p>
        <p className="text-base font-bold text-white/80">{value}</p>
      </div>
    </motion.div>
  );
}

function Badge({ children, className }: any) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
}
