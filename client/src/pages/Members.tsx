import { Layout } from "@/components/Layout";
import { useMembers, useCreateMember, useDeleteMember, useUpdateMember } from "@/hooks/use-members";
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
import { Plus, Search, Trash2, UserCircle, ShieldCheck, Edit2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMemberSchema, type InsertMember, UserRoles } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Members() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isGroupPastor = user?.role === "group_pastor";
  const isPcfLeader = user?.role === "pcf_leader";
  const isCellLeader = user?.role === "cell_leader";

  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<string>(isGroupPastor ? user?.groupId?.toString() || "all" : "all");
  const [pcfId, setPcfId] = useState<string>(isPcfLeader ? user?.pcfId?.toString() || "all" : "all");
  const [cellId, setCellId] = useState<string>(isCellLeader ? user?.cellId?.toString() || "all" : "all");

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [convertPending, setConvertPending] = useState(false);

  const { data: members, isLoading } = useMembers({ 
    search, 
    cellId: cellId !== "all" ? Number(cellId) : undefined 
  });
  const { data: hierarchy } = useHierarchy();
  const { mutate: deleteMember } = useDeleteMember();

  const handleConvert = async (data: any) => {
    if (!selectedMember) return;
    setConvertPending(true);
    try {
      await apiRequest("POST", `/api/admin/members/${selectedMember.id}/convert`, data);
      toast({ title: "Success", description: "Member converted to user successfully" });
      setConvertModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to convert member", variant: "destructive" });
    } finally {
      setConvertPending(false);
    }
  };

  // Filter logic for cascading selects
  const filteredPcfs = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin) return groupId === "all" ? hierarchy.pcfs : hierarchy.pcfs.filter(p => p.groupId === Number(groupId));
    if (isGroupPastor) return hierarchy.pcfs.filter(p => p.groupId === user?.groupId);
    if (isPcfLeader) return hierarchy.pcfs.filter(p => p.id === user?.pcfId);
    return [];
  }, [hierarchy, groupId, isAdmin, isGroupPastor, isPcfLeader, user]);

  const filteredCells = useMemo(() => {
    if (!hierarchy) return [];
    if (isAdmin || isGroupPastor) {
      const parentPcfIds = filteredPcfs.map(p => p.id);
      return hierarchy.cells.filter(c => {
        const pcfMatch = pcfId === "all" ? parentPcfIds.includes(c.pcfId) : c.pcfId === Number(pcfId);
        return pcfMatch;
      });
    }
    if (isPcfLeader) return hierarchy.cells.filter(c => c.pcfId === user?.pcfId);
    if (isCellLeader) return hierarchy.cells.filter(c => c.id === user?.cellId);
    return [];
  }, [hierarchy, pcfId, filteredPcfs, isAdmin, isGroupPastor, isPcfLeader, isCellLeader, user]);

  // Frontend filtering since backend only supports search and cellId
  const filteredMembers = members?.filter(member => {
    const cell = hierarchy?.cells.find(c => c.id === member.cellId);
    const pcf = hierarchy?.pcfs.find(p => p.id === cell?.pcfId);
    const group = hierarchy?.groups.find(g => g.id === pcf?.groupId);

    if (isGroupPastor && group?.id !== user?.groupId) return false;
    if (isPcfLeader && pcf?.id !== user?.pcfId) return false;
    if (isCellLeader && cell?.id !== user?.cellId) return false;

    // Apply active filter values
    if (cellId !== "all" && member.cellId !== Number(cellId)) return false;
    if (pcfId !== "all" && cell?.pcfId !== Number(pcfId)) return false;
    if (groupId !== "all" && pcf?.groupId !== Number(groupId)) return false;

    return true;
  });

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Members</h1>
          <p className="text-muted-foreground">Manage directory and member details.</p>
        </div>
        <AddMemberDialog />
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

        {isAdmin && (
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
        )}

        {(isAdmin || isGroupPastor) && (
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
        )}

        {(isAdmin || isGroupPastor || isPcfLeader) && (
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
        )}
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
                  const hasUserAccount = !!(member as any).userId;
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
                        <div className="flex items-center justify-end gap-1">
                          <EditMemberDialog member={member} />
                          {(isAdmin || isGroupPastor) && !hasUserAccount && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              title="Convert to User"
                              onClick={() => {
                                setSelectedMember(member);
                                setConvertModalOpen(true);
                              }}
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                          )}
                          {hasUserAccount && (
                            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground bg-muted rounded">
                              User Account Active
                            </div>
                          )}
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Convert to User</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <ConvertUserForm 
              member={selectedMember} 
              onSubmit={handleConvert} 
              isPending={convertPending} 
              currentUserRole={user?.role || undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function ConvertUserForm({ member, onSubmit, isPending, currentUserRole }: { 
  member: any, 
  onSubmit: (data: any) => void, 
  isPending: boolean,
  currentUserRole?: string
}) {
  const form = useForm({
    defaultValues: {
      email: (member.email as string | undefined) || "",
      password: "",
      role: (UserRoles.CELL_LEADER as string),
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Login Email</FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temporary Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currentUserRole === UserRoles.ADMIN && (
                    <SelectItem value={UserRoles.ADMIN}>Admin</SelectItem>
                  )}
                  {(currentUserRole === UserRoles.ADMIN || currentUserRole === UserRoles.GROUP_PASTOR) && (
                    <SelectItem value={UserRoles.GROUP_PASTOR}>Group Pastor</SelectItem>
                  )}
                  <SelectItem value={UserRoles.PCF_LEADER}>PCF Leader</SelectItem>
                  <SelectItem value={UserRoles.CELL_LEADER}>Cell Leader</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Converting..." : "Create User Account"}
        </Button>
      </form>
    </Form>
  );
}

function MemberForm({ form, isPending, isEdit = false }: { form: any, isPending: boolean, isEdit?: boolean }) {
  const { user } = useAuth();
  const { data: hierarchy } = useHierarchy();

  const isGroupPastor = user?.role === "group_pastor";
  const isPcfLeader = user?.role === "pcf_leader";
  const isCellLeader = user?.role === "cell_leader";

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const designations = [
    "MEMBER", "CELL_LEADER", "PCF_LEADER", "GROUP_PASTOR", "PASTORAL_ASSISTANT"
  ];

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    isEdit ? (hierarchy?.pcfs.find(p => p.id === hierarchy?.cells.find(c => c.id === form.getValues("cellId"))?.pcfId)?.groupId?.toString() || "") : (isGroupPastor ? user?.groupId?.toString() || "" : "")
  );
  const [selectedPcfId, setSelectedPcfId] = useState<string>(
    isEdit ? (hierarchy?.cells.find(c => c.id === form.getValues("cellId"))?.pcfId?.toString() || "") : (isPcfLeader ? user?.pcfId?.toString() || "" : "")
  );

  useEffect(() => {
    if (hierarchy && isEdit) {
      const cellId = form.getValues("cellId");
      if (cellId) {
        const cell = hierarchy.cells.find(c => c.id === cellId);
        if (cell) {
          const pcf = hierarchy.pcfs.find(p => p.id === cell.pcfId);
          if (pcf) {
            setSelectedPcfId(pcf.id.toString());
            setSelectedGroupId(pcf.groupId.toString());
          }
        }
      }
    }
  }, [hierarchy, isEdit]);

  const filteredPcfs = useMemo(() => {
    if (!hierarchy || !selectedGroupId || selectedGroupId === "none") return [];
    return hierarchy.pcfs.filter(p => p.groupId === Number(selectedGroupId));
  }, [hierarchy, selectedGroupId]);

  const filteredCells = useMemo(() => {
    if (!hierarchy) return [];
    if (isCellLeader) return hierarchy.cells.filter(c => c.id === user?.cellId);
    if (selectedPcfId && selectedPcfId !== "none") return hierarchy.cells.filter(c => c.pcfId === Number(selectedPcfId));
    if (isPcfLeader) return hierarchy.cells.filter(c => c.pcfId === user?.pcfId);
    return [];
  }, [hierarchy, selectedPcfId, isCellLeader, isPcfLeader, user]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
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
          name="designation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Designation</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "MEMBER"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {designations.map(d => (
                    <SelectItem key={d} value={d}>{d.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

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

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} value={field.value || ''} />
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
      </div>

      <div className="space-y-2">
        <FormLabel>Birthday</FormLabel>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="birthDay"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : Number(val))} value={field.value?.toString() || "none"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Day</SelectItem>
                    {days.map(d => (
                      <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="birthMonth"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} value={field.value || "none"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Month</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
      </div>

      <FormField
        control={form.control}
        name="gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Gender</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
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

      {isEdit && (
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "Active"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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
      )}

      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Placement</h4>
        
        {!isGroupPastor && !isPcfLeader && !isCellLeader && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Group</Label>
              <Select value={selectedGroupId || "none"} onValueChange={(val) => {
                setSelectedGroupId(val === "none" ? "" : val);
                setSelectedPcfId("");
                form.setValue("cellId", undefined as any);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select Group</SelectItem>
                  {hierarchy?.groups.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">PCF</Label>
              <Select value={selectedPcfId || "none"} onValueChange={(val) => {
                setSelectedPcfId(val === "none" ? "" : val);
                form.setValue("cellId", undefined as any);
              }}>
                <SelectTrigger disabled={!selectedGroupId || selectedGroupId === "none"}>
                  <SelectValue placeholder="Select PCF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select PCF</SelectItem>
                  {filteredPcfs.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isGroupPastor && (
          <div className="space-y-2">
            <Label className="text-xs">Group: {hierarchy?.groups.find(g => g.id === user?.groupId)?.name}</Label>
            <Select value={selectedPcfId || "none"} onValueChange={(val) => {
              setSelectedPcfId(val === "none" ? "" : val);
              form.setValue("cellId", undefined as any);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select PCF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select PCF</SelectItem>
                {hierarchy?.pcfs.filter(p => p.groupId === user?.groupId).map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isPcfLeader && (
          <div className="space-y-2">
            <Label className="text-xs">PCF: {hierarchy?.pcfs.find(p => p.id === user?.pcfId)?.name}</Label>
          </div>
        )}

        <FormField
          control={form.control}
          name="cellId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Cell Group</FormLabel>
              <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : Number(val))} value={field.value?.toString() || "none"}>
                <FormControl>
                  <SelectTrigger disabled={!isCellLeader && (!selectedPcfId || selectedPcfId === "none") && !isPcfLeader}>
                    <SelectValue placeholder="Select Cell" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Select Cell</SelectItem>
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
      </div>

      <DialogFooter className="mt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? (isEdit ? "Updating..." : "Creating...") : (isEdit ? "Update Member" : "Create Member")}
        </Button>
      </DialogFooter>
    </>
  );
}

function AddMemberDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateMember();
  const { user } = useAuth();
  const { data: hierarchy } = useHierarchy();

  const isCellLeader = user?.role === "cell_leader";
  const isPcfLeader = user?.role === "pcf_leader";

  const form = useForm<InsertMember>({
    resolver: zodResolver(insertMemberSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      gender: "Male",
      title: "",
      status: "Active",
      designation: "MEMBER",
      birthDay: undefined,
      birthMonth: undefined,
      cellId: isCellLeader ? user?.cellId : (isPcfLeader ? hierarchy?.cells.find((c: any) => c.pcfId === user?.pcfId)?.id : undefined),
    },
  });

  useEffect(() => {
    if (isCellLeader && user?.cellId) {
      form.setValue("cellId", user.cellId);
    }
  }, [isCellLeader, user, form]);

  const onSubmit = (data: InsertMember) => {
    // Sanitize empty strings to null for backend
    const sanitizedData = {
      ...data,
      email: data.email?.trim() === "" ? null : data.email,
      phone: data.phone?.trim() === "" ? null : data.phone,
    };
    mutate(sanitizedData, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err.message || "Failed to create member",
          variant: "destructive",
        });
      }
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <MemberForm form={form} isPending={isPending} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member }: { member: any }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useUpdateMember();

  const form = useForm<InsertMember>({
    resolver: zodResolver(insertMemberSchema),
    defaultValues: {
      fullName: member.fullName || "",
      phone: member.phone || "",
      email: member.email || "",
      gender: member.gender || "Male",
      title: member.title || "",
      status: member.status || "Active",
      designation: member.designation || "MEMBER",
      birthDay: member.birthDay || undefined,
      birthMonth: member.birthMonth || undefined,
      cellId: member.cellId,
    },
  });

  const onSubmit = (data: InsertMember) => {
    // Sanitize empty strings to null for backend
    const sanitizedData = {
      ...data,
      email: data.email?.trim() === "" ? null : data.email,
      phone: data.phone?.trim() === "" ? null : data.phone,
    };
    mutate({ id: member.id, ...sanitizedData }, {
      onSuccess: () => {
        setOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err.message || "Failed to update member",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <MemberForm form={form} isPending={isPending} isEdit />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}