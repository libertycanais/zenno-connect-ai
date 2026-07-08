# Zenno AI Suite — Deploy Checklist (Staging → Production)

> Runbook operacional. Aplique passo a passo, marque itens no PR de deploy.
> Não substitui `RELEASE_PLAN.md` (estratégia) nem `STAGING_CHECKLIST.md`
> (validação de ambiente).

## 1. Pré-Deploy

- [ ] PR aprovado por ≥ 1 revisor.
- [ ] CI verde: `typecheck → test → coverage → build → audit`.
- [ ] `docs/RELEASE_PLAN.md` reflete a versão a subir.
- [ ] Changelog atualizado (`CHANGELOG.md`).
- [ ] Secrets necessários confirmados no cofre externo (comparar com `.env.staging.example`).
- [ ] Janela de deploy comunicada no canal de operação.
- [ ] Nenhum incidente ativo em staging.

## 2. Backup

- [ ] `pg_dump` da base staging concluído (< 24h) e verificado (`pg_restore --list`).
- [ ] Snapshot do storage bucket (se aplicável).
- [ ] Cópia dos secrets atuais para restore em <5 min.
- [ ] Tag da imagem Docker anterior anotada: `zenno-app:<previous-tag>`.

## 3. Migração

- [ ] `supabase db push` executado contra staging **primeiro**.
- [ ] `tests/integration/database/migrations.test.ts` verde após push.
- [ ] Nenhuma migration destrutiva sem etapa dual-write anterior.
- [ ] `audit_log` particionado corretamente (nova partição do mês criada).

## 4. Build

- [ ] `bun install --frozen-lockfile` sem drift no lockfile.
- [ ] `bun run build` verde localmente para preset `node-server`.
- [ ] `docker build --build-arg VITE_SUPABASE_URL=... -t zenno-app:<tag> .` OK.
- [ ] Imagem publicada no registry com tag imutável (`staging-YYYYMMDD-HHMM`).

## 5. Deploy

- [ ] `docker compose pull && docker compose up -d --no-deps zenno-app` **ou**
  `pm2 reload zenno --update-env`.
- [ ] Container `healthy` em <30s (via `docker ps` ou healthcheck do orquestrador).
- [ ] Workers reiniciados (quando existirem).
- [ ] Nginx / LB reencaminhando 100% do tráfego para nova versão.

## 6. Smoke Tests

- [ ] `curl -s https://staging/api/public/live` → 200.
- [ ] `curl -s https://staging/api/public/ready | jq '.status'` → `ok`.
- [ ] `curl -s https://staging/api/public/health | jq '.version'` → nova tag.
- [ ] Login email/senha OK (usuário sintético).
- [ ] Login Google OAuth OK.
- [ ] Criar lead → aparece no Kanban.
- [ ] Webhook WhatsApp de teste → chat atualiza.
- [ ] Webhook Meta CAPI de teste → `audit_log` registra.
- [ ] Webhook Stripe/MercadoPago sandbox → `subscriptions` atualiza.
- [ ] Rate limit → burst 200 req/min retorna 429 no excedente.

## 7. Rollback (executar se qualquer critério de rollback do RELEASE_PLAN dispara)

- [ ] Reverter imagem: `docker compose up -d --no-deps zenno-app:<previous-tag>`
  ou `pm2 reload zenno --update-env` apontando para bundle anterior.
- [ ] Reverter migrations SÓ via migration inversa versionada (nunca `db reset`).
- [ ] Restaurar secrets se alterados no deploy.
- [ ] Confirmar smoke tests da versão anterior verdes.
- [ ] Registrar incidente em `docs/incidents/YYYY-MM-DD-<slug>.md`.
- [ ] Post-mortem agendado em até 48h.

## 8. Monitoramento (primeiras 24h)

- [ ] Dashboard 5xx: taxa < 1% (alerta > 2%).
- [ ] Latência p95 < 1s (alerta > 2× baseline).
- [ ] Fila Redis estável (alerta > 1000 jobs).
- [ ] Erros Sentry: nenhum novo tipo de erro top-10.
- [ ] `audit_log` recebendo eventos continuamente (alerta se pausa > 5 min).
- [ ] Conexões Postgres < 80% do pool.
- [ ] Deploy marcado como "estável" após 24h sem incidente.
