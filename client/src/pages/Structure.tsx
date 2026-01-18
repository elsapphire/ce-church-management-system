import { Layout } from "@/components/Layout";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useUsers } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Network, Layers, Home, Search, UserCircle, Trash2, Mail, Lock, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMembers } from "@/hooks/use-members";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

function LeaderCombobox({ 
  value, 
  onValueChange, 
  placeholder 
}: { 
  value: string; 
  onValueChange: (member: any) => void; 
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: users } = useUsers();
  const { data: members } = useMembers();

  const filteredItems = useMemo(() => {
    if (!members) return [];
    
    const items = members.map(m => {
      const linkedUser = users?.find(u => u.memberId === m.id);
      return {
        ...m,
        isUser: !!linkedUser,
        userId: linkedUser?.id
      };
    });
    
    const lowerSearch = search.toLowerCase();
    return items.filter(i => 
      i.fullName.toLowerCase().includes(lowerSearch) || 
      (i.email && i.email.toLowerCase().includes(lowerSearch))
    ).slice(0, 50);
  }, [members, users, search]);

  const selectedMember = members?.find(m => m.id.toString() === value);
  const displayName = selectedMember?.fullName || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="combobox-leader"
        >
          <span className="truncate">{displayName}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search members..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id.toString()}
                  onSelect={() => {
                    onValueChange(item);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span>{item.fullName}</span>
                      {item.isUser && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">User</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.email || "No email"}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Structure() {
  const { data: hierarchy, isLoading } = useHierarchy();
  const { data: users } = useUsers();
  const { data: members } = useMembers();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const isAdmin = user?.role === "admin";
  const isGroupPastor = user?.role === "group_pastor";
  const isPcfLeader = user?.role === "pcf_leader";

  const [groupName, setGroupName] = useState("");
  const [selectedGroupMember, setSelectedGroupMember] = useState<any>(null);
  const [createGroupUser, setCreateGroupUser] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole] = useState("group_pastor");
  
  const [pcfName, setPcfName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedPcfMember, setSelectedPcfMember] = useState<any>(null);
  const [createPcfUser, setCreatePcfUser] = useState(false);
  const [pcfUserEmail, setPcfUserEmail] = useState("");
  const [pcfUserPassword, setPcfUserPassword] = useState("");
  const [pcfUserRole, setPcfUserRole] = useState("pcf_leader");
  
  const [cellName, setCellName] = useState("");
  const [selectedPcfId, setSelectedPcfId] = useState<string>("");
  const [selectedCellMember, setSelectedCellMember] = useState<any>(null);

  useEffect(() => {
    if (selectedGroupMember?.isUser) {
      setCreateGroupUser(false);
    }
  }, [selectedGroupMember]);

  useEffect(() => {
    if (selectedPcfMember?.isUser) {
      setCreatePcfUser(false);
    }
  }, [selectedPcfMember]);

  const handleGroupLeaderChange = (member: any) => {
    setSelectedGroupMember(member);
    setCreateGroupUser(false);
    setUserEmail(member.email || "");
    setUserPassword("");
  };

  const handlePcfLeaderChange = (member: any) => {
    setSelectedPcfMember(member);
    setCreatePcfUser(false);
    setPcfUserEmail(member.email || "");
    setPcfUserPassword("");
  };

  const handleCellLeaderChange = (member: any) => {
    setSelectedCellMember(member);
  };

  const accessibleGroups = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin) return hierarchy.groups || [];
    if (isGroupPastor && user?.groupId) {
      return (hierarchy.groups || []).filter(g => g.id === user.groupId);
    }
    return [];
  }, [hierarchy, isAdmin, isGroupPastor, user]);

  const accessiblePcfs = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin) return hierarchy.pcfs;
    if (isGroupPastor && user?.groupId) {
      return hierarchy.pcfs.filter(p => p.groupId === user.groupId);
    }
    if (isPcfLeader && user?.pcfId) {
      return hierarchy.pcfs.filter(p => p.id === user.pcfId);
    }
    return [];
  }, [hierarchy, isAdmin, isGroupPastor, isPcfLeader, user]);

  const accessibleGroupsForAdd = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin) return hierarchy.groups;
    return []; // Only admin can add groups
  }, [hierarchy, isAdmin]);

  const accessiblePcfsForAdd = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin) return hierarchy.pcfs;
    if (isGroupPastor && user?.groupId) {
      return hierarchy.pcfs.filter(p => p.groupId === user.groupId);
    }
    return [];
  }, [hierarchy, isAdmin, isGroupPastor, user]);

  useEffect(() => {
    if (isGroupPastor && user?.groupId) {
      setSelectedGroupId(user.groupId.toString());
    }
  }, [isGroupPastor, user]);

  useEffect(() => {
    if (isPcfLeader && user?.pcfId) {
      setSelectedPcfId(user.pcfId.toString());
    }
  }, [isPcfLeader, user]);

  const handleAddGroup = async () => {
    if (!groupName || !hierarchy?.church?.id) {
      toast({ 
        title: "Validation Error", 
        description: "Group name and Church ID are required. Please ensure a Church is configured.", 
        variant: "destructive" 
      });
      return;
    }
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/groups", { 
        name: groupName, 
        churchId: hierarchy.church.id,
        leaderId: selectedGroupMember?.isUser ? selectedGroupMember.userId : undefined,
        createUser: createGroupUser,
        userEmail: createGroupUser ? userEmail : undefined,
        userPassword: createGroupUser ? userPassword : undefined,
        userRole: createGroupUser ? userRole : undefined,
        memberId: selectedGroupMember?.id
      });
      toast({ title: "Success", description: "Group added successfully" });
      setGroupName("");
      setSelectedGroupMember(null);
      setCreateGroupUser(false);
      setUserEmail("");
      setUserPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add group", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleAddPcf = async () => {
    if (!pcfName || !selectedGroupId) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/pcfs", { 
        name: pcfName, 
        groupId: Number(selectedGroupId),
        leaderId: selectedPcfMember?.isUser ? selectedPcfMember.userId : undefined,
        createUser: createPcfUser,
        userEmail: createPcfUser ? pcfUserEmail : undefined,
        userPassword: createPcfUser ? pcfUserPassword : undefined,
        userRole: createPcfUser ? pcfUserRole : undefined,
        memberId: selectedPcfMember?.id
      });
      toast({ title: "Success", description: "PCF added successfully" });
      setPcfName("");
      setSelectedPcfMember(null);
      setCreatePcfUser(false);
      setPcfUserEmail("");
      setPcfUserPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add PCF", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleAddCell = async () => {
    if (!cellName || !selectedPcfId) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/admin/cells", { 
        name: cellName, 
        pcfId: Number(selectedPcfId),
        leaderId: selectedCellMember?.isUser ? selectedCellMember.userId : undefined,
        memberId: selectedCellMember?.id
      });
      toast({ title: "Success", description: "Cell added successfully" });
      setCellName("");
      setSelectedCellMember(null);
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add cell", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (type: 'groups' | 'pcfs' | 'cells', id: number) => {
    if (!confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) return;
    setIsPending(true);
    try {
      await apiRequest("DELETE", `/api/admin/${type}/${id}`);
      toast({ title: "Success", description: `${type.slice(0, -1).toUpperCase()} deleted successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || `Failed to delete ${type.slice(0, -1)}`, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const getLeaderName = (leaderId: string | null | undefined) => {
    if (!leaderId || !users) return "Not assigned";
    const leader = users.find(u => u.id === leaderId);
    return leader ? `${leader.firstName || ''} ${leader.lastName || ''}`.trim() || leader.email : "Unknown";
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

  const canCreateGroups = isAdmin;
  const canCreatePcfs = isAdmin || isGroupPastor;
  const canCreateCells = isAdmin || isGroupPastor || isPcfLeader;

  return (
    <Layout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Organization Structure</h1>
        <p className="text-muted-foreground">Manage your church hierarchy by adding and viewing Groups, PCFs, and Cells.</p>
      </div>

      <Tabs defaultValue={canCreateGroups ? "groups" : canCreatePcfs ? "pcfs" : "cells"} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          {canCreateGroups && (
            <TabsTrigger value="groups" className="gap-2">
              <Home className="w-4 h-4" /> Groups
            </TabsTrigger>
          )}
          {canCreatePcfs && (
            <TabsTrigger value="pcfs" className="gap-2">
              <Layers className="w-4 h-4" /> PCFs
            </TabsTrigger>
          )}
          {canCreateCells && (
            <TabsTrigger value="cells" className="gap-2">
              <Network className="w-4 h-4" /> Cells
            </TabsTrigger>
          )}
        </TabsList>

        {canCreateGroups && (
          <TabsContent value="groups" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Add New Group</CardTitle>
                  <CardDescription>Create a new administrative group and assign a Group Pastor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                      id="group-name" 
                      placeholder="e.g. Abuja Group 1" 
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      data-testid="input-group-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Group Pastor</Label>
                    <LeaderCombobox
                      value={selectedGroupMember?.id?.toString() || ""}
                      onValueChange={handleGroupLeaderChange}
                      placeholder="Select Member..."
                    />
                  </div>

                  {selectedGroupMember && !selectedGroupMember.isUser && (
                    <div className="flex items-center space-x-2 pt-2 animate-in fade-in duration-200">
                      <Checkbox 
                        id="create-user" 
                        checked={createGroupUser} 
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setCreateGroupUser(isChecked);
                          if (isChecked) {
                            setUserEmail(selectedGroupMember.email || "");
                          }
                        }}
                        data-testid="checkbox-create-user"
                      />
                      <Label 
                        htmlFor="create-user" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Create user account for this member?
                      </Label>
                    </div>
                  )}

                  {selectedGroupMember && selectedGroupMember.isUser && (
                    <div className="pt-2">
                      <Badge variant="secondary" className="w-full justify-center py-1">
                        Member already has a user account
                      </Badge>
                    </div>
                  )}

                  {createGroupUser && (
                    <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email
                        </Label>
                        <Input 
                          placeholder="Email for the new user" 
                          className="h-8 text-sm" 
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Temporary Password
                        </Label>
                        <Input 
                          placeholder="Temporary password" 
                          className="h-8 text-sm" 
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Role
                        </Label>
                        <Input disabled value="Group Pastor" className="h-8 text-sm opacity-70" />
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    onClick={handleAddGroup} 
                    disabled={isPending || !groupName} 
                    data-testid="button-add-group"
                  >
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
                        <TableHead>Group Pastor</TableHead>
                        <TableHead>PCFs</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hierarchy?.groups.map(g => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell className="text-muted-foreground">{getLeaderName((g as any).leaderId)}</TableCell>
                          <TableCell>{hierarchy.pcfs.filter(p => p.groupId === g.id).length}</TableCell>
                          <TableCell>
                            {isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete('groups', g.id)}
                                disabled={isPending}
                                data-testid={`button-delete-group-${g.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {hierarchy?.groups.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
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
        )}

        {canCreatePcfs && (
          <TabsContent value="pcfs" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Add New PCF</CardTitle>
                  <CardDescription>Create a PCF and assign a PCF Leader.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Parent Group</Label>
                    <Select 
                      value={selectedGroupId} 
                      onValueChange={setSelectedGroupId}
                      disabled={isGroupPastor}
                    >
                      <SelectTrigger data-testid="select-parent-group">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {accessibleGroups.map(g => (
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
                      data-testid="input-pcf-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PCF Leader</Label>
                    <LeaderCombobox
                      value={selectedPcfMember?.id?.toString() || ""}
                      onValueChange={handlePcfLeaderChange}
                      placeholder="Select Member..."
                    />
                  </div>

                  {selectedPcfMember && !selectedPcfMember.isUser && (
                    <div className="flex items-center space-x-2 pt-2 animate-in fade-in duration-200">
                      <Checkbox 
                        id="create-pcf-user" 
                        checked={createPcfUser} 
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setCreatePcfUser(isChecked);
                          if (isChecked) {
                            setPcfUserEmail(selectedPcfMember.email || "");
                          }
                        }}
                        data-testid="checkbox-create-pcf-user"
                      />
                      <Label 
                        htmlFor="create-pcf-user" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Create user account for this member?
                      </Label>
                    </div>
                  )}

                  {selectedPcfMember && selectedPcfMember.isUser && (
                    <div className="pt-2">
                      <Badge variant="secondary" className="w-full justify-center py-1">
                        Member already has a user account
                      </Badge>
                    </div>
                  )}

                  {createPcfUser && (
                    <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email
                        </Label>
                        <Input 
                          placeholder="Email for the new user" 
                          className="h-8 text-sm" 
                          value={pcfUserEmail}
                          onChange={(e) => setPcfUserEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Temporary Password
                        </Label>
                        <Input 
                          placeholder="Temporary password" 
                          className="h-8 text-sm" 
                          value={pcfUserPassword}
                          onChange={(e) => setPcfUserPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Role
                        </Label>
                        <Select value={pcfUserRole} onValueChange={setPcfUserRole}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pcf_leader">PCF Leader</SelectItem>
                            <SelectItem value="cell_leader">Cell Leader</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    onClick={handleAddPcf} 
                    disabled={isPending || !pcfName || !selectedGroupId} 
                    data-testid="button-add-pcf"
                  >
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
                        <TableHead>PCF Leader</TableHead>
                        <TableHead>Parent Group</TableHead>
                        <TableHead>Cells</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessiblePcfs.map(p => {
                        const group = hierarchy?.groups.find(g => g.id === p.groupId);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-muted-foreground">{getLeaderName((p as any).leaderId)}</TableCell>
                            <TableCell className="text-muted-foreground">{group?.name || 'Unknown'}</TableCell>
                            <TableCell>{hierarchy?.cells.filter(c => c.pcfId === p.id).length}</TableCell>
                            <TableCell>
                              {(isAdmin || isGroupPastor) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete('pcfs', p.id)}
                                  disabled={isPending}
                                  data-testid={`button-delete-pcf-${p.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {accessiblePcfs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
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
        )}

        {canCreateCells && (
          <TabsContent value="cells" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-border/50 shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Add New Cell</CardTitle>
                  <CardDescription>Create a cell and assign a Cell Leader.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Parent PCF</Label>
                    <Select 
                      value={selectedPcfId} 
                      onValueChange={setSelectedPcfId}
                      disabled={isPcfLeader}
                    >
                      <SelectTrigger data-testid="select-parent-pcf">
                        <SelectValue placeholder="Select PCF" />
                      </SelectTrigger>
                      <SelectContent>
                        {accessiblePcfs.map(p => (
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
                      data-testid="input-cell-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cell Leader</Label>
                    <LeaderCombobox
                      value={selectedCellMember?.id?.toString() || ""}
                      onValueChange={handleCellLeaderChange}
                      placeholder="Select Cell Leader..."
                    />
                  </div>
                  <Button className="w-full" onClick={handleAddCell} disabled={isPending || !cellName || !selectedPcfId} data-testid="button-add-cell">
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
                        <TableHead>Cell Leader</TableHead>
                        <TableHead>Parent PCF</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hierarchy?.cells.filter(c => accessiblePcfs.some(p => p.id === c.pcfId)).map(c => {
                        const pcf = hierarchy.pcfs.find(p => p.id === c.pcfId);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground">{getLeaderName((c as any).leaderId)}</TableCell>
                            <TableCell className="text-muted-foreground">{pcf?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              {(isAdmin || isGroupPastor || isPcfLeader) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete('cells', c.id)}
                                  disabled={isPending}
                                  data-testid={`button-delete-cell-${c.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {hierarchy?.cells.filter(c => accessiblePcfs.some(p => p.id === c.pcfId)).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
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
        )}
      </Tabs>
    </Layout>
  );
}
