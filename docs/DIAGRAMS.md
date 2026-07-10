# Diagramas — Zenno AI Suite

Todos os diagramas em Mermaid (renderizado nativamente pelo GitHub).

---

## 1. Arquitetura em camadas

```mermaid
flowchart TD
  UI[UI · React 19 + TanStack Router]
  SF[Server Functions · createServerFn]
  PL[Provider Layer<br/>AI · Payments · Ads · WhatsApp]
  MI[Marketing Intelligence Pipeline]
  EB[Event Bus · 8 eventos canônicos]
  DB[(PostgreSQL 15<br/>RLS 100% · multi-tenant)]
  EXT{{Provedores externos<br/>Google · Meta · Stripe · Anthropic}}

  UI --> SF --> PL --> EXT
  SF --> MI
  MI --> EB
  EB --> MI
  SF --> DB
  MI --> DB
```

---

## 2. Marketing Intelligence Pipeline

```mermaid
flowchart LR
  K[Knowledge Layer] --> C[Context Engine]
  BK[Business KPIs] --> C
  C --> EX[Experts · Marketing / Sales / Exec]
  EX --> LLM[Provider Layer → Claude]
  LLM --> R[Recommendation Builder]
  R --> P[Playbook Engine]
  R --> EV[Evidence Engine]
  P --> S[Snapshot Store]
  EV --> S
  S --> UI[Marketing Intelligence Card]
  S --> CP[Copilot Briefing]
```

---

## 3. Event Bus canônico

```mermaid
sequenceDiagram
  participant User
  participant OAuth
  participant Sync
  participant Health
  participant Intel
  participant Snap
  participant Copilot

  User->>OAuth: Conecta Google Ads
  OAuth-->>Sync: PlatformConnected
  Sync-->>Sync: MarketingSyncStarted
  Sync-->>Health: MarketingSyncCompleted
  Health-->>Intel: HealthUpdated
  Intel-->>Intel: RecommendationsGenerated
  Intel-->>Snap: ExecutiveSummaryGenerated
  Snap-->>Copilot: IntelligenceSnapshotUpdated
  Copilot-->>User: Briefing discreto (notificação)
```

---

## 4. Segurança / Multi-tenant

```mermaid
flowchart TD
  R[Request autenticado] --> A[requireSupabaseAuth]
  A --> J[JWT → claims.organization_id]
  J --> Q[Query com RLS]
  Q --> P{{Policy USING<br/>organization_id = auth.org_id}}
  P -->|allow| DB[(Row)]
  P -->|deny| X[403]
```

---

## 5. First Five Minutes (TTFI)

```mermaid
gantt
  title Time To First Intelligence (TTFI)
  dateFormat  X
  axisFormat  %s

  section Onboarding
  OAuth Google           :a1, 0, 10
  Discovery Assets       :a2, after a1, 15
  Primeiro Sync          :a3, after a2, 45
  Health + Intelligence  :a4, after a3, 30
  Snapshot + Briefing    :a5, after a4, 10
```

Meta: TTFI ≤ 5 minutos.

---

## 6. Runtime alvo (Workers)

```mermaid
flowchart LR
  CF[Cloudflare Worker<br/>nodejs_compat] --> SFN[Server Functions]
  SFN --> PG[(PostgreSQL)]
  SFN --> KV[(KV / Cache)]
  SFN --> S3[(R2 / S3 Storage)]
  CF --> STATIC[Assets estáticos]
```
