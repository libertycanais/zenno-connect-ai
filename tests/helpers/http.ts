/**
 * Helpers para construir Request/Response em testes de rotas públicas.
 * Não altera nenhum handler — apenas facilita chamadas.
 */
export function makeRequest(
  url: string,
  init?: RequestInit & { headers?: Record<string, string> },
): Request {
  return new Request(url, init as RequestInit);
}

export function makeJsonRequest(
  url: string,
  body: unknown,
  init?: RequestInit & { headers?: Record<string, string> },
): Request {
  return new Request(url, {
    method: "POST",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
