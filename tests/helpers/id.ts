/**
 * Gerador de ids determinísticos para fixtures.
 * Não substitui gen_random_uuid() em produção — uso APENAS em testes.
 */
let counter = 0;

export function resetIdCounter(): void {
  counter = 0;
}

export function nextId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${counter.toString().padStart(6, "0")}`;
}

export function uuid(seed?: string): string {
  // v4-like determinístico para testes; NUNCA use em produção.
  const base = seed ?? nextId("uuid");
  const hex = Array.from(base)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .padEnd(32, "0")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
