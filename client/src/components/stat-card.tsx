import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  trendValue,
  className 
}: StatCardProps) {
  return (
    <Card className={cn(
      "border-none shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300", 
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-full", 
          trend === "up" ? "bg-emerald-500/10 text-emerald-500" : 
          trend === "down" ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display tracking-tight">{value}</div>
        {(description || trendValue) && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trendValue && (
              <span className={cn(
                "font-medium",
                trend === "up" ? "text-emerald-500" : 
                trend === "down" ? "text-rose-500" : "text-muted-foreground"
              )}>
                {trend === "up" ? "+" : ""}{trendValue}
              </span>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
