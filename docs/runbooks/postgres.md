# Runbook — Postgres

## Sintomas
- Latência de queries subindo (p95 > 500ms).
- `/api/public/ready` retorna 503 com `postgres: fail`.
- Erros `too many connections` nos logs.
- CPU do Postgres > 80% sustentado.

## Diagnóstico
1. `pg_isready -h <host> -U <user>`.
2. Ver conexões ativas:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. Queries lentas:
   ```sql
   SELECT pid, now() - query_start AS runtime, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '5s'
   ORDER BY runtime DESC;
   ```
4. Locks:
   ```sql
   SELECT * FROM pg_locks WHERE granted = false;
   ```
5. Verificar índices ausentes via `tests/integration/database/indexes.test.ts`.

## Logs relevantes
- `event=db.query.slow` (se instrumentado).
- Postgres log: `duration:` linhas > 500 ms.

## Causa provável
- Query nova sem índice.
- Migration recente com lock demorado.
- Pool de conexões esgotado (server function vazando conexão).
- Autovacuum atrasado em tabela grande.
- Partição do `audit_log` sem índice.

## Correção
- Adicionar índice via migration.
- Aumentar pool ou reduzir concorrência no app.
- Executar `VACUUM ANALYZE` em tabela problemática.
- Cancelar query travada: `SELECT pg_cancel_backend(<pid>);`.
- Escalar compute (Supabase Cloud UI ou instância maior).

## Rollback
- Reverter migration problemática (via migration inversa).
- Reverter deploy que introduziu query cara.

## Validação
- p95 < baseline por 10 min consecutivos.
- Pool de conexões < 80%.
- `tests/integration/database/*` verde no ambiente.
