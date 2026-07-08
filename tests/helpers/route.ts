/**
 * Helpers para invocar handlers de TSS server routes em testes.
 * Compatível com o shape atual:
 *   Route.options.server.handlers[METHOD]({ request, params })
 */
export type ServerRoute = {
  options?: {
    server?: {
      handlers?: Record<string, (ctx: { request: Request; params?: Record<string, string> }) => Promise<Response> | Response>;
    };
  };
};

export async function invokeHandler(
  route: ServerRoute,
  method: string,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  const handler = route.options?.server?.handlers?.[method];
  if (!handler) throw new Error(`Route has no ${method} handler`);
  return await handler({ request, params });
}
