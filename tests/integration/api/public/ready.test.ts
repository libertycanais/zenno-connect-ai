import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { invokeHandler } from "@tests/helpers/route";
import { makeRequest } from "@tests/helpers/http";

describe("GET /api/public/ready", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("marks postgres as skipped and redis as skipped when no credentials — still ready", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("REDIS_URL", "");
    const { Route } = await import("@/routes/api/public/ready");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/ready"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: { postgres: { status: string }; redis: { status: string } };
    };
    expect(body.status).toBe("ready");
    expect(body.checks.postgres.status).toBe("skipped");
    expect(body.checks.redis.status).toBe("skipped");
  });

  it("returns 200 when postgres responds (RLS-blocked SELECT counts as alive)", async () => {
    vi.stubEnv("SUPABASE_URL", "https://sb.example.com");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "pk_x");
    // supabase-js uses fetch under the hood; we mock the PostgREST endpoint.
    fetchMock.mockResponder(/\/rest\/v1\/organizations/, () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { Route } = await import("@/routes/api/public/ready");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/ready"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ready");
  });

  it("returns 503 when postgres check fails with a non-RLS error", async () => {
    vi.stubEnv("SUPABASE_URL", "https://sb.example.com");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "pk_x");
    fetchMock.mockResponder(/\/rest\/v1\/organizations/, () =>
      new Response(JSON.stringify({ message: "network is unreachable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const { Route } = await import("@/routes/api/public/ready");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/ready"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; checks: { postgres: { status: string } } };
    expect(body.status).toBe("not_ready");
    expect(body.checks.postgres.status).toBe("fail");
  });

  it("reports redis 'skipped' with reason 'not_wired_yet' when REDIS_URL is set", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("REDIS_URL", "redis://x");
    const { Route } = await import("@/routes/api/public/ready");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/ready"));
    const body = (await res.json()) as { checks: { redis: { status: string; error?: string } } };
    expect(body.checks.redis.status).toBe("skipped");
    expect(body.checks.redis.error).toBe("not_wired_yet");
  });
});
