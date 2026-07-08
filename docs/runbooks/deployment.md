# Runbook — Deployment

## Sintomas
- Build do CI falhando.
- Deploy sobe mas healthcheck falha.
- Container reiniciando em loop.
- Assets 404 pós-deploy.

## Diagnóstico
1. Ver logs do CI: qual step falhou (`typecheck`, `test`, `coverage`, `build`, `audit`).
2. `docker logs zenno-app --tail 200`.
3. `curl -s https://<host>/api/public/live` → 200?
4. `curl -s https://<host>/api/public/ready | jq`.
5. Verificar env vars: `docker exec zenno-app env | grep -v SECRET`.

## Logs relevantes
- `event=app.boot`
- `event=app.ready`
- Erros de módulo ausente (`Cannot find module ...`).

## Causa provável
- Env var faltando (comparar com `.env.staging.example`).
- Build-arg `VITE_*` ausente no `docker build`.
- Migração pendente não aplicada.
- Preset Nitro errado (Cloudflare em vez de `node-server`).
- Imagem antiga cacheada no registry.

## Correção
- Preencher env var faltante e reiniciar.
- Rebuild com `--build-arg VITE_SUPABASE_URL=... --no-cache`.
- Rodar `supabase db push` antes de subir.
- Confirmar `NITRO_PRESET=node-server` no Dockerfile para deploy externo.

## Rollback
Ver [`rollback.md`](./rollback.md).

## Validação
- Smoke tests de `docs/DEPLOY_CHECKLIST.md` §6.
- 24 h sem incidente → deploy marcado como "estável".
