# Runbook — Tracking

## Sintomas
- Eventos não chegam em `/api/public/track/event`.
- `audit_log` sem eventos recentes de tracking.
- Meta CAPI / Google OCI sem eventos server-side.
- Dashboard de atribuição vazio.

## Diagnóstico
1. `curl -s https://<host>/api/public/live` → deve retornar 200.
2. Verificar public key da organização (tabela `tracking_public_keys`,
   coluna `active = true`).
3. Testar disparo manual:
   ```bash
   curl -X POST https://<host>/api/public/track/event \
     -H "Content-Type: application/json" \
     -d '{"pk":"<public_key>","event":"page_view","url":"https://..."}'
   ```
4. Ver logs por `event=tracking.event` no coletor externo.

## Logs relevantes
- `event=tracking.event.received` — evento chegou.
- `event=tracking.event.rejected` — motivo em `reason` (rate_limit, invalid_pk, invalid_origin).
- `event=tracking.dispatch.<provider>` — envio para Meta/Google.

## Causa provável
- Public key desativada/rotacionada.
- Origin fora da allowlist.
- Rate limit atingido (`429`).
- Provider externo (Meta CAPI) fora → eventos ficam em retry.
- HMAC inválido (script antigo com key trocada).

## Correção
- Reativar public key ou gerar nova e atualizar no script do cliente.
- Adicionar origin à allowlist.
- Aumentar limite se legítimo (via feature flag/config).
- Rotacionar tracking secret com anúncio prévio.

## Rollback
- Reverter deploy da versão que quebrou tracking.
- Manter public key antiga válida durante rotação (dual-key window ≥ 24 h).

## Validação
- Disparar evento de teste; confirmar chegada em `audit_log` em < 5 s.
- Verificar recebimento no Meta Events Manager (sandbox).
- Verificar upload no Google Ads → Conversions → Uploads.
