export const LEAD_STATUSES = [
  { id: "novo", label: "Novo Lead" },
  { id: "primeiro_contato", label: "Primeiro Contato" },
  { id: "teste_enviado", label: "Teste Enviado" },
  { id: "negociacao", label: "Negociação" },
  { id: "cliente", label: "Cliente" },
  { id: "renovacao", label: "Renovação" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];

export type Lead = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  campaign: string | null;
  assigned_to: string | null;
  status: LeadStatus;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};
