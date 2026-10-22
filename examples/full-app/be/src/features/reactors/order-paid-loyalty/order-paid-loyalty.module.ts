import { Module } from "@nestjs/common"
import { GrantLoyaltyPointsHandler } from "./application/grant-loyalty-points.handler"
import { ConfigurableModuleClass } from "./order-paid-loyalty.module-definition"

@Module({ providers: [GrantLoyaltyPointsHandler] })
/** The order-paid-loyalty reactor: grants the loyalty points a paid order earns. */
export class OrderPaidLoyaltyModule extends ConfigurableModuleClass {}
