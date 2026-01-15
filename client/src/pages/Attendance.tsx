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
import { QrCode, CheckCircle2, User, Search, Lock, Users, UserX, Printer, FileDown, ChevronDown, Check } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatsCard } from "@/components/StatsCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

  const handleExportPDF = () => {
    if (!selectedServiceId || !services || !allMembers || !records) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;

    const doc = new jsPDF();
    const serviceDate = format(new Date(service.date), 'MMMM d, yyyy');
    
    doc.setFontSize(18);
    doc.text(`Attendance Report: ${service.name}`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Date: ${serviceDate}`, 14, 28);
    doc.text(`Summary: ${presentCount} Present, ${absentCount} Absent`, 14, 35);

    const presentData = records.map((r, i) => [
      i + 1,
      r.member.fullName,
      r.member.title,
      r.member.cellGroup || '-',
      r.member.pcf || '-',
      r.member.phone || '-'
    ]);

    doc.setFontSize(14);
    doc.text('Present Members', 14, 45);
    autoTable(doc, {
      startY: 50,
      head: [['#', 'Name', 'Title', 'Cell', 'PCF', 'Phone']],
      body: presentData,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });

    const presentIds = new Set(records.map(r => r.memberId));
    const absentMembers = allMembers.filter(m => !presentIds.has(m.id));
    const absentData = absentMembers.map((m, i) => [
      i + 1,
      m.fullName,
      m.title,
      m.cellGroup || '-',
      m.pcf || '-',
      m.phone || '-'
    ]);

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.text('Absent Members', 14, finalY + 15);
    autoTable(doc, {
      startY: finalY + 20,
      head: [['#', 'Name', 'Title', 'Cell', 'PCF', 'Phone']],
      body: absentData,
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43] }
    });

    doc.save(`Attendance_${service.name}_${format(new Date(service.date), 'yyyy-MM-dd')}.pdf`);
  };

  const handleExportXLSX = () => {
    if (!selectedServiceId || !services || !allMembers || !records) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;

    const presentIds = new Set(records.map(r => r.memberId));
    const absentMembers = allMembers.filter(m => !presentIds.has(m.id));

    const formatMember = (m: any, i: number) => ({
      '#': i + 1,
      'Name': m.fullName,
      'Title': m.title,
      'Cell': m.cellGroup || '-',
      'PCF': m.pcf || '-',
      'Phone': m.phone || '-'
    });

    const presentSheetData = records.map((r, i) => formatMember(r.member, i));
    const absentSheetData = absentMembers.map((m, i) => formatMember(m, i));

    const wb = XLSX.utils.book_new();
    const wsPresent = XLSX.utils.json_to_sheet(presentSheetData);
    const wsAbsent = XLSX.utils.json_to_sheet(absentSheetData);

    XLSX.utils.book_append_sheet(wb, wsPresent, "Present Members");
    XLSX.utils.book_append_sheet(wb, wsAbsent, "Absent Members");

    XLSX.writeFile(wb, `Attendance_${service.name}_${format(new Date(service.date), 'yyyy-MM-dd')}.xlsx`);
  };

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
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleExportPDF}>
                <Printer className="h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleExportXLSX}>
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
          <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground gap-1">
            {hasMarkPermission && (
              <TabsTrigger value="mark" data-testid="tab-mark" className="px-4 py-2">Mark Attendance</TabsTrigger>
            )}
            <TabsTrigger value="list" data-testid="tab-list" className="px-4 py-2">Members in Church</TabsTrigger>
            <TabsTrigger value="absent" data-testid="tab-absent" className="px-4 py-2">Members Absent</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats" className="px-4 py-2">Statistics</TabsTrigger>
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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [queue, setQueue] = useState<any[]>([]);
  const { mutate, isPending } = useMarkAttendance();
  const { data: members } = useMembers();

  const addToQueue = (member: any) => {
    if (!queue.find(m => m.id === member.id)) {
      setQueue([...queue, member]);
    }
    setOpen(false);
    setSearchValue("");
  };

  const removeFromQueue = (memberId: number) => {
    setQueue(queue.filter(m => m.id !== memberId));
  };

  const handleBatchMark = () => {
    if (queue.length === 0) return;
    
    // In Fast Mode, we'll iterate through the queue. 
    // Ideally the backend would have a batch endpoint, but we'll stick to the logic as requested.
    queue.forEach((member, index) => {
      mutate({
        serviceId,
        memberId: member.id,
        method: "manual",
        location: "Main Auditorium"
      }, {
        onSuccess: () => {
          if (index === queue.length - 1) {
            setQueue([]);
          }
        }
      });
    });
  };

  const handleSimulatedQR = () => {
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
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Member Search</CardTitle>
          <CardDescription>Search by name or ID to add to queue.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={isPending}
              >
                {searchValue || "Search member..."}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command className="w-full">
                <CommandInput placeholder="Type name or ID..." />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No member found.</CommandEmpty>
                  <CommandGroup>
                    {members?.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={`${member.fullName} ${member.id}`}
                        onSelect={() => addToQueue(member)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{member.fullName}</span>
                          <span className="text-xs text-muted-foreground">ID: {member.id} • {member.title}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {queue.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-semibold mb-2">Queue ({queue.length})</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {queue.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{member.fullName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {member.title} • {member.cellGroup || 'No Cell'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => removeFromQueue(member.id)}
                    >
                      <UserX className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        {queue.length > 0 && (
          <div className="p-6 pt-0 mt-auto flex justify-end">
            <Button 
              onClick={handleBatchMark} 
              disabled={isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Present ({queue.length})
            </Button>
          </div>
        )}
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
      <div className="p-6 border-b border-border bg-muted/10">
        <h3 className="font-semibold text-lg">{records?.length || 0} Members in Church</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-bold border-b border-border">
            <tr>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Time</th>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Member</th>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Method</th>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records?.map((record) => (
              <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {record.checkInTime ? format(new Date(record.checkInTime), 'h:mm a') : '-'}
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{record.member.fullName}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="capitalize px-2 py-1 rounded-full bg-muted text-[10px] font-semibold">
                    {record.method.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{record.location || '-'}</td>
              </tr>
            ))}
            {!records?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic text-sm">No attendance records yet for this service.</td>
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
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border bg-muted/10">
        <h3 className="font-semibold text-lg">{absentMembers.length} Members Absent</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-bold border-b border-border">
            <tr>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Member</th>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Phone</th>
              <th className="px-4 py-3 tracking-wider leading-6 border-r border-border/10 last:border-r-0">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {absentMembers.map((member) => (
              <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{member.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{member.phone || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                    member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {member.status}
                  </span>
                </td>
              </tr>
            ))}
            {absentMembers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic text-sm">All members are present!</td>
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