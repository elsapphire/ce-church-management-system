import { Layout } from "@/components/Layout";
import { useAttendanceStats } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function Reports() {
  const { data: stats } = useAttendanceStats();
  
  // Sort stats by service ID (assuming ID correlates to date for simplicity, or we could sort by date if available)
  const sortedStats = [...(stats || [])].sort((a, b) => a.serviceId - b.serviceId);

  const trendData = sortedStats.map(s => ({
    name: s.serviceName,
    Total: s.totalPresent,
    QRCode: s.byMethod.qr_code || 0,
    Manual: s.byMethod.manual || 0
  }));

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display">Reports</h1>
        <p className="text-muted-foreground">Deep dive into attendance analytics.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Attendance Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Total" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Check-in Method Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="QRCode" stackId="a" fill="#10b981" />
                <Bar dataKey="Manual" stackId="a" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
