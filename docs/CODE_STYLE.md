# Code Style — Zenno AI Suite

Regras normativas de estilo. Complementa `docs/ENGINEERING_HANDBOOK.md` §4.

## TypeScript

- `"strict": true` sempre. Sem exceções.
- **Proibido** `any` — usar `unknown` e narrow.
- Sem `@ts-ignore` / `@ts-expect-error` sem justificativa em comentário.
- Tipos de retorno explícitos em exports públicos.
- Discriminated unions para estados finitos (`type State = { kind: 'idle' } | { kind: 'loading' } | ...`).
- `import type` para tipos puros.
- Preferir `readonly` em arrays/objetos imutáveis.

## React

- Function components + hooks (nunca classes).
- Props: `interface Props { ... }` exportada nomeada.
- Componentes ≤ 150 linhas. Excedeu, extrair.
- **Nunca** `useEffect` para estado derivado — usar `useMemo` ou computar.
- **Nunca** `key={index}` em listas dinâmicas.
- Error boundaries em toda rota.
- Loading e empty states explícitos.

## TanStack

- **Router**: file-based em `src/routes/`. Nunca editar `routeTree.gen.ts`.
- **Query**: `queryOptions` compartilhado + `useSuspenseQuery` no componente +
  `context.queryClient.ensureQueryData` no loader.
- `staleTime` por query, nunca global.
- `Link` / `useNavigate` de `@tanstack/react-router` (nunca react-router-dom).

## Supabase

- Client browser: `import { supabase } from "@/integrations/supabase/client"`.
- Client server publishable: instanciar no server function com
  `process.env.SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
- `supabaseAdmin`: apenas via `await import("@/integrations/supabase/client.server")`
  dentro do handler, e em contexto verificado (`requireSupabaseAuth` + role check).
- Nunca editar `src/integrations/supabase/*.ts` (auto-gerado).

## Providers

- Consumidores importam **interface**, nunca implementação.
- Seleção via fábrica + env var.
- Nunca chamar SDK vendor fora de `src/providers/**`.
- Payload externo → coberto por snapshot em `tests/contracts/provider-payloads.contract.test.ts`.

## Server Functions

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const doThing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // process.env lido AQUI dentro
    const key = process.env.SOME_KEY!;
    return { ok: true };
  });
```
- Uma função por arquivo é OK; agrupar por domínio também é OK.
- Não referenciar helpers de módulo top-level no handler (o splitter remove).
- Sempre `inputValidator()` antes de `handler()`.

## Naming

| Item | Convenção | Exemplo |
|------|-----------|---------|
| Arquivo componente | PascalCase | `LeadCard.tsx` |
| Arquivo server fn | `<dominio>.functions.ts` | `leads.functions.ts` |
| Arquivo server-only | `<slug>.server.ts` | `attribution.server.ts` |
| Hook | `useXxx` | `useLeads` |
| Tabela | `snake_case_plural` | `lead_events` |
| FK | `singular_id` | `organization_id` |
| Env var | `SCREAMING_SNAKE_CASE` | `META_APP_ID` |
| Env var pública | prefixo `VITE_` | `VITE_SUPABASE_URL` |
| Tipo | PascalCase | `LeadStatus` |
| Enum-like union | PascalCase | `type LeadStatus = 'new' | 'qualified'` |

## Imports

- Absolutos via `@/` (configurado em `tsconfig.json`).
- Ordem: React → libs externas → `@/...` → relativos → tipos.
- Nunca importar `.server.ts` em componente/hook.
- Nunca importar `client.server.ts` no top-level de `*.functions.ts`.

## Pastas

- `src/lib/` — server functions + utils.
- `src/providers/` — Provider Layer (isolada do domínio).
- `src/components/` — UI reutilizável.
- `src/modules/<dominio>/` — features de domínio (crm, whatsapp, ...).
- `src/hooks/` — hooks reutilizáveis.
- `src/routes/` — páginas + endpoints públicos.

## Errors

- Server fn: `throw new Error("mensagem descritiva")`.
- Endpoint público: `return Response.json({ error: "..." }, { status: 4xx })`.
- Nunca vazar stacktrace em resposta HTTP.
- Log estruturado do erro **sempre**: `log.error({ err, event }, "message")`.

## Logs

```ts
import { log } from "@/lib/logger";

log.info(
  { event: "lead.created", organization_id, lead_id, request_id },
  "lead criado"
);
```
- Objeto de contexto antes da string de mensagem.
- Nunca logar valor sensível (a redaction cobre, mas evite passar).

## DTO / Schemas / Zod

- Input de server fn / endpoint: **sempre** Zod.
- DTO de saída: tipo explícito.
- Reusar schemas quando possível; evitar duplicação.
- Nome do schema: `xxxSchema` (`createLeadSchema`).

## Tailwind

- **Somente tokens semânticos**: `bg-background`, `bg-card`, `bg-primary`,
  `text-foreground`, `text-muted-foreground`, `border-border`.
- **Proibido**: `bg-white`, `bg-blue-500`, `text-black`, `bg-[#...]`.
- Mobile-first: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Classes condicionais via `cn()` de `@/lib/utils`.

## shadcn/ui

- Componentes ficam em `src/components/ui/` (copiados, não instalados).
- Estender via `className` + `cn()`; não editar o componente base sem necessidade.
- Ao criar variante nova, usar `cva` do próprio componente.

## Hooks

- Um responsabilidade por hook.
- Retornar objeto nomeado quando > 2 valores.
- Sem side-effect no corpo (usar `useEffect`).
- Prefixar `use` obrigatoriamente.
