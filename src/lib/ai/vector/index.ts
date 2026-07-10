// EPIC I — Vector Ready adapters (interfaces only; no external vector DB integration).
export type Vector = number[];

export interface EmbeddingProvider {
  readonly name: string;
  readonly dims: number;
  readonly version: string;
  embed(text: string): Promise<Vector>;
  embedBatch(texts: string[]): Promise<Vector[]>;
}

export interface IndexProvider {
  readonly name: string;
  upsert(id: string, vector: Vector, metadata?: Record<string, unknown>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface Retriever {
  readonly name: string;
  search(query: Vector, opts: { organizationId: string; topK: number; filter?: Record<string, unknown> }): Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>;
}

export interface VectorProvider {
  embedding: EmbeddingProvider;
  index: IndexProvider;
  retriever: Retriever;
}

/** Null implementation — safe default before real vector DB is plugged. */
export class NullVectorProvider implements VectorProvider {
  embedding: EmbeddingProvider = {
    name: "none", dims: 0, version: "0",
    async embed(): Promise<Vector> { return []; },
    async embedBatch(t: string[]): Promise<Vector[]> { return t.map(() => []); },
  };
  index: IndexProvider = {
    name: "none",
    async upsert(): Promise<void> { /* noop */ },
    async delete(): Promise<void> { /* noop */ },
  };
  retriever: Retriever = {
    name: "none",
    async search(): Promise<Array<{ id: string; score: number }>> { return []; },
  };
}

export const nullVectorProvider = new NullVectorProvider();
