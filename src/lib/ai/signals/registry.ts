// Signal Detector Registry (in-memory, additive).
import type { SignalDetector, SignalType } from "./types";
import { builtInDetectors } from "./detector";

export class SignalRegistry {
  private detectors = new Map<string, SignalDetector>();
  constructor(seed: SignalDetector[] = builtInDetectors) {
    for (const d of seed) this.register(d);
  }
  register(d: SignalDetector): void { this.detectors.set(d.id, d); }
  unregister(id: string): void { this.detectors.delete(id); }
  get(id: string): SignalDetector | undefined { return this.detectors.get(id); }
  list(): SignalDetector[] { return [...this.detectors.values()]; }
  byType(type: SignalType): SignalDetector[] { return this.list().filter(d => d.type === type); }
  byCadence(cadence: SignalDetector["cadence"]): SignalDetector[] { return this.list().filter(d => d.cadence === cadence); }
}

export const signalRegistry = new SignalRegistry();
