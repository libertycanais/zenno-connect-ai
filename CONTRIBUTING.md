# Contributing — Zenno AI Suite

Obrigado por contribuir. Este guia é normativo — segui-lo é pré-requisito
para que seu PR seja considerado para merge.

## Fluxo Git

- Branch base: `main` (protegida, requer PR).
- Nome da branch: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `hotfix/<slug>`.
- Um PR = uma mudança lógica. PRs gigantes serão devolvidos.
- Commits em português ou inglês, imperativo curto (`add ...`, `fix ...`).

## Como criar branch

```bash
git checkout main && git pull
git checkout -b feat/lead-import-csv
```

## Como abrir PR

- Título convencional: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- Descrição obrigatória:
  - **Contexto** — por que essa mudança existe.
  - **Decisão** — o que foi feito.
  - **Como testar** — passos manuais.
  - **Screenshots** (se UI).
  - **Links** para issue, ADR (se aplicável) e docs atualizados.
- Marcar reviewers apropriados. Segurança precisa aprovar quando toca
  RLS, OAuth, webhooks, tracking ou `SECURITY DEFINER`.

## Como criar migration

1. Arquivo: `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql`.
2. Estrutura obrigatória para nova tabela `public.*`:
   ```sql
   CREATE TABLE public.<nome> (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     -- ... colunas
   );
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<nome> TO authenticated;
   GRANT ALL ON public.<nome> TO service_role;
   ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "..." ON public.<nome> FOR ALL
     USING (organization_id = current_org_id())
     WITH CHECK (organization_id = current_org_id());
   ```
3. Toda FK indexada.
4. Migration **imutável** após merge.

## Como criar feature

1. Issue com escopo + critério de aceite.
2. Se estrutural → ADR primeiro.
3. Migration → Server Function → UI → Testes.
4. Quality gate local: `bunx tsgo --noEmit && bun test && bun run build`.
5. PR.

## Como criar Provider

- Interface em `src/providers/<dominio>/<dominio>-provider.interface.ts`.
- Implementação em `src/providers/<dominio>/<vendor>.provider.ts`.
- Registro na fábrica + env var `<DOMINIO>_PROVIDER`.
- Testes unitários em `tests/unit/providers/<dominio>/`.
- Se envia payload externo → snapshot em `tests/contracts/provider-payloads.contract.test.ts`.

## Como criar endpoint

- Arquivo em `src/routes/api/public/<slug>.ts` (contrato público).
- **Toda alteração é breaking change** → snapshot em
  `tests/contracts/public-endpoints.contract.test.ts` deve ser revisado
  explicitamente.
- Verificar HMAC / public key antes de processar payload.
- Rate limit + Zod + audit_log obrigatórios.

## Como criar teste

- **Unit**: `tests/unit/**` — providers/utils isolados.
- **Integration**: `tests/integration/**` — cobre API, DB, security.
- **Contract**: `tests/contracts/**` — snapshots inline.
- Reusar `tests/fixtures/*` e `tests/helpers/*`. Não hard-codar payloads.

## Como documentar

- Mudança em contrato público / RLS / provider / migration destrutiva
  → atualizar `docs/` no mesmo PR.
- Novo ADR → adicionar `ADR-XXX` em `docs/ARCHITECTURE_DECISIONS.md` +
  entrada no índice final.
- Novo runbook → arquivo em `docs/runbooks/` + link em `docs/INDEX.md`.

## Boas práticas

- TypeScript strict, sem `any`.
- Tokens semânticos para cores (proibido `bg-blue-500`).
- Sem `useEffect` para estado derivado.
- Validar todo input com Zod.
- Nunca `console.log` no código commitado — usar `@/lib/logger`.

## Code Review

Revisores devem checar:
- Correção funcional.
- Segurança (RLS, secrets, HMAC, rate limit).
- Cobertura de testes proporcional ao risco.
- Snapshots contratuais revisados intencionalmente.
- Documentação atualizada.

Aprovações necessárias:
- 1 reviewer para features padrão.
- 2 reviewers para mudanças em RLS, OAuth, tracking, migration destrutiva,
  `/api/public/*` ou Provider Layer.

## Checklist obrigatório do PR

- [ ] Título convencional.
- [ ] Descrição completa (contexto + como testar).
- [ ] `bunx tsgo --noEmit` verde.
- [ ] `bun test` verde (313+ testes).
- [ ] `bun run build` verde.
- [ ] Sem `console.log` / `.only` / `.skip`.
- [ ] Migration com GRANT + RLS + policies (se aplicável).
- [ ] Snapshot contratual revisado (se `/api/public/*` ou provider).
- [ ] Docs atualizados.
- [ ] Reviewer de segurança marcado (se aplicável).
