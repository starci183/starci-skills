import { Injectable, Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectQueueWorkerRegistry } from "@modules/platform/queue"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { PROBE_QUEUE } from "../fixtures/queues/probe.queue"

@Injectable()
/** What the probe worker saw: every delivery in arrival order. */
export class ProbeQueueBehavior {
    /** The deliveries the worker handled. */
    readonly deliveries: Array<QueueDelivery> = []
}

@Module({ providers: [ProbeQueueBehavior], exports: [ProbeQueueBehavior] })
/** Registers the handler of the probe queue the way a feature module does: it records each delivery. */
export class ProbeQueueModule implements OnModuleInit {
    constructor(
        @InjectQueueWorkerRegistry() private readonly registry: QueueWorkerRegistry,
        private readonly behavior: ProbeQueueBehavior,
    ) {}

    /** Hands the handler to the registry. */
    onModuleInit(): void {
        this.registry.add(PROBE_QUEUE, (delivery) => {
            this.behavior.deliveries.push(delivery)
            return Promise.resolve()
        })
    }
}
