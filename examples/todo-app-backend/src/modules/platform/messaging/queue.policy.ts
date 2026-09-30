import type { QueueDefinition } from "./messaging.contracts"

/** Declares a queue; the owning capability exports the result and both its producers and its consumer use it. */
export const defineQueue = <Payload extends object>(definition: QueueDefinition<Payload>): QueueDefinition<Payload> =>
    definition

/** The pause before the next delivery after `attempt` deliveries failed: the base backoff doubled per earlier failure. */
export const backoffDelayMs = (queue: Pick<QueueDefinition<object>, "backoffMs">, attempt: number): number =>
    queue.backoffMs * 2 ** Math.max(0, attempt - 1)
