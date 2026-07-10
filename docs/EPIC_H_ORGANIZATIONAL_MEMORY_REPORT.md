# EPIC H — Organizational Memory & Learning Engine

**Status:** ✅ COMPLETED — Aguardando aprovação do CTO
**Phase:** 3 — Organizational Intelligence
**Escopo:** 100% aditivo. Architecture Freeze v1.0 preservado.

---

## Objetivo

Fazer o Zenno **aprender continuamente**. Cada organização passa a ter memória
própria, auditável, versionada e estritamente isolada. O pipeline foi
projetado para receber, no futuro, adaptadores de **RAG / Vector Search /
Long-Term Memory / Multi-Agent Learning** sem qualquer refatoração —
todos os pontos de extensão foram deixados como *contratos*.

---

## Arquivos criados

### Nova camada: `src/lib/ai/memory-engine/`
- `index.ts` — MemoryEngine + Builder + Validator + Versioning + Merger +
  Decay + Scorer (Quality) + Indexer + Retriever + Pruner + Replay +
  Search (keyword/tag/temporal/importance/hybrid + contratos
  semantic/vector).

### Novos módulos
- `src/lib/ai/business-dna/index.ts` — `BusinessDNA` completo (mercado,
  modelo, ticket, margem, KPIs, tom de comunicação, restrições, histórico)
  + `BusinessDNAStore` versionado org-scoped.
- `src/lib/ai/learning/index.ts` — LearningEngine, LearningPipeline,
  LearningSession, LearningScorer, FeedbackCollector, FeedbackAnalyzer,
  KnowledgeUpdater, LearningMetrics, LearningTimeline, LearningInsights.
- `src/lib/ai/replay/index.ts` — DecisionReplayStore com snapshots
  imutáveis (contexto + DNA + memórias + prompt/rule/expert versions +
  provider/model + workflow + timeline + result). Cross-tenant proibido.
- `src/lib/ai/knowledge-lineage/index.ts` — KnowledgeLineageStore e
  LineageValidator. Toda recomendação exige origem rastreável
  (Signals → KPIs → DNA → Memory → Knowledge → Rules → Expert → Provider).
- `src/lib/ai/self-audit/index.ts` — SelfKnowledgeAudit +
  KnowledgeEvolutionEngine (detecta memórias redundantes/cold, regras
  não usadas, playbooks obsoletos, benchmarks vencidos).
- `src/lib/ai/feedback/index.ts` — ExpertFeedbackStore
  (used/accepted/rejected/outcome/timeToResult/financialImpact/comment)
  + ExpertCalibrationTracker (rollingAccuracy + confidenceHistory).
- `src/lib/ai/memory-quality/index.ts` — QualityGate (`isUsable`) sobre
  o MemoryScorer.
- `src/lib/ai/profile/index.ts` — OrgProfileStore.
- `src/lib/ai/preferences/index.ts` — PreferencesStore.
- `src/lib/ai/history/index.ts` — HistoryStore (append-only por org).

### Testes
- `tests/unit/lib/ai/epic-h-organizational-memory.test.ts` — **24 testes**
  cobrindo Memory Engine (build/validate/version/merge/decay/prune/search
  em todos os modos/replay/quality gate), Business DNA, Learning Engine
  (samples → insights → updates → métricas → timeline), Decision Replay
  com bloqueio cross-tenant, Knowledge Lineage com validação de origem,
  Self Audit + Knowledge Evolution, Expert Feedback + Calibration,
  Profile/Preferences/History org-scoped.

## Arquivos alterados
Nenhum. Implementação 100% aditiva — nenhuma camada existente foi tocada.

---

## Novos módulos (visão consolidada)

| Módulo | Responsabilidade | Ponto de extensão |
|--------|------------------|-------------------|
| `memory-engine` | CRUD + versionamento + busca + qualidade + decay + replay | `EmbeddingRef` + `SearchMode: "vector" \| "semantic"` |
| `business-dna` | DNA da organização carregado por Experts | Versionado — pronto para snapshot no Replay |
| `learning` | Aprende com feedback/playbooks/KPIs/decisões/outcomes | `LearningSource` extensível |
| `replay` | Reproduz decisão com contexto/DNA/memória da época | Aceita qualquer runtime |
| `knowledge-lineage` | Rastreabilidade obrigatória de recomendações | Nós plugáveis por domínio |
| `self-audit` | Auditoria contínua do conhecimento | `AuditFindingKind` extensível |
| `feedback` | Loop e calibração de Experts | Alimenta futuro Consensus |
| `memory-quality` | Gate composto sobre memória | Threshold configurável |
| `profile / preferences / history` | Perfil, preferências e histórico org-scoped | Independentes / reutilizáveis |

---

## Memory Quality Score (composição)

`overallScore = 0.20·confidence + 0.18·relevance + 0.15·freshness +
0.15·businessImpact + 0.10·feedback + 0.10·usage + 0.12·successRate`.
Nenhuma memória é usada sem avaliação (`QualityGate.isUsable`).

