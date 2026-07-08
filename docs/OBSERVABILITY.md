# Observability — Zenno AI Suite

**Versão:** 1.0 (Sprint 5.3)
**Escopo:** camada aditiva de observabilidade — não altera arquitetura, RLS, Provider Layer ou contratos públicos.
**Runtime alvo:** Cloudflare Workers (via TanStack Start).

---

## 1. Visão geral

A observabilidade do Zenno é composta por quatro pilares — todos opcionais e ativáveis por variáveis de ambiente:

| Pilar | Módulo | Estado |
|-------|--------|--------|
| Logs estruturados JSON | `src/lib/logger.ts` (+ re-export em `src/lib/observability/`) | ✅ Ativo por padrão |
| Métricas in-memory | `src/lib/observability/metrics.ts` | ✅ Ativo (endpoint gated) |
| Tracing (interface OTel) | `src/lib/observability/tracing.ts` | 🟡 No-op; pronto para OTel |
| Sentry (client + server) | `src/lib/observability/sentry.ts` | 🟡 Env-gated, lazy |

Ponto de entrada único: `import { log, incCounter, observe, timed, getTracer, initSentry } from "@/lib/observability"`.

---

## 2. Logs estruturados

### 2.1 Formato canônico
```json
{
  "timestamp": "2026-07-08T22:00:00.000Z",
  "level": "info",
  "service": "zenno-api",
  "version": "dev",
  "environment": "staging",
  "request_id": "…",
  "trace_id": "…",
  "organization_id": "…",
  "user_id": "…",
  "event": "oauth.google.callback",
  "duration_ms": 142,
  "status": "ok",
  "message": "…"
}
```

### 2.2 Redação automática (nunca logar)
Chaves redigidas em qualquer profundidade do objeto:
`authorization`, `cookie`, `password`, `token`, `access_token`, `refresh_token`, `api_key`, `secret`, `webhook_secret`, `service_role_key`.

### 2.3 Correlação
```ts
import { log, logContextFromRequest } from "@/lib/observability";

export const Route = createFileRoute("/api/public/x")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = logContextFromRequest(request);
        log.info({ ...ctx, event: "x.received" });
        // …
      },
    },
  },
});
```
`request_id` vem de `x-request-id` ou `cf-ray`, gerando UUID quando ausente.
`trace_id` vem de `traceparent` (W3C) ou `x-trace-id`.

### 2.4 Variáveis de ambiente
| Variável | Uso |
|----------|-----|
| `SERVICE_NAME` | Nome do serviço no campo `service` (default: `zenno-api`) |
| `APP_VERSION` / `GIT_SHA` | Campo `version` |
| `APP_ENV` / `NODE_ENV` | Campo `environment` |

---

## 3. Métricas

### 3.1 API
```ts
import { incCounter, observe, timed } from "@/lib/observability";

incCounter("http_requests_total", { route: "/api/public/track/event", status: 200 });
observe("provider_call_duration_ms", 142, { provider: "meta_ads", op: "list_campaigns" });

await timed("oauth_callback_duration_ms", { provider: "google" }, async () => {
  // …
});
```

### 3.2 Convenções de nomes
- `*_total` → counters monotônicos
- `*_duration_ms` → histograms de latência
- `*_bytes` → histograms de tamanho
- `*_errors_total` → gerado automaticamente por `timed()` no caminho de erro

### 3.3 Métricas recomendadas (a instrumentar por endpoint)
| Nome | Tipo | Labels | Onde |
|------|------|--------|------|
| `http_requests_total` | counter | route, method, status | request middleware |
| `http_request_duration_ms` | histogram | route, method, status | request middleware |
| `oauth_callback_total` | counter | provider, status | `*.oauth.callback.ts` |
| `oauth_callback_duration_ms` | histogram | provider | `*.oauth.callback.ts` |
| `tracking_event_total` | counter | source | `track.event.ts` |
| `tracking_event_duration_ms` | histogram | source | `track.event.ts` |
| `tracking_rate_limited_total` | counter | reason | `rate-limit.server.ts` |
| `provider_call_total` | counter | provider, op, status | Provider Layer |
| `provider_call_duration_ms` | histogram | provider, op | Provider Layer |
| `supabase_query_duration_ms` | histogram | fn | server functions |
| `whatsapp_webhook_total` | counter | instance_id, status | `whatsapp.webhook.$instanceId.ts` |
| `whatsapp_webhook_duration_ms` | histogram | instance_id | idem |
| `queue_jobs_total` | counter | queue, status | reservado — sem fila na baseline v1.0 |

> ⚠️ Instrumentação real dos endpoints é responsabilidade da Sprint 5.4 (aditivo, sem alterar contratos). Sprint 5.3 entrega apenas as primitivas.

### 3.4 Endpoint de scraping

```
GET /api/public/metrics
Authorization: Bearer <METRICS_TOKEN>
```

Respostas:
| Status | Significado |
|--------|-------------|
| 200 | JSON `{ timestamp, counters[], histograms[] }` |
| 401 | Token ausente ou incorreto |
| 503 | `METRICS_TOKEN` não configurado (fail-closed) |

