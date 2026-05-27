import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dispatchAutomationEvent } from "@/lib/automations.functions";
import type { Lead, LeadStatus } from "./leadStatus";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; email?: string; source?: string; campaign?: string; notes?: string; status?: LeadStatus }) => {
      const { data: prof } = await supabase.from("profiles").select("organization_id").single();
      if (!prof) throw new Error("Sem organização");
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...input, organization_id: prof.organization_id })
        .select()
        .single();
      if (error) throw error;
      // Fire-and-forget automation dispatch
      dispatchAutomationEvent({
        data: {
          trigger_type: "lead.created",
          payload: { lead_id: data.id, lead: data },
        },
      }).catch((e) => console.error("dispatch lead.created", e));
      return data as Lead;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { data: prev } = await supabase.from("leads").select("status").eq("id", id).single();
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
      const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
      dispatchAutomationEvent({
        data: {
          trigger_type: "lead.status_changed",
          payload: { lead_id: id, from_status: prev?.status, to_status: status, lead },
        },
      }).catch((e) => console.error("dispatch lead.status_changed", e));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
