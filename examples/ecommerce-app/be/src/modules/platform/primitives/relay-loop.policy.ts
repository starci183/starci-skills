import type { Logger } from "@modules/platform/logging"

/** What a relay loop runs over and how it paces itself. */
export interface RelayLoopParams<Manager> {
    /** The managers of the connections that hold an outbox; one pass visits each. */
    readonly managers: ReadonlyArray<Manager>
    /** Relays the oldest waiting rows of one connection and answers how many it handled. */
    readonly relayOf: (manager: Manager) => Promise<number>
    /** Where a failed pass is logged. */
    readonly logger: Logger
    /** The log event of a failed pass. */
    readonly failure: string
    /** Pauses the loop for the given milliseconds. */
    readonly wait: (ms: number) => Promise<void>
    /** The pause after a pass that handled nothing, in milliseconds. */
    readonly idleMs: number
}

/** A relay loop: one pass on demand, and a loop that runs passes from `start` to `stop`. */
export interface RelayLoop {
    /** One pass over every connection; answers how many rows it handled. */
    relay(): Promise<number>
    /** Starts the loop. */
    start(): void
    /** Stops the loop and waits for its last pass. */
    stop(): Promise<void>
}

/** Builds the loop the two outbox relays share: it pauses only after a pass that handled nothing, and a failed pass is logged and counts as idle. */
export const relayLoopOf = <Manager>(params: RelayLoopParams<Manager>): RelayLoop => {
    let running = false
    let loop: Promise<void> = Promise.resolve()
    const relay = async (): Promise<number> => {
        let handled = 0
        for (const manager of params.managers) handled += await params.relayOf(manager)
        return handled
    }
    const run = async (): Promise<void> => {
        while (running) {
            const handled = await relay().catch((cause: unknown) => {
                params.logger.error(params.failure, cause)
                return 0
            })
            if (handled === 0 && running) await params.wait(params.idleMs)
        }
    }
    return {
        relay,
        start: () => {
            running = true
            loop = run()
        },
        stop: async () => {
            running = false
            await loop
        },
    }
}
