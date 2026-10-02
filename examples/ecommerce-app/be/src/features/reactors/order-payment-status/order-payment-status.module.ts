import { Module } from "@nestjs/common"
import { RecordOrderPaymentHandler } from "./application/record-order-payment.handler"

@Module({ providers: [RecordOrderPaymentHandler] })
/** The order-payment-status reactor: order keeps its local copy of what billing announced about the payment of an order. */
export class OrderPaymentStatusModule {}
