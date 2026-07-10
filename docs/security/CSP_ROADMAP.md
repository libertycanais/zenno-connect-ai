# CSP Enterprise — Roadmap de Endurecimento (RC1.3)

> **Status:** Report-only recomendado como próximo passo. Enforce condicionado a validação de nonces em Vite/React 19.

## Objetivo
Bloquear XSS, injection e leaks de dados via header `Content-Security-Policy` (CSP) mantendo compatibilidade com preview iframe do Lovable.

## Estratégia em 3 ondas

### Onda 1 — Baseline Report-Only (recomendada para RC2)
Publicar `Content-Security-Policy-Report-Only` sem quebrar o app, apenas coletando violações.

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src  'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src   'self' https://fonts.gstatic.com data:;
  img-src    'self' data: blob: https:;
  connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com https://ai.gateway.lovable.dev;
  frame-ancestors 'self' https://*.lovable.dev https://*.lovable.app;
  base-uri 'self';
  form-action 'self';
  report-uri /api/public/csp-report
```

**Nota crítica:** `frame-ancestors` inclui `*.lovable.dev/*.lovable.app` para preservar o preview do editor. Nunca usar `frame-ancestors 'none'` ou `X-Frame-Options: DENY` — quebraria o preview.

### Onda 2 — Enforce com nonce por request
- Gerar `nonce` por request no `__root` head.
- Trocar `'unsafe-inline'` em `script-src` por `'nonce-<nonce>'`.
- Adotar `strict-dynamic` para bibliotecas dinâmicas confiáveis.

### Onda 3 — Trusted Types + isolation
- `require-trusted-types-for 'script'`.
- `trusted-types default zenno#*`.
- Endpoint interno (`/api/public/csp-report`) para telemetria.

## Compatibilidade com Freeze v1.0
- ✅ 100% aditivo — não altera contratos.
- ✅ Não modifica RLS, Provider Layer, nem Server Functions existentes.
- ⚠️ Onda 2/3 exigirá coordenação com Vite plugin (react + tailwind) para injeção de nonce.

## Métricas
- Violations/dia (report-uri).
- Taxa de bloqueio pós-enforce.
- Latência adicional de header (< 0.1 ms).
