# PX 1.3.1 — Premium Navigation + Enterprise Brand Refresh

**Status:** ✅ Entregue
**Escopo:** 100% UI/UX aditivo. Architecture Freeze v1.0 preservado.
**Restrições:** sem alterações em backend, RLS, contratos públicos, Provider Layer, Runtime, Billing, Security ou Multi-tenant.

---

## 1. Enterprise Brand Refresh

Substituída completamente a identidade visual anterior.

### Novo símbolo
`src/components/brand/ZennoMark.tsx`

- **Geometria:** hexágono aberto (aperture) com uma aresta interrompida no
  quadrante inferior-direito para sinalizar "sistema aberto".
- **Z abstrato:** três traços paralelos de peso idêntico (5.5u num grid 64u),
  matematicamente espaçados. Legível a 16 px (favicon), 32 px (nav), 64 px
  (splash) e 128 px (boot).
- **Nó de decisão:** ponto único que representa inteligência ativa —
  o único elemento não geométrico.
- **Sem 3D, sem bevel, sem sombras internas.** Reprodutível em favicon puro.

### Wordmark
`ZennoWordmark` — símbolo + `ZENNO` (tracking 0.24em) + tagline
`Enterprise Intelligence OS`. Sem "CRM AI", sem qualquer sub-brand legado.

### Paleta oficial
| Uso | Token | Descrição |
|---|---|---|
| Primary | `--zenno-brand-primary` | Azul elétrico |
| Accent | `--zenno-brand-accent` | Violeta de sinal |
| Neutro | `--foreground` / `--muted-foreground` | Branco / grafite |
| Superfícies | `--zenno-surface-0/1/2` | Grafite escuro |

### Propagação automática
A marca é consumida via componente único (`ZennoMark`/`ZennoWordmark`),
propagando automaticamente para:

- Boot Screen (`src/components/experience/BootScreen.tsx`)
- Sidebar principal (`src/components/AppShell.tsx`)
- Sidebar de workspace (`src/components/workspace/WorkspaceSidebar.tsx`)
- Login / Signup showcase (`src/components/auth/AuthShowcase.tsx`)
- Head metadata (`src/routes/__root.tsx` → `ZENNO — Enterprise Intelligence OS`)

O arquivo legacy `src/assets/zenno-logo.png` deixa de ser importado no
produto (retido apenas como binário histórico).

---

## 2. Premium Navigation

`src/components/AppShell.tsx` foi completamente redesenhado como um menu
enterprise com microinterações — sem trocar apenas cor ou fundo.

### Organização em 5 grupos + Command Center
1. **Command Center** — Dashboard, Executive, Workspace
2. **Sales** — Clientes, Leads, Pipeline, Atribuição, WhatsApp, Tickets
3. **Marketing** — Google Ads, Meta Ads, ROI Criativos, Sigma
4. **Finance** — Financeiro, Cobranças, Assinatura
5. **Intelligence** — Copilot, Inteligência, Experts, Automações
6. **Workspace** — Organização, Integrações, Admin, Configurações

Divisores luminosos entre grupos (`.zenno-nav-divider`) substituem a
sensação de lista infinita.

### Microinterações (tokens em `src/styles.css` · PX 1.3.1)

| Estado | Comportamento |
|---|---|
| Idle | Fundo transparente · texto muted · ícone muted |
| Hover (160–260ms) | Barra luminosa lateral (3px, gradient primary→accent) surge com `scaleY` · ícone escala 1.08× e ganha cor primary · texto ganha peso 500→600 · fundo glass 7% · faixa de luz percorre da esquerda para a direita (`zenno-nav-sheen`, 720ms, uma passagem) |
| Ativo | Barra lateral fixa com glow discreto · gradient sutil no fundo (10% → transparente) · ícone e texto na cor de destaque |
| AI-powered | Ponto `.zenno-ai-dot` violeta com halo — sinaliza módulos com IA ativa (Executive, Workspace, Copilot, Inteligência, Experts) |

Todas as transições respeitam `prefers-reduced-motion: reduce`
(bloco dedicado no `styles.css`).

### Foco e acessibilidade
- `.zenno-focus-ring` aplicado em todos os itens de navegação e ao toggle.
- `aria-label` no toggle e nos AI dots.
- `data-active` para estilização e para leitores de tela (via cor + peso).

---

## 3. Sinais visuais adicionais

- **Ambient orbs** dentro da sidebar (primary + accent, blur 3xl) —
  camada `pointer-events-none` sem impacto de layout.
- **AI Runtime pill** com pulse dot mantido, agora sobre superfície
  `bg-primary/[0.06]` (bem mais discreto que antes).
- **Rodapé institucional** com `Freeze v1.0` + `RC2 Pilot`.

---

## 4. Arquivos tocados
- `src/styles.css` — bloco aditivo **PX 1.3.1 · Premium Navigation**
- `src/components/brand/ZennoMark.tsx` — reescrito
- `src/components/AppShell.tsx` — reescrito (nav premium + 5 grupos)
- `src/components/workspace/WorkspaceSidebar.tsx` — atualiza cabeçalho para nova marca
- `src/routes/__root.tsx` — title/description/og alinhados com nova identidade
- `docs/PX1_3_1_PREMIUM_NAVIGATION_AND_BRAND_REFRESH.md` — este relatório

Nenhum arquivo de lógica de negócio, rota de dados, RLS, migration ou
provider foi alterado.

---

## 5. Recomendação pós-entrega

Esta é a **última grande mudança visual antes da GA**. Sugerido congelar
a identidade e a navegação premium neste ponto, permitindo que a evolução
seja guiada exclusivamente por telemetria e feedback dos usuários do piloto.
