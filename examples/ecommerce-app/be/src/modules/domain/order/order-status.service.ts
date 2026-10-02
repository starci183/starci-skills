import { Injectable } from "@nestjs/common"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { PushOrderStatusParams } from "./order-status.contracts"
import { orderStatusTopic } from "./order-status.policy"

@Injectable()
/**
 * The push of an order status to its buyer. It writes nothing: it builds the topic of the order owner with the same function the
 * realtime door subscribes with and hands one frame to the hub, so only the buyer's own subscriptions receive it.
 */
export class OrderStatusService {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /** Pushes one status change to the channel of the order's buyer. */
    push(params: PushOrderStatusParams): void {
        this.hub.publish(orderStatusTopic(params.personId, params.orderId), {
            orderId: params.orderId,
            status: params.status,
            changedAt: params.changedAt,
        })
    }
}
