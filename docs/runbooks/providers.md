# Runbook — Providers Externos

Cobre Meta Ads/CAPI, Google Ads/OCI, Uazapi, Stripe, MercadoPago,
Lovable AI Gateway.

## Sintomas gerais
- Payloads externos rejeitados (4xx/5xx do provider).
- Fila de retry crescendo.
- Feature dependente do provider parada.

## Diagnóstico
1. Verificar statuspage do provider.
2. Logs por `event=provider.<nome>.request.failed` com `status` e `body`.
3. Testar endpoint direto via `curl` com credencial válida.
4. Confirmar secrets no cofre correspondem aos env vars atuais.

## Meta
- **Endpoint**: `graph.facebook.com` / CAPI.
- **Rejeições comuns**: `access token expired`, `permission denied`,
  `event_time in the future`, `hash inválido`.
- **Correção**: refresh token (ver `oauth.md`); recalcular hashes de PII.

## Google
- **Endpoint**: Google Ads API + Offline Conversion Upload.
- **Rejeições comuns**: `INVALID_CUSTOMER_ID`, `PERMISSION_DENIED`,
  `CONVERSION_ACTION_NOT_FOUND`.
- **Correção**: confirmar `login_customer_id` correto, escopo `adwords`
  concedido, conversion action criada.

## Uazapi
Ver [`whatsapp.md`](./whatsapp.md).

## Stripe / MercadoPago
- **Rejeições comuns**: signature inválida, evento duplicado,
  metadata ausente.
- **Correção**: sincronizar webhook secret; garantir idempotência via
  `event.id`.

## Lovable AI Gateway
- **Rejeições comuns**: `unauthorized`, `rate_limited`, `quota_exceeded`.
- **Correção**: rotacionar `LOVABLE_API_KEY`; ajustar concorrência.

## Provider Layer — isolamento
- Feature flag por provider via env var (`ADS_PROVIDER`,
  `WHATSAPP_PROVIDER`, ...).
- Alternar para provider secundário se disponível.
- App não deve cair por indisponibilidade externa — eventos ficam em fila.

## Rollback
- Reverter alteração recente na implementação do provider.
- Alternar provider via env var (não requer deploy).

## Validação
- Payload de teste aceito pelo provider (status 2xx).
- Snapshot em `tests/contracts/provider-payloads.contract.test.ts` intacto.
- Fila drenando.
