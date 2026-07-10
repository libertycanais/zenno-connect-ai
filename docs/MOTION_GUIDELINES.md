# Zenno · Motion Guidelines (PX 1.2)

> Movimento é linguagem. Toda animação Zenno é **silenciosa, discreta e informativa**. Nunca decorativa.

## Princípios
1. **Purposeful** — a animação comunica estado, hierarquia ou continuidade.
2. **Calm** — durações contidas, easing suave, sem bounce agressivo.
3. **Consistent** — mesmos tokens em todo o produto.
4. **Respectful** — desativa completamente sob `prefers-reduced-motion: reduce`.

## Tokens
```
--zenno-dur-fast    160ms      hover, focus, tap
--zenno-dur-base    260ms      fade-up, slide-in, drawer
--zenno-dur-slow    480ms      boot, page transition, hero enter
--zenno-ease-standard    cubic-bezier(.2, .8, .2, 1)
--zenno-ease-emphasized  cubic-bezier(.16, 1, .3, 1)
```

## Biblioteca oficial de animações
| Nome | Keyframe | Uso |
|------|----------|-----|
| **Fade Up** | `zenno-fade-up` | Entrada de página, cards, painéis |
| **Pulse Dot** | `zenno-pulse-dot` | Indicadores "live" (AI ativo, status online) |
| **Shimmer** | `zenno-shimmer` | Progress AI, loading premium |
| **Grid Drift** | `zenno-grid-bg` | Background cinemático (PX 1.1) |
| **Orb Float** | `zenno-orb / zenno-orb-slow` | Fundos ambientes |
| **Scanline** | `zenno-scanline` | Passagem sutil, mission control |
| **Feed In/Out** | `zenno-feed-in / zenno-feed-out` | Notificações Live Intelligence |
| **Breathe** | `zenno-breathe` | Barras vivas de expert |
| **Dot Blink** | `zenno-dot-blink` | AI Thinking (3 pontos) |
| **Progress Indeterminate** | `zenno-progress-indeterminate` | Loading AI sem % conhecido |

## Padrões por contexto
### Hover
- Duração: `--zenno-dur-fast`.
- Propriedades: `transform: translateY(-1px)`, `box-shadow: var(--shadow-glow)`.

### Focus
- Instantâneo (0ms) para acessibilidade.
- Usar `.zenno-focus-ring`.

### Loading
- **Skeleton** para dados estruturados (evita CLS).
- **Shimmer** para operações AI.
- **Indeterminate bar** quando o backend não informa progresso.

### AI Thinking
- Três pontos com `zenno-dot-blink` + rótulo rotativo do expert.
- Nunca usar spinner circular clássico em contextos AI.

### Success
- Fade-up de 260ms + gradiente mint por 800ms → dissolve.

### Boot
- Sequência de checklist (130ms/módulo) + fade para welcome + fade-out.

### Page transition
- `zenno-fade-up` (opacity 0→1, translateY 8→0) em 500ms `--zenno-ease-emphasized`.

## Regras invioláveis
- ❌ Nunca durações > 800ms para microinterações.
- ❌ Nunca `ease-in-back` ou bounces agressivos em UI enterprise.
- ❌ Nunca animações infinitas fora de indicadores de estado vivo.
- ✅ Sempre honrar `@media (prefers-reduced-motion: reduce)`.
- ✅ Sempre preferir CSS/GPU (opacity, transform) — evitar animar `top/left/width`.
