import { describe, it } from "vitest";
import { Route } from "@/routes/api/public/live";
describe("__probe__", () => {
  it("shape", () => {
    // eslint-disable-next-line no-console
    console.log("KEYS", Object.keys(Route));
    // @ts-expect-error probe
    console.log("OPT", Object.keys(Route.options ?? {}));
    // @ts-expect-error probe
    console.log("SERVER", JSON.stringify(Object.keys(Route.options?.server ?? Route.server ?? {})));
    // @ts-expect-error probe
    console.log("HANDLERS", Object.keys(Route.options?.server?.handlers ?? Route.server?.handlers ?? {}));
  });
});
