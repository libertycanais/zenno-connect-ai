import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clientIp, rateLimitHit, tooManyRequests } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (errorParam) return redirectTo(`/app/meta-ads?error=${encodeURIComponent(errorParam)}`);
        if (!code || !stateRaw) return redirectTo("/app/meta-ads?error=missing_params");

        // Verify + consume the server-side state nonce
        const { data: stateRow } = await supabaseAdmin
          .from("oauth_states")
          .select("organization_id, user_id, expires_at, consumed_at, provider")
          .eq("state", stateRaw)
          .maybeSingle();
        if (!stateRow || stateRow.provider !== "meta" || stateRow.consumed_at || new Date(stateRow.expires_at) < new Date()) {
          return redirectTo("/app/meta-ads?error=invalid_state");
        }
        await supabaseAdmin.from("oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state", stateRaw);
        const state = { o: stateRow.organization_id, u: stateRow.user_id };

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret) return redirectTo("/app/meta-ads?error=app_not_configured");

        const base = process.env.APP_BASE_URL || `${url.protocol}//${url.host}`;
        const redirectUri = `${base}/api/public/meta/oauth/callback`;

        // 1) trocar code por short-lived token
        const tokenRes = await fetch(
          `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
        );
        const tokenJson = await tokenRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };
        if (!tokenRes.ok || !tokenJson.access_token) {
          return redirectTo(`/app/meta-ads?error=${encodeURIComponent(tokenJson.error?.message || "token_failed")}`);
        }

        // 2) trocar por long-lived (60 dias)
        const llRes = await fetch(
          `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`,
        );
        const llJson = await llRes.json() as { access_token?: string; expires_in?: number };
        const finalToken = llJson.access_token || tokenJson.access_token;
        const expiresIn = llJson.expires_in || tokenJson.expires_in || 60 * 60 * 24 * 60;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // 3) buscar contas de anúncio próprias
        const accRes = await fetch(
          `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,account_id,name,business,currency,account_status&limit=200&access_token=${finalToken}`,
        );
        const accJson = await accRes.json() as { data?: Array<{ account_id: string; name: string; business?: { id: string; name?: string } }> };
        const own = accJson.data ?? [];

        // 4) buscar Business Managers e listar client + owned ad accounts
        const bmRes = await fetch(
          `https://graph.facebook.com/v20.0/me/businesses?fields=id,name&limit=100&access_token=${finalToken}`,
        );
        const bmJson = await bmRes.json().catch(() => ({})) as { data?: Array<{ id: string; name: string }> };
        const businesses = bmJson.data ?? [];

        type Acc = { account_id: string; name: string; business_id: string | null; business_name: string | null; is_client_account: boolean };
        const byAdId = new Map<string, Acc>();
        for (const a of own) {
          byAdId.set(a.account_id, {
            account_id: a.account_id,
            name: a.name,
            business_id: a.business?.id ?? null,
            business_name: a.business?.name ?? null,
            is_client_account: false,
          });
        }
        for (const b of businesses) {
          for (const kind of ["owned_ad_accounts", "client_ad_accounts"] as const) {
            try {
              const r = await fetch(
                `https://graph.facebook.com/v20.0/${b.id}/${kind}?fields=account_id,name&limit=200&access_token=${finalToken}`,
              );
              const j = await r.json() as { data?: Array<{ account_id: string; name: string }> };
              for (const a of j.data ?? []) {
                const existing = byAdId.get(a.account_id);
                byAdId.set(a.account_id, {
                  account_id: a.account_id,
                  name: existing?.name || a.name,
                  business_id: b.id,
                  business_name: b.name,
                  is_client_account: kind === "client_ad_accounts" ? true : existing?.is_client_account ?? false,
                });
              }
            } catch { /* ignore per-business errors */ }
          }
        }

        const accounts = Array.from(byAdId.values());
        if (!accounts.length) return redirectTo("/app/meta-ads?error=no_ad_accounts");

        const rows = accounts.map((a) => ({
          organization_id: state.o,
          ad_account_id: a.account_id,
          name: a.name,
          business_id: a.business_id,
          business_name: a.business_name,
          is_client_account: a.is_client_account,
          is_manager: false,
          access_token: finalToken,
          token_expires_at: expiresAt,
          connected_by: state.u,
          status: "active",
        }));
        const { error } = await supabaseAdmin
          .from("meta_ad_accounts")
          .upsert(rows, { onConflict: "organization_id,ad_account_id" });
        if (error) return redirectTo(`/app/meta-ads?error=${encodeURIComponent(error.message)}`);

        return redirectTo(`/app/meta-ads?connected=${accounts.length}`);
      },
    },
  },
});

function redirectTo(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}
