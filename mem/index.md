# Project Memory — Zenno SaaS

## Core
Zenno é SaaS multi-tenant B2B (agências + WhatsApp traffic). Desenvolvido no Lovable, mas **sem lock-in** — deploy deve rodar em Docker/Coolify/Railway/Render/Fly/AWS/GCP/DO/Cloudflare.
Nunca hardcode URLs, chaves, tokens, endpoints — sempre `process.env` (server) ou `import.meta.env.VITE_*` (client).
Postgres puro + migrations versionadas em `supabase/migrations/`. RLS obrigatório em 100% das tabelas públicas. Multi-tenant por `organization_id`.
Segredos apenas no backend. Server functions autenticadas via `requireSupabaseAuth`. Rotas `/api/public/*` sempre com validação (HMAC/signature + Zod).
Toda integração externa (Meta, Google, WhatsApp, pagamentos, IA) atrás de camada de abstração — trocar fornecedor sem reescrever consumers.
**REGRA REFORÇADA:** Nenhum módulo novo pode depender diretamente de fornecedor externo (Uazapi, Lovable AI, gateway específico, até Supabase). Consumer sempre importa a interface/provider layer, nunca o SDK/cliente do provider.
Nunca editar arquivos auto-gerados: `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`, `src/routeTree.gen.ts`, `.env` Supabase vars, `supabase/config.toml`.
Antes de criar feature nova: validar se respeita independência de infra, env-vars, RLS, camada de abstração, e observabilidade estruturada.

## Memories
- [Arquitetura de deploy independente](mem://architecture/deploy-independence) — Regras completas de portabilidade, infra, segurança, observabilidade e integrações
