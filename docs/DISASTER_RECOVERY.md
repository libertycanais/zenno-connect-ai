# Disaster Recovery — Zenno AI Suite

Plano formal de continuidade para cenários catastróficos.

## Objetivos de recuperação

| Métrica | Alvo | Definição |
|---------|------|-----------|
| **RPO** (Recovery Point Objective) | ≤ 1 h | Máx. perda de dados aceitável |
| **RTO** (Recovery Time Objective) | ≤ 4 h | Máx. downtime aceitável |
| **MTTR** (Mean Time To Repair) | ≤ 1 h em SEV-1 | Média de reparo |

## Backup

### Postgres
- **Supabase Cloud**: backup diário automático + PITR (Point-In-Time
  Recovery) quando disponível no plano.
- **Self-hosted**: `pg_dump` diário via cron (ver `DEPLOYMENT.md` §11),
  retenção 30 dias, cópia offsite S3/Backblaze.
- Verificação: teste de restore trimestral em ambiente scratch.

### Redis
- **N/A na baseline v1.0** (Cloudflare Workers). Sem estado externo além do Postgres.
- Se algum dia adotado (via novo ADR), aplicar AOF + snapshots RDB e tratar como
  cache — nunca como fonte de verdade.

### Storage (Supabase)
- Backup automático diário no Cloud.
- Self-hosted: incluir buckets no cron de backup (`aws s3 sync`).

### Secrets
- Cofre externo (Doppler / Vault / 1Password / AWS Secrets Manager).
- Snapshot mensal exportado e cifrado; guardado offsite.

### Código e infra
- Repo Git é fonte de verdade.
- Imagens Docker imutáveis por tag no registry (retenção ≥ 90 dias).

## Restore

### Postgres
```bash
# Cloud: usar UI Supabase → Backups → Restore
# Self-hosted:
gunzip -c /var/backups/zenno-YYYY-MM-DD.sql.gz \
  | psql "postgresql://postgres:SENHA@db.host:5432/postgres"
```
Validação: rodar `tests/integration/database/integrity.test.ts` no ambiente restaurado.

### Redis
```bash
docker compose stop redis
# copiar AOF/RDB do backup para volume
docker compose start redis
```

### Storage
```bash
aws s3 sync s3://zenno-backup/storage/ /var/storage/
```

### Secrets
- Recuperar do cofre + snapshot cifrado offsite.

## Failover

Estado atual: single-region, single-AZ (staging). Failover manual.

Alvo (produção):
- **Postgres**: multi-AZ (Supabase Pro / RDS multi-AZ).
- **Redis**: replicação + Sentinel.
- **App**: ≥ 2 instâncias atrás de LB com healthchecks.
- **DNS**: TTL ≤ 60s para failover rápido.

## Recovery — cenários

### Perda de banco (região inteira)
- **RPO**: ≤ 1 h (via PITR ou último dump).
- **RTO**: ≤ 4 h.
- Passos:
  1. Provisionar novo Postgres.
  2. Restore do último backup válido.
  3. Aplicar migrations pendentes (`supabase db push`).
  4. Redirecionar `DATABASE_URL` / `SUPABASE_URL`.
  5. Rodar suíte de integridade.
  6. Reabrir tráfego gradualmente.

### Perda de Redis
- **RPO**: 0 (não é fonte de verdade).
- **RTO**: ≤ 15 min.
- Passos:
  1. Subir novo Redis com AOF do backup (se houver).
  2. Reiniciar worker; jobs perdidos são retentados via idempotência.

### Perda de Storage
- **RPO**: ≤ 24 h.
- **RTO**: ≤ 2 h.
- Restore via `aws s3 sync`.

### Perda de Secrets
- **RPO**: última rotação registrada.
- **RTO**: ≤ 1 h.
- Restore do snapshot cifrado offsite + rotação imediata de todos os secrets afetados.

### Perda de região inteira
- **RPO**: ≤ 1 h.
- **RTO**: ≤ 8 h (planejado — depende de infra multi-região).
- Passos:
  1. Provisionar stack em região secundária (IaC recomendado: Terraform / Pulumi).
  2. Restore Postgres + Storage.
  3. Redeploy imagem Docker imutável (mesma tag).
  4. Reconfigurar DNS.
  5. Smoke tests (`docs/DEPLOY_CHECKLIST.md` §6).

## Drills

- **Trimestral**: restore de dump em ambiente scratch + validação.
- **Semestral**: simulação de perda de região (papel).
- **Anual**: drill completo com failover real em ambiente de staging.

Registrar cada drill em `docs/incidents/drills/YYYY-MM-DD-<slug>.md`.

## Responsáveis

- **Owner**: CTO.
- **Executores**: DevOps + Segurança.
- **Verificadores**: QA + Tech Lead.
