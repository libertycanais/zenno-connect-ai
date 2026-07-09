import type { KnowledgeModule } from "../types";
export const benchmarksKnowledge: KnowledgeModule = {
  domain: "benchmarks", version: "1.0.0", rules: [
    { id: "bench.use_p50", domain: "benchmarks", title: "Comparar com p50",
      description: "Métricas de campanha devem sempre ser comparadas com benchmark.p50 da categoria.",
      when: [], recommend: ["comparar_com_benchmark"],
      severity: "info", references: [], version: "1.0.0" },
  ],
};
