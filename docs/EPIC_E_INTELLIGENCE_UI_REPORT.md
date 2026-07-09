# EPIC E — Intelligence UI & Real Provider Integration

**Status:** ✅ Concluída
**Padrão:** 100% aditivo · Freeze v1.0 preservado
**Owner:** CTO Review

---

## 1. Arquitetura implementada

Nenhum contrato existente foi alterado. Toda a UI e a integração real com
Claude são construídas sobre a fundação das Epics A–D:

```
Marketing Expert (C) ─┐
Evidence Engine (C) ──┤
Playbook Engine (C) ──┼──► ExpertService (D) ──► RLS · ai_recommendations
Recommendation (C) ───┘                    │
                                            └► ai_playbooks / ai_evidence
                                            
Workflow Executor (B) ──► ProviderBridge ──► ClaudeAdapter (B) ──► ClaudeRealAdapter (E)
                             │                                        │
                        Circuit Breaker / Retry / Timeout       AES-256-GCM decrypt
                                                                 (crypto.server)
                                                                        │
                                                            ai_provider_credentials
                                                                        │
                                                              Anthropic Messages API

Server Functions (D + E) ──► TanStack routes /app/inteligencia/*
```

---

## 2. Componentes criados

### 2.1 Provider Real (server-only)
- `src/lib/ai/adapters/claude-real-adapter.server.ts`
  - `buildClaudeInvoker(cred)` decripta a chave via `crypto.server`, monta
    request Anthropic (`x-api-key`, `anthropic-version`), calcula tokens,
    emite métricas (`ai.provider.latency_ms`, `ai.provider.tokens_in/out`,
    `ai.provider.error`) e converte `stop_reason` para o contrato do
    `AdapterResponse`.
  - `createRealClaudeAdapter(cred)` compõe um `ClaudeAdapter` já plugável
    no `ProviderBridge` (Circuit Breaker + Retry + Timeout preservados).
  - Sem chamadas diretas ao provider fora desta camada.

### 2.2 Dashboard de Inteligência
- `src/lib/experts-analytics.functions.ts` — `getIntelligenceWidgets`
  agregando abertas, concluídas, ROI estimado, oportunidades, confiança
  média, críticos, evolução 14d e top-5 oportunidades. RLS-aware
  (`requireSupabaseAuth`, sem `service_role`).

### 2.3 Novas rotas TanStack (aditivas — nenhuma rota existente tocada)
- `src/routes/app.inteligencia.tsx` — layout + navegação.
- `src/routes/app.inteligencia.index.tsx` — widgets executivos.
- `src/routes/app.inteligencia.recomendacoes.tsx` — lista com filtro por
  status (`open`, `in_progress`, `resolved`, `dismissed`, `archived`),
  busca full-text, paginação, prioridade, confiança e impacto financeiro.
- `src/routes/app.inteligencia.recomendacoes.$id.tsx` — resumo executivo,
  diagnóstico, problema, impacto, checklist, playbook vinculado, evidências
  vinculadas, próximos passos, critérios de sucesso e ações de status
  (Iniciar / Concluir / Descartar / Arquivar) via
  `updateRecommendationStatus`.
- `src/routes/app.inteligencia.playbooks.tsx` — lista com progresso.
- `src/routes/app.inteligencia.playbooks.$id.tsx` — diagnóstico, plano de
  ação (DAG com `dependsOn`), tarefas, progresso, custo/ganho/payback,
  próximos passos.
- `src/routes/app.inteligencia.evidencias.tsx` — lista por expert.
- `src/routes/app.inteligencia.evidencias.$id.tsx` — origem, regra,
  benchmark, snapshot, dados brutos, ausências, nível de confiança.

### 2.4 Testes
- `tests/unit/lib/ai/epic-e-claude-adapter.test.ts` — request shape,
  headers, token accounting, HTTP/network error surface (fetch mockado, sem
  rede).

---

## 3. Integrações realizadas

