import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  connectInstance,
  refreshInstanceStatus,
  disconnectInstance,
  sendWhatsAppMessage,
} from "@/lib/whatsapp.functions";

export type WAInstance = {
  id: string;
  name: string;
  base_url: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  phone_number: string | null;
  qr_code: string | null;
  webhook_secret: string;
  created_at: string;
};

export type WAChat = {
  id: string;
  instance_id: string;
  phone: string;
  name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  lead_id: string | null;
};

export type WAMessage = {
  id: string;
  chat_id: string;
  direction: "in" | "out";
  message_type: string;
  content: string | null;
  status: string;
  created_at: string;
};

export function useInstances() {
  return useQuery({
    queryKey: ["wa-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, name, base_url, status, phone_number, qr_code, webhook_secret, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WAInstance[];
    },
  });
}

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; base_url: string; token: string }) => {
      const { data: prof } = await supabase.from("profiles").select("organization_id").single();
      if (!prof) throw new Error("Sem organização");
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .insert({ ...input, organization_id: prof.organization_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-instances"] }),
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-instances"] }),
  });
}

export function useConnectInstance() {
  const qc = useQueryClient();
  const fn = useServerFn(connectInstance);
  return useMutation({
    mutationFn: async (instanceId: string) => fn({ data: { instanceId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-instances"] }),
  });
}

export function useRefreshInstance() {
  const qc = useQueryClient();
  const fn = useServerFn(refreshInstanceStatus);
  return useMutation({
    mutationFn: async (instanceId: string) => fn({ data: { instanceId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-instances"] }),
  });
}

export function useDisconnectInstance() {
  const qc = useQueryClient();
  const fn = useServerFn(disconnectInstance);
  return useMutation({
    mutationFn: async (instanceId: string) => fn({ data: { instanceId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-instances"] }),
  });
}

export function useChats(instanceId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("wa-chats-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_chats" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-chats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["wa-chats", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_chats")
        .select("id, instance_id, phone, name, last_message_at, last_message_preview, unread_count, lead_id")
        .eq("instance_id", instanceId!)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as WAChat[];
    },
  });
}

export function useMessages(chatId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!chatId) return;
    const ch = supabase
      .channel(`wa-msgs-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${chatId}` },
        () => qc.invalidateQueries({ queryKey: ["wa-messages", chatId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, qc]);

  return useQuery({
    queryKey: ["wa-messages", chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, chat_id, direction, message_type, content, status, created_at")
        .eq("chat_id", chatId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as WAMessage[];
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const fn = useServerFn(sendWhatsAppMessage);
  return useMutation({
    mutationFn: async (input: { instanceId: string; phone: string; text: string }) =>
      fn({ data: input }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["wa-chats"] });
      qc.invalidateQueries({ queryKey: ["wa-messages"] });
    },
  });
}
