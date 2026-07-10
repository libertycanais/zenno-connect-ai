# EPIC K — ZENNO OS · Security Design Review

**Status:** DRAFT · aguardando aprovação do CTO para iniciar implementação
**Escopo:** Workspace unificado, Widget SDK, Plugin API, Command Palette, Global Search, Copilot Panel, Realtime, Deep Links, Shareable URLs, Notification Center, Action Approval, Preferences/Bookmarks/Layouts/Snapshots, Feature Flags por widget.
**Baseline:** Architecture Freeze v1.0 · Epics A–J aprovadas · `P0.6_AI_COPILOT_SECURITY.md` (Ondas 1–5) permanece autoritativo para a camada de IA.
**Princípio:** 100% aditivo. Nenhuma superfície do Epic K pode enfraquecer isolamento multi-tenant, RLS, RBAC, Provider Layer, Runtime, Brain, Memory, Learning, Executive ou Monitoring.

---

## 1. Threat Model

### 1.1 Ativos protegidos

| Ativo | Sensibilidade | Fonte |
|---|---|---|
| `BusinessContext` (Onda 2) exibido em widgets | Alta (dados financeiros/CRM/tracking agregados por org) | AI Context Engine |
| Executive Reports, Scenarios, Forecasts | Alta | `ai_executive_reports`, `ai_scenarios`, `ai_forecasts` |
| Recommendations, Playbooks, Evidence | Alta | `ai_recommendations`, `ai_playbooks`, `ai_evidence` |
| Memories, Decision Replays, Knowledge Lineage | Crítica (aprendizado organizacional) | `ai_memory` + memory-engine stores |
| Signals / Insights / Notifications | Média | Monitoring Engine (Epic G) |
| Layouts, Bookmarks, Preferences, Widget Visibility, Feature Flags | Média (revela postura operacional da org) | **NOVO no Epic K** |
| Workspace Snapshots (estado serializado) | Alta (pode conter deep-links + contexto) | **NOVO no Epic K** |
| Provider Credentials (Claude/OpenAI/Gemini/…) | Crítica (ciphertext em `ai_provider_credentials`) | Onda 1 — imutável |
| Command Palette / Global Search index | Alta (federa TODAS as camadas acima) | **NOVO no Epic K** |

### 1.2 Atores e superfícies

| Ator | Superfície nova (Epic K) | Vetor primário |
|---|---|---|
| Usuário autenticado da org A | Workspace, widgets, palette, search, deep-links | Escalonamento horizontal para org B |
| Usuário autenticado com role `viewer` | Widgets sensíveis, Action Approval, Copilot streaming | Escalonamento vertical (viewer → analyst → owner) |
| Convidado com link compartilhado | Shareable Workspace URLs, Snapshots | Vazamento de contexto executivo sem sessão válida |
| Plugin de terceiro (Widget SDK / Plugin API) | Widget Context, Widget Events, Widget Cache | Exfiltração de contexto multi-org, XSS via render arbitrário |
| Atacante externo | Deep links, palette autocompletar, canais realtime | Enumeração de IDs, side-channel via timing de resposta |
| Insider abusivo | Snapshots + Bookmarks + Notification Center | Persistência de acesso após revogação de role |

### 1.3 Threat catalog (STRIDE resumido)

