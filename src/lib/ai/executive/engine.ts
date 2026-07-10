// EPIC I — Executive Engine
// Orquestra: consensus + report + score. Reutiliza infra dos Epics anteriores.
import type { Expert, ExpertRunInput } from "../experts/types";
import { runMultiExpertConsensus } from "./consensus-runner";
import { buildExecutiveReport, type BuildReportOpts } from "./report-builder";
import type { ExecutiveEngineInput, ExecutiveReport } from "./types";

export type ExecutiveEngineRunInput = ExecutiveEngineInput & {
  experts?: Expert[];
  expertRunInput?: ExpertRunInput;
  scoreOpts?: BuildReportOpts;
};

export class ExecutiveEngine {
  run(input: ExecutiveEngineRunInput): ExecutiveReport {
    let consensus = null as ExecutiveReport["consensus"];
    let expertOutputs = input.expertOutputs;
    if (input.experts && input.experts.length > 0 && input.expertRunInput) {
      const res = runMultiExpertConsensus({
        organizationId: input.organizationId,
        topic: input.topic,
        experts: input.experts,
        runInput: input.expertRunInput,
      });
      consensus = res.consensus;
      expertOutputs = [...expertOutputs, ...res.expertOutputs];
    }
    return buildExecutiveReport(
      { ...input, expertOutputs },
      { ...(input.scoreOpts ?? {}), consensus },
    );
  }
}

export const executiveEngine = new ExecutiveEngine();
