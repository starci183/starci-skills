import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueHandler } from "./queue.contracts"
import { InjectQueueOptions, InjectQueueTransport } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import type { QueueWorkerRegistry } from "./queue.port"
import type { QueueTransport } from "./queue-transport.port"

@Injectable()
/**
 * The consuming side of the queues: the registry the processors fill, and the workers and schedulers started when the app has
 * registered every handler. A scheduler that cannot be registered is logged and does not stop the app: the next boot upserts it again.
 */
export class QueueWorkerService implements QueueWorkerRegistry, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly handlers = new Map<string, QueueHandler>()

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the handler of the queue; a second handler for the same queue replaces the first. */
    add(queue: string, handler: QueueHandler): void {
        this.handlers.set(queue, handler)
    }

    /** Starts one worker per registered queue, then registers the schedulers of the options. */
    async onApplicationBootstrap(): Promise<void> {
        for (const [queue, handler] of this.handlers) await this.transport.work(queue, handler, this.options.concurrency)
        for (const scheduler of this.options.schedulers) {
            await this.transport.upsertScheduler(scheduler).catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.SchedulerFailed, cause, { scheduler: scheduler.id })
            })
        }
    }

    /** Closes the workers and the queues. */
    async onApplicationShutdown(): Promise<void> {
        await this.transport.close()
    }
}
