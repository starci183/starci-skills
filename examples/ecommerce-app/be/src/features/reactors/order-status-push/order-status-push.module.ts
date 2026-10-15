import { Module } from "@nestjs/common"
import { PushOrderStatusHandler } from "./application/push-order-status.handler"
import { ConfigurableModuleClass } from "./order-status-push.module-definition"

@Module({ providers: [PushOrderStatusHandler] })
/** The order-status-push reactor: pushes each status change of an order to the realtime channel of its buyer. */
export class OrderStatusPushModule extends ConfigurableModuleClass {}
