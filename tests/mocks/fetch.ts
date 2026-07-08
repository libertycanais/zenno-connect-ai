/**
 * Mock global de fetch — nunca deve haver rede real em testes.
 * Uso:
 *   const fetchMock = installFetchMock();
 *   fetchMock.mockResponse("https://graph.facebook.com/v20.0/me", { id: "1" });
 */
import { vi, type MockInstance } from "vitest";

type Responder = (input: Request) => Response | Promise<Response>;

export type FetchMock = MockInstance<typeof fetch> & {
  mockResponse: (matcher: string | RegExp, body: unknown, init?: ResponseInit) => void;
  mockResponder: (matcher: string | RegExp, responder: Responder) => void;
  routes: Array<{ matcher: string | RegExp; responder: Responder }>;
};

export function installFetchMock(): FetchMock {
  const routes: FetchMock["routes"] = [];

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req =
      input instanceof Request ? input : new Request(String(input), init as RequestInit);
    for (const route of routes) {
      const matches =
        typeof route.matcher === "string"
          ? req.url.includes(route.matcher)
          : route.matcher.test(req.url);
      if (matches) return route.responder(req);
    }
    throw new Error(`[fetch-mock] unmatched request: ${req.method} ${req.url}`);
  };

  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(impl) as unknown as FetchMock;
  spy.routes = routes;
  spy.mockResponse = (matcher, body, init) =>
    routes.push({
      matcher,
      responder: () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
          ...init,
        }),
    });
  spy.mockResponder = (matcher, responder) => routes.push({ matcher, responder });
  return spy;
}
