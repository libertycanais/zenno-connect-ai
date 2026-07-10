// Signal Dispatcher — routes signals to recommended Experts.
import type { BusinessSignal } from "../signals/types";
import type { DispatchTarget } from "./types";

export type ExpertHandler = (signal: BusinessSignal) => Promise<void> | void;

export class SignalDispatcher {
  private handlers = new Map<string, ExpertHandler>();
  register(expert: string, handler: ExpertHandler): void { this.handlers.set(expert, handler); }
  targets(signal: BusinessSignal): DispatchTarget[] {
    return signal.recommendedExperts.map(expert => ({ expert, signal }));
  }
  async dispatch(signal: BusinessSignal): Promise<{ delivered: string[]; skipped: string[] }> {
    const delivered: string[] = []; const skipped: string[] = [];
    for (const t of this.targets(signal)) {
      const h = this.handlers.get(t.expert);
      if (!h) { skipped.push(t.expert); continue; }
      try { await h(signal); delivered.push(t.expert); } catch { skipped.push(t.expert); }
    }
    return { delivered, skipped };
  }
}
