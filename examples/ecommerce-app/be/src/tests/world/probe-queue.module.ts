import { Injectable, Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { isRecord } from "@modules/platform/primitives"
import { InjectQueueWorkerRegistry } from "@modules/platform/queue"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { PROBE_QUEUE } from "../fixtures/queues/probe.queue"

/** One delivery the probe worker handled: the BullMQ job id, the note of its payload and which attempt it was. */
export interface ProbeDelivery {
    /** The BullMQ job id. */
    readonly id: string
    /** The note of the payload, or an empty text when the payload carries none. */
    readonly note: string
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}

@Injectable()
/** What the probe worker saw: every delivery in arrival order. */
export class ProbeQueueBehavior {
    /** The deliveries the worker handled. */
    readonly deliveries: Array<ProbeDelivery> = []

    /** The deliveries that carry the note. */
    withNote(note: string): Array<ProbeDelivery> {
        return this.deliveries.filter((delivery) => delivery.note === note)
    }
}

@Injectable()
/** The handler of the probe queue: it records each delivery. */
export class ProbeQueueHandler {
    readonly queue = PROBE_QUEUE

    constructor(private readonly behavior: ProbeQueueBehavior) {}

    /** Records the delivery. */
    handle(delivery: QueueDelivery): Promise<void> {
        const note =
            isRecord(delivery.payload) && typeof delivery.payload.note === "string" ? delivery.payload.note : ""
        this.behavior.deliveries.push({ id: delivery.id, note, attempt: delivery.attempt })
        return Promise.resolve()
    }
}

@Module({ providers: [ProbeQueueBehavior, ProbeQueueHandler], exports: [ProbeQueueBehavior] })
/** Registers the handler of the probe queue the way a feature module does. */
export class ProbeQueueModule implements OnModuleInit {
    constructor(
        @InjectQueueWorkerRegistry() private readonly registry: QueueWorkerRegistry,
        private readonly handler: ProbeQueueHandler,
    ) {}

    /** Hands the handler to the registry. */
    onModuleInit(): void {
        this.registry.add(this.handler)
    }
}
