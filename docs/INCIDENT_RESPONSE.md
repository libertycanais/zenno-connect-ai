# Incident Response — Zenno AI Suite

Playbook geral. Runbooks específicos em `docs/runbooks/`.

## Severidades

| Sev | Definição | Tempo de resposta |
|-----|-----------|-------------------|
| SEV-1 | App fora / perda de dados / vazamento | Imediato (< 5 min) |
| SEV-2 | Feature crítica quebrada / provider externo fora | < 30 min |
| SEV-3 | Degradação parcial / feature secundária | < 4 h |
| SEV-4 | Melhoria / observação | Próximo sprint |

## Fluxo padrão de resposta

1. **Detectar** — alerta automático ou report do usuário.
2. **Reconhecer** — abrir incidente no canal de operação, atribuir IC (Incident Commander).
3. **Comunicar** — status inicial em ≤ 5 min (SEV-1/2).
4. **Diagnosticar** — usar runbook do domínio afetado.
5. **Mitigar** — restaurar serviço (rollback é sempre opção válida).
6. **Resolver** — correção definitiva.
7. **Post-mortem** — obrigatório em SEV-1/2, ≤ 48h.

## Procedimentos por cenário

### Webhook parado
Runbook: [`runbooks/whatsapp.md`](./runbooks/whatsapp.md), [`runbooks/tracking.md`](./runbooks/tracking.md).
- Verificar `/api/public/ready`.
- Checar logs por `event=webhook.received`.
- Verificar rate limit e HMAC.

### OAuth expirado
Runbook: [`runbooks/oauth.md`](./runbooks/oauth.md).
- Verificar tabelas `meta_ad_accounts` / `google_ad_accounts` por `expires_at`.
- Forçar refresh via job manual ou reautorização.

### Redis indisponível
Runbook: [`runbooks/redis.md`](./runbooks/redis.md).
- `/api/public/ready` retorna 503.
- Reiniciar container; jobs em fila são persistentes (AOF).

### Postgres lento
Runbook: [`runbooks/postgres.md`](./runbooks/postgres.md).
- Verificar `pg_stat_activity`.
- Checar índices via `tests/integration/database/indexes.test.ts`.
- Escalar compute se necessário.

### Tracking parado
Runbook: [`runbooks/tracking.md`](./runbooks/tracking.md).
- Verificar allowlist de origem.
- Verificar public key ativa.
- Rate limit não deve estar zerado por bug de janela.

### Meta indisponível
Runbook: [`runbooks/providers.md`](./runbooks/providers.md#meta).
- Verificar status Meta (statuspage).
- Provider Layer isola; app não deve cair.
- Eventos ficam em retry na fila.

### Google indisponível
Runbook: [`runbooks/providers.md`](./runbooks/providers.md#google).
- Mesma dinâmica de Meta.

### Provider fora (geral)
Runbook: [`runbooks/providers.md`](./runbooks/providers.md).
- Isolar impacto via feature flag do provider (`<DOMINIO>_PROVIDER=disabled`).
- Alternar para provider secundário se disponível.

### Rate limit excedido
- Legítimo → aumentar limite após review.
- Abuso → bloquear origem no LB/WAF.

### Fila de jobs assíncronos
Runbook: [`runbooks/bullmq.md`](./runbooks/bullmq.md).
- **N/A na baseline v1.0** (Cloudflare Workers não roda BullMQ).
- Runbook mantido como reserva para futura adoção (novo ADR obrigatório).

### Rollback
Runbook: [`runbooks/rollback.md`](./runbooks/rollback.md).
- Reverter imagem/tag anterior.
- Nunca `db reset`; usar migration inversa versionada.

## Comunicação

Canais:
- **Interno**: canal `#ops-zenno` (Slack/Discord/Teams).
- **Cliente**: página de status pública (planejada) + e-mail para SEV-1.

Template de update (a cada 30 min em SEV-1):
```
[SEV-X] <título> — <status: investigando | mitigado | resolvido>
- Impacto: <o que está afetado>
- Ação em curso: <o que está sendo feito>
- Próximo update: <horário>
- IC: <nome>
```

## Escalonamento

- SEV-1 → CTO + Tech Lead + Segurança em 15 min.
- SEV-2 → Tech Lead em 30 min.
- SEV-3 → Reviewer normal.
- Vazamento de dados → Segurança + Jurídico + CTO **imediatamente**.

## Post-mortem

Formato blameless. Obrigatório em SEV-1/2:
```
# Post-Mortem YYYY-MM-DD — <slug>
## Resumo
## Timeline
## Impacto (usuários, dados, tempo)
## Root cause
## O que funcionou
## O que não funcionou
## Ações corretivas (com owner e prazo)
```
Salvar em `docs/incidents/YYYY-MM-DD-<slug>.md`.
