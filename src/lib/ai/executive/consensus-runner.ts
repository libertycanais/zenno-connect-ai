// EPIC I — Multi-Expert Consensus Runner (execução real, pura)
// Reutiliza weightedMajority (Epic G) e adiciona execução paralela dos Experts.
import type { Expert, ExpertRunInput, ExpertRunOutput } from "../experts/types";
import { weightedMajority, type ConsensusInput, type ConsensusResult } from "../consensus";

export type ConsensusRunnerInput = {
  organizationId: string;
  topic: string;
  experts: Expert[];
  runInput: ExpertRunInput;
  weights?: ConsensusInput["weights"];
};

export type ConsensusRunnerOutput = {
  organizationId: string;
  topic: string;
  expertOutputs: ExpertRunOutput[];
  consensus: ConsensusResult;
  failures: Array<{ expertId: string; error: string }>;
};

export function runMultiExpertConsensus(input: ConsensusRunnerInput): ConsensusRunnerOutput {
  const outputs: ExpertRunOutput[] = [];
  const failures: Array<{ expertId: string; error: string }> = [];
  for (const expert of input.experts) {
    try {
      const out = expert.run(input.runInput);
      if (out.expertId) outputs.push(out);
    } catch (e) {
      failures.push({
        expertId: expert.descriptor?.id ?? "unknown",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const consensus = weightedMajority({
    organizationId: input.organizationId,
    topic: input.topic,
    expertOutputs: outputs,
    weights: input.weights,
  });
  return {
    organizationId: input.organizationId,
    topic: input.topic,
    expertOutputs: outputs,
    consensus,
    failures,
  };
}
