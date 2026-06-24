import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef } from "react";
import { Loader2, ArrowRight, ArrowUpRight } from "lucide-react";

const TICKER_ITEMS = [
  { symbol: "S&P/TSX", value: "22,456.32", change: "+0.67%", up: true },
  { symbol: "S&P 500", value: "5,842.16", change: "+0.84%", up: true },
  { symbol: "NASDAQ", value: "18,429.30", change: "+1.21%", up: true },
  { symbol: "CAD/USD", value: "0.7312", change: "-0.18%", up: false },
  { symbol: "GOLD", value: "$2,341.40", change: "-0.12%", up: false },
  { symbol: "WTI CRUDE", value: "$78.20", change: "+0.56%", up: true },
  { symbol: "GOC 10 YR", value: "3.64%", change: "-0.03", up: false },
  { symbol: "NATURAL GAS", value: "$2.84", change: "+1.42%", up: true },
  { symbol: "BITCOIN", value: "$67,420", change: "+2.14%", up: true },
];

const SEGMENTS = [
  {
    label: "Individuals and families",
    summary: "We manage portfolios for ultra high net worth individuals who want their money working harder than they are, without the complexity.",
    cta: "Begin your application",
    min: "Min. $500M",
  },
  {
    label: "Business owners",
    summary: "Selling a business is one of the most significant financial moments of your life. We help you plan what happens next.",
    cta: "Talk to an advisor",
    min: "Min. $1B",
  },
  {
    label: "Institutions and endowments",
    summary: "We serve sovereign funds, foundations and pension plans that need a fiduciary partner with genuine institutional depth.",
    cta: "Institutional inquiry",
    min: "Min. $5B",
  },
  {
    label: "Family offices",
    summary: "When wealth spans generations and family branches, you need consolidated oversight and a team that thinks across all of it.",
    cta: "Family office services",
    min: "Min. $10B",
  },
];

const PRINCIPLES = [
  { n: "01", title: "Preservation first", body: "Capital you don't lose, you don't have to earn back. Before we ever talk about returns, we set a clear floor on how much you're willing to risk losing." },
  { n: "02", title: "Institutional access", body: "Your portfolio draws from the same instruments as sovereign wealth funds. Private credit, direct co investments, structured products and more." },
  { n: "03", title: "Transparent pricing", body: "One simple annual fee. No commissions, no fund markups, no hidden spreads. You always know exactly what you pay and why." },
  { n: "04", title: "Tax aware execution", body: "Every trade is evaluated against its tax impact. We harvest losses systematically, choose optimal lot selection, and coordinate across all your accounts." },
];

const STORIES = [
  {
    name: "Catherine Mercer",
    background: "Healthcare executive, Toronto, Ontario",
    before: "$620M",
    after: "$2.8B",
    years: 7,
    quote: "I finally felt like I had someone genuinely in my corner. Someone who understood both the numbers and the bigger picture of what I was building.",
  },
  {
    name: "James and Eleanor Thornton",
    background: "Energy sector founders, Calgary, Alberta",
    before: "$1.4B",
    after: "$6.2B",
    years: 9,
    quote: "Selling our company could have been a financial disaster. Veritas walked us through every decision on tax, structure and reinvestment. Not a single misstep.",
  },
  {
    name: "Dr. Marcus Lin",
    background: "Surgeon and private equity partner, Vancouver, BC",
    before: "$580M",
    after: "$2.3B",
    years: 6,
    quote: "The discipline they apply to a portfolio is something I could never have done on my own. And I say that as someone who reads financial statements for fun.",
  },
];

