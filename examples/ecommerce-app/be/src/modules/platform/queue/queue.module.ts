import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Queue, Worker } from "bullmq"
import type { EntityManager } from "typeorm"
import { QUEUE_FACTORY, QUEUE_OUTBOX, QUEUE_RELAY_MANAGERS, QUEUE_TRANSPORT, QUEUE_WORKER_REGISTRY } from "./queue.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./queue.module-definition"
import { BullmqQueueTransportClient } from "./bullmq-queue-transport.client"
import type { BullmqConnection, BullmqJob, BullmqQueue, BullmqWorker, BullmqWorkerOptions } from "./queue-transport.port"
import { QueueOutboxService } from "./queue-outbox.service"
import { QueueRelayService } from "./queue-relay.service"
import { QueueWorkerService } from "./queue-worker.service"

@Module({})
/** The queues of a service: the outbox writer, its relay into BullMQ, the workers and the schedulers, registered once per app over the connections that hold an outbox. */
export class QueueModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that enqueues or processes jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: QUEUE_RELAY_MANAGERS,
                    useFactory: (...managers: Array<EntityManager>) => managers,
                    inject: [...options.connections],
                },
                {
                    provide: QUEUE_FACTORY,
                    useValue: {
                        queue: (name: string, options: BullmqConnection): BullmqQueue => new Queue(name, options),
                        worker: (name: string, processor: (job: BullmqJob) => Promise<void>, options: BullmqWorkerOptions): BullmqWorker =>
                            new Worker<object>(name, processor, options),
                    },
                },
                BullmqQueueTransportClient,
                { provide: QUEUE_TRANSPORT, useExisting: BullmqQueueTransportClient },
                QueueOutboxService,
                QueueRelayService,
                QueueWorkerService,
                { provide: QUEUE_OUTBOX, useExisting: QueueOutboxService },
                { provide: QUEUE_WORKER_REGISTRY, useExisting: QueueWorkerService },
            ],
            exports: [QUEUE_OUTBOX, QUEUE_WORKER_REGISTRY, QUEUE_TRANSPORT],
        }
    }
}
