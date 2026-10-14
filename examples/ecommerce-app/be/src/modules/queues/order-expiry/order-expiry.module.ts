import { Module } from "@nestjs/common"
import { OrderExpiryQueue } from "./order-expiry.queue"

@Module({ providers: [OrderExpiryQueue], exports: [OrderExpiryQueue] })
/** The typed producer of an order-expiry job. */
export class OrderExpiryModule {}
