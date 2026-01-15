import { Layout } from "@/components/Layout";
import { useServices } from "@/hooks/use-services";
import { useAttendanceList, useMarkAttendance, useAttendanceStats } from "@/hooks/use-attendance";
import { useMembers } from "@/hooks/use-members";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
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
import { QrCode, CheckCircle2, User, Search, Lock } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const canMarkAttendance = (role?: string | null) => {
  return role === "admin" || role === "group_pastor";
};

export default function Attendance() {
  const { data: services } = useServices();
  const { user } = useAuth();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const hasMarkPermission = canMarkAttendance(user?.role);

  // Default to first active service if available and none selected
  if (!selectedServiceId && services?.length) {
    const activeService = services.find(s => s.active) || services[0];
    if (activeService) setSelectedServiceId(activeService.id);
  }

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display">Attendance</h1>
        <p className="text-muted-foreground">Mark and monitor attendance records.</p>
      </div>

      <div className="w-full max-w-xs mb-6">
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

      {selectedServiceId ? (
        <Tabs defaultValue={hasMarkPermission ? "mark" : "list"} className="w-full">
          <TabsList className={`grid w-full max-w-[400px] ${hasMarkPermission ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {hasMarkPermission && (
              <TabsTrigger value="mark" data-testid="tab-mark">Mark Attendance</TabsTrigger>
            )}
            <TabsTrigger value="list" data-testid="tab-list">View List</TabsTrigger>
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
              Marking attendance is only available for Zonal Pastors and Group Pastors.
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
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/10">
        <h3 className="font-semibold">{records?.length || 0} Attendees</h3>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
          <tr>
            <th className="px-6 py-4">Time</th>
            <th className="px-6 py-4">Member</th>
            <th className="px-6 py-4">Method</th>
            <th className="px-6 py-4">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records?.map((record) => (
            <tr key={record.id}>
              <td className="px-6 py-4 text-muted-foreground">
                {record.checkInTime ? format(new Date(record.checkInTime), 'h:mm a') : '-'}
              </td>
              <td className="px-6 py-4 font-medium">{record.member.fullName}</td>
              <td className="px-6 py-4">
                <span className="capitalize px-2 py-1 rounded-full bg-muted text-xs">
                  {record.method.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-muted-foreground">{record.location || '-'}</td>
            </tr>
          ))}
          {!records?.length && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No attendance records yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceStatsPanel({ serviceId }: { serviceId: number }) {
  const { data: stats } = useAttendanceStats(serviceId);
  
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
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
    </div>
  );
}
