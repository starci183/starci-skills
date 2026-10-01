import { Module } from "@nestjs/common"
import { CancelOrderHandler } from "./application/cancel-order.handler"

@Module({ providers: [CancelOrderHandler] })
/** The cancellation feature: the handler that compensates an order whose invoice was rejected. */
export class CancellationModule {}
