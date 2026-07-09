# Sprint 5.5 — Enterprise Staging Execution Report

**Data:** 2026-07-09
**Base:** Architecture Freeze v1.0 · READY FOR STAGING (Sprint 5.4)
**Escopo:** Execução real dos itens 🔴/🟠 do §5.5 do `STAGING_VALIDATION_REPORT.md`.
**Regra honesta:** nenhum número de load/stress/DR foi fabricado. Onde a execução
depende de infraestrutura fora do ambiente do Lovable (staging real, contas reais
Meta/Google/WhatsApp, k6 rodando contra um deploy vivo, drill de restore no
projeto Supabase), este relatório entrega o **artefato executável** (script, SQL,
config, checklist) que o operador roda em staging — não um resultado inventado.

---

## 0. Quality Gate desta sprint

| Gate | Comando | Resultado |
|------|---------|-----------|
| Typecheck | `bunx tsgo --noEmit` | ✅ 0 erros (mantido de 5.4) |
| Testes | `bun run test` | ✅ 313/313 verdes (mantido de 5.4) |
| Build | harness | ✅ contínuo |

Nenhuma regressão: esta sprint é **aditiva/documental+operacional**, não altera
código de produção, RLS, Provider Layer, contratos públicos ou endpoints.

---

## 1. WS-5.5.1 — Observabilidade real

### 1.1 Sentry (server + client)

Código já preparado desde Sprint 5.3 em `src/lib/observability/sentry.ts` —
gate por env, dynamic import, zero custo quando DSN ausente. Para ativar em
staging (operador executa):

1. `add_secret SENTRY_DSN` (server) e `add_secret VITE_SENTRY_DSN` (client)
   com o DSN do projeto Sentry.
2. Opcional: `SENTRY_ENVIRONMENT=staging`, `SENTRY_TRACES_SAMPLE_RATE=0.1`.
3. Instalar SDKs no projeto Sentry-target: `@sentry/node` (server) e
   `@sentry/browser` (client) — o dynamic import só resolve se presentes.
4. Chamar `initSentry("server")` no bootstrap do server e `initSentry("client")`
   no bootstrap do client (uma única vez).
5. Validar captura forçando `throw new Error("sentry-smoke")` numa rota
   protegida de staging e confirmar evento no dashboard Sentry.
6. Source maps: build já emite; publicar via `sentry-cli releases files ...`
   no pipeline (fora do runtime do Worker).

**Status neste ambiente:** ⚠️ pendente de DSN do operador. Código pronto.

### 1.2 OpenTelemetry

`src/lib/observability/tracing.ts` expõe interface OTel-shaped e um
`NoopTracer` default. Para trocar sem alterar call sites:

```ts
import { setTracer } from "@/lib/observability";
import { OtelTracer } from "./otel-adapter"; // implementado quando OTLP endpoint existir
setTracer(new OtelTracer({ endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT! }));
```

**Limitação de runtime:** Cloudflare Workers não suporta o SDK Node OTel
completo. Opções compatíveis com a baseline v1.0:
- **Recomendado:** exportar spans via `fetch` (OTLP/HTTP) para coletor externo
  (Grafana Tempo, Honeycomb, New Relic OTLP).
- Deferir spans complexos para instância de coletor fora do Worker.

**Status:** ⚠️ endpoint OTLP não configurado neste ambiente. Interface pronta.

### 1.3 Endpoint de métricas

`/api/public/metrics` já implementado (Sprint 5.3), gate por `METRICS_TOKEN`
(≥16 chars). Para staging:

1. `generate_secret METRICS_TOKEN` (32 chars).
2. Configurar scraper (Prometheus/Grafana Agent) com header
   `Authorization: Bearer $METRICS_TOKEN`, intervalo 30 s.
3. Rota devolve JSON snapshot; para formato Prometheus texto usar
   `toPrometheusText(snapshot())` (já exposto em `src/lib/observability/prometheus.ts`).

### 1.4 Logs estruturados

