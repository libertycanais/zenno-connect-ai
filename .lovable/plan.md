
# Copiloto Tráfego — Fase de escrita (com aprovação)

Adicionar ao Copiloto a capacidade de **executar ações** em Meta Ads e Google Ads (pausar/retomar campanha, ajustar orçamento), sempre com **cartão de confirmação** no chat antes de qualquer chamada real às APIs. Também sincroniza a resposta em **streaming** para melhor UX.

## O que muda

### 1. Ações pendentes (tabela nova)
`ai_copilot_pending_actions` — cada tool call de escrita vira uma linha `pending` que o usuário aprova/rejeita.

Colunas: `conversation_id`, `message_id`, `tool_name`, `tool_args (jsonb)`, `preview (text)`, `platform`, `account_id`, `status` (pending/approved/rejected/executed/failed), `result (jsonb)`, `executed_at`.

RLS por `organization_id` (via profile do user).

### 2. Novas tools no Copiloto (server-side)

Todas com `needs_approval: true` — o handler **não executa**: retorna um preview e registra a pending action.

| Tool | Args | O que faz depois de aprovado |
|---|---|---|
| `pause_campaign` | `platform`, `campaign_id` | `POST /{id}` status=PAUSED (Meta) / `mutate` status=PAUSED (Google) |
| `resume_campaign` | `platform`, `campaign_id` | idem, ACTIVE/ENABLED |
| `update_daily_budget` | `platform`, `campaign_id`, `new_daily_budget_cents` | update do daily_budget |

Cada uma valida ownership: a campanha precisa pertencer a `organization_id` do user (via `meta_campaigns`/`google_ads_campaigns`).

### 3. Fluxo de aprovação

- Modelo chama `pause_campaign` → runTool retorna `{ status: "pending_approval", pending_id, preview: "Vou pausar 'Campanha X' (Meta)" }` e insere linha em `ai_copilot_pending_actions`.
- Frontend renderiza card no chat com botões **Aprovar** / **Rejeitar**.
- **Aprovar** chama `approvePendingAction({ id })` (createServerFn autenticado) — executa a chamada real à API do provedor (usando tokens em `meta_ad_accounts`/`google_ad_accounts`) e atualiza `status=executed` + `result`.
- **Rejeitar** chama `rejectPendingAction({ id })` — marca como `rejected`.
- Nova mensagem de sistema `"Ação aprovada: pausada com sucesso"` volta para o loop do modelo na próxima interação.

### 4. UI (`src/routes/app.ia.copiloto.tsx`)
- Detecta mensagens tool com payload `status: pending_approval` e renderiza `<PendingActionCard>` com preview + 2 botões.
- Após aprovar/rejeitar, refetch da conversa.
- Badges já existentes: 🔍 leitura / ⚡ aguardando aprovação / ✅ executada / ❌ rejeitada.

### 5. Executores (server-only)
- `src/lib/copilot-executors.server.ts`
  - `executeMetaPauseResume(account, campaign_id, status)` → `POST graph.facebook.com/v20.0/{id}` com `access_token` da conta.
  - `executeMetaBudget(account, campaign_id, cents)` → mesmo endpoint com `daily_budget`.
  - `executeGoogleAdsPauseResume(account, campaign_id, status)` → `customers/{cid}/campaigns:mutate` com `login-customer-id` do MCC quando aplicável.
  - `executeGoogleAdsBudget(...)` → similar, ajustando `campaign_budget`.
- Refresh de token OAuth quando expirado (já existe helper Google; adicionar Meta se necessário — usar long-lived token).

### 6. Streaming (opcional nesta entrega — feito depois)
Manter fase 1 sem streaming para simplificar; deixar `copilotChat` como está com resposta completa.

## Ordem de execução

1. **Migration** — cria `ai_copilot_pending_actions` + RLS + GRANTs.
2. **`copilot-executors.server.ts`** — 4 executores (Meta pause/budget, Google pause/budget) com verificação de ownership.
3. **`copilot.functions.ts`** — adicionar 3 tools (`pause_campaign`, `resume_campaign`, `update_daily_budget`), lógica de "criar pending action em vez de executar", + 2 novas server fns `approvePendingAction`, `rejectPendingAction`, + `listPendingActions`.
4. **`app.ia.copiloto.tsx`** — componente `<PendingActionCard>` com botões, integração no render de mensagens tool.
5. Ajustar SYSTEM_PROMPT: dizer que agora pode executar mas sempre exige confirmação.

## Perguntas antes de começar

1. **Escopo destas tools**: começo com **pause/resume/update_budget** apenas (mais seguros, reversíveis) ou já incluo `create_campaign`/`create_adset` nesta rodada (muito mais complexo, ~2x o trabalho)?
2. Auto-otimização por regras (cron) fica para próxima entrega — confirma?
