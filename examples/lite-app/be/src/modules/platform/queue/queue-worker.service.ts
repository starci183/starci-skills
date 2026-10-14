import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { QueueHandler } from "./queue.contracts"
import { InjectQueueOptions, InjectQueueTransport } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import type { QueueWorkerRegistry } from "./queue.port"
import type { QueueTransport } from "./queue-transport.port"

@Injectable()
/**
 * The consuming side of the queues: the registry the processors fill, and the workers started when the app has registered
 * every handler. Recurring jobs are owned by the migrations: a pg_cron tick is declared with the queue it feeds, so the
 * deployment does not depend on which replica booted first.
 */
export class QueueWorkerService implements QueueWorkerRegistry, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly handlers = new Map<string, QueueHandler>()

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueTransport() private readonly transport: QueueTransport,
    ) {}

    /** Registers the handler under the queue it names; a second handler for the same queue replaces the first. */
    add(handler: QueueHandler): void {
        this.handlers.set(handler.queue, handler)
    }

    /** Starts one worker per registered queue. */
    async onApplicationBootstrap(): Promise<void> {
        await eachInOrder([...this.handlers.values()], (handler) =>
            this.transport.work(handler, this.options.concurrency),
        )
    }

    /** Stops the workers and waits for the deliveries they run. */
    async onApplicationShutdown(): Promise<void> {
        await this.transport.close()
    }
}
