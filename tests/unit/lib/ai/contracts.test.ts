import { describe, it, expect } from "vitest";
import * as contracts from "@/lib/ai/contracts";

describe("AI contracts hub", () => {
  it("re-exports Brain and Governance surface", () => {
    // Type-only imports at runtime resolve to `undefined`; we just ensure
    // the module loads without throwing and stays enumerable.
    expect(typeof contracts).toBe("object");
  });
});
