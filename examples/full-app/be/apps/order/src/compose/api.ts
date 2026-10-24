import type { DynamicModule, Type } from "@nestjs/common"
import { CheckoutGraphqlModule, CheckoutHttpModule } from "@features/api/checkout"
import { HealthHttpModule } from "@features/api/health"
import { OrderStatusGraphqlModule } from "@features/realtime/order-status"

/** The order request doors expose health, checkout, the versioned operation route and live order status. */
export const apiModules = (): Array<DynamicModule | Type<unknown>> => [
    HealthHttpModule.register({}),
    CheckoutGraphqlModule.register({}),
    CheckoutHttpModule.register({}),
    OrderStatusGraphqlModule.register({}),
]
