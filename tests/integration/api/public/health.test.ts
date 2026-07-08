import { describe, expect, it } from "vitest";
import { Route as LiveRoute } from "@/routes/api/public/live";
import { Route as HealthRoute } from "@/routes/api/public/health";
import { invokeHandler } from "@tests/helpers/route";
import { makeRequest } from "@tests/helpers/http";

describe("GET /api/public/live", () => {
  it("returns 200 with status ok + timestamp (no dependency checks)", async () => {
    const res = await invokeHandler(LiveRoute, "GET", makeRequest("http://x/api/public/live"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("GET /api/public/health", () => {
  it("returns 200 with service/version/environment/uptime", async () => {
    const res = await invokeHandler(HealthRoute, "GET", makeRequest("http://x/api/public/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.service).toBe("string");
    expect(typeof body.version).toBe("string");
    expect(typeof body.environment).toBe("string");
    expect(typeof body.uptime_seconds).toBe("number");
    expect(body.timestamp).toBeDefined();
  });
});
