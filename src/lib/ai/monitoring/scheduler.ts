// Signal Scheduler — infra contracts only (no real cron).
import type { MonitoringCadence, MonitoringJob } from "./types";

export class SignalScheduler {
  private jobs = new Map<string, MonitoringJob>();
  register(job: MonitoringJob): void { this.jobs.set(job.id, job); }
  unregister(id: string): void { this.jobs.delete(id); }
  list(cadence?: MonitoringCadence): MonitoringJob[] {
    const all = [...this.jobs.values()].filter(j => j.enabled);
    return cadence ? all.filter(j => j.cadence === cadence) : all;
  }
  enable(id: string, on: boolean): void {
    const j = this.jobs.get(id); if (j) j.enabled = on;
  }
}
