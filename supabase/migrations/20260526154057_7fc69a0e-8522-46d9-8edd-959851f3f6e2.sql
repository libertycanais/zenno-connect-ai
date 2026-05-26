
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'agent');
CREATE TYPE public.lead_status AS ENUM ('novo','primeiro_contato','teste_enviado','negociacao','cliente','renovacao','cancelado');

-- ============= ORGANIZATIONS =============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER_ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============= SECURITY FUNCTIONS =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- ============= POLICIES: organizations =============
CREATE POLICY "members view own org" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "owners update own org" ON public.organizations
  FOR UPDATE TO authenticated USING (id = public.current_org_id() AND public.has_role(auth.uid(),'owner'));

-- ============= POLICIES: profiles =============
CREATE POLICY "view profiles in org" ON public.profiles
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============= POLICIES: user_roles =============
CREATE POLICY "view roles in org" ON public.user_roles
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

-- ============= TRIGGER: handle_new_user =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email,'@',1) || '''s Org');
  INSERT INTO public.organizations(name) VALUES (org_name) RETURNING id INTO new_org_id;
  INSERT INTO public.profiles(id, organization_id, full_name, email)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  INSERT INTO public.user_roles(user_id, organization_id, role)
    VALUES (NEW.id, new_org_id, 'owner');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============= LEADS =============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  campaign TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.lead_status NOT NULL DEFAULT 'novo',
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_org ON public.leads(organization_id);
CREATE INDEX idx_leads_status ON public.leads(organization_id, status);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_created ON public.leads(organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view leads in org" ON public.leads
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "insert leads in org" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "update leads in org" ON public.leads
  FOR UPDATE TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "delete leads in org" ON public.leads
  FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= LEAD TAGS =============
CREATE TABLE public.lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tags TO authenticated;
GRANT ALL ON public.lead_tags TO service_role;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view tags in org" ON public.lead_tags
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "manage tags in org" ON public.lead_tags
  FOR ALL TO authenticated USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE TABLE public.lead_tag_assignments (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY(lead_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tag_assignments TO authenticated;
GRANT ALL ON public.lead_tag_assignments TO service_role;
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view tag assigns" ON public.lead_tag_assignments
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.organization_id = public.current_org_id()));
CREATE POLICY "manage tag assigns" ON public.lead_tag_assignments
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.organization_id = public.current_org_id()));

-- ============= LEAD ACTIVITIES (history/tasks/notes) =============
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  content TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view activities in org" ON public.lead_activities
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "insert activities in org" ON public.lead_activities
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "update activities in org" ON public.lead_activities
  FOR UPDATE TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "delete own activities" ON public.lead_activities
  FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND user_id = auth.uid());
