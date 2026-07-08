# Runbook — WhatsApp (Uazapi)

## Sintomas
- Mensagens não chegam ao chat.
- Webhook `/api/public/whatsapp/webhook/:instanceId` sem hits recentes.
- Instância marca `disconnected`.

## Diagnóstico
1. `curl -s https://<host>/api/public/live` → 200.
2. Verificar assinatura HMAC:
   - Header `x-webhook-signature` presente.
   - `UAZAPI_WEBHOOK_SECRET` bate com cofre.
3. Consultar Uazapi (dashboard) por status da instância.
4. Logs por `event=whatsapp.webhook.received` / `.rejected`.

## Logs relevantes
- `event=whatsapp.webhook.received`
- `event=whatsapp.webhook.hmac.invalid`
- `event=whatsapp.webhook.rate_limited`
- `event=whatsapp.instance.disconnected`

## Causa provável
- Instância deslogada no Uazapi (QR expirado).
- Webhook secret rotacionado só em um lado.
- URL de webhook desatualizada no Uazapi.
- Rate limit da instância excedido.

## Correção
- Reautenticar instância (novo QR).
- Sincronizar `UAZAPI_WEBHOOK_SECRET`.
- Atualizar URL do webhook no painel Uazapi para o host correto.

## Rollback
- Reverter deploy que alterou URL/secret.
- Reusar instância antiga se substituição falhou.

## Validação
- Enviar mensagem de teste do celular para o número da instância.
- Confirmar chegada em `whatsapp_messages` e no chat em tempo real (< 3 s).
- `audit_log` registra evento.
