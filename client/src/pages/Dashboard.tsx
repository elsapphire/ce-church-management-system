import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useMembers } from "@/hooks/use-members";
import { useAttendanceStats } from "@/hooks/use-attendance";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Users, UserCheck, CalendarDays, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";

const COLORS = ['hsl(var(--primary))', '#ef4444']; // Primary and Red-500 for Absent

export default function Dashboard() {
  const { data: hierarchy } = useHierarchy();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isGroupPastor = user?.role === "group_pastor";
  const isPcfLeader = user?.role === "pcf_leader";
  const isCellLeader = user?.role === "cell_leader";

  const { data: members } = useMembers();
  const { data: stats } = useAttendanceStats();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("latest");

  // Calculate aggregated stats
  const totalMembers = members?.length || 0;
  const activeMembers = members?.filter(m => m.status === 'Active').length || 0;
  const totalCells = hierarchy?.cells.length || 0;

  const currentService = useMemo(() => {
    if (!stats || stats.length === 0) return null;
    if (selectedServiceId === "latest") return stats[0];
    return stats.find(s => s.serviceId === Number(selectedServiceId)) || stats[0];
  }, [stats, selectedServiceId]);

  // Prepare chart data from stats
  const chartData = stats?.slice(0, 5).map(stat => ({
    name: stat.serviceName,
    present: stat.totalPresent,
  })) || [];

  const snapshotData = useMemo(() => {
    if (!currentService) return [];
    const present = currentService.totalPresent;
    const absent = Math.max(0, totalMembers - present);
    return [
      { name: 'Present', value: present },
      { name: 'Absent', value: absent },
    ];
  }, [currentService, totalMembers]);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Dashboard</h1>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary">
              {isAdmin && hierarchy?.church?.name ? `Zone: ${hierarchy.church.name}` :
               isGroupPastor && user?.groupId ? `Group: ${hierarchy?.groups.find(g => g.id === user.groupId)?.name || 'Loading...'}` :
               isPcfLeader && user?.pcfId ? `PCF: ${hierarchy?.pcfs.find(p => p.id === user.pcfId)?.name || 'Loading...'}` :
               isCellLeader && user?.cellId ? `Cell: ${hierarchy?.cells.find(c => c.id === user.cellId)?.name || 'Loading...'}` :
               null}
            </p>
            <p className="text-muted-foreground">
              {isAdmin ? "Overview of church growth and attendance metrics across the zone." :
               isGroupPastor ? "Overview of your group's performance and growth." :
               isPcfLeader ? "Overview of your PCF's performance." :
               "Overview of your cell's performance."}
            </p>
          </div>
        </div>
        
        {stats && stats.length > 0 && (
          <div className="w-full md:w-64">
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest Service</SelectItem>
                {stats.map(s => (
                  <SelectItem key={s.serviceId} value={s.serviceId.toString()}>
                    {s.serviceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
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

        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold font-display">Attendance Snapshot</h3>
            <p className="text-sm text-muted-foreground">Present vs Absent for {currentService?.serviceName || 'selected service'}</p>
          </div>
          <div className="h-[300px] w-full flex items-center justify-center">
            {snapshotData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={snapshotData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {snapshotData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground font-bold text-xl"
                  >
                    {currentService ? Math.round((currentService.totalPresent / totalMembers) * 100) : 0}%
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No data available</p>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {snapshotData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-xs font-medium">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
