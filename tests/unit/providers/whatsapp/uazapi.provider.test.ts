import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UazapiProvider } from "@/providers/whatsapp/uazapi.provider";
import { ProviderNotConfiguredError } from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("UazapiProvider", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
    vi.stubEnv("UAZAPI_BASE_URL", "https://uazapi.example.com");
    vi.stubEnv("UAZAPI_API_TOKEN", "adm-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has stable name", () => {
    expect(new UazapiProvider().name).toBe("uazapi");
  });

  it("createInstance requires UAZAPI_BASE_URL", async () => {
    vi.stubEnv("UAZAPI_BASE_URL", "");
    await expect(
      new UazapiProvider().createInstance(makeTenantContext().providerContext, { name: "x" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("createInstance requires UAZAPI_API_TOKEN", async () => {
    vi.stubEnv("UAZAPI_API_TOKEN", "");
    await expect(
      new UazapiProvider().createInstance(makeTenantContext().providerContext, { name: "x" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("createInstance parses response", async () => {
    fetchMock.mockResponse("/instance/init", {
      instance: { id: "inst_1", status: "pending" },
    });
    const ref = await new UazapiProvider().createInstance(
      makeTenantContext().providerContext,
      { name: "x" },
    );
    expect(ref).toEqual({ id: "inst_1", status: "pending" });
  });

  it("getInstanceStatus returns 'unknown' on non-ok response (no throw)", async () => {
    fetchMock.mockResponder(/instance\/status/, () => new Response("", { status: 500 }));
    const ref = await new UazapiProvider().getInstanceStatus(
      makeTenantContext().providerContext,
      "inst_1",
    );
    expect(ref.status).toBe("unknown");
  });

  it("getInstanceStatus maps connected + phone", async () => {
    fetchMock.mockResponse(/instance\/status/, { connected: true, phone: "+55" });
    const ref = await new UazapiProvider().getInstanceStatus(
      makeTenantContext().providerContext,
      "inst_1",
    );
    expect(ref).toMatchObject({ status: "connected", phoneNumber: "+55" });
  });

  it("receiveWebhook normalizes message payload", async () => {
    const ev = await new UazapiProvider().receiveWebhook(
      makeTenantContext().providerContext,
      "inst_1",
      { event: "message", data: { fromMe: false, from: "551199", id: "msg1", text: "hi" } },
    );
    expect(ev).toMatchObject({
      instanceId: "inst_1",
      event: "message",
      fromMe: false,
      from: "551199",
      externalId: "msg1",
      text: "hi",
    });
  });

  it("receiveWebhook classifies status/connection events", async () => {
    const status = await new UazapiProvider().receiveWebhook(
      makeTenantContext().providerContext,
      "inst_1",
      { event: "status" },
    );
    expect(status.event).toBe("status");
    const conn = await new UazapiProvider().receiveWebhook(
      makeTenantContext().providerContext,
      "inst_1",
      { event: "connection" },
    );
    expect(conn.event).toBe("connection");
  });

  it("disconnectInstance is best-effort", async () => {
    fetchMock.mockResponder(/disconnect/, () => {
      throw new Error("net");
    });
    await expect(
      new UazapiProvider().disconnectInstance(makeTenantContext().providerContext, "inst_1"),
    ).resolves.toBeUndefined();
  });
});
