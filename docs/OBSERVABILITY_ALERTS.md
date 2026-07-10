# Observability Alerts — RC1.15

> Thresholds sugeridos para RC1 · Pilot Program. Alertas devem ser criados no provedor de observabilidade (Grafana, Datadog, ou dashboard Prometheus interno).

## SLOs de Produto

| Categoria | Métrica | Alvo (SLO) | Warning | Critical |
|-----------|---------|------------|---------|----------|
| **Latência** | Server Function p95 | < 800 ms | > 1200 ms (5m) | > 2000 ms (5m) |
| **Latência** | Server Function p99 | < 2000 ms | > 3000 ms (5m) | > 5000 ms (5m) |
| **Erros** | Error rate global | < 0.5% | > 1% (5m) | > 3% (5m) |
| **Erros** | 5xx / min | < 5 | > 10/min | > 50/min |
| **AI** | Provider error rate | < 2% | > 5% (10m) | > 10% (10m) |
| **AI** | Circuit breaker aberto | 0 | ≥ 1 provider | ≥ 2 providers |
| **AI** | Budget burn / hora | < 1x | > 2x baseline | > 5x baseline |
| **DB** | Connection pool saturation | < 60% | > 75% | > 90% |
| **DB** | Slow query p95 | < 200 ms | > 500 ms | > 1000 ms |
| **Auth** | Login failure rate | < 5% | > 10% | > 25% |
| **Rate limit** | Requests bloqueados | < 1% | > 3% | > 10% |
| **Workspace** | Share token verify failures | < 0.5% | > 2% | > 5% |

## Regras de Alerta (formato Prometheus)

```yaml
groups:
  - name: zenno_slo
    rules:
      - alert: ServerFnLatencyP95High
        expr: histogram_quantile(0.95, sum(rate(server_fn_duration_ms_bucket[5m])) by (le, name)) > 1200
        for: 5m
        annotations:
          summary: "Server function {{ $labels.name }} p95 above 1.2s"

      - alert: AIProviderErrorRateHigh
        expr: sum(rate(ai_provider_errors_total[10m])) / sum(rate(ai_provider_calls_total[10m])) > 0.05
        for: 10m
        annotations:
          summary: "AI provider error rate > 5%"

      - alert: CircuitBreakerOpen
        expr: sum(circuit_breaker_state{state="open"}) >= 1
        for: 2m
        annotations:
          summary: "Provider circuit breaker is OPEN"

      - alert: AIBudgetBurnHigh
        expr: sum(rate(ai_cost_usd_total[1h])) > 2 * avg_over_time(sum(rate(ai_cost_usd_total[1h]))[7d])
        for: 15m
        annotations:
          summary: "AI cost burn > 2x weekly baseline"

      - alert: ShareTokenVerifyFailures
        expr: sum(rate(share_token_verify_failures_total[10m])) / sum(rate(share_token_verify_total[10m])) > 0.02
        for: 10m
        annotations:
          summary: "Share token verification failure rate > 2%"
```

## Runbooks (referência cruzada)
- `docs/runbooks/*` — resposta a cada alerta.
- `docs/DISASTER_RECOVERY.md` — RTO/RPO.
- `docs/INCIDENT_RESPONSE.md` — comunicação.

## Canais de Notificação
- **Critical** → PagerDuty + Slack `#zenno-oncall`.
- **Warning** → Slack `#zenno-observability`.
- **Info** → Dashboard silencioso.

## Revisão
Revisitar thresholds após 30 dias de dados reais em pilot.
