// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import type { EntityManager } from "typeorm"
//   import { OrderPlacedEvent } from "@modules/events/order"
//   import { InjectOrderEntityManager } from "@modules/platform/database"
//   import { InjectEventBus } from "@modules/platform/event-bus"
//   import type { EventBus } from "@modules/platform/event-bus"
//   import { OrderEntity } from "./persistence/entities/order.entity"

@Injectable()
/** A domain service: the order and its event commit together or not at all. */
export class OrderService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly eventBus: EventBus,
    ) {}

    /** Places the order and announces it to the other contexts. */
    async place(order: OrderEntity): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.save(order)
            // The outbox row is written through `manager`: it exists exactly when the order commits.
            await this.eventBus.publish(OrderPlacedEvent.create({ orderId: order.id, personId: order.personId, totalMinorUnits: order.total }), manager)
        })
    }
}