const INSIGHTS = [
  {
    category: "Canadian fixed income",
    date: "June 2025",
    headline: "What the Bank of Canada's rate path means for your bond portfolio",
    excerpt: "With the Bank of Canada cutting ahead of the Fed, Government of Canada bonds are behaving differently than their US counterparts. Duration extension may finally make sense for Canadian investors holding short.",
    readTime: "6 min read",
  },
  {
    category: "Equity strategy",
    date: "May 2025",
    headline: "The TSX is cheap relative to history. Here is why that matters",
    excerpt: "Canadian equities trade at a meaningful discount to US peers on almost every valuation metric. For investors willing to look past the energy and financials concentration, the opportunity set is broader than it looks.",
    readTime: "8 min read",
  },
  {
    category: "Tax and estate",
    date: "May 2025",
    headline: "The 2025 capital gains inclusion rate change and what to do now",
    excerpt: "Ottawa's proposed increase to the capital gains inclusion rate has prompted many high net worth Canadians to revisit their holding structures. We break down the scenarios and where planning still creates real value.",
    readTime: "5 min read",
  },
];

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-foreground">

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-cream/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/assets/IMG_4531_1771684255921.jpeg" alt="Veritas" className="w-6 h-6 object-contain" />
            <span className="font-serif text-[1.05rem] tracking-tight">Veritas Wealth</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-[13px] text-muted-foreground">
            <button className="hover:text-foreground transition-colors">Who we serve</button>
            <button className="hover:text-foreground transition-colors">Our approach</button>
            <button className="hover:text-foreground transition-colors">Performance</button>
            <button className="hover:text-foreground transition-colors">Insights</button>
            <button className="hover:text-foreground transition-colors">About</button>
          </nav>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/auth")}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Client login
            </button>
            <button
              onClick={() => setLocation("/auth")}
              data-testid="button-get-started"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] px-4 py-2 hover:bg-primary/90 transition-colors"
            >
              Apply now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[68vh] flex flex-col justify-end pt-16 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.82 }}
        >
          <source src="/assets/aHR0cHM6Ly9hc3NldHMuZ3Jvay5jb20vdXNlcnMvZjg1MzVhY2QtY2ExZS00Mz_1771684255921.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2218] via-[#0B2218]/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-8 pb-10 sm:pb-14">
          <div className="max-w-2xl">
            <p className="label-caps text-white/50 mb-4 tracking-[0.2em]">Private wealth management since 1967</p>
            <h1 className="font-serif text-white leading-[1.1]" style={{ fontSize: "clamp(2rem, 4vw, 3.8rem)" }}>
              Capital, <em>protected</em>. Wealth, grown.
            </h1>
            <p className="text-white/60 text-lg sm:text-xl mt-5 max-w-lg leading-relaxed">
              We manage money for people with a lot of it. Families, founders and institutions with $500M or more who want a real partner, not just a platform.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-7">
              <button
                onClick={() => setLocation("/auth")}
                className="flex items-center gap-2 bg-white text-primary text-sm font-medium px-7 py-3.5 hover:bg-cream transition-colors"
                data-testid="button-cta-start"
              >
                Begin your application <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLocation("/auth")}
                data-testid="button-sign-in"
                className="label-caps text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                Client login <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live market ticker */}
      <div className="bg-[#0B2218] border-t border-white/5 py-3 overflow-hidden">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 px-8">
              <span className="label-caps text-white/30">{item.symbol}</span>
              <span className="font-mono-nums text-white text-sm">{item.value}</span>
              <span className={`font-mono-nums text-xs ${item.up ? "text-emerald-400" : "text-red-400"}`}>{item.change}</span>
              <span className="text-white/10 ml-2">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Credibility strip */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <p className="font-serif text-base italic text-muted-foreground">
            Veritas Wealth has been serving investors, families and institutions for over <strong className="text-foreground not-italic font-medium">57 years</strong>.
          </p>
          <div className="flex items-center gap-8 text-[11px]">
            {["CIRO Registered Dealer", "CIPF Member", "Deloitte Canada Audited", "Fiduciary Standard"].map(b => (
              <span key={b} className="label-caps text-muted-foreground/60 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary/40 inline-block" /> {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Who we serve */}
      <section className="bg-cream border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-28">
          <div className="mb-12">
            <p className="label-caps text-muted-foreground mb-3">Who we serve</p>
            <div className="flex items-end justify-between gap-8">
              <h2 className="font-serif leading-tight" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
                One firm, every chapter<br />
                <em>of your financial life.</em>
              </h2>
              <p className="hidden lg:block text-[15px] text-muted-foreground max-w-xs leading-relaxed text-right">
                Whether you built your wealth over decades or over a single transaction, we meet you where you are and plan for where you want to go.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 border border-border">
            {SEGMENTS.map((seg, i) => (
              <div
                key={seg.label}
                className={`p-8 space-y-5 flex flex-col justify-between group hover:bg-primary hover:text-primary-foreground transition-colors duration-300 ${i < 3 ? "lg:border-r border-border" : ""} ${i < 2 ? "sm:border-r border-border" : ""}`}
              >
                <div className="space-y-3">
                  <span className="font-mono-nums text-[10px] text-muted-foreground group-hover:text-primary-foreground/40 transition-colors">0{i + 1}</span>
                  <h3 className="font-serif text-xl leading-snug">{seg.label}</h3>
                  <p className="text-[15px] text-muted-foreground group-hover:text-primary-foreground/70 leading-relaxed transition-colors">{seg.summary}</p>
                </div>
                <div className="pt-4 border-t border-border group-hover:border-primary-foreground/20 transition-colors space-y-2">
                  <button
                    onClick={() => setLocation("/auth")}
                    className="flex items-center gap-1.5 text-sm text-primary group-hover:text-primary-foreground font-medium transition-colors"
                  >
                    {seg.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="label-caps text-muted-foreground/50 group-hover:text-primary-foreground/30 transition-colors">{seg.min}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-secondary/40 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-32">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 lg:gap-24 items-start">
            <div className="space-y-6">
              <p className="label-caps text-muted-foreground">Our philosophy</p>
              <blockquote className="font-serif leading-snug" style={{ fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)" }}>
                "Most wealth managers optimize for growth. We optimize for outcomes. The life you actually want to live."
              </blockquote>
              <div className="pt-4 flex items-center gap-3">
                <div className="w-8 h-px bg-border" />
                <span className="text-sm text-muted-foreground">Veritas Investment Committee, 2024</span>
              </div>
              <button
                onClick={() => setLocation("/auth")}
                className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                Apply for an account <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0 divide-y divide-border">
              {PRINCIPLES.map(p => (
                <div key={p.n} className="py-7 flex gap-6">
                  <span className="font-mono-nums text-xs text-muted-foreground/50 shrink-0 mt-1">{p.n}</span>
                  <div className="space-y-2">
                    <h3 className="font-serif text-xl font-medium">{p.title}</h3>
                    <p className="text-muted-foreground text-[15px] leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="bg-[#0B2218] text-primary-foreground border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-28">
          <div className="grid lg:grid-cols-[auto_1fr] gap-16 lg:gap-32 items-start">
            <div className="lg:max-w-xs space-y-4">
              <p className="label-caps text-white/30">Verified track record</p>
              <h2 className="font-serif text-white leading-tight" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)" }}>
                Numbers that speak for themselves.
              </h2>
              <p className="text-white/50 text-[15px] leading-relaxed">
                All performance figures are net of fees, across diversified model portfolios, and audited annually by Deloitte.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-white/10">
              {[
                { v: "$4.2B", l: "Assets under management", sub: "as of Q4 2024" },
                { v: "12.4%", l: "Average 10 year return", sub: "annualised, net of fees" },
                { v: "0.32%", l: "All in annual fee", sub: "no hidden costs" },
                { v: "51K+", l: "Client accounts", sub: "across 38 countries" },
              ].map(s => (
                <div key={s.l} className="px-6 sm:px-8 first:pl-0 space-y-2 py-2">
                  <p className="font-mono-nums text-gold text-3xl sm:text-4xl font-medium tracking-tight">{s.v}</p>
                  <p className="text-white/60 text-sm leading-snug">{s.l}</p>
                  <p className="label-caps text-white/25">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Client stories */}
      <section className="bg-cream border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-32">
          <div className="flex items-end justify-between mb-14">
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Client outcomes</p>
              <h2 className="font-serif leading-tight" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
                The results speak<br />
                <em>for themselves.</em>
              </h2>
            </div>
            <p className="hidden lg:block text-xs text-muted-foreground max-w-xs leading-relaxed text-right">
              Names and identifying details have been changed with consent. All returns have been independently verified.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {STORIES.map(s => (
              <div key={s.name} className="py-10 lg:py-0 lg:px-10 first:pl-0 last:pr-0 space-y-6">
                <div>
                  <span className="font-serif text-5xl text-border leading-none">"</span>
                  <p className="font-serif text-xl italic leading-snug -mt-2">{s.quote}</p>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="w-9 h-9 bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-serif text-primary font-medium">{s.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.background}</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="label-caps text-muted-foreground mb-1">Started with</p>
                    <p className="font-mono-nums text-base">{s.before}</p>
                  </div>
                  <div className="text-muted-foreground/30 self-center">to</div>
                  <div>
                    <p className="label-caps text-muted-foreground mb-1">After {s.years} years</p>
                    <p className="font-mono-nums text-base font-medium text-primary">{s.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market insights */}
      <section className="bg-secondary/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-32">
          <div className="flex items-end justify-between mb-12">
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Market insights</p>
              <h2 className="font-serif leading-tight" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
                Thinking clearly<br />
                <em>about markets.</em>
              </h2>
            </div>
            <button className="hidden sm:flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4">
              View all insights <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Featured article */}
          <div className="border border-border p-8 sm:p-10 mb-6 group hover:border-primary/30 transition-colors cursor-pointer">
            <div className="grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-16 items-start">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="label-caps text-primary">{INSIGHTS[0].category}</span>
                  <span className="text-border">·</span>
                  <span className="label-caps text-muted-foreground">{INSIGHTS[0].date}</span>
                </div>
                <h3 className="font-serif leading-snug" style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)" }}>
                  {INSIGHTS[0].headline}
                </h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{INSIGHTS[0].excerpt}</p>
              </div>
              <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 lg:gap-6 shrink-0">
                <span className="label-caps text-muted-foreground">{INSIGHTS[0].readTime}</span>
                <span className="flex items-center gap-1.5 text-sm text-primary group-hover:underline underline-offset-4">
                  Read <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Two smaller articles */}
          <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border border-t-0">
            {INSIGHTS.slice(1).map(article => (
              <div key={article.headline} className="p-7 space-y-4 group hover:bg-cream/60 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="label-caps text-primary">{article.category}</span>
                  <span className="text-border">·</span>
                  <span className="label-caps text-muted-foreground">{article.date}</span>
                </div>
                <h3 className="font-serif text-xl leading-snug group-hover:text-primary transition-colors">{article.headline}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed line-clamp-3">{article.excerpt}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="label-caps text-muted-foreground/60">{article.readTime}</span>
                  <span className="flex items-center gap-1 text-xs text-primary group-hover:underline underline-offset-4">
                    Read <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-cream border-b border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-32">
          <div className="space-y-14">
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Getting started</p>
              <h2 className="font-serif leading-tight" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
                From application to<br />
                invested in 5 business days.
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {[
                { n: "01", title: "Apply online", body: "Complete our brief application. We read every one ourselves. No algorithm decides whether you're a fit." },
                { n: "02", title: "Advisory call", body: "Your assigned advisor goes through your full financial picture with you and proposes a strategy for your sign off." },
                { n: "03", title: "Fund your account", body: "Send funds via wire or ACH. Minimum opening balance is $500,000,000. No lock up periods ever." },
                { n: "04", title: "Portfolio goes live", body: "We build and deploy your portfolio within two trading days. Your reporting dashboard is active from day one." },
              ].map(step => (
                <div key={step.n} className="py-8 sm:py-0 sm:px-8 first:pl-0 last:pr-0 space-y-4">
                  <span className="font-mono-nums text-xs text-muted-foreground/40">{step.n}</span>
                  <h3 className="font-serif text-xl">{step.title}</h3>
                  <p className="text-muted-foreground text-[15px] leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="label-caps text-primary-foreground/30">Ready to begin?</p>
              <h2 className="font-serif leading-tight text-white" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>
                Serious capital deserves<br />
                <em>serious stewardship.</em>
              </h2>
              <p className="text-primary-foreground/60 text-[15px] leading-relaxed max-w-sm">
                The application takes about 15 minutes. Your advisor will reach out within one business day to talk through your goals and see if we're the right fit for each other.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start gap-4">
              <button
                onClick={() => setLocation("/auth")}
                className="flex items-center gap-2 bg-white text-primary text-sm font-medium px-8 py-4 hover:bg-cream transition-colors whitespace-nowrap"
                data-testid="button-apply-final"
              >
                Begin your application <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLocation("/auth")}
                className="label-caps text-primary-foreground/40 hover:text-primary-foreground flex items-center gap-1.5 transition-colors"
              >
                Client login <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-white/10 grid sm:grid-cols-2 gap-4 text-[11px] text-primary-foreground/25 leading-relaxed">
            <p>Veritas Wealth Management, LLC is a registered investment adviser. Registration does not imply a certain level of skill or training. Past performance is not a guarantee of future results.</p>
            <p>All figures shown are based on model portfolio returns and may differ from individual client outcomes. Fees may vary based on account size and service level. Please refer to our ADV for full disclosures.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
