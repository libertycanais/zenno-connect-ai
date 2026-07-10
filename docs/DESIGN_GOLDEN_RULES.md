# Zenno Design System v1.0 — LOCKED

> **Status:** 🔒 LOCKED · **Marco:** GA-ready · **Autoridade:** CTO
> A partir deste ponto, nenhum componente novo entra no sistema sem seguir
> estas regras. Alterações exigem RFC baseado em dados do RC2.

---

## 0. Regra de ouro

**Pare de construir telas. Comece a construir experiências.**

Toda tela responde a **uma pergunta única do usuário** antes de mostrar dados.
A IA responde primeiro. Os dados vêm depois.

Exemplos canônicos:
- Financeiro → "Como está meu caixa?"
- Marketing → "Onde estou queimando dinheiro?"
- Sales → "Quem devo priorizar hoje?"
- Executive → "O que preciso decidir agora?"

Se uma tela nova não tem pergunta clara, ela não entra.

---

## 1. Spacing (escala única)

**Permitido:** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`

**Proibido:** qualquer outro valor (13, 19, 27, 43, etc.).

Tailwind: use apenas `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24`. Arbitrary
values `[13px]` requerem RFC.

---

## 2. Radius (três tamanhos, ponto final)

| Token | Valor | Uso |
|---|---|---|
| **sm** | `10px` | Chips, badges, inputs pequenos |
| **md** | `16px` | Botões, inputs, cards padrão |
| **lg** | `24px` | Modais, drawers, painéis premium |

Nada de 12, 14, 18, 22. Se um componente pede outro valor, ele está errado.

---

## 3. Motion (durações canônicas)

| Interação | Duração | Easing |
|---|---|---|
| Tooltip | **120ms** | `--zenno-ease-standard` |
| Hover | **180ms** | `--zenno-ease-standard` |
| Copilot | **220ms** | `--zenno-ease-emphasized` |
| Drawer | **250ms** | `--zenno-ease-emphasized` |
| Modal | **300ms** | `--zenno-ease-emphasized` |
| Page transition | **350ms** | `--zenno-ease-emphasized` |

Toda animação deve respeitar `prefers-reduced-motion: reduce`.
Sem exceções. Sem `ease-in-back`, sem bounces agressivos.

---

## 4. Elevation (quatro níveis, apenas)

| Nível | Uso |
|---|---|
| **elev-0** | Superfície plana (background) |
| **elev-1** | Card padrão em repouso |
| **elev-2** | Card em hover, drawer, popover |
| **elev-3** | Modal, command palette, boot overlay |

Zero sombras "customizadas por componente". Se precisar de algo entre
níveis, escolha o mais próximo.

---

## 5. Typography (seis variantes, fim)

| Variante | Uso |
|---|---|
| **Hero** | Landing / login showcase |
| **Display** | Boot, splash, momento cinematográfico |
| **H1** | Título de página |
| **H2** | Título de seção |
| **Body** | Texto padrão |
| **Caption** | Metadata, timestamps, labels auxiliares |

Nada além disso. Sem H3/H4/H5/H6, sem "small-body", sem "large-caption".

---

## 6. Color (paleta congelada)

Somente tokens semânticos definidos em `src/styles.css`:

- Superfícies: `background · card · popover · sidebar · muted · secondary`
- Ação: `primary · accent · destructive`
- Texto: `foreground · muted-foreground`
- Marca: `--zenno-brand-primary · --zenno-brand-accent`

**Proibido:** `bg-blue-500`, `text-white`, `#7C3AED`, gradientes ad-hoc.
Todo novo uso de cor deve resolver para um token existente.

---

## 7. Interaction (padrões únicos)

- **Focus:** sempre `.zenno-focus-ring` — não usar outline default.
- **Hover:** apenas alterações permitidas por tokens (fundo, cor, escala 1.08 máx).
- **Active:** barra luminosa lateral (padrão premium navigation).
- **Loading:** `zenno-shimmer` (AI) · skeleton (dados) · `zenno-progress-indeterminate` (sem %).
- **Empty state:** título + subtítulo + 1 CTA · nunca só "Nenhum dado".
- **Error:** mensagem humana + ação de recuperação · nunca stack trace.

---

## 8. O que está permitido daqui em diante

- ✅ Ajustes de acessibilidade (contraste, ARIA, foco, teclado)
- ✅ Correções de UX descobertas no piloto RC2
- ✅ Bugs visuais (overflow, misalignment, z-index)
- ✅ Otimizações de performance (CLS, LCP, INP)

## 9. O que está proibido sem RFC

- ❌ Novos estilos (utilitários, animações, sombras)
- ❌ Novas cores (mesmo tons)
- ❌ Novas tipografias ou tamanhos
- ❌ Novos padrões de componentes
- ❌ Novos sistemas de navegação
- ❌ Novas microinterações
- ❌ Ícones fora do lucide-react
- ❌ Bibliotecas de UI adicionais

**RFC obrigatório** com: Problema · Evidências (dados RC2) · Impacto ·
ROI · Alternativas rejeitadas.

---

## 10. Checklist de aceitação para todo componente novo

Antes de merge, o componente deve marcar **todos**:

- [ ] Spacing usa apenas a escala permitida
- [ ] Radius é `sm`, `md` ou `lg`
- [ ] Animações usam durações canônicas
- [ ] Elevation é `0-3`
- [ ] Tipografia é uma das 6 variantes
- [ ] Cor é 100% token semântico
- [ ] Focus ring aplicado
- [ ] `prefers-reduced-motion` respeitado
- [ ] Empty state definido
- [ ] Loading state definido
- [ ] Error state definido
- [ ] Responde a **uma pergunta** clara do usuário

Componente que não passa não entra em produção.

---

## 11. Governança

- **Owner:** CTO
- **Revisor obrigatório em RFCs:** UI Architect + Product
- **Cadência de revisão:** somente quando RC2 produzir evidência
- **Marco de descongelamento:** GA v1.0 aprovado + 30 dias de piloto

---

## 12. Prioridade pós-freeze

Design está congelado. Investimento agora vai para:

1. **Site institucional** — nível HubSpot / Salesforce / Monday
2. **Vídeo oficial de demonstração** — 2-3 min mostrando IA em ação
3. **Casos de sucesso do piloto RC2** — evidências reais de valor

Interface refinada não vende software. Valor comprovado vende.
