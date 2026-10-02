import { Module } from "@nestjs/common"
import { GrantLoyaltyPointsHandler } from "./application/grant-loyalty-points.handler"

@Module({ providers: [GrantLoyaltyPointsHandler] })
/** The order-paid-loyalty reactor: grants the loyalty points a paid order earns. */
export class OrderPaidLoyaltyModule {}
