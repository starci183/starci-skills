import { Module } from "@nestjs/common"
import { OrderStatusSubscription } from "./order-status.subscription"

@Module({ providers: [OrderStatusSubscription] })
/** The realtime door of the order status channel; the hub comes from the app's realtime capability. */
export class OrderStatusRealtimeModule {}