| # | Ameaça | Categoria | Severidade | Superfície |
|---|---|---|---|---|
| T-K01 | Layout/Snapshot de org A carregado por org B | **Cross-tenant** | 🔴 Crítica | Workspace Layouts, Snapshots |
| T-K02 | Global Search retorna hits agregados de outra org | **Cross-tenant** | 🔴 Crítica | Global Search, Command Palette |
| T-K03 | Widget de terceiro lê `BusinessContext` completo e faz `fetch()` externo | **Exfiltração** | 🔴 Crítica | Plugin API, Widget SDK |
| T-K04 | Shareable URL contém `report_id` sem escopo → outra org resolve via API | **Enumeração + IDOR** | 🔴 Crítica | Shareable URLs, Deep Links |
| T-K05 | XSS via título de widget/nota renderizado sem sanitização | **XSS armazenado** | 🔴 Crítica | Widget Registry, Notifications |
| T-K06 | Canal Realtime `workspace:{user_id}` sem filtro por org recebe eventos cross-org | **Cross-tenant** | 🔴 Crítica | Realtime, Notification Center |
| T-K07 | Action Approval burlado — cliente marca `status=approved` direto | **Elevação/bypass** | 🔴 Crítica | Action Center, Approval flow |
| T-K08 | Copilot Panel exibe Memory/Decision Trace de outra org via `id` forjado | **IDOR** | 🔴 Crítica | Copilot Panel |
| T-K09 | Widget Preferences aceita HTML/JS arbitrário como valor default | **XSS DOM** | 🟠 Alta | Preferences Store |
| T-K10 | Feature Flag por widget habilitado no cliente (localStorage) sem revalidação server | **Client-side auth** | 🟠 Alta | Feature Flags |
| T-K11 | Command Palette expõe rotas admin a `viewer` | **Info disclosure + escalation** | 🟠 Alta | Command Palette |
| T-K12 | Snapshots persistem tokens/URLs assinadas no estado serializado | **Secret leakage** | 🟠 Alta | Snapshots |
| T-K13 | Deep-link para widget pré-carrega dados antes do gate `_authenticated` | **Info disclosure** | 🟠 Alta | Deep Links |
| T-K14 | Notification Center envia payload cru (contexto executivo) para transport externo | **Data egress** | 🟠 Alta | Notification Center |
| T-K15 | Widget Events → event bus global vaza dados entre widgets de plugins distintos | **Confidentiality** | 🟠 Alta | Widget Events |
| T-K16 | Widget Cache compartilhado entre orgs por chave não escopada | **Cross-tenant cache** | 🟠 Alta | Widget Cache |
| T-K17 | Knowledge Lineage exposto no Copilot Panel revela nomes de fontes internas | **Info leakage** | 🟡 Média | Copilot Panel |
| T-K18 | Palette com fuzzy match faz N queries → DoS / timing side-channel | **DoS + enumeração** | 🟡 Média | Global Search |
| T-K19 | CSP permissiva para acomodar plugins → `unsafe-inline` global | **XSS amplifier** | 🟡 Média | Plugin API |
| T-K20 | Workspace Telemetry (usage analytics) grava PII sem redaction | **Compliance** | 🟡 Média | Telemetry |
| T-K21 | Realtime channel enumerável por padrão `signals:*` | **Enumeração** | 🟡 Média | Realtime |
| T-K22 | Rollback de Snapshot restaura visibilidade de widget revogado por RBAC | **Stale authorization** | 🟡 Média | Snapshots + Permissions |

---

## 2. Trust Boundaries

```
┌────────────────────────────────────────────────────────────────────┐
│ BROWSER (untrusted)                                                │
│  ├─ Workspace shell (React)                                        │
│  ├─ Widget renderers (1st-party)                                   │
│  ├─ Widget renderers (3rd-party / plugin — SANDBOXED)   ← T-K03/05 │
│  ├─ Command Palette / Global Search UI                             │
│  └─ Realtime subscriber (Supabase JS)                              │
└────────────────────────────────────────────────────────────────────┘
             │  bearer token (auth-attacher middleware)
             ▼
┌────────────────────────────────────────────────────────────────────┐
│ TANSTACK SERVER FN LAYER (semi-trusted, executes as caller)        │
│  ├─ workspace.functions.ts     — CRUD Layout/Snapshot/Prefs        │
│  ├─ search.functions.ts        — Global Search federator           │
│  ├─ palette.functions.ts       — Resource resolver                 │
│  ├─ notifications.functions.ts — Read/ack only                     │
│  ├─ actions.functions.ts       — Approval state machine            │
│  └─ copilot.functions.ts       — Streaming proxy (existing)        │
│  RULE: TODO server fn usa requireSupabaseAuth + org scope check    │
└────────────────────────────────────────────────────────────────────┘
             │  RLS as authenticated role
             ▼
┌────────────────────────────────────────────────────────────────────┐
│ POSTGRES (trusted)                                                 │
│  ├─ NEW: workspace_layouts, workspace_snapshots,                   │
│         workspace_preferences, workspace_bookmarks,                │
│         widget_visibility, widget_feature_flags,                   │
│         workspace_telemetry                                        │
│  └─ ALL: FORCE ROW LEVEL SECURITY + organization_id NOT NULL       │
└────────────────────────────────────────────────────────────────────┘
```

