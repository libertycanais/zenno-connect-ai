# UI Consistency Guide (RC1.11)

> Padrões visuais consolidados durante o backlog RC1. Additive — não substitui shadcn primitives, apenas convenciona uso.

## Card Padding

| Contexto | Padding | Motivo |
|----------|---------|--------|
| **Superfícies principais** (dashboard cards, seções raiz) | `p-6` | Respiro visual + hierarquia clara |
| **Widgets embarcados** (WidgetContainer, KPI tiles) | `p-4` | Densidade de informação |
| **Modais e drawers** | `p-6` | Foco em ação única |
| **Tabelas dentro de cards** | `p-0` no CardContent + `px-6 py-4` na tabela | Alinhamento com bordas |
| **Cards compactos em listas** | `p-3` | Escaneabilidade |

## Espaçamento Vertical

- Entre seções: `space-y-6`
- Entre subseções: `space-y-4`
- Dentro de forms: `space-y-3`

## Tipografia

- Título de página: `text-2xl font-semibold`
- Título de card: `text-sm font-semibold` (compactos) ou `text-lg` (destaque)
- Subtítulo: `text-xs text-muted-foreground`

## Cores (tokens semânticos apenas)

- Fundos: `bg-background`, `bg-card`, `bg-muted`
- Texto: `text-foreground`, `text-muted-foreground`
- Estados: `text-destructive`, `text-primary`, `bg-primary/10`
- **PROIBIDO:** classes hard-coded (`bg-blue-500`, `text-red-600`, etc.)

## Estados

- **Loading** — Skeleton com altura fixa (evita CLS).
- **Empty** — Mensagem centralizada `text-sm text-muted-foreground py-6`.
- **Error** — Border `border-destructive/40` + `bg-destructive/5`.

## Ícones
- Tamanho padrão inline: `h-4 w-4`.
- Sempre acompanhados de `aria-label` ou texto adjacente.
