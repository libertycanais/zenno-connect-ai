# Zenno — Enterprise Test Suite

Sprint 4 — infraestrutura de testes. Nenhum contrato público, RLS, DTO,
Provider Layer ou endpoint público é modificado por esta suíte.

## Estrutura

```
tests/
  setup.ts                # bootstrap global (jest-dom, mocks, env)
  unit/                   # testes unitários puros (funções, helpers)
  integration/            # server functions, fluxos multi-módulo
  contracts/              # contratos de Provider Layer, APIs públicas
  helpers/                # utilitários reutilizáveis (render, auth, tenant)
  fixtures/               # dados canônicos (org, user, lead, event…)
  mocks/                  # mocks tipados (supabase, providers, fetch)
```

## Convenções

- Nomes: `*.test.ts` ou `*.spec.ts`.
- Multi-tenant: sempre usar `withOrganization()` para gerar contexto.
- Providers: nunca chamar SDK real — usar mocks em `tests/mocks/providers`.
- Fixtures são **factories deterministicamente aleatórias** via seed opcional.
- Nunca depender de rede ou banco real.

## Scripts

```
bun test                # roda toda a suíte
bun test --coverage     # com cobertura V8
bun test tests/unit     # subconjunto
```
