
-- Categorias
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read fin cats" ON public.finance_categories FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "managers write fin cats" ON public.finance_categories FOR ALL TO authenticated
  USING (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)))
  WITH CHECK (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)));

-- Transações
CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category_id uuid,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  due_date date NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  lead_id uuid,
  meta_account_id uuid,
  google_account_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_tx_org_due ON public.finance_transactions(organization_id, due_date DESC);
CREATE INDEX idx_fin_tx_status ON public.finance_transactions(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read fin tx" ON public.finance_transactions FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "managers write fin tx" ON public.finance_transactions FOR ALL TO authenticated
  USING (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)))
  WITH CHECK (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)));

CREATE TRIGGER trg_fin_tx_updated BEFORE UPDATE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
