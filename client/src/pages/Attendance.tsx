import { Layout } from "@/components/Layout";
import { useServices } from "@/hooks/use-services";
import { useAttendanceList, useMarkAttendance, useAttendanceStats } from "@/hooks/use-attendance";
import { useMembers } from "@/hooks/use-members";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QrCode, CheckCircle2, User, Search, Lock, Users, UserX, Printer, FileDown, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatsCard } from "@/components/StatsCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const canMarkAttendance = (role?: string | null) => {
  return role === "admin" || role === "group_pastor";
};

export default function Attendance() {
  const { data: services } = useServices();
  const { data: allMembers } = useMembers();
  const { user } = useAuth();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const hasMarkPermission = canMarkAttendance(user?.role);

  // Default to first active service if available and none selected
  if (!selectedServiceId && services?.length) {
    const activeService = services.find(s => s.active) || services[0];
    if (activeService) setSelectedServiceId(activeService.id);
  }

  const { data: records } = useAttendanceList(selectedServiceId || 0);

  const presentCount = records?.length || 0;
  const absentCount = Math.max(0, (allMembers?.length || 0) - presentCount);

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display">Attendance</h1>
        <p className="text-muted-foreground">Mark and monitor attendance records.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 mt-4">
        <div className="w-full max-w-xs">
          <label className="text-sm font-medium mb-1.5 block">Select Service</label>
          <Select 
            value={selectedServiceId?.toString()} 
            onValueChange={(val) => setSelectedServiceId(Number(val))}
          >
            <SelectTrigger data-testid="select-service">
              <SelectValue placeholder="Choose a service..." />
            </SelectTrigger>
            <SelectContent>
              {services?.map((service) => (
                <SelectItem key={service.id} value={service.id.toString()}>
                  {service.name} ({format(new Date(service.date), 'MMM d')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileDown className="h-4 w-4" />
                Print / Export
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print as PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => alert('Exporting to XLSX...')}>
                <FileDown className="h-4 w-4" />
                Export as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatsCard
          title="Members in Church"
          value={presentCount}
          icon={Users}
          description="Marked as present"
        />
        <StatsCard
          title="Members Absent"
          value={absentCount}
          icon={UserX}
          description="Not yet marked present"
        />
      </div>

      {selectedServiceId ? (
        <Tabs defaultValue={hasMarkPermission ? "mark" : "list"} className="w-full">
          <TabsList className={`grid w-full max-w-[500px] ${hasMarkPermission ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {hasMarkPermission && (
              <TabsTrigger value="mark" data-testid="tab-mark">Mark Attendance</TabsTrigger>
            )}
            <TabsTrigger value="list" data-testid="tab-list">Members in Church</TabsTrigger>
            <TabsTrigger value="absent" data-testid="tab-absent">Members Absent</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            {hasMarkPermission && (
              <TabsContent value="mark">
                <MarkAttendancePanel serviceId={selectedServiceId} />
              </TabsContent>
            )}
            
            <TabsContent value="list">
              <AttendanceListPanel serviceId={selectedServiceId} />
            </TabsContent>

            <TabsContent value="absent">
              <AbsentMembersPanel serviceId={selectedServiceId} />
            </TabsContent>
            
            <TabsContent value="stats">
              <AttendanceStatsPanel serviceId={selectedServiceId} />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">Select a service to manage attendance.</p>
        </div>
      )}

      {!hasMarkPermission && (
        <Card className="mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Only Zonal Pastors and Group Pastors can record attendance.
            </p>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}

function MarkAttendancePanel({ serviceId }: { serviceId: number }) {
  const [memberIdInput, setMemberIdInput] = useState("");
  const { mutate, isPending } = useMarkAttendance();
  const { data: members } = useMembers(); // To lookup names

  const handleMark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberIdInput) return;

    mutate({
      serviceId,
      memberId: Number(memberIdInput),
      method: "manual",
      location: "Main Auditorium"
    }, {
      onSuccess: () => setMemberIdInput("")
    });
  };

  const handleSimulatedQR = () => {
    // Simulate reading a QR code (random existing member for demo)
    if (!members?.length) return;
    const randomMember = members[Math.floor(Math.random() * members.length)];
    mutate({
      serviceId,
      memberId: randomMember.id,
      method: "qr_code",
      location: "Main Auditorium"
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Manual Entry</CardTitle>
          <CardDescription>Enter Member ID directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMark} className="space-y-4">
            <Input 
              placeholder="Enter Member ID..." 
              value={memberIdInput}
              onChange={(e) => setMemberIdInput(e.target.value)}
              type="number"
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Marking..." : "Submit Attendance"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary">QR Check-in</CardTitle>
          <CardDescription>Scan member QR code.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="p-4 bg-white rounded-xl shadow-sm mb-4">
            <QrCode className="w-16 h-16 text-primary" />
          </div>
          <Button variant="outline" onClick={handleSimulatedQR} disabled={isPending}>
            Simulate Scan (Demo)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceListPanel({ serviceId }: { serviceId: number }) {
  const { data: records, isLoading } = useAttendanceList(serviceId);

  if (isLoading) return <p>Loading records...</p>;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print:border-none print:shadow-none">
      <div className="p-6 border-b border-border bg-muted/10 print:px-0">
        <h3 className="font-semibold text-lg">{records?.length || 0} Members in Church</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-bold border-b border-border">
            <tr>
              <th className="px-8 py-5 tracking-wider">Time</th>
              <th className="px-8 py-5 tracking-wider">Member</th>
              <th className="px-8 py-5 tracking-wider">Method</th>
              <th className="px-8 py-5 tracking-wider">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records?.map((record) => (
              <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-8 py-5 text-muted-foreground">
                  {record.checkInTime ? format(new Date(record.checkInTime), 'h:mm a') : '-'}
                </td>
                <td className="px-8 py-5 font-medium">{record.member.fullName}</td>
                <td className="px-8 py-5">
                  <span className="capitalize px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                    {record.method.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-8 py-5 text-muted-foreground">{record.location || '-'}</td>
              </tr>
            ))}
            {!records?.length && (
              <tr>
                <td colSpan={4} className="px-8 py-12 text-center text-muted-foreground italic text-base">No attendance records yet for this service.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbsentMembersPanel({ serviceId }: { serviceId: number }) {
  const { data: allMembers, isLoading: loadingMembers } = useMembers();
  const { data: records, isLoading: loadingAttendance } = useAttendanceList(serviceId);

  const absentMembers = useMemo(() => {
    if (!allMembers || !records) return [];
    const presentIds = new Set(records.map(r => r.memberId));
    return allMembers.filter(m => !presentIds.has(m.id));
  }, [allMembers, records]);

  if (loadingMembers || loadingAttendance) return <p>Loading members...</p>;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print:border-none print:shadow-none">
      <div className="p-6 border-b border-border bg-muted/10 print:px-0">
        <h3 className="font-semibold text-lg">{absentMembers.length} Members Absent</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-bold border-b border-border">
            <tr>
              <th className="px-8 py-5 tracking-wider">Member</th>
              <th className="px-8 py-5 tracking-wider">Phone</th>
              <th className="px-8 py-5 tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {absentMembers.map((member) => (
              <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-8 py-5 font-medium">{member.fullName}</td>
                <td className="px-8 py-5 text-muted-foreground">{member.phone || '-'}</td>
                <td className="px-8 py-5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {member.status}
                  </span>
                </td>
              </tr>
            ))}
            {absentMembers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-8 py-12 text-center text-muted-foreground italic text-base">All members are present!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function AttendanceStatsPanel({ serviceId }: { serviceId: number }) {
  const { data: stats } = useAttendanceStats(serviceId);
  const { user } = useAuth();
  
  if (!stats?.[0]) return <p>No stats available.</p>;
  
  const currentStat = stats[0];
  const methodData = Object.entries(currentStat.byMethod).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }));

  const cellData = Object.entries(currentStat.byCell).map(([id, value]) => ({
    name: `Cell ${id}`,
    value
  }));

  const showCellBreakdown = user?.role === "admin" || user?.role === "group_pastor" || user?.role === "pcf_leader";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className={!showCellBreakdown ? "md:col-span-2" : ""}>
        <CardHeader>
          <CardTitle>Check-in Methods</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={methodData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {showCellBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>By Cell Group</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cellData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--secondary-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
