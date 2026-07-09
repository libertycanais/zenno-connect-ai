import { describe, expect, it } from "vitest";
import { validateResponse, redactSecrets } from "@/lib/ai/validators/response";

describe("validateResponse", () => {
  it("passes clean text", () => {
    const r = validateResponse({ text: "Suas campanhas têm CTR de 2,3%." });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("flags empty response", () => {
    const r = validateResponse({ text: "   \n  " });
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe("EMPTY");
  });

  it("flags refusal boilerplate", () => {
    const r = validateResponse({ text: "Desculpe, não posso ajudar com isso." });
    expect(r.issues.some((i) => i.code === "REFUSAL")).toBe(true);
  });

  it("flags <untrusted> echo (prompt injection leak)", () => {
    const r = validateResponse({ text: "resposta <untrusted>lixo</untrusted>" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "INJECTION_ECHO")).toBe(true);
  });

  it("flags leaked secrets", () => {
    const r = validateResponse({ text: "use sk-abcdef1234567890ABCDEF12345 to auth" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "SECRET_LEAK")).toBe(true);
  });

  it("flags invalid JSON when jsonMode requested", () => {
    const r = validateResponse({ text: "not json", jsonMode: true });
    expect(r.issues.some((i) => i.code === "INVALID_JSON")).toBe(true);
  });

  it("accepts valid JSON when jsonMode requested", () => {
    const r = validateResponse({ text: '{"a":1}', jsonMode: true });
    expect(r.ok).toBe(true);
  });

  it("flags unauthorized tool calls", () => {
    const r = validateResponse({ text: "ok", allowedToolNames: ["a", "b"], toolCallNames: ["c"] });
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe("UNAUTHORIZED_TOOL");
  });

  it("redactSecrets masks known patterns", () => {
    const out = redactSecrets("token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    expect(out).toContain("[REDACTED]");
  });
});
