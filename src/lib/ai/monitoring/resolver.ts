// Marks signals as resolved/suppressed. Pure state map, no I/O.
import type { BusinessSignal, SignalStatus } from "../signals/types";

export class SignalResolver {
  private states = new Map<string, SignalStatus>();
  set(signalId: string, status: SignalStatus): void { this.states.set(signalId, status); }
  get(signalId: string): SignalStatus | undefined { return this.states.get(signalId); }
  apply(signal: BusinessSignal): BusinessSignal {
    const st = this.states.get(signal.id);
    return st ? { ...signal, status: st } : signal;
  }
  reset(): void { this.states.clear(); }
}
