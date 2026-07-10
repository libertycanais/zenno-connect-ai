# Zenno · Logo Guidelines (PX 1.2)

## Conceitos avaliados

### Proposta A — **Aperture Z** ✅ ESCOLHIDA
Monograma Z geométrico dentro de um anel de abertura + ponto-sinal.
- **Geometria:** 3 traços de igual peso (5u em grid 64u), terminações arredondadas, anel 1.5u.
- **Conceito:** foco (aperture) + fluxo (Z) + telemetria viva (dot).
- **Mensagem:** precisão enterprise com IA sempre ativa.
- **Motivo da escolha:** reconhecível a 16px (favicon), funciona mono/gradient/outline, escala para splash.

### Proposta B — **Zenith Grid**
Z formado por linhas de grid ascendente. Muito bonito em splash, mas ilegível abaixo de 24px.

### Proposta C — **Prism Fold**
Z como fita dobrada em prisma tricolor. Excelente para brand marketing, fraco em favicon/dark UI.

### Proposta D — **Signal Node**
Nó central com 3 vetores saindo em Z. Conceito forte de "hub inteligente", mas confunde-se com marcas de VPN/rede.

### Proposta E — **Serif Zenno**
Wordmark serifado luxo. Perde tom tech; descartada.

## Composições oficiais (Proposta A)
| Variante | Uso |
|----------|-----|
| **Símbolo (gradient)** | App icon, splash, boot, avatar, favicon 32/64/128 |
| **Símbolo (mono)** | Emails transacionais, PDFs institucionais |
| **Símbolo (outline)** | Sobre fotografia ou vídeo |
| **Wordmark horizontal** | Header, footer, documentos |
| **Wordmark vertical** | Splash, materiais impressos |
| **Minimalista** | Watermarks, background sutil |
| **Premium (gradient + glow)** | Boot Screen, lançamentos |

## Componentes React
```tsx
import { ZennoMark, ZennoWordmark } from "@/components/brand/ZennoMark";

<ZennoMark className="h-8 w-8" />                 // gradient (default)
<ZennoMark variant="mono" className="h-6 w-6" />  // uso mono
<ZennoWordmark />                                 // símbolo + lettering
```

## Clear-space
Mínimo = altura do símbolo em todos os lados. Nunca aplicar sobre elementos com contraste < 4.5:1.

## Tamanhos mínimos
- Digital: **16px** (favicon), **24px** (nav), **32px** (padrão).
- Splash / Boot: **≥ 96px**.

## Cores permitidas
- **Gradient oficial:** `linear-gradient(135deg, #0EA5FF → #7C3AED)`.
- **Mono claro:** `#F5F9FC` sobre Surface 0/1.
- **Mono escuro:** `#050B14` sobre superfície clara.

## Proibido
- ❌ Rotacionar, espelhar, distorcer, aplicar bevel/emboss.
- ❌ Recolorir o ponto-sinal (deve seguir o gradiente ou mono).
- ❌ Colocar o símbolo sem clear-space.
- ❌ Substituir o wordmark por outra fonte.

## Downloads / referências
- Fonte de verdade: `src/components/brand/ZennoMark.tsx` (SVG inline).
- Para geração de PNG/ICO — exportar via headless SVG rasterizer usando a mesma viewBox (64×64).
