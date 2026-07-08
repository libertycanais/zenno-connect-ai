# Runbook — Redis

## Sintomas
- `/api/public/ready` retorna 503 com `redis: fail`.
- Worker BullMQ parado.
- Latência do app subindo (se Redis é usado em cache).

## Diagnóstico
1. `docker ps` → container `zenno-redis` `healthy`?
2. `docker compose exec redis redis-cli ping` → deve responder `PONG`.
3. `redis-cli info memory` — verificar uso de memória.
4. `redis-cli info persistence` — AOF/RDB OK.

## Logs relevantes
- Redis stdout: `Ready to accept connections`.
- App: `event=redis.connect.failed`.

## Causa provável
- Container caído / OOM killed.
- Disco cheio (AOF cresceu demais).
- Rede entre app e Redis com problema.
- Redis com maxmemory atingido sem policy adequada.

## Correção
- Reiniciar container: `docker compose restart redis`.
- Ajustar `maxmemory` + `maxmemory-policy` no `redis.conf`.
- Rotacionar AOF (`BGREWRITEAOF`).
- Escalar disco.

## Rollback
- Restaurar AOF/RDB de backup se corrupção.
- Redis não é fonte de verdade — perda total é degradação, não catástrofe.

## Validação
- `redis-cli ping` → `PONG`.
- `/api/public/ready` volta a 200.
- Worker BullMQ processa fila.
