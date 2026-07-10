# Zenno · Design System (PX 1.2)

> Consolidação dos tokens vivos declarados em `src/styles.css`. **Aditivo**, não substitui shadcn primitives.

## Tokens semânticos (shadcn)
Definidos em `:root` / `.dark`. Toda superfície do produto usa **exclusivamente** estes tokens — proibido hard-coded (`bg-blue-500`, `#fff`, etc.).

`--background · --foreground · --card · --card-foreground · --primary · --primary-foreground · --secondary · --muted · --accent · --destructive · --border · --input · --ring · --sidebar-*`

## Tokens de marca (PX 1.2 · aditivos)
```
--zenno-brand-primary    oklch(0.72 0.18 235)
--zenno-brand-accent     oklch(0.58 0.24 295)
--zenno-brand-cyan       oklch(0.78 0.14 210)
--zenno-brand-mint       oklch(0.75 0.17 160)
--zenno-brand-gold       oklch(0.82 0.16 85)
--zenno-brand-danger     oklch(0.66 0.24 25)
--zenno-surface-0/1/2
--zenno-glass            color-mix(...)
--zenno-glow             box-shadow token
```

## Border Radius
| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | 6px | Chips, badges |
| `--radius-md` | 8px | Inputs, buttons |
| `--radius-lg` | 10px | Cards, painéis |
| `--radius-xl` | 14px | Widgets, drawers |

## Spacing
Padrão Tailwind (4px baseline). Regra de composição definida em `docs/UI_CONSISTENCY.md`.

## Elevation
| Token | Uso |
|-------|-----|
| `--zenno-elev-1` | Card padrão |
| `--zenno-elev-2` | Card em hover, drawer |
| `--zenno-elev-3` | Modais, command palette |
| `--shadow-glow` | Estados AI ativos |

## Blur / Glass
- Superfície glass: `zenno-glass` (backdrop-blur 14px, saturate 140%).
- Fundo ambiente: `zenno-ambient` (radial glows).
- Overlay grid: `zenno-grid-bg` (PX 1.1).

## Motion tokens
```
--zenno-dur-fast   160ms    hover, focus
--zenno-dur-base   260ms    fade-up, slide
--zenno-dur-slow   480ms    boot, page transition
--zenno-ease-standard    cubic-bezier(.2,.8,.2,1)
--zenno-ease-emphasized  cubic-bezier(.16,1,.3,1)
```

## Utilities disponíveis
`zenno-glass · zenno-ambient · zenno-gradient-text · zenno-pulse-dot · zenno-fade-up · zenno-shimmer · zenno-grid-bg · zenno-orb / zenno-orb-slow · zenno-scanline · zenno-feed-in / zenno-feed-out · zenno-breathe · zenno-dot-blink · zenno-progress-track / zenno-progress-indeterminate · zenno-noise · zenno-wordmark · zenno-focus-ring`

## Componentes de marca
| Componente | Arquivo | Papel |
|-----------|---------|-------|
| `ZennoMark` | `src/components/brand/ZennoMark.tsx` | Símbolo SVG (variants: gradient/mono/outline) |
| `ZennoWordmark` | idem | Símbolo + lettering |
| `BootScreen` | `src/components/experience/BootScreen.tsx` | Boot experience |
| `AIStatusBar` | `src/components/experience/AIStatusBar.tsx` | Status IA global |
| `MissionControlPanel` | `src/components/experience/MissionControlPanel.tsx` | Painel executivo |

## Acessibilidade
- Contraste mínimo 4.5:1 para texto body; 3:1 para large.
- `zenno-focus-ring` para foco visível consistente.
- `@media (prefers-reduced-motion: reduce)` desativa todas as animações identitárias.
- ARIA roles em componentes de status (`role="status" aria-live="polite"`).
