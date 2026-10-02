import { Injectable } from "@nestjs/common"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { PushOrderStatusParams } from "./order-status.contracts"
import { orderStatusTopic } from "./order-status.policy"

/** The inbox source of the status events this service pushes. */
const STATUS_SOURCE = "order-status-push"

@Injectable()
/**
 * The push of an order status to its buyer. It writes no domain state: it claims the delivered event in the inbox first, so a
 * redelivery pushes nothing twice, then builds the topic of the order owner with the same function the realtime door
 * subscribes with and hands one frame to the hub, so only the buyer's own subscriptions receive it.
 */
export class OrderStatusService {
    constructor(
        @InjectInbox() private readonly inbox: Inbox,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
    ) {}

    /** Pushes one status change to the channel of the order's buyer, once per delivered event. */
    async push(params: PushOrderStatusParams): Promise<void> {
        if (!(await this.inbox.claim(STATUS_SOURCE, params.eventId))) return
        this.hub.publish(orderStatusTopic(params.personId, params.orderId), {
            orderId: params.orderId,
            status: params.status,
            changedAt: params.changedAt,
        })
    }
}
