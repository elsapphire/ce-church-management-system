import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  ClipboardCheck, 
  BarChart3, 
  Settings,
  LogOut,
  Church,
  Network
} from "lucide-react";
import logoUrl from "@assets/ce-logo-removebg-preview_1768304044152.png";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const getRoleLabel = (role?: string | null) => {
  switch (role) {
    case "admin": return "Zonal Pastor";
    case "group_pastor": return "Group Pastor";
    case "pcf_leader": return "PCF Leader";
    case "cell_leader": return "Cell Leader";
    default: return "Member";
  }
};

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/services", label: "Services", icon: Calendar, roles: ["admin", "group_pastor"] },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "group_pastor"] },
  { href: "/structure", label: "Structure", icon: Network, roles: ["admin", "group_pastor", "pcf_leader"] },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const filteredNavItems = navItems.filter(item => 
    !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r border-border shadow-sm">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Abuja Zone 1</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Attendance System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <Link key={item.href} href={item.href} className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
            location === item.href 
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>
              <item.icon className="w-5 h-5" />
              {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <Badge variant="secondary" className="text-[10px] mt-1" data-testid="badge-role">
              {getRoleLabel(user?.role)}
            </Badge>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
