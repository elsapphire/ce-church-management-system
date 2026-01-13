import { Layout } from "@/components/Layout";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Network, Layers, Home, Trash2, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Structure() {
  const { data: hierarchy, isLoading } = useHierarchy();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  // Forms state
  const [groupName, setGroupName] = useState("");
  const [pcfName, setPcfName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [cellName, setCellName] = useState("");
  const [selectedPcfId, setSelectedPcfId] = useState<string>("");

  const handleAddGroup = async () => {
    if (!groupName || !hierarchy?.church?.id) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/groups", { name: groupName, churchId: hierarchy.church.id });
      toast({ title: "Success", description: "Group added successfully" });
      setGroupName("");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
    } catch (err) {
      toast({ title: "Error", description: "Failed to add group", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleAddPcf = async () => {
    if (!pcfName || !selectedGroupId) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/pcfs", { name: pcfName, groupId: Number(selectedGroupId) });
      toast({ title: "Success", description: "PCF added successfully" });
      setPcfName("");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
    } catch (err) {
      toast({ title: "Error", description: "Failed to add PCF", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleAddCell = async () => {
    if (!cellName || !selectedPcfId) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/cells", { name: cellName, pcfId: Number(selectedPcfId) });
      toast({ title: "Success", description: "Cell added successfully" });
      setCellName("");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
    } catch (err) {
      toast({ title: "Error", description: "Failed to add cell", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading structure...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Organization Structure</h1>
        <p className="text-muted-foreground">Manage your church hierarchy by adding and viewing Groups, PCFs, and Cells.</p>
      </div>

      <Tabs defaultValue="groups" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="groups" className="gap-2">
            <Home className="w-4 h-4" /> Groups
          </TabsTrigger>
          <TabsTrigger value="pcfs" className="gap-2">
            <Layers className="w-4 h-4" /> PCFs
          </TabsTrigger>
          <TabsTrigger value="cells" className="gap-2">
            <Network className="w-4 h-4" /> Cells
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Add New Group</CardTitle>
                <CardDescription>Create a new administrative group.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input 
                    id="group-name" 
                    placeholder="e.g. Abuja Group 1" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleAddGroup} disabled={isPending || !groupName}>
                  <Plus className="w-4 h-4 mr-2" /> Add Group
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Existing Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>PCFs Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hierarchy?.groups.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell>
                          {hierarchy.pcfs.filter(p => p.groupId === g.id).length}
                        </TableCell>
                      </TableRow>
                    ))}
                    {hierarchy?.groups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                          No groups found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pcfs" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Add New PCF</CardTitle>
                <CardDescription>Associate a PCF with a group.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Parent Group</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {hierarchy?.groups.map(g => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pcf-name">PCF Name</Label>
                  <Input 
                    id="pcf-name" 
                    placeholder="e.g. PCF Name" 
                    value={pcfName}
                    onChange={(e) => setPcfName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleAddPcf} disabled={isPending || !pcfName || !selectedGroupId}>
                  <Plus className="w-4 h-4 mr-2" /> Add PCF
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Existing PCFs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PCF Name</TableHead>
                      <TableHead>Parent Group</TableHead>
                      <TableHead>Cells Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hierarchy?.pcfs.map(p => {
                      const group = hierarchy.groups.find(g => g.id === p.groupId);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">{group?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            {hierarchy.cells.filter(c => c.pcfId === p.id).length}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {hierarchy?.pcfs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                          No PCFs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cells" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Add New Cell</CardTitle>
                <CardDescription>Create a cell within a PCF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Parent PCF</Label>
                  <Select value={selectedPcfId} onValueChange={setSelectedPcfId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select PCF" />
                    </SelectTrigger>
                    <SelectContent>
                      {hierarchy?.pcfs.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cell-name">Cell Name</Label>
                  <Input 
                    id="cell-name" 
                    placeholder="e.g. Wisdom Cell" 
                    value={cellName}
                    onChange={(e) => setCellName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleAddCell} disabled={isPending || !cellName || !selectedPcfId}>
                  <Plus className="w-4 h-4 mr-2" /> Add Cell
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Existing Cells</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cell Name</TableHead>
                      <TableHead>Parent PCF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hierarchy?.cells.map(c => {
                      const pcf = hierarchy.pcfs.find(p => p.id === c.pcfId);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-muted-foreground">{pcf?.name || 'Unknown'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {hierarchy?.cells.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                          No cells found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}