import { Args, Resolver, Subscription } from "@nestjs/graphql"
import { CurrentPrincipal, Roles } from "@modules/domain/identity"
import { orderStatusTopic } from "@modules/domain/order"
import type { OrderStatusFrame } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusChangedType } from "./dto/order-status-changed.type"
import { OrderStatusInput } from "./dto/order-status.input"

@Resolver()
/** The push door of one buyer's order status: it subscribes the client to the order's topic of the hub and writes nothing. */
export class OrderStatusSubscription {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /** The status changes of the caller's order, pushed as they happen; the topic is built from the principal, so another buyer receives nothing. */
    @Subscription(() => OrderStatusChangedType, {
        name: "orderStatusChanged",
        resolve: (frame: OrderStatusFrame): OrderStatusChangedType => frame,
    })
    @Roles("member")
    orderStatusChanged(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: OrderStatusInput,
    ): AsyncIterable<OrderStatusFrame> {
        return this.hub.subscribe(orderStatusTopic(principal.id, input.orderId))
    }
}
