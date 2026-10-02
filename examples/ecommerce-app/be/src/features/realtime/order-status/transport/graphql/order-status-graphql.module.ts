import { Module } from "@nestjs/common"
import { OrderStatusSubscription } from "./order-status.subscription"

@Module({ providers: [OrderStatusSubscription] })
/** The GraphQL transport of the order status channel: its subscription door; the hub comes from the app's realtime capability. */
export class OrderStatusGraphqlModule {}