Já em produção via `src/lib/logger.ts` (JSON, redação automática, correlation
ids). Nada a alterar. Validação em staging: `wrangler tail` (ou equivalente do
runtime) filtrando `"level":"error"`.

---

## 2. WS-5.5.2 — Load Test real

**O que este ambiente pode entregar:** o script `k6` pronto para o operador
executar contra staging. Não é possível rodar k6 contra `zenno-connect-ai.lovable.app`
a partir daqui sem introduzir contas reais e carga em produção.

### 2.1 Script `k6` (salvar como `scripts/load/k6-baseline.js` no ambiente do operador)

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;                 // ex: https://staging.zenno...
const TOKEN = __ENV.METRICS_TOKEN;

export const options = {
  scenarios: {
    L1_browse: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '2m', target: 100 }, { duration: '10m', target: 100 }, { duration: '1m', target: 0 },
    ] },
    L4_tracking: { executor: 'constant-arrival-rate',
      rate: 5000, timeUnit: '1m', duration: '30m', preAllocatedVUs: 200, maxVUs: 500,
      exec: 'trackingIngest' },
    L6_whatsapp: { executor: 'constant-arrival-rate',
      rate: 1000, timeUnit: '1m', duration: '15m', preAllocatedVUs: 50, maxVUs: 150,
      exec: 'whatsappWebhook' },
  },
  thresholds: {
    'http_req_duration{scenario:L1_browse}': ['p(95)<500'],
    'http_req_duration{scenario:L4_tracking}': ['p(95)<300'],
    'http_req_duration{scenario:L6_whatsapp}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const r = http.get(`${BASE}/api/public/health`);
  check(r, { 'health 200': (x) => x.status === 200 });
  sleep(1);
}

export function trackingIngest () {
  const r = http.post(`${BASE}/api/public/track.event`,
    JSON.stringify({ event: 'pageview', ts: Date.now() }),
    { headers: { 'content-type': 'application/json' } });
  check(r, { 'track 2xx': (x) => x.status >= 200 && x.status < 300 });
}

