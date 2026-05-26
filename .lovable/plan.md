
# IMPLEMENTATION PLAN — ZENNO CRM AI (Fundação / Fase 1)

O escopo solicitado é gigantesco (CRM + WhatsApp/Uazapi + Meta Ads + Google Ads + Sigma + Financeiro + Automações + IA + Tickets + Equipe + Notificações). Não é viável — nem seguro — entregar tudo numa única iteração. Proponho construir em fases, começando pela **fundação multi-tenant** + **módulo CRM (Leads + Pipeline Kanban)**, que é o coração do produto e desbloqueia todos os outros módulos.

Cada módulo seguinte (WhatsApp, Meta Ads, Google Ads, Sigma, Financeiro, IA, etc.) será entregue em iterações separadas, cada uma com seu próprio Implementation Plan completo (3.A → 3.F).

---

## Fase 1 — Fundação + CRM

### 3.A Análise de Arquitetura
- Projeto vazio. Vamos usar o template padrão Lovable (React + Vite + TS + Tailwind + Shadcn). *Observação: Next.js não é suportado no Lovable; usamos React/Vite, que cobre todos os requisitos de UI/SSR-light necessários.*
- Backend: **Lovable Cloud** (Supabase gerenciado) — Auth, Postgres, RLS, Edge Functions, Storage, Secrets.
- Arquitetura **multi-tenant por `organization_id`** com RLS em todas as tabelas.
- Papéis isolados em tabela `user_roles` + função `has_role` SECURITY DEFINER (evita recursão de RLS e escalonamento de privilégio).
- Estrutura modular de pastas: `src/modules/{crm,whatsapp,ads,financeiro,...}` para escalar.

### 3.B Banco de Dados
Tabelas criadas nesta fase (todas com RLS + GRANTs):
- `organizations` — tenants
- `profiles` — perfil do usuário (1:1 com `auth.users`), vinculado a `organization_id`
- `app_role` enum (`owner`, `admin`, `manager`, `agent`)
- `user_roles` — papéis por usuário/org
- `leads` — campos: nome, telefone, email, origem, campanha, responsável, status, observações, created_at
- `lead_status` enum: `novo`, `primeiro_contato`, `teste_enviado`, `negociacao`, `cliente`, `renovacao`, `cancelado`
- `lead_tags`, `lead_tag_assignments`
- `lead_activities` (histórico/tarefas/agendamentos)
- Índices em `organization_id`, `status`, `responsavel_id`, `created_at`
- Trigger `handle_new_user` cria profile + organization na primeira autenticação

### 3.C Backend
- Função `has_role(uuid, app_role)` SECURITY DEFINER
- Função `current_org_id()` SECURITY DEFINER (lê org do usuário logado)
- RLS: `USING (organization_id = current_org_id())` em todas as tabelas de domínio
- Trigger de criação automática de profile/org no signup
- Sem Edge Functions nesta fase (não há integração externa ainda)

### 3.D Frontend
- Auth: login/cadastro (email+senha), proteção de rotas
- Layout principal com sidebar modular (preparado para futuros módulos)
- Páginas:
  - `/` Dashboard (cards placeholder de métricas)
  - `/leads` Lista de leads + filtros + busca
  - `/leads/kanban` Pipeline Kanban arrastável (dnd-kit)
  - `/leads/:id` Detalhe do lead (histórico, tarefas, tags)
  - `/settings` Org/usuários
- Hooks: `useAuth`, `useOrg`, `useLeads` (React Query)
- Design responsivo desktop/mobile

### 3.E Segurança
| Risco | Nível | Impacto | Mitigação |
|---|---|---|---|
| Escalonamento de privilégio | 18 | Crítico | Roles em tabela separada + `has_role` SECURITY DEFINER |
| Vazamento cross-tenant | 20 | Crítico | RLS obrigatório com `current_org_id()` em toda tabela |
| SQL Injection | 5 | Baixo | Apenas client tipado Supabase, sem SQL cru |
| XSS | 6 | Médio | React escapa por padrão; sem `dangerouslySetInnerHTML` |
| CSRF | 4 | Baixo | JWT Bearer + SameSite |
| Falha de auth | 10 | Alto | `onAuthStateChange` + `getUser()` server-trusted |
| Race condition no signup | 8 | Médio | Trigger atômico cria profile+org+role |

### 3.F Revisão de Impacto
- Projeto vazio — sem regressão possível nesta fase.
- Estrutura de pastas e tabelas projetadas para acomodar todos os módulos futuros sem refactor.

---

## Roadmap das próximas fases (cada uma = novo plano)
2. WhatsApp/Uazapi (instâncias + chat)
3. Meta Ads (OAuth + Conversion API)
4. Google Ads (OAuth + Offline Conversions)
5. Sigma (integração API)
6. Financeiro
7. Automações (fluxos WhatsApp)
8. IA (OpenAI via Lovable AI Gateway)
9. Tickets + Notificações + Comissões/Metas

---

## Confirmações antes de codificar
1. **Confirma começarmos pela Fase 1 (Fundação + CRM Leads/Kanban)?**
2. **Confirma usar React + Vite** (Next.js não roda no Lovable) e **Lovable Cloud** como backend (Supabase gerenciado, sem você precisar de conta externa)?
3. Algum nome/branding/cor específica para a UI ou pode seguir um tema dark moderno padrão ZENNO?
