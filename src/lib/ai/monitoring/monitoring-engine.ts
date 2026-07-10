// Monitoring Engine — orchestrates Scheduler → SignalEngine → Dedup/Cooldown → Dispatcher.
import { SignalEngine } from "../signals/signal-engine";
import { SignalScheduler } from "./scheduler";
import { SignalDispatcher } from "./dispatcher";
import { SignalDeduplicator } from "./deduplicator";
import { SignalCooldown } from "./cooldown";
import { SignalHistory } from "./history";
import { SignalResolver } from "./resolver";
import type { MonitoringCadence, MonitoringRun } from "./types";
import type { BusinessSignal } from "../signals/types";

export class MonitoringEngine {
  readonly scheduler: SignalScheduler;
  readonly dispatcher: SignalDispatcher;
  readonly dedup: SignalDeduplicator;
  readonly cooldown: SignalCooldown;
  readonly history: SignalHistory;
  readonly resolver: SignalResolver;

  constructor(
    private readonly engine: SignalEngine = new SignalEngine(),
    scheduler = new SignalScheduler(),
    dispatcher = new SignalDispatcher(),
    dedup = new SignalDeduplicator(),
    cooldown = new SignalCooldown(),
    history = new SignalHistory(),
    resolver = new SignalResolver(),
  ) {
    this.scheduler = scheduler; this.dispatcher = dispatcher;
    this.dedup = dedup; this.cooldown = cooldown;
    this.history = history; this.resolver = resolver;
  }

  async tick(cadence: MonitoringCadence): Promise<{ runs: MonitoringRun[]; signals: BusinessSignal[] }> {
    const runs: MonitoringRun[] = [];
    const emitted: BusinessSignal[] = [];
    for (const job of this.scheduler.list(cadence)) {
      const startedAt = new Date().toISOString();
      let suppressed = 0;
      const input = await job.loader();
      const signals = this.engine.run(input, { cadence });
      for (const s of signals) {
        if (this.cooldown.isCooling(s.organizationId, s.type)) { suppressed++; continue; }
        if (!this.dedup.shouldEmit(s)) { suppressed++; continue; }
        this.cooldown.mark(s.organizationId, s.type);
        this.history.push(s);
        emitted.push(s);
        await this.dispatcher.dispatch(s);
      }
      runs.push({
        id: `run_${job.id}_${Date.now()}`, jobId: job.id, organizationId: job.organizationId,
        startedAt, finishedAt: new Date().toISOString(),
        signalsEmitted: signals.length - suppressed, signalsSuppressed: suppressed,
      });
    }
    return { runs, signals: emitted };
  }
}

export const monitoringEngine = new MonitoringEngine();