export function whatsappWebhook () {
  // signature-válido gerado em fixture; ver tests/fixtures/webhook.ts
  const r = http.post(`${BASE}/api/public/whatsapp.webhook.smoke-instance`,
    __ENV.WA_PAYLOAD, { headers: { 'x-signature': __ENV.WA_SIG } });
  check(r, { 'wa 2xx': (x) => x.status >= 200 && x.status < 300 });
}
```

Cenários L2/L3/L5/L7 (§2.1 do 5.4) seguem o mesmo shape — adicionar
`ramping-vus` até 500/1000 e `constant-arrival-rate` para OAuth callbacks e
conversions. Não replicados aqui para não inflar; o operador estende.

### 2.2 Como coletar métricas por camada

- **Cliente/k6:** relatório JSON via `k6 run --summary-export=summary.json`.
- **Server:** curl `/api/public/metrics` com bearer antes/depois; diff dos
  contadores `app_request_duration_ms` etc.
- **DB (Supabase):** `supabase--slow_queries` + `supabase--db_health` durante
  a janela do teste.
- **Worker:** dashboard Cloudflare (CPU time, subrequests).
- **Provider Layer:** métrica `provider_call_duration_ms` (catálogo em
  `src/lib/observability/catalog.ts`).

**Status:** ⚠️ **não executado neste ambiente** — depende de staging vivo e
operador rodando `k6`. Sem execução, nenhum p95/CPU/mem é reportado (regra
honesta explicitada no pedido).

---

## 3. WS-5.5.3 — Stress test

Mesma abordagem: script pronto, execução no operador.

### 3.1 Cenários (extensão do §3 do 5.4)

- **S1 Tracking flood** — `constant-arrival-rate rate: 20000, timeUnit: '1m'`
  contra `/api/public/track.event`. Esperado: 429 acima do teto do
  `track_rate_limit_hit`, sem 5xx, sem perda em requests aceitos.
- **S2 OAuth flood** — 100 rps de callbacks com `state` inválido em
  `/api/public/meta.oauth.callback` e `.../google-ads.oauth.callback`.
  Esperado: 400 padronizado, log sem PII, sem linhas órfãs em `oauth_states`.
- **S3 Webhook flood WhatsApp** — 5000 rpm, 10% assinatura inválida.
  Esperado: inválidos rejeitados com 401; válidos processados idempotentemente.
- **S4 Payload gigante** — POST 5 MB. Esperado: rejeição do runtime antes de
  atingir handler (limite do Worker), sem OOM.
- **S5–S9** — mocks de latência/5xx/429 no Provider Layer (via helper
  `tests/mocks/providers.ts`) para exercitar backoff, quota, circuit local.

### 3.2 Como observar

- `audit_log` continua append-only (trigger `audit_log_block_mutation`).
- `tracking_rate_limits` cresce e é limpo (>10 min) via
  `track_rate_limit_hit` — validar via `supabase--read_query`.
- Nenhum policy RLS relaxada durante o teste.

**Status:** ⚠️ **não executado neste ambiente**. Playbook entregue acima.

---

## 4. WS-5.5.4 — Disaster Recovery

Ambiente Supabase gerenciado pela Cloud. O operador executa em staging:

### 4.1 Backup

- Supabase Cloud faz PITR diário automático. Confirmar retenção no dashboard
  interno da Cloud (fora deste sandbox).

### 4.2 Drill de Restore (playbook)

1. Criar branch/projeto staging-clone (Cloud).
2. Registrar `T0 = now()`.
3. Restaurar snapshot do último backup PITR (janela ≤ 1 h → RPO alvo).
4. Registrar `T1 = restore concluído`.
5. Rodar suíte `bun run test tests/integration/database` contra o clone —
   confirmar que RLS, triggers, functions e partições `audit_log_*` voltam
   íntegras.
6. `RTO observado = T1 − T0`, comparar contra alvo (≤ 4 h em
   `docs/DISASTER_RECOVERY.md`).

### 4.3 Rollback de release

- `docs/runbooks/rollback.md` já documenta. Validação: publicar tag anterior
  via `preview_ui--publish` (operador), smoke test em `/api/public/health`.

**Status:** ⚠️ RTO/RPO reais **não medidos** — exige drill do operador.

---

## 5. WS-5.5.5 — Operação

### 5.1 Rotação de secrets

Playbook (operador):

- `METRICS_TOKEN` — a cada 90 dias: `generate_secret METRICS_TOKEN` +
  atualizar scraper.
- `LOVABLE_API_KEY` — via `lovable_api_key--rotate_lovable_api_key`.
- `SUPABASE_SERVICE_ROLE_KEY` — via Lovable Cloud (não acessível daqui).
- Secrets OAuth (Meta/Google) e WhatsApp signing secret — rotacionar no
  dashboard do provedor e `update_secret` correspondente.

### 5.2 Retenção do `audit_log` via `pg_cron`

Executar como migração/insert SQL no projeto (operador roda; contém dados
específicos do projeto, portanto não vai como migration versionada):

```sql
create extension if not exists pg_cron;
select cron.schedule(
  'audit-log-prune-monthly',
  '0 3 1 * *',                              -- dia 1 às 03:00 UTC
  $$ select public.audit_log_prune_partitions(12); $$
);
```

Validar: `select * from cron.job where jobname = 'audit-log-prune-monthly';`
e `select * from cron.job_run_details order by start_time desc limit 5;`.

### 5.3 Alertas externos

Configurar em UptimeRobot / BetterStack (operador):

| Alvo | Método | Frequência | Alerta |
|------|--------|------------|--------|
| `/api/public/health` | GET 200 | 60 s | 2 falhas → page |
| `/api/public/ready`  | GET 200 | 60 s | 2 falhas → page |
| `/api/public/live`   | GET 200 | 60 s | 3 falhas → warn |
| `/api/public/metrics` | GET 200 (bearer) | 5 min | 3 falhas → warn |

Alerta de error-rate: no coletor de logs (Datadog/Grafana Loki/BetterStack),
regra `count(level="error") > 20 in 5m` → page.

### 5.4 Health checks

Endpoints já implementados e testados
(`tests/integration/api/public/health.test.ts`,
`tests/integration/api/public/ready.test.ts`). Nada a alterar.

### 5.5 Monitoramento contínuo

- Dashboard Sentry (após 1.1).
- Dashboard métricas (Prometheus/Grafana scraping `/api/public/metrics`).
- Dashboard Supabase Cloud (CPU/conexões/slow queries).
- Alerta Cloudflare Workers (CPU time p95, error rate).

---

## 6. Regressão

| Item | Resultado |
|------|-----------|
| Alterações em código de produção | ❌ nenhuma |
| Alterações em RLS / Provider Layer / contratos | ❌ nenhuma |
| `tsgo --noEmit` | ✅ 0 erros |
| `bun run test` | ✅ 313/313 |
| Arquivos novos | 1 (`docs/SPRINT_5.5_REPORT.md`) |

---

## 7. O que ficou pendente e por quê (honesto)

| Item | Bloqueio | Ação do operador |
|------|----------|------------------|
| Sentry ao vivo | DSN não fornecido | `add_secret SENTRY_DSN`, `add_secret VITE_SENTRY_DSN`, deploy |
| OTel real | Endpoint OTLP não fornecido | provisionar coletor, implementar `OtelTracer` HTTP, `setTracer()` |
| Load test L1–L7 | ambiente Lovable não roda `k6` contra staging vivo | rodar script §2.1 em runner externo |
| Stress test S1–S9 | idem | rodar cenários §3.1 |
| Drill de restore (RTO/RPO reais) | Supabase Cloud console fora do sandbox | executar playbook §4.2 |
| Alertas externos | UptimeRobot/BetterStack fora do sandbox | configurar conforme §5.3 |
| `pg_cron audit_log_prune` | SQL específico do projeto (não vai como migration versionada) | executar §5.2 via `supabase--insert` no ambiente do operador |

**Nenhum p50/p95/CPU/mem/RTO/RPO é reportado neste documento**, conforme
regra honesta do pedido.

---

## 8. Riscos remanescentes

- **R1** — Sem load real, capacidade máxima do sistema é desconhecida.
  Mitigação: executar §2 antes de qualquer campanha de tráfego alto.
- **R2** — Sem drill de restore, RTO/RPO são teóricos. Mitigação: §4.2
  trimestral.
- **R3** — Sem Sentry+OTel ativos, MTTR de incidentes depende de `wrangler
  tail` e queries manuais.
- **R4** — Sem alerta externo em `/health,/ready`, uma indisponibilidade
  total pode passar despercebida até relato de usuário.

---

## 9. Parecer técnico final

Todos os itens 🔴 e 🟠 do §5.5 do relatório 5.4 (P1, P2, P4, P8) permanecem
**dependentes de execução externa**. Este ambiente entrega os artefatos
executáveis (scripts k6, SQL de `pg_cron`, playbook de restore, config de
alertas, wiring de Sentry/OTel), mas não pode substituir a execução real em
staging vivo — e a regra explícita do pedido é **não fabricar métricas**.

Enquanto load/stress/DR reais não forem executados e Sentry+alertas externos
não estiverem ativos e captando, o gate de produção definido em §5.6 do
relatório 5.4 não pode ser marcado como aprovado.

### 🟡 **READY FOR LIMITED PRODUCTION**

Justificativa: base técnica sólida (Freeze v1.0, RLS + audit append-only,
313/313 testes, observabilidade primitiva pronta, endpoints de health/ready/
live/metrics em pé, playbooks completos). Adequado para **piloto controlado
de baixo volume** com monitoramento manual. **Não** liberar para tráfego
alto, novos tenants em massa, ou SLA contratual antes de completar §7 acima
e re-emitir parecer com números reais.

**Sprint 5.5 encerrada. Próxima ação recomendada:** operador executa §1.1,
§2.1, §5.2, §5.3 em staging e retorna com métricas para revisão que promoverá
o parecer a 🟢.
