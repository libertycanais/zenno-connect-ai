# Zenno AI Suite — Production Readiness Score

> Avaliação técnica do estado atual do projeto para promoção à **Produção
> Enterprise**. Escala 0–10 por dimensão; parecer final ao fim do documento.

## Notas por dimensão

| Dimensão          | Nota | Justificativa curta                                                                                       |
|-------------------|------|-----------------------------------------------------------------------------------------------------------|
| Arquitetura       | 9    | TanStack Start + Provider Layer + Multi-tenant estáveis, contratos congelados.                            |
| Segurança         | 9    | RLS 100%, SECURITY DEFINER com search_path fixo, audit_log append-only, redaction de logs.                |
| Testes            | 8    | 313 testes (unit + integration + contract), snapshots de payloads externos. Cobertura global ainda baixa. |
| Infraestrutura    | 8    | Docker multi-stage, compose reprodutível, healthchecks operacionais.                                      |
| Observabilidade   | 5    | Logger JSON com redaction pronto, mas Sentry/APM externo ainda não plugado.                               |
| Escalabilidade    | 7    | Stateless server, Postgres + Redis prontos; falta drill de carga real.                                    |
| Performance       | 7    | Índices auditados, particionamento de audit_log; sem load-test formal.                                    |
| Documentação      | 9    | ARCHITECTURE, SECURITY, DOCKER, DEPLOYMENT, PROJECT_READINESS, RELEASE_PLAN, checklists.                  |
| Deploy            | 7    | Runbook completo, CI verde; falta drill de rollback ponta-a-ponta em staging.                             |
| Operação          | 6    | Healthchecks + logs prontos; on-call, SLOs e runbooks de incidente ainda embrionários.                    |
| Governança        | 6    | Changelog, PR-review, memória de projeto; falta política formal de aprovação/rotação de secrets.          |
| Compliance        | 5    | Redaction e audit_log ajudam; falta política de retenção, DPA, LGPD/GDPR formalizados.                    |

**Média ponderada (uniforme): 7.2 / 10**

## Radar textual

```text
Arquitetura      █████████░  9
Segurança        █████████░  9
Documentação     █████████░  9
Testes           ████████░░  8
Infraestrutura   ████████░░  8
Escalabilidade   ███████░░░  7
Performance      ███████░░░  7
Deploy           ███████░░░  7
Operação         ██████░░░░  6
Governança       ██████░░░░  6
Observabilidade  █████░░░░░  5
Compliance       █████░░░░░  5
```

## Riscos

1. **Observabilidade externa ausente** — incidentes em produção sem visibilidade rápida além dos logs stdout.
2. **Cobertura de testes global (~24%)** — módulos server function ainda expostos a regressões silenciosas.
3. **Ausência de load-test formal** — comportamento sob pico real desconhecido (WhatsApp burst, tracking).
4. **Política de retenção do `audit_log` indefinida** — crescimento ilimitado da tabela particionada.
5. **Rotação de secrets** — sem calendário formal para OAuth/webhook secrets.
6. **Compliance LGPD/GDPR** — DPA, política de retenção de dados de lead e direito ao esquecimento não formalizados.

## Bloqueadores para produção

- ❌ Sentry (ou equivalente) plugado no client **e** server.
- ❌ Coletor de logs externo (Loki / Datadog / CloudWatch) ingerindo stdout.
- ❌ Política de retenção do `audit_log` implementada (drop de partições antigas).
- ❌ Drill de rollback ponta-a-ponta executado com sucesso em staging.
- ❌ Load-test mínimo (100 req/s sustentado por 10 min) nos endpoints `/api/public/track/*` e `/api/public/whatsapp/webhook/*`.

## Itens obrigatórios antes de produção

1. Plugar Sentry e validar captura de erro sintético em <2 min.
2. Configurar driver de logs externo (Docker `json-file` → Vector → Loki, por exemplo).
3. Implementar job de retenção de partições antigas do `audit_log` (default sugerido: 12 meses).
4. Definir SLO inicial (ex.: 99.5% de disponibilidade, p95 < 1s).
5. Executar drill de rollback em staging e documentar em `docs/incidents/drills/`.
6. Load-test com k6/Artillery e capturar baseline.
7. Rotacionar todos os secrets antes do go-live e registrar no cofre.

## Itens recomendados

- Elevar cobertura server-side para 60% (WS-11 no backlog).
- Extrair snapshots contratuais para `.snap` versionados + spec OpenAPI (WS-12).
- Adicionar `/metrics` (Prometheus format) para scraping.
- Criar página de status pública (`status.zenno.example`).
- Formalizar DPA + política LGPD/GDPR com aviso de privacidade e fluxo de esquecimento.
- Habilitar 2FA obrigatório para admins.
- Escrever runbooks para os 5 incidentes mais prováveis (webhook flap, OAuth expirado, banco lento, Redis cheio, secret vazado).

## Plano para atingir READY FOR PRODUCTION

**Semana 1 — Observabilidade**
- Sentry (client + server) + alertas para top-10 erros.
- Driver de logs externo + dashboards de latência/5xx/throughput.

**Semana 2 — Retenção e resiliência**
- Job de retenção de partições `audit_log`.
- Drill de rollback em staging + documento em `docs/incidents/drills/`.
- Rotação de secrets + calendário no cofre.

**Semana 3 — Carga e qualidade**
- Load-test k6 nos endpoints críticos, baseline documentado.
- Cobertura de testes server ≥ 60%.
- SLO/SLA formalizados.

**Semana 4 — Compliance e governança**
- Política LGPD/GDPR + fluxo de esquecimento.
- Runbooks dos 5 incidentes-chave.
- Ensaio de comunicação de incidente + página de status.

Ao encerrar as 4 semanas com todos os itens verdes, promover parecer para
🟢 **READY FOR PRODUCTION**.

## Parecer final

**🟡 READY FOR STAGING**

O projeto está estruturalmente sólido — arquitetura, segurança, testes,
contratos e infraestrutura já operam em nível de SaaS maduro. Os
bloqueadores para produção são operacionais (observabilidade externa,
retenção, drill de rollback, load-test), não arquiteturais. O ambiente
de **Staging Enterprise** pode ser habilitado imediatamente para uso
com design partners, enquanto o plano de 4 semanas acima é executado
em paralelo para destravar a promoção a produção.
