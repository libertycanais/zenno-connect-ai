// Signal Engine — runs registered detectors against inputs and yields normalized signals.
import type { BusinessSignal, SignalDetectorInput } from "./types";
import { SignalRegistry, signalRegistry } from "./registry";
import { normalizeSignal } from "./normalizer";

export type SignalEngineOptions = {
  registry?: SignalRegistry;
  cadence?: "hourly" | "daily" | "weekly" | "monthly" | "on-event";
};

export class SignalEngine {
  constructor(private readonly registry: SignalRegistry = signalRegistry) {}

  run(input: SignalDetectorInput, opts: SignalEngineOptions = {}): BusinessSignal[] {
    const list = opts.cadence ? this.registry.byCadence(opts.cadence) : this.registry.list();
    const out: BusinessSignal[] = [];
    for (const detector of list) {
      try {
        const partial = detector.detect(input);
        if (!partial) continue;
        out.push(normalizeSignal(detector, input, partial as never));
      } catch { /* isolated; a broken detector never affects others */ }
    }
    return out;
  }
}

export const signalEngine = new SignalEngine();
