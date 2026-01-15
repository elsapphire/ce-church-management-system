import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useMembers } from "@/hooks/use-members";
import { useAttendanceStats } from "@/hooks/use-attendance";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Users, UserCheck, CalendarDays, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const { data: hierarchy } = useHierarchy();
  const { data: members } = useMembers();
  const { data: stats } = useAttendanceStats();
  const { user } = useAuth();

  // Calculate aggregated stats
  const totalMembers = members?.length || 0;
  const activeMembers = members?.filter(m => m.status === 'Active').length || 0;
  const totalCells = hierarchy?.cells.length || 0;

  const isAdmin = user?.role === "admin";
  const isGroupPastor = user?.role === "group_pastor";
  
  // Prepare chart data from stats
  const chartData = stats?.slice(0, 5).map(stat => ({
    name: stat.serviceName,
    present: stat.totalPresent,
  })) || [];

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Overview of church growth and attendance metrics across the zone." :
           isGroupPastor ? "Overview of your group's performance and growth." :
           user?.role === "pcf_leader" ? "Overview of your PCF's performance." :
           "Overview of your cell's performance."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Members" 
          value={totalMembers} 
          icon={Users}
          description={isAdmin ? "Registered members in zone" : "Accessible members"}
        />
        <StatsCard 
          title="Active Members" 
          value={activeMembers} 
          icon={UserCheck}
          description="Status: Active"
        />
        <StatsCard 
          title={isAdmin ? "Total Cells" : "Accessible Cells"}
          value={totalCells} 
          icon={TrendingUp}
          description={isAdmin ? "Across all Groups" : isGroupPastor ? "In your Group" : "In your PCF"}
        />
        <StatsCard 
          title="Recent Services" 
          value={stats?.length || 0} 
          icon={CalendarDays}
          description="Services recorded"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {(isAdmin || isGroupPastor) && (
          <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold font-display">Attendance Trends</h3>
              <p className="text-sm text-muted-foreground">Number of attendees per service</p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="present" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={cn(
          "bg-card rounded-xl border border-border/50 shadow-sm p-6",
          !(isAdmin || isGroupPastor) && "lg:col-span-3"
        )}>
          <div className="mb-6">
            <h3 className="text-lg font-bold font-display">Structure Overview</h3>
            <p className="text-sm text-muted-foreground">Organizational breakdown</p>
          </div>
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm font-medium">Groups</span>
                <span className="font-bold text-primary">{hierarchy?.groups.length || 0}</span>
              </div>
            )}
            {(isAdmin || isGroupPastor) && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm font-medium">PCFs</span>
                <span className="font-bold text-primary">{hierarchy?.pcfs.length || 0}</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-sm font-medium">Cells</span>
              <span className="font-bold text-primary">{hierarchy?.cells.length || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
