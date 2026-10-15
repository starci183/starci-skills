import { Module } from "@nestjs/common"
import { RecomputeOrderSummaryHandler } from "./application/recompute-order-summary.handler"
import { ConfigurableModuleClass } from "./order-summary-projection.module-definition"

@Module({ providers: [RecomputeOrderSummaryHandler] })
/** The order-summary-projection reactor: keeps the order summary read model current by recomputing it whenever an order is placed, paid or expired. */
export class OrderSummaryProjectionModule extends ConfigurableModuleClass {}
