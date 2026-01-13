import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, description, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-md card-hover", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="p-2 bg-primary/10 rounded-full">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <h2 className="text-3xl font-bold font-display">{value}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center text-xs font-medium mt-1",
              trend.positive ? "text-green-600" : "text-red-600"
            )}>
              {trend.positive ? "+" : ""}{trend.value}%
              <span className="text-muted-foreground ml-1 font-normal text-xs">{trend.label}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
