import type { ModuleMetadata } from "@nestjs/common"
import { ExpireOrdersQueueModule } from "@features/jobs/expire-orders"
import { SendReceiptQueueModule } from "@features/jobs/send-receipt"
import { OrderPaidLoyaltyMessageModule } from "@features/reactors/order-paid-loyalty"
import { OrderPaymentStatusMessageModule } from "@features/reactors/order-payment-status"
import { OrderStatusPushMessageModule } from "@features/reactors/order-status-push"
import { OrderSummaryProjectionMessageModule } from "@features/reactors/order-summary-projection"
import { PlaceOrderMessageModule } from "@features/saga/place-order"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { EventBusModule } from "@modules/platform/event-bus"
import { InboxModule } from "@modules/platform/inbox"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule } from "@modules/platform/queue"
import { SagaModule } from "@modules/platform/saga"
import { orderExpirySchedulerOf } from "@modules/queues/order-expiry"
import type { OrderAppOptions } from "../order.options"

/**
 * The background area of the order api: the event bus with its inbox, the saga store, the queue with its schedulers and
 * the fenced jobs, and the message and queue doors that run on them (the place-order saga, the reactors and projection of
 * the order events, the expiry and receipt jobs). A composition group holds one area's module list and nothing else;
 * `app.module.ts` spreads it.
 */
export const backgroundModules = (options: OrderAppOptions): NonNullable<ModuleMetadata["imports"]> => [
    EventBusModule.register({ isGlobal: true, ...options.eventBus, connections: [ORDER_ENTITY_MANAGER] }),
    InboxModule.register({ isGlobal: true, connection: ORDER_ENTITY_MANAGER }),
    SagaModule.register({ isGlobal: true }),
    QueueModule.register({
        isGlobal: true,
        ...options.queue,
        connections: [ORDER_ENTITY_MANAGER],
        schedulers: [orderExpirySchedulerOf(options.orderExpiry)],
    }),
    JobsModule.register({ isGlobal: true, ...options.jobs, connection: ORDER_ENTITY_MANAGER }),
    PlaceOrderMessageModule,
    OrderPaymentStatusMessageModule,
    OrderPaidLoyaltyMessageModule,
    OrderStatusPushMessageModule,
    OrderSummaryProjectionMessageModule,
    ExpireOrdersQueueModule,
    SendReceiptQueueModule,
]