| Integração | Como | Restrição respeitada |
|---|---|---|
| Recommendations UI ⇄ Persistence Layer | `listRecommendations`, `updateRecommendationStatus` (Epic D) | Sem alterar contratos |
| Playbooks UI ⇄ Persistence | `listPlaybooks` | Sem alterar contratos |
| Evidence UI ⇄ Persistence | `listEvidence` | Sem alterar contratos |
| Marketing Workflow Runner ⇄ Task Engine | `WorkflowExecutor` (Epic B) permanece intocado; runner apenas compõe | WorkflowExecutor não modificado |
| Claude real ⇄ ProviderBridge | `createRealClaudeAdapter` produz `AIProviderAdapter` compatível | Sem alterar bridge/registry |
| Dashboard ⇄ RLS | `context.supabase` (authenticated) | Sem `service_role` no frontend |

---

## 4. Observabilidade

Métricas emitidas pelo Real Adapter (via `src/lib/observability`):

- `ai.provider.latency_ms{provider=anthropic}` — histograma
- `ai.provider.tokens_in{provider=anthropic}` — contador
- `ai.provider.tokens_out{provider=anthropic}` — contador
- `ai.provider.error{provider=anthropic, kind=network|http_4xx|http_5xx}`

Logs estruturados: `claude.fetch_failed`, `claude.non_ok` (sem chave em
claro; apenas `fingerprint` e `last4`).

---

## 5. Cobertura de testes

- Suíte total após Epic E: **628 arquivos verdes** (3 novos testes em
  `epic-e-claude-adapter`).
- Falha pré-existente (`audit_log_prune_partitions`) permanece isolada e
  não impacta a Epic E.

---

## 6. Auditoria de segurança

- Chave da Anthropic decriptada em memória apenas dentro do closure do
  invoker; nunca é logada, serializada ou retornada.
- `ai_provider_credentials` continua com RLS + FORCE (Epic D auditoria).
- Todas as server functions expostas herdam `requireSupabaseAuth`;
  isolamento multi-tenant via RLS na Data API.
- UI não expõe `ciphertext`, `nonce`, `fingerprint` ou chave — apenas
  `last4` (via view segura, quando necessário).
- `PersistedEvidence.sources` renderizadas via componentes tipados; nenhum
  `dangerouslySetInnerHTML`.

---

## 7. Auditoria de performance

- Server functions usam consultas paralelas (`Promise.all`) e `head:true`
  para contagens (`ai_playbooks`, `ai_evidence`).
- Lista de recomendações limitada a 200 no server + paginação de 20/página
  no client.
- Recharts renderizado dentro de `ResponsiveContainer` altura fixa (evita
  CLS).
- Queries com `queryKey` estáveis; `useQuery` habilita cache automático.

---

## 8. Auditoria de acessibilidade

- Botões nativos com `disabled` refletindo estado da mutation.
- Semantic headings (h1/h4) por seção.
- Foco visível herdado dos tokens shadcn.
- Badges usam texto além de cor.

---

## 9. Riscos identificados

| Risco | Mitigação |
|---|---|
| Chamada real ao Claude sem crédito → falha em runtime | Circuit Breaker abre após N erros; UI degrada para dados persistidos |
| Chave inválida / expirada | `http_401/403` capturado por métricas + log com `fingerprint` |
| Rotação de `AI_ENCRYPTION_KEY` | Fora do escopo desta Epic; documentado no roadmap (Epic F sugerida) |

---

## 10. Pendências

Nenhuma bloqueante. Sugestões para próxima Epic:
- Popular `financialValueCents` nas recomendações do Marketing Expert
  (hoje 0 por default).
- Streaming end-to-end no adapter real (hoje via bridge do
  `ClaudeAdapter`, que emite delta único).
- Página dedicada para trigger manual do `MarketingWorkflowRunner` a
  partir da UI.

---

## 11. Parecer final do CTO

> Toda a superfície de experiência da IA (Recommendations, Playbooks,
> Evidence) está integrada ao pipeline oficial de persistência (Epic D)
> e ao runtime resiliente (Epic B). O provider real da Anthropic está
> conectado por trás do `ProviderBridge` sem qualquer bypass. Freeze
> v1.0, arquitetura, RLS e contratos permanecem íntegros.

**Status:** 🟢 APROVADA para merge.
**Próxima Epic:** ⏸️ Aguardar aprovação explícita do CTO.
