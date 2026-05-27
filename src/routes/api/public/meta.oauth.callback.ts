import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        let state: { o: string; u: string; s: string };
        try {
          state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
        } catch {
          return redirectTo("/app/meta-ads?error=invalid_state");
        }

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

        // 3) buscar contas de anúncio
        const accRes = await fetch(
          `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,account_id,name,business&limit=100&access_token=${finalToken}`,
        );
        const accJson = await accRes.json() as { data?: Array<{ account_id: string; name: string; business?: { id: string } }> };
        const accounts = accJson.data ?? [];
        if (!accounts.length) return redirectTo("/app/meta-ads?error=no_ad_accounts");

        const rows = accounts.map((a) => ({
          organization_id: state.o,
          ad_account_id: a.account_id,
          name: a.name,
          business_id: a.business?.id ?? null,
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
