import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { OrderExpiryQueue } from "@modules/queues/order-expiry"
import { InjectOrderExpiryTicksOptions } from "./order-expiry-ticks.decorators"
import type { OrderExpiryTicksOptions } from "./order-expiry-ticks.options"

@Injectable()
/** Enqueues one manual expiry tick; the running order app owns the expiry work and delivery. */
export class OrderExpiryTicksService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: OrderExpiryQueue,
        @InjectOrderExpiryTicksOptions() private readonly options: OrderExpiryTicksOptions,
    ) {}

    /** Commits the same typed payload as the scheduler to the order database's queue outbox. */
    async enqueueTick(): Promise<void> {
        await this.entityManager.transaction((tx) =>
            this.queue.enqueueExpireOrders({ olderThanMs: this.options.olderThanMs }, tx),
        )
    }
}
