---
name: Project Mode — Product Evolution
description: Zenno AI Suite is in Product Evolution mode; engineering base is frozen and closed
type: constraint
---
Zenno AI Suite entrou oficialmente em **Product Evolution** (pós ENGINEERING PHASE COMPLETED).

Baseline oficial (imutável sem solicitação explícita do usuário):
- Architecture Freeze v1.0 (`docs/ARCHITECTURE_FREEZE.md`)
- Engineering Final Report (`docs/ENGINEERING_FINAL_REPORT.md`)
- ADRs (`docs/ARCHITECTURE_DECISIONS.md`)
- Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`)
- Project Readiness / Production Readiness
- Observability (`docs/OBSERVABILITY.md`)
- Performance Audit (`docs/PERFORMANCE_AUDIT.md`)

**Regras permanentes:**
- Não criar Sprints genéricas novas. Toda demanda é uma FEATURE independente.
- Não criar documentação redundante — atualizar a existente só se a feature exigir.
- Não revisar arquitetura sem pedido explícito.
- Não alterar ADRs aceitos.
- Não alterar contratos públicos, RLS ou Provider Layer sem pedido explícito com ADR novo.
- Toda mudança deve ser aditiva e preservar a arquitetura existente.
- Manter 313/313 testes verdes e `tsgo --noEmit` limpo como quality gate mínimo.

**Why:** engenharia base encerrada e congelada; foco muda para valor de produto sobre baseline estável.
