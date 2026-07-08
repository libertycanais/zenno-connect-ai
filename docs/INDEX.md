# Zenno AI Suite — Documentation Index

> Catálogo mestre de toda a documentação do projeto. Ponto de entrada
> único para qualquer papel (dev, DevOps, QA, Tech Lead, Arquiteto, CTO).

## Categorias

### 🏛️ Arquitetura e decisões
| Documento | Descrição |
|-----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Visão arquitetural detalhada |
| [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | 12 ADRs oficiais |
| [ARCHITECTURE_FREEZE.md](./ARCHITECTURE_FREEZE.md) | Declaração de congelamento da arquitetura base |
| [MASTER_ROADMAP.md](./MASTER_ROADMAP.md) | Sprints passadas + futuras até v2.0 |
| [VERSION_HISTORY.md](./VERSION_HISTORY.md) | Histórico de versões |

### 🔐 Segurança
| Documento | Descrição |
|-----------|-----------|
| [SECURITY.md](./SECURITY.md) | Superfícies, ameaças, controles |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Playbook de incidente |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | RPO/RTO, failover, restore |

### 🚀 Deploy e operação
| Documento | Descrição |
|-----------|-----------|
| [DOCKER.md](./DOCKER.md) | Build/run em Docker |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Deploy em VPS externa |
| [RELEASE_PLAN.md](./RELEASE_PLAN.md) | Estratégia de release |
| [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) | Validação de staging |
| [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) | Runbook passo-a-passo |
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Score + bloqueadores |
| [PROJECT_READINESS.md](./PROJECT_READINESS.md) | Snapshot de maturidade |

### 👷 Engenharia
| Documento | Descrição |
|-----------|-----------|
| [ENGINEERING_HANDBOOK.md](./ENGINEERING_HANDBOOK.md) | Handbook completo |
| [CODE_STYLE.md](./CODE_STYLE.md) | Padrões de código |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Como contribuir |

### 📚 Runbooks operacionais
| Runbook | Cenário |
|---------|---------|
| [runbooks/tracking.md](./runbooks/tracking.md) | Tracking parado |
| [runbooks/oauth.md](./runbooks/oauth.md) | OAuth expirado / falhando |
| [runbooks/whatsapp.md](./runbooks/whatsapp.md) | Webhook WhatsApp / Uazapi |
| [runbooks/bullmq.md](./runbooks/bullmq.md) | Fila BullMQ travada |
| [runbooks/redis.md](./runbooks/redis.md) | Redis indisponível |
| [runbooks/postgres.md](./runbooks/postgres.md) | Postgres lento / indisponível |
| [runbooks/providers.md](./runbooks/providers.md) | Provider externo fora |
| [runbooks/deployment.md](./runbooks/deployment.md) | Deploy falhou |
| [runbooks/rollback.md](./runbooks/rollback.md) | Executar rollback |

### 🧠 Contexto (raiz do repo)
| Documento | Descrição |
|-----------|-----------|
| [../README.md](../README.md) | Ponto de entrada do repo |
| [../CHANGELOG.md](../CHANGELOG.md) | Changelog convencional |
| [../.env.staging.example](../.env.staging.example) | Template de variáveis |

---

## Ordem de leitura por papel

### 👨‍💻 Desenvolvedor
1. `README.md`
2. `docs/ENGINEERING_HANDBOOK.md` (seções 1–4)
3. `docs/CODE_STYLE.md`
4. `CONTRIBUTING.md`
5. `docs/ARCHITECTURE.md`
6. `docs/ARCHITECTURE_DECISIONS.md`

### 🛠️ DevOps
1. `docs/DOCKER.md`
2. `DEPLOYMENT.md`
3. `docs/STAGING_CHECKLIST.md`
4. `docs/DEPLOY_CHECKLIST.md`
5. `docs/RELEASE_PLAN.md`
6. `docs/DISASTER_RECOVERY.md`
7. `docs/runbooks/*`

### 🧪 QA
1. `docs/ENGINEERING_HANDBOOK.md` (§7 Testes)
2. `docs/STAGING_CHECKLIST.md`
3. `docs/DEPLOY_CHECKLIST.md` (§6 Smoke Tests)
4. `tests/README.md`
5. `docs/INCIDENT_RESPONSE.md`

### 🧭 Tech Lead
1. `docs/ARCHITECTURE.md`
2. `docs/ARCHITECTURE_DECISIONS.md`
3. `docs/ARCHITECTURE_FREEZE.md`
4. `docs/ENGINEERING_HANDBOOK.md` (integral)
5. `docs/MASTER_ROADMAP.md`
6. `docs/PROJECT_READINESS.md`
7. `docs/PRODUCTION_READINESS.md`

### 🏛️ Arquiteto
1. `docs/ARCHITECTURE_DECISIONS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ARCHITECTURE_FREEZE.md`
4. `docs/SECURITY.md`
5. `docs/DISASTER_RECOVERY.md`
6. `docs/MASTER_ROADMAP.md`
7. `docs/VERSION_HISTORY.md`

### 🎩 CTO
1. `docs/PROJECT_READINESS.md`
2. `docs/PRODUCTION_READINESS.md`
3. `docs/MASTER_ROADMAP.md`
4. `docs/RELEASE_PLAN.md`
5. `docs/ARCHITECTURE_DECISIONS.md` (índice final)
6. `docs/DISASTER_RECOVERY.md`
