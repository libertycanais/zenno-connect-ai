# Runbook — OAuth (Meta / Google)

## Sintomas
- Contas OAuth conectadas param de sincronizar.
- Erro `invalid_grant` / `token_expired` nos logs.
- Usuário reporta "reconectar conta Meta/Google".

## Diagnóstico
1. Verificar `meta_ad_accounts` / `google_ad_accounts`:
   ```sql
   SELECT id, organization_id, expires_at, updated_at
   FROM meta_ad_accounts
   WHERE expires_at < now();
   ```
2. Logs por `event=oauth.callback` e `event=oauth.refresh`.
3. Verificar `META_APP_ID`, `META_APP_SECRET`, `GOOGLE_ADS_CLIENT_ID`,
   `GOOGLE_ADS_CLIENT_SECRET` no cofre e nas env vars atuais.
4. Testar callback manual:
   `GET /api/public/meta/oauth/callback?code=...&state=<válido>`.

## Logs relevantes
- `event=oauth.callback.received`
- `event=oauth.callback.rejected` (com `reason`)
- `event=oauth.refresh.failed`
- `event=oauth.state.invalid`

## Causa provável
- Refresh token revogado pelo usuário no provedor.
- `client_secret` alterado sem atualizar cofre.
- Redirect URI divergente entre app e console do provedor.
- Escopo faltante (usuário revogou permissão).
- Rate limit no endpoint de token do provedor.

## Correção
- Reautorizar conta (fluxo manual via UI do painel).
- Sincronizar `client_secret` entre cofre, env e console do provedor.
- Ajustar redirect URI e reconectar.
- Solicitar escopos corretos (ver `docs/ENGINEERING_HANDBOOK.md` §5).

## Rollback
- Reverter alteração recente em `META_APP_*` / `GOOGLE_ADS_*`.
- Restaurar redirect URI anterior no console do provedor.

## Validação
- Fluxo end-to-end: iniciar OAuth → callback → registrar em `audit_log`.
- Job de sync roda sem erro em < 5 min.