**Boundary invariants:**
- Nenhum código de plugin roda no mesmo realm do shell (iframe sandbox + postMessage).
- Nenhum server fn confia em `organization_id` vindo do cliente — sempre resolvido via `current_org_id()`.
- Nenhum `service_role` client é usado no caminho do Workspace (é read-path do usuário).

---

## 3. Invariantes de Segurança (43 novas · numeradas continuando as 65 anteriores)

### 3.1 Multi-tenant & RLS (I-K66 → I-K74)
- **I-K66** Toda nova tabela do Epic K possui `organization_id UUID NOT NULL` e `REFERENCES organizations(id) ON DELETE CASCADE`.
- **I-K67** Toda nova tabela do Epic K tem `ENABLE ROW LEVEL SECURITY` **e** `FORCE ROW LEVEL SECURITY`.
- **I-K68** Policies SELECT/INSERT/UPDATE/DELETE usam `organization_id = public.current_org_id()` — nunca leem `organization_id` do payload do cliente.
- **I-K69** `workspace_layouts` e `workspace_snapshots` têm índice composto `(organization_id, owner_user_id, updated_at DESC)`.
- **I-K70** `workspace_preferences` e `workspace_bookmarks` são escopados a `(organization_id, user_id)` — jamais globais.
- **I-K71** `widget_visibility` e `widget_feature_flags` respeitam `(organization_id, widget_id)` — flag habilitada em org A **não** vaza para org B.
- **I-K72** GRANTs seguem o padrão do projeto: `authenticated` (CRUD escopado) + `service_role` (ALL). Nenhum grant a `anon` em tabelas do Workspace.
- **I-K73** Nenhum trigger do Epic K desabilita RLS temporariamente (`SET LOCAL row_security = off` é proibido).
- **I-K74** Snapshots armazenam apenas **referências por ID** aos artefatos (report_id, playbook_id, …). Nunca o corpo do artefato — a resolução ocorre em runtime respeitando RLS atual.

### 3.2 RBAC & Action Approval (I-K75 → I-K81)
- **I-K75** `viewer` pode ler widgets, mas **não pode** aprovar ações, salvar Snapshots compartilhados, publicar Layouts de organização ou alterar Feature Flags.
- **I-K76** `analyst` pode aprovar ações, salvar Layouts pessoais, mas **não pode** alterar Layouts de organização.
- **I-K77** Somente `owner`/`admin` pode publicar Layout `scope='organization'` e Feature Flags org-wide.
- **I-K78** Action Approval é **server-authoritative**: transição `suggested → approved → executed` só ocorre via server fn que revalida `has_role` + estado atual. Cliente **não** envia `status`; envia intenção (`approve|reject|execute`).
- **I-K79** A execução da ação (após approval) delega ao WorkflowExecutor da Epic F. O Epic K nunca executa side-effects diretamente.
- **I-K80** Toda transição de estado da ação grava linha em `audit_log` via `app_write_audit_log` — reutiliza pipeline existente, sem novos writers.
- **I-K81** Auto-execução é proibida em qualquer superfície do Workspace (guardrail já validado no Epic J).

### 3.3 Global Search & Command Palette (I-K82 → I-K88)
- **I-K82** Global Search é um **federador server-side** que roda queries independentes por camada (leads, campaigns, recommendations, memories, playbooks, reports, insights, actions, timeline). Cada query passa por RLS como o usuário autenticado — não há `service_role`.
- **I-K83** Resultados são unificados com um schema comum `{kind, id, org_id, title_redacted, url, score}`. O federador **filtra** qualquer resultado onde `org_id != current_org_id()` como defesa em profundidade.
- **I-K84** `title_redacted` passa pela função `audit_redact()` antes de sair — nunca expõe secret keys, tokens ou ciphertext.
- **I-K85** Command Palette só lista **comandos permitidos** para a role atual. A lista de comandos é derivada server-side, não filtrada no cliente.
- **I-K86** Autocomplete/fuzzy tem debounce (≥ 250 ms) + rate-limit por usuário via `global_rate_limit_hit('palette:'||user_id, 30, 60)`.
- **I-K87** Palette não expõe rotas `admin/*` para `viewer`/`analyst` — mesmo que a rota física exista.
- **I-K88** Search **nunca** retorna raw ciphertext de `ai_provider_credentials` nem colunas `api_key_*`. Enforced via allow-list de colunas por camada.

