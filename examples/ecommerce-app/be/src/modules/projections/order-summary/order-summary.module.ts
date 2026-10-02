import { Module } from "@nestjs/common"
import { OrderSummaryProjection } from "./order-summary.projection"

@Module({ providers: [OrderSummaryProjection], exports: [OrderSummaryProjection] })
/** The order-summary projection over the order database; its table is created by the migrations the app registers. */
export class OrderSummaryModule {}
