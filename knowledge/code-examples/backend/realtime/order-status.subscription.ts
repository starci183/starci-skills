import { Args, Resolver, Subscription } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { Principal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusChangedType } from "./dto/order-status-changed.type"

@Resolver()
/** The push door of one buyer's order status: it subscribes the client to a topic of the hub and writes nothing. */
export class OrderStatusSubscription {
    constructor(private readonly hub: RealtimeHub) {}

    /** The topic is built from the principal, so another buyer's client never receives this order's frames. */
    @Subscription(() => OrderStatusChangedType)
    orderStatusChanged(
        @CurrentPrincipal() principal: Principal,
        @Args("orderId") orderId: string,
    ): AsyncIterable<OrderStatusChangedType> {
        return this.hub.subscribe(`order-status:${principal.id}:${orderId}`)
    }
}