### 3.4 Deep Links & Shareable URLs (I-K89 → I-K94)
- **I-K89** Deep links usam apenas IDs opacos (UUIDs). Nenhum ID sequencial é introduzido.
- **I-K90** Toda rota de deep-link vive sob `_authenticated/` — gate managed do Supabase redireciona para `/auth`. Não existe deep-link público a artefato.
- **I-K91** Shareable Workspace URLs, quando implementadas, exigem token dedicado gravado em `workspace_share_tokens (id, organization_id, snapshot_id, expires_at, created_by, revoked_at)` com **TTL máximo de 7 dias** e **um único uso opcional**.
- **I-K92** O token concede acesso **read-only** e **somente** ao snapshot referenciado — nunca à navegação lateral do Workspace.
- **I-K93** Compartilhamento externo (fora da org) é **desligado por default**; requer feature flag org-wide + role `owner` para habilitar.
- **I-K94** URLs compartilhadas **nunca** contêm bearer tokens, chaves de API ou dados sensíveis em query string. Somente `?share=<token>`.

### 3.5 Widget SDK & Plugin API (I-K95 → I-K102)
- **I-K95** Plugins de terceiros executam em **iframe `sandbox="allow-scripts"`** (sem `allow-same-origin`) — sem acesso a cookies, localStorage ou DOM do shell.
- **I-K96** Comunicação plugin ↔ shell é **exclusivamente** via `postMessage` com schema Zod validado nos dois lados.
- **I-K97** O shell entrega ao plugin um **BusinessContext filtrado** contendo apenas os módulos declarados no manifest do plugin (princípio do menor privilégio). Nunca o contexto completo.
- **I-K98** Plugin **não** recebe bearer token. Toda chamada a dados passa por bridge do shell, que revalida escopo antes de responder.
- **I-K99** CSP do Workspace: `default-src 'self'; script-src 'self'; frame-src 'self' https://*.plugins.zenno.app; connect-src 'self' https://<supabase-host>; style-src 'self' 'unsafe-inline'` (inline styles apenas). **Proibido** `unsafe-eval` e `unsafe-inline` em `script-src`.
- **I-K100** Widget titles, subtitles, descriptions e valores de Preferences renderizados via React (escape automático). **Proibido** `dangerouslySetInnerHTML` em qualquer widget 1st ou 3rd-party.
- **I-K101** Plugin manifest é imutável após instalação; upgrade exige nova aprovação de `owner` + registro em `audit_log`.
- **I-K102** Widget Cache é **chaveado por `(organization_id, user_id, widget_id, key)`**. Impossível colisão cross-org por design.

### 3.6 Realtime (I-K103 → I-K106)
- **I-K103** Canais Supabase Realtime usam **naming pattern escopado**: `org:{org_id}:signals`, `org:{org_id}:notifications`, `org:{org_id}:tasks`. Nunca `signals:*` global.
- **I-K104** RLS na publicação Realtime replica as policies da tabela subjacente — subscriber recebe **apenas** rows autorizadas.
- **I-K105** Subscrição server-side confirma `org_id` do canal contra `current_org_id()` antes de estabelecer socket.
- **I-K106** Payload realtime passa por `audit_redact()` antes de sair (defesa em profundidade contra colunas sensíveis futuras).

### 3.7 Copilot Panel, Streaming, Memory & Lineage (I-K107 → I-K108)
- **I-K107** Copilot Panel reutiliza contratos Ondas 1–5. Streaming continua server-authoritative; nenhum novo endpoint que exponha modelo/provider raw. Metadata exibida (provider, model, confidence, tokens) já é do usuário — reforçar redação de `provider_credential_id`.
- **I-K108** Decision Trace, Memory utilizada e Knowledge Lineage exibidos no painel são carregados via server fn com filtro `organization_id = current_org_id()` e retornam **apenas** nomes/IDs opacos — nunca conteúdo bruto de outra memória além da referenciada pela decisão atual.

---

## 4. Riscos Classificados por Severidade

