// EPIC K — Global Search with Explainability
import type {
  SearchExplanation, SearchModule, SearchQuery, SearchResult,
} from "./types";

export type SearchModuleFn = (
  text: string,
  organizationId: string,
  filters: Record<string, unknown>,
) => Promise<SearchResult[]>;

export type SearchExecution = {
  results: SearchResult[];
  explanation: SearchExplanation;
};

export class GlobalSearchEngine {
  private modules = new Map<SearchModule, SearchModuleFn>();

  register(module: SearchModule, fn: SearchModuleFn): void {
    this.modules.set(module, fn);
  }

  unregister(module: SearchModule): void { this.modules.delete(module); }

  registered(): SearchModule[] { return [...this.modules.keys()]; }

  async search(q: SearchQuery): Promise<SearchExecution> {
    const started = Date.now();
    const requested: SearchModule[] = q.modules ?? [...this.modules.keys()];
    const consulted: SearchModule[] = [];
    const ignored: SearchModule[] = [];
    const results: SearchResult[] = [];

    await Promise.all(requested.map(async (m) => {
      const fn = this.modules.get(m);
      if (!fn) { ignored.push(m); return; }
      consulted.push(m);
      try {
        const r = await fn(q.text, q.organizationId, q.filters ?? {});
        results.push(...r);
      } catch {
        ignored.push(m);
      }
    }));

    results.sort((a, b) => b.score - a.score);

    return {
      results,
      explanation: {
        consultedModules: consulted,
        ignoredModules: ignored,
        filtersApplied: q.filters ?? {},
        responseTimeMs: Date.now() - started,
        resultCount: results.length,
      },
    };
  }
}
