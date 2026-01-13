import { Layout } from "@/components/Layout";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Network, Layers, Home } from "lucide-react";

export default function Structure() {
  const { data: hierarchy } = useHierarchy();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

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

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display tracking-tight">Organization Structure</h1>
        <p className="text-muted-foreground">Manage your church hierarchy by adding new Groups, PCFs, and Cells.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Group */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Home className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Add Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input 
                id="group-name" 
                placeholder="Enter group name" 
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAddGroup} disabled={isPending || !groupName}>
              <Plus className="w-4 h-4 mr-2" /> Add Group
            </Button>
          </CardContent>
        </Card>

        {/* Add PCF */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Add PCF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group" />
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
                placeholder="Enter PCF name" 
                value={pcfName}
                onChange={(e) => setPcfName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAddPcf} disabled={isPending || !pcfName || !selectedGroupId}>
              <Plus className="w-4 h-4 mr-2" /> Add PCF
            </Button>
          </CardContent>
        </Card>

        {/* Add Cell */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Network className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Add Cell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select PCF</Label>
              <Select value={selectedPcfId} onValueChange={setSelectedPcfId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a PCF" />
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
                placeholder="Enter cell name" 
                value={cellName}
                onChange={(e) => setCellName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAddCell} disabled={isPending || !cellName || !selectedPcfId}>
              <Plus className="w-4 h-4 mr-2" /> Add Cell
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}