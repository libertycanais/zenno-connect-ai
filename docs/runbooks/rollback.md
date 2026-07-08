# Runbook — Rollback

## Quando disparar
Ver critérios em `docs/RELEASE_PLAN.md` §"Critérios para rollback".
Resumo: 5xx > 2%, p95 > 2× baseline por 5 min, auth quebrada, divergência
de contrato em produção, erro estrutural em `audit_log`, vazamento.

## Sintomas
- Métricas fora do baseline pós-deploy.
- Erros novos no Sentry (quando plugado).
- Reports imediatos de usuários.

## Diagnóstico rápido (≤ 5 min)
1. Confirmar que o problema começou no deploy atual (comparar timestamps).
2. Confirmar tag anterior disponível no registry.
3. Confirmar snapshot de secrets válido.

## Execução

### Docker Compose
```bash
docker compose pull zenno-app:<previous-tag>
docker compose up -d --no-deps zenno-app
```

### PM2 (VPS)
```bash
pm2 reload zenno --update-env
# apontando para bundle anterior
```

### Migrations
- **Nunca** `db reset` em ambiente compartilhado.
- Aplicar migration inversa versionada se disponível.
- Se migration destrutiva foi aplicada sem plano dual-write → restaurar
  do backup mais recente (segue `docs/DISASTER_RECOVERY.md`).

### Secrets
- Reverter apenas os secrets alterados no deploy.
- Nunca reverter secrets sem plano — pode invalidar sessões ativas.

## Logs relevantes
- `event=deploy.rollback.started` (manual)
- `event=deploy.rollback.completed`

## Validação
- Smoke tests da versão anterior (`docs/DEPLOY_CHECKLIST.md` §6).
- Métricas voltam ao baseline em ≤ 15 min.
- Sem novos erros no Sentry.

## Comunicação
- Update em `#ops-zenno` a cada 10 min durante rollback.
- Post-mortem em 48 h (obrigatório em SEV-1/2).
- Incidente arquivado em `docs/incidents/YYYY-MM-DD-<slug>.md`.
