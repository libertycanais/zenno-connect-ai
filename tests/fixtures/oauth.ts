import { uuid } from "@tests/helpers/id";

export type OAuthConnectionFixture = {
  id: string;
  organization_id: string;
  provider: "meta" | "google_ads";
  external_account_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
  created_at: string;
};

export function oauthConnectionFixture(
  overrides: Partial<OAuthConnectionFixture> = {},
): OAuthConnectionFixture {
  const id = overrides.id ?? uuid("oauth");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    provider: overrides.provider ?? "meta",
    external_account_id: overrides.external_account_id ?? "act_1234567890",
    access_token: overrides.access_token ?? "test-access-token-not-real",
    refresh_token: overrides.refresh_token ?? "test-refresh-token-not-real",
    expires_at:
      overrides.expires_at ?? new Date(Date.now() + 3_600_000).toISOString(),
    scopes: overrides.scopes ?? ["ads_read", "ads_management"],
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

export type OAuthCallbackFixture = {
  code: string;
  state: string;
  redirect_uri: string;
};

export function oauthCallbackFixture(
  overrides: Partial<OAuthCallbackFixture> = {},
): OAuthCallbackFixture {
  return {
    code: overrides.code ?? "test-oauth-code",
    state: overrides.state ?? uuid("state"),
    redirect_uri: overrides.redirect_uri ?? "https://app.example.com/oauth/callback",
  };
}
