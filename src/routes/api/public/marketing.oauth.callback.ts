// FEATURE — Marketing Platform · Unified OAuth Callback
// Handles: state validation → token exchange → encrypt → upsert connection → redirect to Wizard.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clientIp, rateLimitHit, tooManyRequests } from "@/lib/rate-limit.server";
import { hashState, encryptToken } from "@/lib/marketing/marketing-security.server";
import { getConnector } from "@/lib/marketing/registry/connector-registry";
import { getCapability } from "@/lib/marketing/registry/capability-registry";
import type { MarketingProvider } from "@/lib/marketing";

function redir(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

export const Route = createFileRoute("/api/public/marketing/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ip = clientIp(request);
        const stateRaw = url.searchParams.get("state") ?? "";
        const [ipHit, stateHit] = await Promise.all([
          rateLimitHit(`mkt-oauth:${ip}`, 20, 60),
          stateRaw ? rateLimitHit(`mkt-oauth:${stateRaw}`, 3, 60) : Promise.resolve({ limited: false }),
        ]);
        if (ipHit.limited || stateHit.limited) return tooManyRequests(60);

        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        if (err) return redir(`/app/marketing/connect?error=${encodeURIComponent(err)}`);
        if (!code || !stateRaw) return redir("/app/marketing/connect?error=missing_params");

        // Validate state (hash-lookup)
        const stateHash = hashState(stateRaw);
        const { data: stateRow } = await supabaseAdmin
          .from("marketing_oauth_states")
          .select("id, organization_id, user_id, provider, redirect_after, expires_at, consumed_at")
          .eq("state_hash", stateHash)
          .maybeSingle();

        if (!stateRow || stateRow.consumed_at || new Date(stateRow.expires_at) < new Date()) {
          return redir("/app/marketing/connect?error=invalid_state");
        }
        await supabaseAdmin.from("marketing_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("id", stateRow.id);

        const provider = stateRow.provider as MarketingProvider;
        const cap = getCapability(provider);
        if (!cap.enabled) return redir("/app/marketing/connect?error=provider_disabled");

        const base = process.env.APP_BASE_URL || `${url.protocol}//${url.host}`;
        const redirectUri = `${base}/api/public/marketing/oauth/callback`;

        // Exchange code
        let tokens;
        try {
          const connector = getConnector(provider);
          tokens = await connector.exchangeCode({ code, redirectUri });
        } catch (e) {
          return redir(`/app/marketing/connect?error=${encodeURIComponent(e instanceof Error ? e.message : "token_failed")}`);
        }

        // Encrypt tokens
        const enc = encryptToken(tokens.accessToken);
        const encRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

        // Optional: fetch userinfo for display name (Google only, best-effort)
        let displayName = `${cap.label} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
        if (provider === "google") {
          try {
            const uiRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            if (uiRes.ok) {
              const ui = (await uiRes.json()) as { email?: string; name?: string };
              if (ui.email) displayName = ui.email;
              else if (ui.name) displayName = ui.name;
            }
          } catch { /* ignore */ }
        }

        // Upsert connection
        const { data: conn, error: upErr } = await supabaseAdmin
          .from("marketing_connections")
          .upsert({
            organization_id: stateRow.organization_id,
            provider,
            display_name: displayName,
            status: "active",
            scopes: tokens.scopes ?? cap.scopes,
            credentials_ciphertext: enc.ciphertext,
            credentials_nonce: enc.nonce,
            refresh_ciphertext: encRefresh?.ciphertext ?? null,
            refresh_nonce: encRefresh?.nonce ?? null,
            token_expires_at: tokens.expiresAt ?? null,
            connected_by: stateRow.user_id,
            last_error: null,
          }, { onConflict: "organization_id,provider,display_name" })
          .select("id")
          .single();

        if (upErr || !conn) {
          return redir(`/app/marketing/connect?error=${encodeURIComponent(upErr?.message || "upsert_failed")}`);
        }

        // Timeline: connection.succeeded (best-effort)
        await supabaseAdmin.from("marketing_timeline_events").insert({
          organization_id: stateRow.organization_id,
          connection_id: conn.id,
          provider,
          event_type: "connection.succeeded",
          severity: "success",
          payload: { display_name: displayName, scopes: (tokens.scopes ?? cap.scopes).length },
          occurred_at: new Date().toISOString(),
        });

        // Redirect ALWAYS to wizard (never to a dashboard)
        const target = stateRow.redirect_after || "/app/marketing/connect";
        const finalUrl = `${target}${target.includes("?") ? "&" : "?"}connectionId=${conn.id}&provider=${provider}&status=connected`;
        return redir(finalUrl);
      },
    },
  },
});
