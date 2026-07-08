# Arquitetura — Zenno SaaS

## Provider Layer

```
Server Functions (domínio)
        │
        ▼  (importa APENAS interface)
┌────────────────────────────────────────────────┐
│  src/providers/<domain>/*-provider.interface   │
└────────────────────────────────────────────────┘
        │
        ▼  (factory por ENV)
┌────────────────────────────────────────────────┐
│  *-provider.factory  →  concrete Provider      │
│                         (Meta | Google | ...)  │
└────────────────────────────────────────────────┘
        │
        ▼
   API externa (fetch)
```

### Domínios

| Domínio  | Interface              | Providers | ENV switch          |
| -------- | ---------------------- | --------- | ------------------- |
| Ads      | `AdsProvider`          | `meta`, `google_ads`               | `ADS_PROVIDER`      |
| WhatsApp | `WhatsAppProvider`     | `uazapi` (WABA pluggable)          | `WHATSAPP_PROVIDER` |
| Payments | `PaymentProvider`      | `stripe`, `mercadopago`            | `PAYMENT_PROVIDER`  |
| AI       | `AIProvider`           | `lovable` (OpenAI/Anthropic prontos p/ adapter) | `AI_PROVIDER` |

### Uso em consumers de domínio

```ts
import { getWhatsAppProvider } from "@/providers/whatsapp/whatsapp-provider.factory";

const wa = getWhatsAppProvider();               // usa ENV
await wa.sendMessage(ctx, instanceId, { to, text });
```

Regra: server functions e handlers importam **somente** a factory + tipos da interface. **Nunca** `graph.facebook.com`, SDK Stripe, `@/integrations/lovable`, etc. diretamente.

### Adicionar um novo provider

1. Criar `src/providers/<domain>/<name>.provider.ts` implementando a interface.
2. Registrar no factory (`registry` + `SUPPORTED`).
3. Documentar ENV necessária.
4. Adicionar teste de contrato (factory retorna instância + métodos disponíveis).
5. Nenhuma mudança em consumers.

### Regras invioláveis

- **Zero SDK de fornecedor** importado em módulo de domínio.
- Toda credencial via `process.env` server-side; nunca client.
- Erros externos passam por `sanitizeProviderError` antes de exposição.
- Providers são stateless — instanciados sob demanda pela factory.

## Camadas atuais

- `src/routes/` — TanStack routes (páginas + `/api/public/*`)
- `src/lib/*.functions.ts` — server functions de domínio (isomorfic-safe)
- `src/lib/*.server.ts` — helpers server-only
- `src/providers/` — camada de abstração para fornecedores externos ← **novo**
- `src/integrations/supabase/` — clients gerados (não editar)
- `supabase/migrations/` — schema versionado

## Deploy independente

Ver `docs/DOCKER.md` e `mem://architecture/deploy-independence`.
