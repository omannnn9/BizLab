import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CompanyMember } from "@/types/database";

export interface HrEmployee {
  id: string;
  company_id: string;
  member_id: string;
  job_title: string | null;
  department_id: string | null;
  employment_type: string;
  status: "active" | "on_leave" | "terminated";
  start_date: string | null;
  member?: CompanyMember;
}

export interface HrLeaveRequest {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type: "vacation" | "sick" | "personal" | "other";
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  employee?: HrEmployee;
}

export function useEmployees() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["hr-employees", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_employees")
        .select("*, member:company_members(*, profile:profiles(*))")
        .eq("company_id", company!.id);
      if (error) throw error;
      return (data ?? []) as unknown as HrEmployee[];
    },
  });
}

export function useMyEmployeeRecord() {
  const { membership } = useWorkspace();
  return useQuery({
    queryKey: ["hr-employee-self", membership?.id],
    enabled: !!membership,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_employees")
        .select("*")
        .eq("member_id", membership!.id)
        .maybeSingle();
      if (error) throw error;
      return data as HrEmployee | null;
    },
  });
}

export function useAddEmployee() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; jobTitle?: string }) => {
      const { error } = await supabase
        .from("hr_employees")
        .insert({ company_id: company!.id, member_id: input.memberId, job_title: input.jobTitle || null });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr-employees", company?.id] }),
  });
}

export function useLeaveRequests() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["hr-leave-requests", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_leave_requests")
        .select("*, employee:hr_employees(*, member:company_members(*, profile:profiles(*)))")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HrLeaveRequest[];
    },
  });
}

export function useCreateLeaveRequest() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employeeId: string; startDate: string; endDate: string; reason?: string }) => {
      const { error } = await supabase.from("hr_leave_requests").insert({
        company_id: company!.id,
        employee_id: input.employeeId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr-leave-requests", company?.id] }),
  });
}

export function useReviewLeaveRequest() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "cancelled" }) => {
      const isReview = status === "approved" || status === "rejected";
      const { error } = await supabase
        .from("hr_leave_requests")
        .update({
          status,
          ...(isReview ? { reviewed_by: user!.id, reviewed_at: new Date().toISOString() } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr-leave-requests", company?.id] }),
  });
}
