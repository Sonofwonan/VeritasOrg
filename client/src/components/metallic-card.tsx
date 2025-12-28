import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

interface MetallicCardProps {
  userName: string;
  balance: number;
  accountType: string;
  lastFour: string;
  className?: string;
}

export function MetallicCard({
  userName,
  balance,
  accountType,
  lastFour,
  className
}: MetallicCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("perspective-1000", className)}
    >
      <Card className="relative w-full aspect-[1.586/1] overflow-hidden rounded-2xl border-none shadow-2xl transition-transform duration-500 preserve-3d group hover:rotate-y-12">
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
            <div className="text-right">
              <p className="text-[10px] tracking-[0.2em] font-bold text-primary mb-1">PREMIUM</p>
              <div className="flex gap-1 justify-end">
                <div className="w-8 h-6 rounded-sm bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                   <div className="w-full h-[1px] bg-amber-500/40 rotate-12 scale-150" />
                   <div className="w-full h-[1px] bg-amber-500/40 -rotate-12 scale-150" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] tracking-[0.3em] font-medium text-white/40 uppercase">Card Number</p>
            <div className="flex gap-4 text-2xl font-mono tracking-widest text-white/90 drop-shadow-md">
              <span>****</span>
              <span>****</span>
              <span>****</span>
              <span className="text-white">{lastFour}</span>
            </div>
          </div>

          <div className="flex justify-between items-end">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[8px] tracking-[0.2em] font-medium text-white/40 uppercase">Account Holder</p>
                <p className="font-bold tracking-tight text-lg uppercase text-white/90">{userName}</p>
              </div>
              <div className="flex gap-8">
                <div className="space-y-0.5">
                  <p className="text-[8px] tracking-[0.2em] font-medium text-white/40 uppercase">Expires</p>
                  <p className="font-mono text-xs font-bold text-white/80">12 / 29</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] tracking-[0.2em] font-medium text-white/40 uppercase">Type</p>
                  <p className="text-[10px] font-bold text-white/80 uppercase">{accountType.split(' ')[0]}</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                 <div className="w-10 h-10 rounded-full bg-red-600/60 blur-[1px] -mr-4" />
                 <div className="w-10 h-10 rounded-full bg-amber-500/60 blur-[1px]" />
              </div>
              <p className="absolute bottom-0 right-0 text-[8px] font-bold tracking-tighter italic text-white/40">WORLD ELITE</p>
            </div>
          </div>
        </div>
        
        {/* Subtle Inner Border */}
        <div className="absolute inset-4 rounded-xl border border-white/5 pointer-events-none" />
      </Card>
    </motion.div>
  );
}
