// FEATURE — Marketing Intelligence Experience · In-memory typed event bus (additive)
// Zero external deps. Safe for edge runtime. Listeners are best-effort; errors are swallowed
// so a broken subscriber never breaks the sync pipeline.
import type { MarketingEvent, MarketingEventMap, MarketingEventName } from "./events";

type Handler<K extends MarketingEventName> = (event: MarketingEvent<K>) => void | Promise<void>;

const handlers = new Map<MarketingEventName, Set<Handler<MarketingEventName>>>();

export function on<K extends MarketingEventName>(name: K, handler: Handler<K>): () => void {
  const set = handlers.get(name) ?? new Set();
  set.add(handler as Handler<MarketingEventName>);
  handlers.set(name, set);
  return () => set.delete(handler as Handler<MarketingEventName>);
}

export function emit<K extends MarketingEventName>(
  name: K,
  payload: MarketingEventMap[K],
): MarketingEvent<K> {
  const base = { ...payload, at: (payload as { at?: string }).at ?? new Date().toISOString() };
  const event = { name, ...base } as unknown as MarketingEvent<K>;
  const set = handlers.get(name);
  if (set) {
    for (const h of set) {
      try {
        void h(event);
      } catch {
        /* swallow: subscribers must never break the pipeline */
      }
    }
  }
  return event;
}

export function clearAllListeners(): void {
  handlers.clear();
}

export function listenerCount(name?: MarketingEventName): number {
  if (name) return handlers.get(name)?.size ?? 0;
  let n = 0;
  for (const s of handlers.values()) n += s.size;
  return n;
}
