// P0.6 · Onda 1 — Post Processor
import { describe, expect, it } from "vitest";
import { postProcess, structuredResponseSchema } from "@/lib/ai/post-processor";

describe("Post-Processor", () => {
  it("parses a fenced JSON block", () => {
    const raw = 'Aqui vai:\n```json\n{"summary":"ok","priority":"high","financialImpactCents":1200,"confidence":0.8,"recommendations":[]}\n```';
    const r = postProcess(raw);
    expect(r.summary).toBe("ok");
    expect(r.priority).toBe("high");
    expect(r.financialImpactCents).toBe(1200);
  });

  it("parses a raw JSON object", () => {
    const r = postProcess('{"summary":"raw","priority":"low","confidence":0.4}');
    expect(r.summary).toBe("raw");
    expect(r.recommendations).toEqual([]);
  });

  it("falls back to text-only summary when no JSON", () => {
    const r = postProcess("Apenas texto livre sem estrutura.");
    expect(r.summary).toContain("Apenas texto");
    expect(r.confidence).toBe(0.3);
  });

  it("never throws on malformed JSON", () => {
    expect(() => postProcess("```json\n{not valid}\n```")).not.toThrow();
    const r = postProcess("```json\n{not valid}\n```");
    expect(r.summary).toBeTruthy();
  });

  it("caps summary length at 2000", () => {
    const long = "x".repeat(5000);
    expect(postProcess(long).summary.length).toBeLessThanOrEqual(2000);
  });

  it("schema validates recommendations shape", () => {
    const parsed = structuredResponseSchema.parse({
      summary: "s",
      recommendations: [{ title: "t", detail: "d" }],
    });
    expect(parsed.recommendations[0].effort).toBe("medium");
    expect(parsed.recommendations[0].impact).toBe("medium");
  });
});
