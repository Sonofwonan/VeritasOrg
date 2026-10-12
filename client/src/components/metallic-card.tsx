import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

interface MetallicCardProps {
  userName: string;
  accountType: string;
  accountNumber: string;
  className?: string;
}

export function MetallicCard({
  userName,
  accountType,
  accountNumber,
  className
}: MetallicCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("perspective-1000", className)}
    >
      <Card className="wealth-card relative w-full aspect-[1.586/1] overflow-hidden rounded-2xl border-none shadow-2xl transition-transform duration-500 preserve-3d group hover:rotate-y-12">
        {/* Metallic Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#333] to-[#0a0a0a] shadow-[inset_0_0_100px_rgba(255,255,255,0.05)]" />
        
        {/* Metallic Texture/Sheen */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        {/* Card Content */}
        <div className="relative h-full p-8 flex flex-col justify-between text-white z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain brightness-125" />
              </div>
              <div>
                <h3 className="font-bold tracking-tighter text-lg leading-tight">VERITAS</h3>
                <p className="text-[10px] tracking-[0.2em] font-medium text-white/50">WEALTH MANAGEMENT</p>
              </div>
            </div>
            <p className="text-[9px] tracking-[0.18em] font-semibold text-white/55 text-right">APPLICATION ACCOUNT</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] tracking-[0.3em] font-medium text-white/55 uppercase">Application account number</p>
            <p className="font-mono text-xl tracking-[0.18em] text-white/90 drop-shadow-md">{accountNumber}</p>
            <p className="text-[9px] leading-relaxed text-white/55">Veritas account identification only—not a payment card or external payment instruction.</p>
          </div>

          <div className="flex justify-between items-end">
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-[8px] tracking-[0.2em] font-medium text-white/40 uppercase">Account Holder</p>
                <p className="font-bold tracking-tight text-lg uppercase text-white/90">{userName}</p>
              </div>
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/65">{accountType}</p>
          </div>
        </div>
        
        {/* Subtle Inner Border */}
        <div className="absolute inset-4 rounded-xl border border-white/5 pointer-events-none" />
      </Card>
    </motion.div>
  );
}
