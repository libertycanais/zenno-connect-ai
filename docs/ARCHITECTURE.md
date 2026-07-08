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

| Domínio  | Interface          | Providers                                       | ENV switch          |
| -------- | ------------------ | ----------------------------------------------- | ------------------- |
| Ads      | `AdsProvider`      | `meta`, `google_ads`                            | `ADS_PROVIDER`      |
| WhatsApp | `WhatsAppProvider` | `uazapi` (WABA pluggable)                       | `WHATSAPP_PROVIDER` |
| Payments | `PaymentProvider`  | `stripe`, `mercadopago`                         | `PAYMENT_PROVIDER`  |
| AI       | `AIProvider`       | `lovable` (OpenAI/Anthropic prontos p/ adapter) | `AI_PROVIDER`       |

### Uso em consumers de domínio

```ts
import { getWhatsAppProvider } from "@/providers/whatsapp/whatsapp-provider.factory";

const wa = getWhatsAppProvider(); // usa ENV
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

## Tracking público

Fluxo atual do pixel público:

```
site do cliente
      │  Origin / Referer
      ▼
/api/public/track/event
      │  valida pk + allowlist fail-closed
      │  aplica rate limit por IP e por chave pública
      ▼
tracking_events / tracking_leads
      │  somente se origem permitida
      ▼
meta_conversion_events / google_ads_conversions
      │
      ▼
audit_log
```

Invariantes da camada:

- Chave pública identifica a organização, mas não autoriza ingestão sozinha.
- Allowlist vazia significa **bloqueado**, não modo permissivo.
- Requests públicos sem origem/referer não são aceitos para evitar ingestão server-to-server não autenticada.
- CORS é derivado do `Origin` recebido e nunca usa wildcard no endpoint de evento.
- Conversões continuam no modelo atual de consumers; a migração completa para Provider Layer permanece como etapa posterior.

## Deploy independente

Ver `docs/DOCKER.md` e `mem://architecture/deploy-independence`.
