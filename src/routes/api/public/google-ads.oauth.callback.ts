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

        // For each accessible customer, discover metadata + child accounts if it's a manager (MCC).
        type Row = {
          organization_id: string; customer_id: string; name: string;
          descriptive_name?: string | null; currency?: string | null; timezone?: string | null;
          manager_customer_id?: string | null; is_manager?: boolean;
          access_token: string; refresh_token: string | null; token_expires_at: string;
          connected_by: string; status: string;
        };
        const rows: Row[] = [];

        for (const cid of ids) {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${tokens.access_token}`,
            "developer-token": devToken,
            "Content-Type": "application/json",
            "login-customer-id": cid,
          };
          // Get self info
          let isManager = false;
          let selfName = `Customer ${cid}`;
          let currency: string | null = null;
          let timezone: string | null = null;
          try {
            const selfRes = await fetch(
              `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
              {
                method: "POST", headers,
                body: JSON.stringify({
                  query: "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.time_zone FROM customer LIMIT 1",
                }),
              },
            );
            const selfJson = await selfRes.json() as { results?: Array<{ customer?: { descriptive_name?: string; manager?: boolean; currency_code?: string; time_zone?: string } }> };
            const c = selfJson.results?.[0]?.customer;
            if (c) {
              isManager = Boolean(c.manager);
              selfName = c.descriptive_name || selfName;
              currency = c.currency_code ?? null;
              timezone = c.time_zone ?? null;
            }
          } catch { /* ignore, keep defaults */ }

          rows.push({
            organization_id: state.o,
            customer_id: cid,
            name: selfName,
            descriptive_name: selfName,
            currency, timezone,
            manager_customer_id: null,
            is_manager: isManager,
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token ?? null,
            token_expires_at: expiresAt,
            connected_by: state.u,
            status: "active",
          });

          // If manager, enumerate children
          if (isManager) {
            try {
              const childRes = await fetch(
                `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
                {
                  method: "POST", headers,
                  body: JSON.stringify({
                    query: "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1",
                  }),
                },
              );
              const childJson = await childRes.json() as { results?: Array<{ customerClient?: { clientCustomer?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean; level?: number; status?: string } }> };
              for (const r of childJson.results ?? []) {
                const cc = r.customerClient;
                if (!cc?.clientCustomer) continue;
                const childId = cc.clientCustomer.split("/")[1];
                if (!childId || childId === cid) continue;
                if (cc.status && cc.status !== "ENABLED") continue;
                rows.push({
                  organization_id: state.o,
                  customer_id: childId,
                  name: cc.descriptiveName || `Customer ${childId}`,
                  descriptive_name: cc.descriptiveName ?? null,
                  currency: cc.currencyCode ?? null,
                  timezone: cc.timeZone ?? null,
                  manager_customer_id: cid,
                  is_manager: Boolean(cc.manager),
                  access_token: tokens.access_token!,
                  refresh_token: tokens.refresh_token ?? null,
                  token_expires_at: expiresAt,
                  connected_by: state.u,
                  status: "active",
                });
              }
            } catch { /* ignore */ }
          }
        }
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
