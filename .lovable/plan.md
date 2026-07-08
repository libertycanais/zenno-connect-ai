
# Contas gerenciadoras + Copiloto Claude

Dois blocos independentes que se combinam: **(1)** permitir que gestores de tráfego conectem uma conta **gerenciadora** (Google Ads MCC e Meta Business Manager) e enxerguem/gerenciem várias contas de clientes a partir dela, e **(2)** um copiloto Claude que lê dados dessas contas, sugere e (com aprovação) sobe/otimiza campanhas.

---

## Parte 1 — Contas gerenciadoras (MCC / Business Manager)

Hoje o app conecta 1 conta por OAuth e salva em `google_ad_accounts` / `meta_ad_accounts`. Vou estender para gerenciadoras:

**Google Ads (MCC)**
- No callback OAuth, além de `customers:listAccessibleCustomers`, chamar `customer/{id}/googleAds:searchStream` com `SELECT customer_client.* FROM customer_client` para descobrir todos os clientes vinculados ao MCC.
- Novo campo `is_manager` + `manager_customer_id` (já existe) em `google_ad_accounts`. Cada cliente é uma linha filha do MCC.
- Todas as chamadas de API dos clientes usam header `login-customer-id: <mcc_id>`.

**Meta (Business Manager)**
- Após OAuth, chamar `GET /me/businesses` → para cada business, `GET /{business_id}/owned_ad_accounts` e `/client_ad_accounts`.
- Novos campos `business_id`, `business_name`, `is_client_account` em `meta_ad_accounts`.

**UI**
- Nova tela `/app/clientes` com:
  - Lista agrupada por gerenciadora (MCC / BM).
  - Badge de plataforma, status, moeda, gasto do mês.
  - Botão "Definir como cliente ativo" (contexto global salvo em `localStorage` + `current_client_account_id` na sessão).
- Tabelas de campanhas passam a filtrar pelo cliente ativo automaticamente.
- Botão "Sincronizar todos os clientes" no MCC/BM (job em background que popula `meta_campaigns` e `google_ads_campaigns` para cada filho).

**Segurança**
- RLS por `organization_id` mantida.
- Só quem tem role `owner`/`admin` na org pode conectar/desconectar gerenciadora.

---

## Parte 2 — Copiloto Claude para campanhas

Sub-agente de IA especializado em tráfego pago, com **ferramentas** (tool use) que ele mesmo invoca — o usuário aprova antes de qualquer escrita.

**Backend**
- `POST /api/public/ai/traffic-copilot` (server function autenticada, `createServerFn` com `requireSupabaseAuth`).
- Provedor: **Lovable AI Gateway** com modelo Anthropic (`anthropic/claude-sonnet-4.5`). Sem pedir API key do usuário — usa `LOVABLE_API_KEY` já configurada.
- Streaming via AI SDK (`streamText`) com `stopWhen: stepCountIs(50)`.

**Ferramentas expostas ao Claude** (todas com `needsApproval` nas de escrita):
| Tool | Tipo | O que faz |
|---|---|---|
| `list_client_accounts` | leitura | Retorna contas do cliente ativo |
| `get_campaign_performance` | leitura | Métricas (CTR, CPA, ROAS, gasto) por período |
| `get_creatives` | leitura | Lista anúncios + preview |
| `search_audiences` | leitura | Públicos salvos do BM |
| `create_campaign` | **escrita** | Cria campanha rascunho (Meta/Google) |
| `create_adset` | **escrita** | Cria conjunto com segmentação + orçamento |
| `create_ad` | **escrita** | Sobe criativo + copy |
| `pause_campaign` / `resume_campaign` | **escrita** | Liga/desliga |
| `update_budget` | **escrita** | Ajusta orçamento diário |
| `duplicate_and_test` | **escrita** | Duplica adset trocando 1 variável (teste A/B) |

Cada tool de escrita retorna um **card de confirmação** no chat: "Vou criar campanha X com R$ 50/dia mirando público Y. Confirmar?" — só executa após clique.

**Auto-otimização (opcional, off por padrão)**
- Nova tabela `ai_optimization_rules`: `{ account_id, trigger (ex: CPA > 30 por 3 dias), action (ex: reduzir budget 20%), enabled }`.
- Cron diário (pg_cron → endpoint público assinado) roda regras e loga ações em `ai_optimization_runs`.

**UI**
- Nova rota `/app/ia/copiloto` — chat estilo Claude com:
  - Seletor de cliente ativo no topo.
  - Sugestões rápidas: "Analisar contas que estão gastando sem converter", "Sugerir 3 novas campanhas para cliente X", "Otimizar orçamentos da semana".
  - Renderização de tool calls com badges (🔍 lendo dados / ⚡ vai executar / ✅ executado).
  - Timeline de ações executadas por conta.

---

## Tabelas novas

```sql
ai_copilot_conversations (id, org_id, user_id, client_account_id, title, created_at)
ai_copilot_messages (id, conversation_id, role, content jsonb, tool_calls jsonb, created_at)
ai_optimization_rules (id, org_id, account_id, platform, trigger jsonb, action jsonb, enabled, created_at)
ai_optimization_runs (id, rule_id, triggered_at, result jsonb, status)
```
Todas com RLS por `organization_id` e GRANTs para `authenticated` + `service_role`.

---

## Ordem de entrega

1. **MCC/BM discovery** — expandir OAuth callbacks + migration com campos novos.
2. **Tela `/app/clientes`** + contexto de cliente ativo.
3. **Sync em lote** de campanhas dos filhos.
4. **Copiloto (leitura)** — chat + tools de leitura, sem escrita ainda.
5. **Copiloto (escrita)** — tools de create/pause/update com cards de aprovação.
6. **Regras de auto-otimização** (opcional, ligar depois).

---

## Perguntas antes de começar

1. **Escopo inicial:** entrego **tudo** (Parte 1 + 2 completas) ou começo só pela **Parte 1** (gerenciadoras) e o copiloto vem depois?
2. **Auto-otimização automática** (regras que rodam sozinhas no cron) você quer nessa fase ou só o copiloto assistido por chat?
3. Confirma usar **Claude via Lovable AI Gateway** (sem você precisar dar API key da Anthropic)? Custo sai dos créditos Lovable.
