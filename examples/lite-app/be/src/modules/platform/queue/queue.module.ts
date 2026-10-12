import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { QUEUE_OUTBOX, QUEUE_RELAY_MANAGERS, QUEUE_TRANSPORT, QUEUE_WORKER_REGISTRY } from "./queue.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./queue.module-definition"
import { PgmqQueueTransportClient } from "./pgmq-queue-transport.client"
import { QueueOutboxService } from "./queue-outbox.service"
import { QueueRelayService } from "./queue-relay.service"
import { QueueWorkerService } from "./queue-worker.service"

@Module({})
/** The queues of an app over Supabase Queues (pgmq): the outbox writer, its relay, the workers and the schedulers, registered once per app over the connections that hold an outbox. */
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
                PgmqQueueTransportClient,
                { provide: QUEUE_TRANSPORT, useExisting: PgmqQueueTransportClient },
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
