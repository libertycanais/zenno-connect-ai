import { describe, it, expect } from "vitest";
import {
  InMemoryTelemetrySink, NoopTelemetrySink, buildTelemetryEvent,
} from "@/lib/ai/telemetry";

describe("telemetry contracts", () => {
  it("NoopTelemetrySink accepts events silently", () => {
    const sink = new NoopTelemetrySink();
    expect(() => sink.emit(buildTelemetryEvent("PlannerStarted", {
      organizationId: "org-1", userId: "user-1",
    }))).not.toThrow();
  });

  it("InMemoryTelemetrySink buffers and drains", () => {
    const sink = new InMemoryTelemetrySink(2);
    sink.emit(buildTelemetryEvent("PlannerStarted", { organizationId: "o", userId: "u" }));
    sink.emit(buildTelemetryEvent("PlannerFinished", { organizationId: "o", userId: "u" }));
    sink.emit(buildTelemetryEvent("WorkflowStarted", { organizationId: "o", userId: "u" }));
    expect(sink.size()).toBe(2); // capacity bound
    const drained = sink.drain();
    expect(drained.length).toBe(2);
    expect(sink.size()).toBe(0);
  });

  it("peek filters by name", () => {
    const sink = new InMemoryTelemetrySink();
    sink.emit(buildTelemetryEvent("ProviderSelected", { organizationId: "o", userId: "u" }));
    sink.emit(buildTelemetryEvent("PlannerStarted", { organizationId: "o", userId: "u" }));
    expect(sink.peek("ProviderSelected").length).toBe(1);
  });
});
