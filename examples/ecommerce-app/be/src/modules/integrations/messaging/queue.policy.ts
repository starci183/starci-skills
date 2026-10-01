import type { QueueDefinition } from "./messaging.contracts"

/** Declares the queue of a consumer: its spec and how a stored payload is read back. */
export const defineQueue = <Payload extends object>(definition: QueueDefinition<Payload>): QueueDefinition<Payload> =>
    definition