## Memory Decay
- Meia-vida configurável (`halfLifeDays`).
- `archiveBelow` marca como arquivada.
- `removeBelow` + `expiresAt` disparam remoção via `MemoryPruner`.

## Memory Search (modos entregues + contratos)
Entregues: **keyword, tag, temporal, importance, hybrid**.
Contratos (retornam `[]` até adapter): **semantic, vector**.
Todos aplicam **filtro obrigatório por `organizationId`**.

---

## Knowledge Lineage (invariante)

`Signals → KPIs → Business DNA → Memory → Knowledge → Rules → Expert → Provider → Recommendation`

`KnowledgeLineageStore.record` **rejeita** qualquer nó sem
`expertId`, `provider` ou sem pelo menos uma origem
(signal, kpi ou memory).

## Decision Replay (invariante)

`DecisionReplayStore.capture` **rejeita** capturas em que o `BusinessDNA`
ou qualquer `MemoryRecord` pertença a outra organização. Cada snapshot
é imutável (append-only) e inclui: contexto, DNA, memórias, promptVersion,
ruleVersions, expertVersion, provider, model, workflow, timeline, result.

## Self Audit + Knowledge Evolution

Detecta e classifica automaticamente:
- `redundant_memory` (título+scope duplicados)
- `cold_memory` (0 usos há > 30 dias)
- `unused_rule`, `obsolete_playbook`, `stale_benchmark` (>180 dias),
  `inconsistent_knowledge`.
- `KnowledgeEvolutionEngine.evolve` propõe `retire | review | refresh`.

## Expert Confidence Calibration

`ExpertCalibrationTracker` mantém `predictions / hits / misses /
rollingAccuracy / confidenceHistory (cap 50)` por (`org`, `expertId`).
Base para o futuro Consensus Engine.

---

## Segurança / Multi-tenant / RLS

Toda camada é **in-memory, aditiva e organization-scoped**:

- `MemoryEngine.{get,update,list,search,markUsed,prune,replay}` filtram por
  `organizationId`.
- `MemoryMerger.merge` **throw** em cross-tenant.
- `DecisionReplayStore.capture` **throw** em DNA ou memórias de outro tenant.
- `KnowledgeLineageStore.get` retorna `null` para outro tenant.
- Nenhum store expõe dados globais.
- Não há acesso a Supabase, Provider Layer, Runtime, Experts, Signals,
  Monitoring, Billing, Tracking ou API pública — RLS existente permanece
  intocada. Quando (e se) uma persistência for adicionada, será via
  migração dedicada com RLS + GRANTs, sem alterar o Freeze.

## Compatibilidade

| Camada | Impacto |
|--------|--------:|
| Architecture Freeze v1.0 | ✅ intacta |
| Provider Layer | ✅ intacta |
| Brain | ✅ intacta |
| Runtime | ✅ intacta |
| Experts | ✅ intacta (podem passar a *ler* Business DNA opcionalmente) |
| Signals / Monitoring | ✅ intactas |
| Governance | ✅ intacta |
| Billing / Tracking / Multi-tenant / RLS | ✅ intactas |
| API pública / Contratos públicos / ADRs / Audit Log | ✅ intactos |
| Cloudflare Workers | ✅ compatível (puro TS, sem I/O, sem Node-only) |

---

## Quality Gate

| Gate | Resultado |
|------|-----------|
| `bunx tsgo --noEmit` | ✅ 0 erros |
| `bun run test` (Epic H) | ✅ 24/24 |
| `bun run test` (total) | ✅ 691 passed / 1 failed (`audit_log_prune_partitions` — **pré-existente**, externa à Epic H, sem regressão) |
| `bun run build` | executado automaticamente pelo harness |

---

## Melhorias automáticas (CTO)

Todas aditivas e alinhadas às restrições:

1. **QualityGate** helper em `memory-quality/` — evita reuso ad-hoc do
   scorer em Experts.
2. **HistoryStore** append-only por org — base natural para o futuro
   AI Timeline persistido.
3. **`emptyLineage()` / `noEmbedding()`** — construtores canônicos para
   evitar drift em novos módulos.
4. **`SearchMode = "vector" | "semantic"`** já publicados como contratos
   — Vector DB adapter poderá ser plugado sem tocar consumidores.
5. **`ExpertCalibrationTracker`** com janela deslizante — pronto para o
   Consensus Engine futuro.

---

## Próximos passos sugeridos

- **Epic I (a definir)** — persistência das memórias via `public.ai_memories`
  (migração com RLS + GRANTs) e adapter de Vector Search plugável em
  `EmbeddingRef`.
- Consumo opcional do `BusinessDNA` pelos Experts existentes
  (leitura pura, sem alterar contratos).
- Job de auditoria periódica com o `SelfKnowledgeAudit`.

**PARADA OBRIGATÓRIA cumprida.** Aguardando aprovação do CTO para Epic I.