**Segurança:**
- Rota sob `/api/public/*` (bypass de auth da plataforma).
- Token via env `METRICS_TOKEN`, comprimento mínimo 16 chars.
- Comparação em tempo constante.
- `cache-control: no-store`.
- Sem PII, sem `organization_id` — apenas labels operacionais.

**Limitação conhecida (Workers):** cada isolate mantém contadores em memória local. Scraping periódico agregado externamente é o padrão. Persistência entre isolates só será possível com backend externo (Sprint 5.4+).

**Configuração:**
```bash
# via Lovable Cloud secrets (add_secret)
METRICS_TOKEN=<64 chars random>
```

---

## 4. Tracing distribuído

### 4.1 Interface (OTel-shaped)
```ts
import { getTracer } from "@/lib/observability";

const tracer = getTracer();
await tracer.withSpan(
  "attribution.match_lead",
  async (span) => {
    span.setAttribute("organization_id", orgId);
    return doMatch(orgId);
  },
  { attributes: { component: "attribution" } },
);
```

### 4.2 Estado atual
- Implementação default é **no-op** que emite spans como log estruturado (nível `debug`) com `trace_id`, `span_id`, `duration_ms`, `status`.
- Nenhuma dependência OTel foi adicionada.

### 4.3 Migração para OTel real (Sprint 5.4+)
1. `bun add @opentelemetry/api @opentelemetry/sdk-trace-web` (edge-compatible).
2. Criar adapter `OTelTracer implements Tracer`.
3. `setTracer(new OTelTracer(...))` no bootstrap.
Nenhum call site precisa mudar.

---

## 5. Sentry (opcional)

### 5.1 Ativação
Sentry é **desabilitado por padrão**. Ativar somente instalando dependências e definindo DSN:

```bash
# server
SENTRY_DSN=https://…@sentry.io/…

# client (Vite)
VITE_SENTRY_DSN=https://…@sentry.io/…

# opcionais
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.1
APP_VERSION=<git sha>
```

### 5.2 Uso
```ts
import { initSentry, captureException } from "@/lib/observability";

// bootstrap (server ou client)
await initSentry("server"); // ou "client"

// em qualquer catch
try {
  // …
} catch (err) {
  captureException(err, { organization_id: orgId });
  throw err;
}
```

### 5.3 Comportamento sem Sentry
- `initSentry` retorna `false` silenciosamente.
- `captureException`/`captureMessage` são no-op — nunca lançam.
- Bundle não carrega `@sentry/*` (dynamic import falha silenciosamente).

### 5.4 Instalação (quando/se decidido)
```bash
bun add @sentry/node          # server
bun add @sentry/browser       # client
```

---

## 6. Alertas recomendados (Sprint 5.4)

| Métrica | Regra | Severidade |
|---------|-------|------------|
| `http_requests_total{status=5xx}` | > 1% em 5min | 🔴 |
| `http_request_duration_ms.p95` | > 1500ms por 10min | 🟠 |
| `oauth_callback_total{status=error}` | > 5 em 5min | 🔴 |
| `tracking_rate_limited_total` | crescimento > 3σ | 🟠 |
| `provider_call_duration_ms.p95` | > 2000ms | 🟠 |
| `provider_call_total{status=error}` | > 5% em 5min | 🔴 |
| `whatsapp_webhook_duration_ms.p95` | > 500ms | 🟡 |
| Sentry — issues novas | qualquer | 🟠 |

---

## 7. Dashboards recomendados (Sprint 5.4)

**Golden signals (por rota):**
1. Latency — histogram p50/p95/p99
2. Traffic — RPS por status class
3. Errors — %5xx e counters de erro por domínio
4. Saturation — Postgres `db_health` (connections, WAL, deadlocks)

**Por domínio:**
- **OAuth:** callbacks/min, taxa de sucesso, latência por provider
- **Tracking:** eventos/min, rate-limit hits, atribuições/min
- **Provider Layer:** chamadas/op, latência, erros
- **WhatsApp:** webhooks/min, latência, mensagens/instance
- **Supabase:** slow queries (via `supabase--slow_queries`), `db_health`

---

## 8. Compatibilidade Cloudflare Workers

| Aspecto | Compatível? | Nota |
|---------|-------------|------|
| Logger JSON (`console.*`) | ✅ | Captura nativa pelo Workers Logs |
| Métricas in-memory | ✅ | Escopo do isolate; scrape externo agrega |
| Tracer no-op | ✅ | Emite via logger |
| Sentry `@sentry/browser` | ✅ (client) | Só client-side |
| Sentry `@sentry/node` | ⚠️ | Testar em Workers antes de ativar; alternativa: `@sentry/cloudflare` |
| `AsyncLocalStorage` | ✅ com `nodejs_compat` | Não usada nesta versão para manter simplicidade |
| Persistent counters | ❌ | Precisa backend externo (KV/DO/Prom pushgateway) |

---

## 9. Roadmap pós-5.3

- **5.4** Instrumentação end-to-end dos endpoints com as métricas nomeadas em §3.3
- **5.4** Adapter OTel real, avaliar `@sentry/cloudflare`
- **5.5** Dashboards + regras de alerta em ferramenta externa (Grafana/Datadog)
- **6.x** Persistência de métricas (Durable Objects ou push para Prometheus remote-write)
- **6.x** Log-based alerts sobre `audit_log`
