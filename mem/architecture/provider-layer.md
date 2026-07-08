---
name: Provider Layer Zenno
description: Camada de abstração para fornecedores externos — Ads, WhatsApp, Payments, AI. Consumers importam factory, nunca SDK
type: constraint
---

# Provider Layer — Sprint Arquitetura 3

## Estrutura
`src/providers/<domain>/`:
- `<domain>-provider.interface.ts` — contrato
- `<name>.provider.ts` — adapter concreto
- `<domain>-provider.factory.ts` — seleção por ENV

Domínios: `ads`, `whatsapp`, `payments`, `ai`, `common`.

## Regra inviolável
**Nenhum módulo de domínio (`src/lib/*.functions.ts`, rotas, handlers) pode importar SDK/API de fornecedor.** Consumers usam:
```ts
import { getAdsProvider } from "@/providers/ads/ads-provider.factory";
```
Nunca:
```ts
import { Stripe } from "stripe";                   // ❌
import { LovableAI } from "@/integrations/lovable"; // ❌ em domínio
await fetch("https://graph.facebook.com/...");     // ❌ em domínio
```

## ENV switches
- `ADS_PROVIDER` (default `meta`)
- `WHATSAPP_PROVIDER` (default `uazapi`)
- `PAYMENT_PROVIDER` (default `stripe`)
- `AI_PROVIDER` (default `lovable`)

## Providers registrados
- Ads: `meta`, `google_ads`
- WhatsApp: `uazapi`
- Payments: `stripe`, `mercadopago`
- AI: `lovable`

## Adicionar novo provider
1. Criar `<name>.provider.ts` implementando a interface do domínio.
2. Registrar no `registry` + `SUPPORTED` da factory.
3. Documentar ENV.
4. Zero alteração em consumers.

## Erros
Usar `ProviderError`, `ProviderNotConfiguredError`, `UnknownProviderError` de `@/providers/common/provider.types`. Sanitizar mensagens externas com `sanitizeProviderError` antes de expor.

## Segurança
- Todas as credenciais via `process.env` (server-only).
- Nenhum secret cruza para o client.
- Erros externos redigidos por `sanitizeProviderError` (remove `bearer <token>`).
- Logs via `@/lib/logger` (já redige chaves sensíveis).
