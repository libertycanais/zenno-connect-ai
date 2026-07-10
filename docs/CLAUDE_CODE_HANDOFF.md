# Claude Code Handoff — Zenno AI Suite

**Objetivo:** dar a um agente Claude Code (ou qualquer engenheiro externo) o contexto mínimo suficiente para operar o repositório sem quebrar o Architecture Freeze v1.0.

---

## 1. Leitura obrigatória (nessa ordem)

1. [`PROJECT_MANIFEST.md`](../PROJECT_MANIFEST.md)
2. [`docs/ARCHITECTURE_FREEZE.md`](ARCHITECTURE_FREEZE.md)
3. [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
4. [`docs/ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md)
5. [`docs/SECURITY.md`](SECURITY.md) + [`docs/security/*`](security/)
6. [`docs/ENGINEERING_HANDBOOK.md`](ENGINEERING_HANDBOOK.md)
7. [`docs/PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md)
8. [`docs/DESIGN_GOLDEN_RULES.md`](DESIGN_GOLDEN_RULES.md)
9. [`docs/MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md)
10. [`mem/architecture/*`](../mem/architecture/) — constraints permanentes

---

## 2. Comandos padrão

```bash
bun install
bun run dev
bun run test            # Vitest — deve estar verde
bunx tsgo --noEmit      # typecheck — deve estar limpo
bun run build
```

Quality Gate mínimo: **testes verdes + tsgo limpo**.

---

## 3. Estrutura mental do código

```
src/
├── routes/              # TanStack file-routing (páginas + api/public/*)
├── components/          # UI (workspace, marketing, experience, brand)
├── lib/
│   ├── ai/              # Copilot, Governance, Brain, Experts, Knowledge
│   ├── business/        # Business KPI Engine (fonte oficial de métricas)
│   ├── marketing/       # Connectors, Intelligence Pipeline, Event Bus
│   ├── workspace/       # Zenno OS
│   └── pilot/           # Feature Flags + Telemetria RC2
├── providers/           # Provider Layer (ads, ai, payments, whatsapp)
└── integrations/
    └── supabase/        # AUTO-GERADO — não editar
supabase/migrations/     # DDL versionado, RLS, GRANTs
tests/                   # unit / integration / contracts / rc1
docs/                    # documentação oficial
mem/                     # memória persistente (constraints, decisões)
```

---

## 4. Regras de ouro

1. **Nunca** editar `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`
2. **Nunca** remover RLS ou `organization_id` de uma query/policy
3. **Nunca** importar SDK externo fora de `src/providers/*`
4. **Nunca** colocar segredos com prefixo `VITE_` (exceto publishable keys)
5. **Nunca** reintroduzir Redis/BullMQ (removido da baseline)
6. **Sempre** rodar `bunx tsgo --noEmit` + `bun run test` antes de finalizar
7. **Sempre** que alterar arquitetura, abrir novo ADR em `docs/ARCHITECTURE_DECISIONS.md`
8. **Sempre** que criar tabela pública, incluir `GRANT` + `ENABLE ROW LEVEL SECURITY` + policies na mesma migration

---

## 5. Como estender

| Cenário | Onde tocar |
|---|---|
| Novo provider de IA | `src/providers/ai/*` + factory + testes |
| Novo conector marketing | `src/lib/marketing/contracts/connector.ts` (implementar interface) |
| Nova regra de conhecimento | `src/lib/ai/knowledge/*` (arquivo tipado, sem prompt livre) |
| Novo KPI | `src/lib/business/*` (função pura, sem I/O) |
| Novo Expert | `src/lib/ai/experts/*` implementando `Expert.run` |
| Novo widget do OS | `src/components/workspace/widgets.tsx` + registry |
| Nova rota | `src/routes/` (arquivo dot-separated); tree é auto-gerado |
| Novo evento canônico | `src/lib/marketing/intelligence/events/*` + tipagem no bus |

---

## 6. Antes de fazer PR

- [ ] `bunx tsgo --noEmit` sem erros
- [ ] `bun run test` verde
- [ ] Migração (se houver) idempotente e com GRANT + RLS
- [ ] Docs relevantes atualizados (INDEX, ADR se aplicável)
- [ ] Nenhum segredo commitado
- [ ] Sem `console.log` ou `any` novos
- [ ] Provider Layer preservado

---

## 7. Contatos e ponteiros

- Índice completo: [`docs/INDEX.md`](INDEX.md)
- Runbooks operacionais: [`docs/runbooks/`](runbooks/)
- Diagramas: [`docs/DIAGRAMS.md`](DIAGRAMS.md)
- Backlog priorizado: [`docs/PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md)

**PARADA OBRIGATÓRIA após leitura deste guia.** Não iniciar migração sem aprovação explícita do CTO.
