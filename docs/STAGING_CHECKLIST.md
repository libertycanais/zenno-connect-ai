# Zenno AI Suite — Staging Checklist

> Validação item a item do ambiente de **Staging Enterprise**. Cada item
> tem status atual, procedimento de validação e critério de aceite.
> Status: ✅ Validado · 🟡 Parcial · ⏳ Pendente · ❌ Bloqueado.

## Legenda de status
- ✅ **Validado** — coberto por testes automatizados e/ou drill manual recente.
- 🟡 **Parcial** — implementado, mas falta drill em staging real.
- ⏳ **Pendente** — pré-requisito para staging enterprise.
- ❌ **Bloqueado** — depende de decisão externa.

---

### Docker
- **Status**: ✅
- **Como validar**: `docker build -t zenno-app .` + `docker run --env-file .env.staging -p 3000:3000 zenno-app`.
- **Critério de aceite**: build multi-stage completa sem warnings, container sobe em <15s, `HEALTHCHECK` fica `healthy`.

### Postgres
- **Status**: ✅
- **Como validar**: `docker compose up -d postgres` + `docker compose exec postgres pg_isready`.
- **Critério de aceite**: `pg_isready` OK, migrations aplicadas via `supabase db push`, `tests/integration/database/*` verde.

### Redis
- **Status**: ✅
- **Como validar**: `docker compose up -d redis` + `docker compose exec redis redis-cli ping`.
- **Critério de aceite**: `PONG`, persistência AOF ativa, healthcheck do compose `healthy`.

### Health
- **Status**: ✅
- **Como validar**: `curl -s http://staging/api/public/health | jq`.
- **Critério de aceite**: 200, campos `version` e `uptime` presentes.

### Ready
- **Status**: ✅
- **Como validar**: `curl -s http://staging/api/public/ready | jq`.
- **Critério de aceite**: 200 com `postgres: ok` e `redis: ok`.

### Live
- **Status**: ✅
- **Como validar**: `curl -si http://staging/api/public/live`.
- **Critério de aceite**: 200 imediato, sem dependência de banco.

### Tracking
- **Status**: ✅
- **Como validar**: `POST /api/public/track/event` com payload de fixture + verificar `audit_log` e disparo para provider.
- **Critério de aceite**: evento registrado, snapshot do payload externo coincide com `tests/contracts/provider-payloads.contract.test.ts`.

### OAuth Meta
- **Status**: 🟡
- **Como validar**: fluxo completo `/api/public/meta/oauth/callback` com app Meta de teste.
- **Critério de aceite**: token trocado, refresh salvo criptografado, `audit_log` registrando evento.

### OAuth Google
- **Status**: 🟡
- **Como validar**: fluxo `/api/public/google-ads/oauth/callback` com projeto Google Ads sandbox.
- **Critério de aceite**: mesmo padrão do Meta, sem vazamento de client_secret em log.

### WhatsApp
- **Status**: 🟡
- **Como validar**: `POST /api/public/whatsapp/webhook/{instance}` com payload Uazapi assinado.
- **Critério de aceite**: assinatura HMAC validada, mensagem persistida, chat em tempo real reflete.

### Payments
- **Status**: ⏳
- **Como validar**: webhook Stripe/MercadoPago sandbox → atualização de `subscriptions`.
- **Critério de aceite**: assinatura verificada, idempotência garantida, `plan`/`current_period_end` atualizados.

### Audit Log
- **Status**: ✅
- **Como validar**: `tests/integration/database/audit-log.test.ts` + inspeção manual da partição corrente.
- **Critério de aceite**: append-only garantido por trigger, 12 partições vivas, redaction aplicada.

### Rate Limit
- **Status**: ✅
- **Como validar**: `tests/integration/database/rate-limit.test.ts` + burst manual em `/api/public/track/event`.
- **Critério de aceite**: 429 após limite, contador reseta na janela, sem vazamento cross-tenant.

### Provider Layer
- **Status**: ✅
- **Como validar**: `bun test tests/unit/providers` e `tests/contracts/provider-payloads.contract.test.ts`.
- **Critério de aceite**: fábricas retornam provider correto por env, snapshots congelados.

### CI
- **Status**: ✅
- **Como validar**: `.github/workflows/ci.yml` verde no último push em `main`.
- **Critério de aceite**: pipeline `typecheck → test → coverage → build → audit` verde em <5 min.

### Coverage
- **Status**: 🟡 (piso 20% global; alvo 60% server)
- **Como validar**: `bun run test:coverage` + artefato `coverage/` no CI.
- **Critério de aceite**: nenhum módulo crítico (`src/lib/*.functions.ts`, `src/providers/*`) abaixo de 60%.

### Build
- **Status**: ✅
- **Como validar**: `bun run build` local + `docker build`.
- **Critério de aceite**: bundle Nitro `node-server` gerado, sem warnings de resolução externa.

### Typecheck
- **Status**: ✅
- **Como validar**: `bunx tsgo --noEmit`.
- **Critério de aceite**: 0 erros, 0 `any` novos em `src/lib/*.functions.ts`.

### Environment Variables
- **Status**: ✅ (template em `.env.staging.example`)
- **Como validar**: `diff <(grep -oE '^[A-Z_]+' .env.staging.example) <(grep -oE '^[A-Z_]+' .env.staging | sort -u)`.
- **Critério de aceite**: nenhum placeholder vazio em staging, nenhum `VITE_*` de secret real no bundle.

### Secrets
- **Status**: 🟡
- **Como validar**: inventário no cofre externo (Doppler/Vault/1Password) + rotação documentada.
- **Critério de aceite**: nenhuma chave em código, rotação < 90 dias para OAuth/webhook secrets.

### Backups
- **Status**: 🟡
- **Como validar**: cron `pg_dump` diário + restore drill em ambiente scratch.
- **Critério de aceite**: dump < 24h, restore ≤ 15 min para dataset staging.

### Logs
- **Status**: 🟡
- **Como validar**: `docker compose logs zenno-app | jq` → validar campos + coletor externo recebendo.
- **Critério de aceite**: 100% JSON válido, chaves sensíveis `[REDACTED]`, ingestão externa OK.

### Observabilidade
- **Status**: ⏳
- **Como validar**: Sentry (erros) + Datadog/Grafana (métricas) plugados e recebendo eventos.
- **Critério de aceite**: erro sintético aparece em <2 min, dashboard mostra 5xx/latência/throughput.
