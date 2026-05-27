import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/google-ads/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return redir(`/app/google-ads?error=${encodeURIComponent(err)}`);
        if (!code || !stateRaw) return redir("/app/google-ads?error=missing_params");

        const { data: stateRow } = await supabaseAdmin
          .from("oauth_states")
          .select("organization_id, user_id, expires_at, consumed_at, provider")
          .eq("state", stateRaw)
          .maybeSingle();
        if (!stateRow || stateRow.provider !== "google_ads" || stateRow.consumed_at || new Date(stateRow.expires_at) < new Date()) {
          return redir("/app/google-ads?error=invalid_state");
        }
        await supabaseAdmin.from("oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state", stateRaw);
        const state = { o: stateRow.organization_id, u: stateRow.user_id };

        const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
        if (!clientId || !clientSecret) return redir("/app/google-ads?error=app_not_configured");

        const base = process.env.APP_BASE_URL || `${url.protocol}//${url.host}`;
        const redirectUri = `${base}/api/public/google-ads/oauth/callback`;

        // exchange code
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: "authorization_code",
          }),
        });
        const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
        if (!tokenRes.ok || !tokens.access_token) {
          return redir(`/app/google-ads?error=${encodeURIComponent(tokens.error || "token_failed")}`);
        }
        const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

        // list accessible customers
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!devToken) return redir("/app/google-ads?error=missing_dev_token");

        const listRes = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, "developer-token": devToken },
        });
        const listJson = await listRes.json() as { resourceNames?: string[] };
        const ids = (listJson.resourceNames ?? []).map((rn) => rn.split("/")[1]).filter(Boolean);
        if (!ids.length) return redir("/app/google-ads?error=no_customers");

        const rows = ids.map((cid) => ({
          organization_id: state.o,
          customer_id: cid,
          name: `Customer ${cid}`,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          connected_by: state.u,
          status: "active",
        }));
        const { error } = await supabaseAdmin
          .from("google_ad_accounts")
          .upsert(rows, { onConflict: "organization_id,customer_id" });
        if (error) return redir(`/app/google-ads?error=${encodeURIComponent(error.message)}`);

        return redir(`/app/google-ads?connected=${ids.length}`);
      },
    },
  },
});

function redir(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}
