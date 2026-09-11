import { useState } from "react";
import { format } from "date-fns";
import { Building2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useAddEmployee,
  useCreateDepartment,
  useCreateLeaveRequest,
  useDeleteDepartment,
  useDepartments,
  useEmployees,
  useLeaveRequests,
  useMyEmployeeRecord,
  useReviewLeaveRequest,
  useSetEmployeeDepartment,
} from "@/hooks/use-hr";
import { useCompanyMembers } from "@/hooks/use-members";
import { usePermissions } from "@/hooks/use-permissions";

const NO_DEPARTMENT = "none";

const LEAVE_STATUS_VARIANT = {
  pending: "secondary",
  approved: "success",
  rejected: "outline",
  cancelled: "outline",
} as const;

export function HrPage() {
  const { data: employees } = useEmployees();
  const { data: leaveRequests } = useLeaveRequests();
  const { data: myRecord } = useMyEmployeeRecord();
  const { data: members } = useCompanyMembers();
  const { data: departments } = useDepartments();
  const addEmployee = useAddEmployee();
  const createLeaveRequest = useCreateLeaveRequest();
  const reviewLeaveRequest = useReviewLeaveRequest();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const setEmployeeDepartment = useSetEmployeeDepartment();
  const { can } = usePermissions();

  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [pickedMemberId, setPickedMemberId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState(NO_DEPARTMENT);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentLeadId, setDepartmentLeadId] = useState(NO_DEPARTMENT);

  const unstaffedMembers = members?.filter((m) => !employees?.some((e) => e.member_id === m.id)) ?? [];
  const canManage = can("hr", "create");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="HR"
        description="Employees, departments and leave requests."
        actions={
          myRecord ? (
            <Button onClick={() => setLeaveDialogOpen(true)}>
              <Plus /> Request leave
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="employees" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="leave">Leave requests</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="employees" className="flex-1 overflow-y-auto px-6 py-4">
          {canManage && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setAddEmployeeOpen(true)}>
                <Plus className="size-3.5" /> Add employee
              </Button>
            </div>
          )}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees?.map((emp) => (
                  <tr key={emp.id}>
                    <td className="flex items-center gap-2 px-4 py-2.5 font-medium">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {(emp.member?.profile?.full_name ?? emp.member?.profile?.email ?? "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      {emp.member?.profile?.full_name ?? emp.member?.profile?.email}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{emp.job_title ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {canManage ? (
                        <Select
                          value={emp.department_id ?? NO_DEPARTMENT}
                          onValueChange={(v) =>
                            setEmployeeDepartment.mutate({
                              employeeId: emp.id,
                              departmentId: v === NO_DEPARTMENT ? null : v,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                            {departments?.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">{emp.department?.name ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {emp.employment_type.replace("_", " ")}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={emp.status === "active" ? "success" : "outline"}>{emp.status}</Badge>
                    </td>
                  </tr>
                ))}
                {(!employees || employees.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No employee records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="flex-1 overflow-y-auto px-6 py-4">
          {canManage && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setDepartmentDialogOpen(true)}>
                <Plus className="size-3.5" /> New department
              </Button>
            </div>
          )}
          {departments && departments.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept) => {
                const headcount = employees?.filter((e) => e.department_id === dept.id).length ?? 0;
                return (
                  <div key={dept.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        <p className="text-sm font-medium">{dept.name}</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => deleteDepartment.mutate(dept.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dept.lead?.profile?.full_name ?? dept.lead?.profile?.email
                        ? `Led by ${dept.lead?.profile?.full_name ?? dept.lead?.profile?.email}`
                        : "No lead assigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {headcount} {headcount === 1 ? "person" : "people"}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Group employees by department to organize your org chart and reporting."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setDepartmentDialogOpen(true)}>
                    <Plus /> New department
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="leave" className="flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Dates</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaveRequests?.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-2.5 font-medium">
                      {req.employee?.member?.profile?.full_name ?? req.employee?.member?.profile?.email}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(new Date(req.start_date), "MMM d")} – {format(new Date(req.end_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{req.reason ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={LEAVE_STATUS_VARIANT[req.status]}>{req.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {req.status === "pending" && canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => reviewLeaveRequest.mutate({ id: req.id, status: "approved" })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reviewLeaveRequest.mutate({ id: req.id, status: "rejected" })}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(!leaveRequests || leaveRequests.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No leave requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add employee record</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pickedMemberId) return;
              await addEmployee.mutateAsync({
                memberId: pickedMemberId,
                jobTitle,
                departmentId: employeeDepartmentId === NO_DEPARTMENT ? null : employeeDepartmentId,
              });
              setPickedMemberId("");
              setJobTitle("");
              setEmployeeDepartmentId(NO_DEPARTMENT);
              setAddEmployeeOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label>Team member</Label>
              <Select value={pickedMemberId} onValueChange={setPickedMemberId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a member" /></SelectTrigger>
                <SelectContent>
                  {unstaffedMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.profile?.full_name ?? m.profile?.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select value={employeeDepartmentId} onValueChange={setEmployeeDepartmentId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addEmployee.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!departmentName.trim()) return;
              await createDepartment.mutateAsync({
                name: departmentName,
                leadMemberId: departmentLeadId === NO_DEPARTMENT ? null : departmentLeadId,
              });
              setDepartmentName("");
              setDepartmentLeadId(NO_DEPARTMENT);
              setDepartmentDialogOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="departmentName">Name</Label>
              <Input
                id="departmentName"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                autoFocus
                required
                placeholder="Engineering"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Department lead</Label>
              <Select value={departmentLeadId} onValueChange={setDepartmentLeadId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>No lead</SelectItem>
                  {members?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.profile?.full_name ?? m.profile?.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createDepartment.isPending}>Create department</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!myRecord || !startDate || !endDate) return;
              await createLeaveRequest.mutateAsync({ employeeId: myRecord.id, startDate, endDate, reason });
              setStartDate("");
              setEndDate("");
              setReason("");
              setLeaveDialogOpen(false);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createLeaveRequest.isPending}>Submit request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