### 4.1 🔴 Críticos — bloqueiam merge se não mitigados
| Risco | Mitigação obrigatória |
|---|---|
| Cross-tenant em Layouts/Snapshots (T-K01) | I-K66..I-K74 + teste E2E "org A não vê layout de org B" |
| Cross-tenant em Global Search (T-K02) | I-K82..I-K84 + fuzz test com IDs de outra org |
| Exfiltração via plugin (T-K03) | I-K95..I-K99 |
| IDOR em Shareable URL (T-K04) | I-K89..I-K94 |
| XSS armazenado (T-K05) | I-K100 + review manual de todo widget que renderiza texto do usuário |
| Realtime cross-tenant (T-K06) | I-K103..I-K106 |
| Bypass Action Approval (T-K07) | I-K78..I-K81 |
| IDOR Memory/Decision (T-K08) | I-K108 |

### 4.2 🟠 Altos — merge só com mitigação documentada
T-K09 (I-K100), T-K10 (I-K71 + revalidação server), T-K11 (I-K87), T-K12 (I-K74 + snapshot scrubber), T-K13 (`_authenticated` gate), T-K14 (I-K106 + allowlist de transports), T-K15 (namespacing de event bus por widget instance), T-K16 (I-K102).

### 4.3 🟡 Médios — endereçar antes do GA
T-K17 (view redigida no painel), T-K18 (I-K86 + timeout de query), T-K19 (I-K99 sem exceções), T-K20 (redaction em telemetry), T-K21 (I-K103), T-K22 (revalidar visibilidade no restore).

---

## 5. Checklist de Merge (obrigatório antes de aprovar PR)

**Schema**
- [ ] Toda nova tabela: `organization_id NOT NULL` + FK + índice + RLS + FORCE RLS + policies escopadas por `current_org_id()`.
- [ ] GRANTs explícitos (`authenticated` CRUD + `service_role` ALL). Zero grants a `anon`.
- [ ] Migration inclui trigger `audit_row_change` quando a tabela é operacional (Layouts, Snapshots, Flags, Bookmarks).

**Server fns**
- [ ] Toda server fn nova usa `requireSupabaseAuth`.
- [ ] Nenhuma server fn aceita `organization_id` do cliente.
- [ ] Nenhuma server fn nova usa `supabaseAdmin` fora de webhook/admin já existentes.
- [ ] Action state machine implementada server-side; cliente envia intenção, não estado.

**UI / Widgets**
- [ ] Zero `dangerouslySetInnerHTML` em widgets, palette results, notifications, snapshots.
- [ ] Command Palette recebe lista de comandos server-filtrada por role.
- [ ] Copilot Panel não renderiza HTML cru do assistant (markdown sanitizado).

**Plugins**
- [ ] Iframe sandbox `allow-scripts` (sem `allow-same-origin`) para 3rd-party.
- [ ] Bridge Zod-validada nas duas pontas.
- [ ] CSP declarada e revisada; sem `unsafe-eval`, sem `unsafe-inline` em `script-src`.

**Realtime**
- [ ] Canais usam pattern `org:{org_id}:*`.
- [ ] Handshake valida `org_id` server-side.

**Shareable URLs**
- [ ] Tabela `workspace_share_tokens` com `expires_at`, `revoked_at`, `created_by`.
- [ ] Endpoint público (se existir) vive em `src/routes/api/public/*` e valida token + TTL + revogação.
- [ ] Sem PII em query string além do token opaco.

**Audit**
- [ ] Aprovação de ação, publicação de Layout org, alteração de Feature Flag, criação/revogação de Share Token → `audit_log`.

---

## 6. Testes Obrigatórios

### 6.1 Unitários (Vitest)
- `workspace/layouts.test.ts` — CRUD escopado; recusa `organization_id` vindo do cliente.
- `workspace/snapshots.test.ts` — snapshot serializa **apenas IDs**; restore revalida RLS de cada referência.
- `workspace/preferences.test.ts` — merge determinístico; rejeita chaves com prefixo `__proto__`, `constructor`, `prototype`.
- `search/federator.test.ts` — filtro defensivo `org_id != current` remove hits mesmo se camada esquecer.
- `palette/commands.test.ts` — `viewer` não vê comandos admin; `analyst` não vê publish-org.
- `actions/state-machine.test.ts` — transições ilegais rejeitadas; auto-execução impossível.
- `plugins/bridge.test.ts` — payloads inválidos rejeitados; contexto filtrado por manifest.
- `realtime/channel-naming.test.ts` — pattern `org:{id}:*` obrigatório.

