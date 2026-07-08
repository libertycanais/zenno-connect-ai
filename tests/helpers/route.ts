/**
 * Helpers para invocar handlers de TSS server routes em testes.
 * Compatível com o shape atual:
 *   Route.options.server.handlers[METHOD]({ request, params })
 */
// Route é intencionalmente `unknown` — tipagem interna do TanStack Router é
// muito específica para descrever aqui; o teste sabe qual método existe.
export async function invokeHandler(
  route: unknown,
  method: string,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  const r = route as {
    options?: {
      server?: {
        handlers?: Record<
          string,
          (ctx: { request: Request; params?: Record<string, string> }) =>
            | Promise<Response>
            | Response
        >;
      };
    };
  };
  const handler = r.options?.server?.handlers?.[method];
  if (!handler) throw new Error(`Route has no ${method} handler`);
  return await handler({ request, params });
}
