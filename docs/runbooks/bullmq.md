# Runbook — BullMQ

## Sintomas
- Jobs empilhando na fila.
- Latência de tarefas assíncronas subindo.
- Worker parado (não processa nada há > 2 min).

## Diagnóstico
1. `docker ps` → container `zenno-worker` `healthy`?
2. `docker compose logs zenno-worker` — buscar exceções.
3. Inspecionar fila (via CLI Redis):
   ```bash
   redis-cli -u $REDIS_URL LLEN bull:default:wait
   redis-cli -u $REDIS_URL LLEN bull:default:active
   ```
4. Verificar DLQ:
   ```bash
   redis-cli -u $REDIS_URL LLEN bull:default:failed
   ```

## Logs relevantes
- `event=job.picked` / `job.completed` / `job.failed`
- `event=worker.heartbeat` (planejado)

## Causa provável
- Worker crashou por exceção não tratada.
- Redis lento/indisponível.
- Job específico causando loop de retry (poison message).
- Concorrência alta demais para o pool de Postgres.

## Correção
- Reiniciar worker (`docker compose restart zenno-worker`).
- Mover poison messages para DLQ manualmente.
- Ajustar concorrência do worker.
- Escalar Redis se saturado.

## Rollback
- Reverter versão que introduziu novo job com bug.
- Desabilitar tipo de job problemático via feature flag.

## Validação
- Fila `wait` decrescendo continuamente.
- `active` estável.
- `failed` sem crescimento.
- Job de teste completa em tempo esperado.
