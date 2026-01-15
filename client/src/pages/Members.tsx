import { Layout } from "@/components/Layout";
import { useMembers, useCreateMember, useDeleteMember } from "@/hooks/use-members";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, UserCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMemberSchema, type InsertMember } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function Members() {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<string>("all");
  const [pcfId, setPcfId] = useState<string>("all");
  const [cellId, setCellId] = useState<string>("all");
  
  const { data: members, isLoading } = useMembers({ 
    search, 
    cellId: cellId !== "all" ? Number(cellId) : undefined 
  });
  const { data: hierarchy } = useHierarchy();
  const { mutate: deleteMember } = useDeleteMember();
  const { user } = useAuth();

  // Filter logic for cascading selects
  const filteredPcfs = hierarchy?.pcfs.filter(p => groupId === "all" || p.groupId === Number(groupId)) || [];
  const filteredCells = hierarchy?.cells.filter(c => {
    const pcfMatch = pcfId === "all" || c.pcfId === Number(pcfId);
    const groupMatch = groupId === "all" || hierarchy.pcfs.find(p => p.id === c.pcfId)?.groupId === Number(groupId);
    return pcfMatch && groupMatch;
  }) || [];

  // Frontend filtering since backend only supports search and cellId
  const filteredMembers = members?.filter(member => {
    if (cellId !== "all" && member.cellId !== Number(cellId)) return false;
    if (pcfId !== "all") {
      const cell = hierarchy?.cells.find(c => c.id === member.cellId);
      if (cell?.pcfId !== Number(pcfId)) return false;
    }
    if (groupId !== "all") {
      const cell = hierarchy?.cells.find(c => c.id === member.cellId);
      const pcf = hierarchy?.pcfs.find(p => p.id === cell?.pcfId);
      if (pcf?.groupId !== Number(groupId)) return false;
    }
    const cell = hierarchy?.cells.find(c => c.id === member.cellId);
    const pcf = hierarchy?.pcfs.find(p => p.id === cell?.pcfId);
    const group = hierarchy?.groups.find(g => g.id === pcf?.groupId);

    if (user?.role === "group_pastor" && group?.id !== user.groupId) return false;
    if (user?.role === "pcf_leader" && pcf?.id !== user.pcfId) return false;
    if (user?.role === "cell_leader" && cell?.id !== user.cellId) return false;

    return true;
  });

  const accessibleCellsForAdd = useMemo(() => {
    if (!hierarchy) return [];
    if (user?.role === "admin") return hierarchy.cells;
    if (user?.role === "group_pastor") {
      const groupPcfs = hierarchy.pcfs.filter(p => p.groupId === user.groupId).map(p => p.id);
      return hierarchy.cells.filter(c => groupPcfs.includes(c.pcfId));
    }
    if (user?.role === "pcf_leader") {
      return hierarchy.cells.filter(c => c.pcfId === user.pcfId);
    }
    if (user?.role === "cell_leader") {
      return hierarchy.cells.filter(c => c.id === user.cellId);
    }
    return [];
  }, [hierarchy, user]);
  
  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Members</h1>
          <p className="text-muted-foreground">Manage directory and member details.</p>
        </div>
        <AddMemberDialog accessibleCells={accessibleCellsForAdd} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={groupId} onValueChange={(val) => {
          setGroupId(val);
          setPcfId("all");
          setCellId("all");
        }}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {hierarchy?.groups.map(g => (
              <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pcfId} onValueChange={(val) => {
          setPcfId(val);
          setCellId("all");
        }}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="All PCFs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PCFs</SelectItem>
            {filteredPcfs.map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cellId} onValueChange={setCellId}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="All Cells" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cells</SelectItem>
            {filteredCells.map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Cell Group</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading members...</td>
                </tr>
              ) : filteredMembers?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No members found matching filters.</td>
                </tr>
              ) : (
                filteredMembers?.map((member) => {
                  const cell = hierarchy?.cells.find(c => c.id === member.cellId);
                  return (
                    <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <UserCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{member.fullName}</div>
                            <div className="text-xs text-muted-foreground">{member.gender}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{member.phone || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'Active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-foreground font-medium">{cell?.name || 'Unassigned'}</span>
                          {cell && (
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {hierarchy?.pcfs.find(p => p.id === cell.pcfId)?.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this member?')) {
                              deleteMember(member.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function AddMemberDialog({ accessibleCells }: { accessibleCells: any[] }) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateMember();
  const { user } = useAuth();
  const { data: hierarchy } = useHierarchy();

  const isAdmin = user?.role === "admin";
  const isGroupPastor = user?.role === "group_pastor";
  const isPcfLeader = user?.role === "pcf_leader";
  const isCellLeader = user?.role === "cell_leader";

  const form = useForm<InsertMember>({
    resolver: zodResolver(insertMemberSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      gender: "Male",
      title: "",
      status: "Active",
      cellId: isCellLeader ? user.cellId : undefined,
    },
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    isGroupPastor ? user.groupId?.toString() || "" : ""
  );
  const [selectedPcfId, setSelectedPcfId] = useState<string>(
    isPcfLeader ? user.pcfId?.toString() || "" : ""
  );

  const filteredPcfs = useMemo(() => {
    if (!hierarchy || !selectedGroupId) return [];
    return hierarchy.pcfs.filter(p => p.groupId === Number(selectedGroupId));
  }, [hierarchy, selectedGroupId]);

  const filteredCells = useMemo(() => {
    if (!hierarchy) return [];
    if (isCellLeader) return hierarchy.cells.filter(c => c.id === user.cellId);
    if (selectedPcfId) return hierarchy.cells.filter(c => c.pcfId === Number(selectedPcfId));
    if (isPcfLeader) return hierarchy.cells.filter(c => c.pcfId === user.pcfId);
    return [];
  }, [hierarchy, selectedPcfId, isCellLeader, isPcfLeader, user]);

  const onSubmit = (data: InsertMember) => {
    mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        if (!isGroupPastor) setSelectedGroupId("");
        if (!isPcfLeader) setSelectedPcfId("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pastor">Pastor</SelectItem>
                      <SelectItem value="Deacon">Deacon</SelectItem>
                      <SelectItem value="Deaconess">Deaconess</SelectItem>
                      <SelectItem value="Brother">Brother</SelectItem>
                      <SelectItem value="Sister">Sister</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1234567890" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "Male"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "Active"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>Group</Label>
                <Select value={selectedGroupId} onValueChange={(val) => {
                  setSelectedGroupId(val);
                  setSelectedPcfId("");
                  form.setValue("cellId", undefined as any);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Group" />
                  </SelectTrigger>
                  <SelectContent>
                    {hierarchy?.groups.map(g => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(isAdmin || isGroupPastor) && (
              <div className="space-y-2">
                <Label>PCF</Label>
                <Select 
                  value={selectedPcfId} 
                  onValueChange={(val) => {
                    setSelectedPcfId(val);
                    form.setValue("cellId", undefined as any);
                  }}
                  disabled={!selectedGroupId && isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PCF" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPcfs.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormField
              control={form.control}
              name="cellId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cell Group</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(Number(val))} 
                    value={field.value?.toString()}
                    disabled={isCellLeader || (!selectedPcfId && (isAdmin || isGroupPastor))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a cell" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCells.map((cell) => (
                        <SelectItem key={cell.id} value={cell.id.toString()}>
                          {cell.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Member"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