### 6.2 Segurança / Integração
- **Cross-tenant matrix**: user A da org 1 tenta ler `layouts`, `snapshots`, `bookmarks`, `preferences`, `notifications`, `share_tokens` da org 2 via server fn e via query direta. Deve falhar em 100% dos casos.
- **Search leak fuzz**: 500 iterações com IDs aleatórios de outra org como query — nenhum hit deve retornar.
- **Snapshot scrubber**: injeta chaves proibidas (`access_token`, `api_key`, `password`) em preferences → `audit_redact` remove antes de persistir.
- **Share token TTL**: token expirado / revogado retorna 404 (não 401 — evita enumeração).
- **XSS regression**: widget title `<img src=x onerror=alert(1)>` renderiza como texto.
- **RBAC matrix**: viewer/analyst/admin/owner × cada ação sensível.

### 6.3 Realtime
- Duas sessões simultâneas (org A e org B) escutando `org:*:signals` — inserir signal em A não gera evento em B.

---

## 7. Recomendações do CTO (aditivas ao pedido)

1. **`workspace_share_tokens` como tabela dedicada**, não coluna em snapshots — permite revogação granular sem invalidar o snapshot.
2. **Snapshot Scrubber** rodando server-side no INSERT: rejeita snapshots com chaves reservadas ou tamanho > 256 KB.
3. **Plugin manifest signing** (v1.1): hash SHA-256 do manifest gravado em `plugin_registry`; qualquer divergência bloqueia carregamento.
4. **Kill-switch por widget**: coluna `disabled_globally BOOLEAN` em `widget_registry` permite desabilitar widget comprometido em toda a base sem migration.
5. **Telemetry redaction library** compartilhada (`src/lib/telemetry/redact.ts`) para garantir I-K106/T-K20 em um único ponto.
6. **CSP report-only** primeiro deploy → coleta violações reais → CSP enforce.
7. **Feature Flag por Widget é servidor-authoritative**: cache local ok, mas cada `execute` revalida.
8. **Deep-link preview** (pré-fetch em hover) proibido para artefatos sensíveis (Executive Reports, Memory, Playbooks) — só carrega após click.
9. **Notification transports allowlist** — inicialmente apenas in-app + email transacional já existente. Slack/Webhook fica para depois do review dedicado.
10. **Workspace Snapshots versionados** (`schema_version INT`) para permitir migração de formato sem invalidar snapshots antigos.

---

## 8. Compatibilidade

| Camada | Impacto | Observação |
|---|---|---|
| Architecture Freeze v1.0 | ✅ Nenhum | Somente novas tabelas + novos server fns |
| Provider Layer | ✅ Nenhum | Copilot Panel consome runtime existente |
| Runtime / Brain / Experts | ✅ Nenhum | Widgets são leitores |
| Memory / Learning / Executive | ✅ Nenhum | Painéis leem via server fn já existente |
| Monitoring | ✅ Nenhum | Realtime consome pipeline atual |
| Billing / Tracking | ✅ Nenhum | Widgets são projeções |
| Multi-tenant / RLS | ✅ Reforçado | 43 novas invariantes |
| API Pública | ✅ Nenhum | Sem novos endpoints públicos, exceto share-token (opcional, sob flag) |
| Audit Log | ✅ Reutilizado | Novos eventos usam `app_write_audit_log` |

---

## 9. Decisão

**Recomendação:** APROVAR o design com as 43 invariantes acima como pré-requisito de merge. Implementação do Epic K pode iniciar em modo Build após ack do CTO. Snapshot Scrubber, CSP report-only e cross-tenant test matrix são **hard gates** — não podem ser feature-flagged para depois.

**Bloqueadores identificados:** nenhum. Todos os riscos 🔴 têm mitigação viável dentro do freeze.

**Próximo passo após aprovação:** iniciar Wave 1 do Epic K (schema + RLS + server fns core + Widget Registry expandido). Waves 2–4 (Palette/Search, Plugin API, Realtime, Shareable URLs) seguem em sequência com Quality Gate por wave.
