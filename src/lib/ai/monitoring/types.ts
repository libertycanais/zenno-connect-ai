// Monitoring Engine — Contracts
import type { BusinessSignal, SignalDetectorInput } from "../signals/types";

export type MonitoringCadence = "hourly" | "daily" | "weekly" | "monthly";

export type MonitoringJob = {
  id: string;
  organizationId: string;
  cadence: MonitoringCadence;
  loader: () => Promise<SignalDetectorInput> | SignalDetectorInput;
  enabled: boolean;
};

export type MonitoringRun = {
  id: string;
  jobId: string;
  organizationId: string;
  startedAt: string;
  finishedAt: string;
  signalsEmitted: number;
  signalsSuppressed: number;
};

export type SignalHistoryEntry = {
  signal: BusinessSignal;
  emittedAt: string;
};

export type DispatchTarget = {
  expert: BusinessSignal["recommendedExperts"][number];
  signal: BusinessSignal;
};
